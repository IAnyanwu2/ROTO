import torch
import os
import rasterio
import numpy as np
from model_trainer import CornYieldModel, TemporalAttention, CornYieldDataset, COUNTY_YIELDS_2023
from torch.utils.data import DataLoader

def run_inference(data_path, model_spatial, model_temporal):
    # Use the same dataset but turn off augmentation for clean results
    dataset = CornYieldDataset(data_path, augment=False)
    
    # --- CRITICAL FIX: shuffle=False so filenames match the images perfectly ---
    loader = DataLoader(dataset, batch_size=1, shuffle=False)
    
    model_spatial.eval()
    model_temporal.eval()
    
    print(f"🧐 Evaluating Model on {len(dataset)} samples...")
    print(f"{'County':<18} | {'Predicted':<10} | {'Actual':<10} | {'Error':<10}")
    print("-" * 58)
    
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
            
            # Map the actual filename to the full 20-County Dictionary
            filename = dataset.files[i]
            county = "Unknown"
            for c_key in COUNTY_YIELDS_2023.keys():
                if c_key in filename:
                    county = c_key
                    break
            
            # Just show the first 15 for a quick scorecard check
            if i < 15: 
                print(f"{county:<18} | {pred:<10.2f} | {actual:<10.2f} | {error:<+10.2f}")

    print("-" * 58)
    print(f"🏆 Average Absolute Error: {total_error/len(dataset):.2f} bu/acre")

if __name__ == "__main__":
    print("Launch this script via Colab importing run_inference(), passing your trained models.")
