import os
import rasterio
import numpy as np
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def validate_geotiff_directory(directory_path, threshold_valid_pixels=0.25):
    """
    Scans a directory of GeoTIFFs and validates their quality for ROTO training.
    
    Args:
        directory_path (str): Path to the folder containing .tif files.
        threshold_valid_pixels (float): Minimum ratio of non-zero/non-NaN pixels required (Recommended: 0.25).
    """
    logger.info(f"🔍 Starting validation for: {directory_path}")
    
    files = [f for f in os.listdir(directory_path) if f.endswith(('.tif', '.tiff'))]
    total_files = len(files)
    invalid_files = []

    if total_files == 0:
        logger.warning("⚠️ No GeoTIFF files found in the directory.")
        return

    for filename in files:
        file_path = os.path.join(directory_path, filename)
        try:
            with rasterio.open(file_path) as src:
                data = src.read()
                
                # 1. Check for NaNs
                nan_count = np.isnan(data).sum()
                
                # 2. Check for Zero-Value Pixels (GEE Masks often result in 0)
                zero_count = (data == 0).sum()
                
                total_pixels = data.size
                valid_pixel_ratio = (total_pixels - (nan_count + zero_count)) / total_pixels
                
                # 3. Validation Logic
                if valid_pixel_ratio < threshold_valid_pixels:
                    logger.error(f"❌ {filename} FAILED: Only {valid_pixel_ratio:.2%} valid data.")
                    invalid_files.append(filename)
                else:
                    logger.info(f"✅ {filename} PASSED: {valid_pixel_ratio:.2%} valid data.")
                    
        except Exception as e:
            logger.error(f"⚠️ Error reading {filename}: {e}")
            invalid_files.append(filename)

    # Summary
    logger.info("-" * 30)
    logger.info(f"Validation Summary:")
    logger.info(f"Total Scanned: {total_files}")
    logger.info(f"Passed: {total_files - len(invalid_files)}")
    logger.info(f"Failed: {len(invalid_files)}")
    
    if invalid_files:
        logger.warning(f"Note: Consider removing or re-exporting failed files.")

if __name__ == "__main__":
    # Example usage: target the default export folder
    target_dir = os.path.join(os.getcwd(), 'CornYieldData_Iowa_2023')
    if os.path.exists(target_dir):
        validate_geotiff_directory(target_dir)
    else:
        logger.error(f"Folder not found: {target_dir}")
