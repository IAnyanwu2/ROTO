import os
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.models as models
import torchvision.transforms as T
from torch.utils.data import Dataset, DataLoader, random_split
import rasterio
import numpy as np
import re

# ==========================================
# 0. RESEARCH DATA: 2023 Iowa County Yields (bu/acre)
# ==========================================
COUNTY_YIELDS_2023 = {
    'Boone': 226.5, 'Pocahontas': 218.1, 'Jasper': 218.0, 
    'Union': 217.0, 'Marshall': 216.3, 'Story': 208.5,
    'Polk': 202.4, 'Webster': 205.1, 'Sioux': 212.8,
    'Lyon': 209.4, 'Kossuth': 198.5, 'Cerro Gordo': 194.2,
    'Pottawattamie': 192.3, 'Page': 185.7, 'Scott': 203.2,
    'Dubuque': 197.8, 'Johnson': 201.5, 'Lee': 189.4,
    'Buchanan': 199.6, 'Woodbury': 182.1
}

# ==========================================
# 1. MODELS (ResNet-18 + Temporal Attention)
# ==========================================
class CornYieldModel(nn.Module):
    def __init__(self, pretrained=True):
        super(CornYieldModel, self).__init__()
        self.backbone = models.resnet18(pretrained=pretrained)
        original_conv = self.backbone.conv1
        self.backbone.conv1 = nn.Conv2d(4, 64, kernel_size=7, stride=2, padding=3, bias=False)
        with torch.no_grad():
            self.backbone.conv1.weight[:, :3, :, :] = original_conv.weight
            self.backbone.conv1.weight[:, 3, :, :] = original_conv.weight.mean(dim=1)
        self.backbone.fc = nn.Identity() 

    def forward(self, x):
        return self.backbone(x)

class TemporalAttention(nn.Module):
    def __init__(self, input_dim=512):
        super(TemporalAttention, self).__init__()
        self.query, self.key, self.value = nn.Linear(input_dim, input_dim), nn.Linear(input_dim, input_dim), nn.Linear(input_dim, input_dim)
        self.softmax = nn.Softmax(dim=1)
        self.regressor = nn.Sequential(nn.Linear(input_dim, 128), nn.ReLU(), nn.Dropout(0.3), nn.Linear(128, 1))

    def forward(self, x):
        q, k, v = self.query(x), self.key(x), self.value(x)
        weights = self.softmax(torch.bmm(q, k.transpose(1, 2)) / (x.size(-1)**0.5))
        return self.regressor(torch.bmm(weights, v).mean(dim=1)), weights

# ==========================================
# 2. DATASET (Loading GeoTIFFs with Interpolation)
# ==========================================
class CornYieldDataset(Dataset):
    def __init__(self, folder_path, augment=True):
        self.folder_path = folder_path
        self.files = [f for f in os.listdir(folder_path) if f.endswith('.tif')]
        self.augment = augment
        self.preprocess = T.Compose([T.CenterCrop(32)])
        self.augmentation = T.Compose([T.RandomHorizontalFlip(), T.RandomVerticalFlip(), T.RandomRotation(90)])

    def __len__(self):
        return len(self.files)

    def _get_yield_label(self, filename):
        """Extracts county name and returns the 2023 yield label."""
        for county in COUNTY_YIELDS_2023.keys():
            if county in filename:
                return COUNTY_YIELDS_2023[county]
        return 201.0  # State Average fallback

    def __getitem__(self, idx):
        file_path = os.path.join(self.folder_path, self.files[idx])
        with rasterio.open(file_path) as src:
            data = src.read().astype(np.float32)
            
        # --- ABSOLUTE SAFETY CLAMP ---
        # 1. Neutralize NaNs and Infinities to 0.0
        data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)
        # 2. Hard clamp satellite reflectance values strictly between 0 and 10000
        data = np.clip(data, 0.0, 10000.0)
        # 3. Normalize to [0, 1] range for Deep Learning
        data = data / 10000.0
        
        # Reshape to (Months, Channels, H, W) -> (6, 4, H, W)
        temporal_tensor = torch.from_numpy(data).view(6, 4, data.shape[1], data.shape[2])
        
        # --- 15-Day Momentum Interpolation (Gap Filling) ---
        for m in range(6):
            if torch.sum(temporal_tensor[m]) == 0:
                # Find nearest neighbors for linear interpolation
                prev_m = m - 1 if m > 0 else None
                next_m = m + 1 if m < 5 else None
                
                if prev_m is not None and next_m is not None:
                    temporal_tensor[m] = (temporal_tensor[prev_m] + temporal_tensor[next_m]) / 2.0
                elif prev_m is not None:
                    temporal_tensor[m] = temporal_tensor[prev_m]
                elif next_m is not None:
                    temporal_tensor[m] = temporal_tensor[next_m]

        temporal_tensor = self.preprocess(temporal_tensor)
        if self.augment:
            temporal_tensor = self.augmentation(temporal_tensor)
            
        label = torch.tensor([self._get_yield_label(self.files[idx])], dtype=torch.float32)
        return temporal_tensor, label

