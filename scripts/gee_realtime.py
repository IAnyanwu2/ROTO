import ee
import numpy as np
import requests
import io

def init_gee(project_id):
    try:
        ee.Initialize(project=project_id)
        print("GEE Real-Time Engine Initialized.")
    except Exception:
        print("Authenticating GEE for Real-Time Access...")
        ee.Authenticate()
        ee.Initialize(project=project_id)

def get_realtime_corn_patch(lat, lon, year=2023):
    """
    Fetches the 6-month temporal satellite data block (4 channels)
    for a specific lat/lon coordinate instantly via HTTP.
    """
    point = ee.Geometry.Point([lon, lat])
    
    # Create a 320x320 meter box around the click
    region = point.buffer(160).bounds()
    
    def mask_s2_clouds(image):
        qa = image.select('QA60')
        cloud_bit = 1 << 10
        cirrus_bit = 1 << 11
        mask = qa.bitwiseAnd(cloud_bit).eq(0).And(qa.bitwiseAnd(cirrus_bit).eq(0))
        scl = image.select('SCL')
        scl_mask = scl.gte(4).And(scl.lte(7))
        return image.updateMask(mask).updateMask(scl_mask)
        
    def get_monthly_composite(month):
        start = ee.Date.fromYMD(year, month, 1)
        end = start.advance(1, 'month')
        
        col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(region).filterDate(start, end) \
            .map(mask_s2_clouds) \
            .select(['B4', 'B3', 'B2', 'B8'])
            
        composite = col.median()
        
        # 15-Day Momentum Interoplation
        prev_momentum = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(region).filterDate(start.advance(-15, 'day'), start) \
            .map(mask_s2_clouds).median()
            
        next_momentum = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(region).filterDate(end, end.advance(15, 'day')) \
            .map(mask_s2_clouds).median()
            
        synthetic = ee.Image.cat([prev_momentum, next_momentum]).reduce(ee.Reducer.mean())
        final_image = composite.unmask(synthetic).toFloat()
        
        return final_image
        
    # Stack months May (5) to October (10)
    stacked_image = ee.Image.cat([get_monthly_composite(m) for m in range(5, 11)])
    
    try:
        # Instead of Export to Drive, generate an instantaneous NPY download URL!
        url = stacked_image.getDownloadURL({
            'scale': 10,
            'region': region,
            'format': 'NPY'
        })
        
        # Fetch the array straight into RAM
        response = requests.get(url)
        data = np.load(io.BytesIO(response.content)) 
        
        # Earth Engine returns a structured numpy array where bands are tuple fields.
        # We need to reshape it into our PyTorch format: (6 Months, 4 Channels, H, W)
        h, w = data.shape
        band_names = data.dtype.names
        
        # 7. Reshape logic: NPY returns bands sorted alphabetically (B2, B2_1... B3, B3_1...)
        # We must explicitly map these back to (6 Months, 4 Channels)
        tensor = np.zeros((6, 4, h, w), dtype=np.float32)
        
        # Mapping: 0:Red(B4), 1:Green(B3), 2:Blue(B2), 3:NIR(B8)
        channel_names = ['B4', 'B3', 'B2', 'B8']
        
        for m in range(6):
            for c_idx, c_name in enumerate(channel_names):
                # GEE suffixes are B4, B4_1, B4_2... for stacked images
                suffix = f"_{m}" if m > 0 else ""
                full_name = f"{c_name}{suffix}"
                
                if full_name in band_names:
                    tensor[m, c_idx, :, :] = data[full_name]
                
        # --- Strict Clamping for Model Safety ---
        tensor = np.nan_to_num(tensor, nan=0.0, posinf=0.0, neginf=0.0)
        tensor = np.clip(tensor, 0.0, 10000.0)
        tensor = tensor / 10000.0
        
        return tensor

    except Exception as e:
        print(f"Error fetching real-time GEE data: {e}")
        return None
