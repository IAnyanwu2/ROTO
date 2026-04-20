import torch
import os
import rasterio
import numpy as np
from model_trainer import CornYieldModel, TemporalAttention, CornYieldDataset
from torch.utils.data import DataLoader

def run_inference(data_path, model_spatial, model_temporal):
    # Use the same dataset but turn off augmentation for clean results
    dataset = CornYieldDataset(data_path, augment=False)
    loader = DataLoader(dataset, batch_size=1, shuffle=True)
    
    model_spatial.eval()
    model_temporal.eval()
    
    print(f"🧐 Evaluating Model on {len(dataset)} samples...")
    print(f"{'County':<15} | {'Predicted':<10} | {'Actual':<10} | {'Error':<10}")
    print("-" * 55)
    
    total_error = 0
    with torch.no_grad():
        for i, (images, labels) in enumerate(loader):
            if torch.cuda.is_available():
                images, labels = images.cuda(), labels.cuda()
                
            batch_size, seq_len, c, h, w = images.shape
            x = images.view(batch_size * seq_len, c, h, w)
            features = model_spatial(x).view(batch_size, seq_len, -1)
            prediction, _ = model_temporal(features)
            
            pred = prediction.item()
            actual = labels.item()
            error = pred - actual
            total_error += abs(error)
            
            # Use filename to get county (extracting from the dataset list)
            filename = dataset.files[i]
            county = "Unknown"
            for c_name in ["Boone", "Story", "Woodbury", "Polk", "Jasper", "Union", "Marshall", "Pocahontas"]:
                if c_name in filename:
                    county = c_name
                    break
            
            if i < 15: # Just show the first 15 for a quick check
                print(f"{county:<15} | {pred:<10.2f} | {actual:<10.2f} | {error:<+10.2f}")

    print("-" * 55)
    print(f"🏆 Average Absolute Error: {total_error/len(dataset):.2f} bu/acre")

if __name__ == "__main__":
    # Point to your Drive folder and your trained models
    DATA_PATH = '/content/drive/MyDrive/CornYieldData_Iowa_2023/'
    # Note: In Colab, you would pass your 'trained_spatial' and 'trained_temporal' variables directly.