# ==========================================
# 3. TRAINER
# ==========================================
# ==========================================
# 3. TRAINER
# ==========================================
def train_yield_model(folder_path, model_spatial, model_temporal, epochs=300):
    full_dataset = CornYieldDataset(folder_path, augment=True)
    if len(full_dataset) < 5:
        print("⚠️ Dataset too small for 80/20 split. Check folders.")
        return model_spatial, model_temporal
        
    train_size = int(0.8 * len(full_dataset))
    test_size = len(full_dataset) - train_size
    train_data, test_data = random_split(full_dataset, [train_size, test_size])
    train_loader = DataLoader(train_data, batch_size=4, shuffle=True)
    
    criterion = nn.MSELoss()
    params = list(model_spatial.parameters()) + list(model_temporal.parameters())
    optimizer = optim.Adam(params, lr=0.001, weight_decay=1e-4)
    
    # --- NEW: LR Scheduler (Slowing down for precision) ---
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=100, gamma=0.1)
    
    print(f"🚀 Starting Stabilized Training on {len(train_data)} samples...")
    for epoch in range(epochs):
        model_spatial.train()
        model_temporal.train()
        epoch_loss = 0
        for images, labels in train_loader:
            if torch.cuda.is_available():
                images, labels = images.cuda(), labels.cuda()
                
            optimizer.zero_grad()
            batch_size, seq_len, c, h, w = images.shape
            x = images.view(batch_size * seq_len, c, h, w)
            features = model_spatial(x).view(batch_size, seq_len, -1)
            prediction, _ = model_temporal(features)
            loss = criterion(prediction, labels)
            loss.backward()
            
            torch.nn.utils.clip_grad_norm_(params, max_norm=1.0)
            optimizer.step()
            epoch_loss += loss.item()
            
        # Update learning rate
        scheduler.step()
        
        if (epoch+1) % 20 == 0:
            current_lr = optimizer.param_groups[0]['lr']
            print(f"Epoch [{epoch+1}/{epochs}] | Loss: {epoch_loss/len(train_loader):.4f} | LR: {current_lr}")
    return model_spatial, model_temporal

if __name__ == "__main__":
    # --- CONFIGURATION (COLAB READY) ---
    DATA_PATH = '/content/drive/MyDrive/CornYieldData_Iowa_2023/'
    
    model_spatial = CornYieldModel()
    model_temporal = TemporalAttention()

    if torch.cuda.is_available():
        model_spatial = model_spatial.cuda()
        model_temporal = model_temporal.cuda()
        print("⚡ Using GPU (T4/Other) for training.")

    trained_spatial, trained_temporal = train_yield_model(
        folder_path=DATA_PATH,
        model_spatial=model_spatial,
        model_temporal=model_temporal,
        epochs=100 
    )
    print("\n🚀 Training Complete. Weights are now optimized for State-Wide Iowa data.")
