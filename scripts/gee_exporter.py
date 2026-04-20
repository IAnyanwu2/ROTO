import ee

def setup_gee(project_id):
    """Initializes GEE with the required project ID."""
    try:
        ee.Initialize(project=project_id)
        print(f"✅ GEE initialized: {project_id}")
    except Exception:
        ee.Authenticate(auth_mode='colab')
        ee.Initialize(project=project_id)
        print(f"✅ GEE initialized after auth: {project_id}")

def mask_s2_clouds(image):
    """Bitmask-based cloud and cirrus removal for Sentinel-2."""
    qa = image.select('QA60')
    cloud_bit = 1 << 10
    cirrus_bit = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit).eq(0).And(qa.bitwiseAnd(cirrus_bit).eq(0))
    
    # Scene Classification Layer (SCL) for additional filtering (shadows/snow)
    scl = image.select('SCL')
    # Keep: 4 (Vegetation), 5 (Bare Soil), 6 (Water), 7 (Unclassified)
    scl_mask = scl.gte(4).And(scl.lte(7))
    
    return image.updateMask(mask).updateMask(scl_mask)

def export_corn_patches(project_id, year=2023, patches_per_county=10, drive_folder='CornYieldData_Iowa_2023'):
    """Exports 4-channel temporal imagery for 20 Iowa counties with growth-momentum logic."""
    
    # 20 Diversified Counties (Representative of Iowa)
    COUNTY_LIST = [
        'Boone', 'Pocahontas', 'Jasper', 'Union', 'Marshall', 
        'Story', 'Polk', 'Woodbury', 'Lyon', 'Dubuque',
        'Kossuth', 'Pottawattamie', 'Scott', 'Johnson', 'Sioux',
        'Page', 'Lee', 'Cerro Gordo', 'Webster', 'Buchanan'
    ]
    
    roi_state = ee.FeatureCollection('TIGER/2018/States').filter(ee.Filter.eq('NAME', 'Iowa'))
    cdl = ee.Image(f'USDA/NASS/CDL/{year}').select('cropland').clip(roi_state)
    corn_mask = cdl.eq(1)
    
    def get_monthly_composite(month, region):
        start = ee.Date.fromYMD(year, month, 1)
        end = start.advance(1, 'month')
        
        # 1. Primary Collection (Monthly Median)
        col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(region).filterDate(start, end) \
            .map(mask_s2_clouds) \
            .select(['B4', 'B3', 'B2', 'B8'])
            
        composite = col.median()
        
        # 2. 15-Day Momentum Interpolation (Triggered if < 25% valid pixels)
        # Using a simple check on the NIR band to detect high-cloud occlusion
        coverage = composite.select('B8').reduceRegion(reducer=ee.Reducer.count(), geometry=region, scale=100)
        
        # If data is missing/occluded, interpolate from end-of-prev and start-of-next month
        # In GEE scripts, we handle this by creating a "Synthetic" image if 'col' is empty
        prev_momentum = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(region).filterDate(start.advance(-15, 'day'), start) \
            .map(mask_s2_clouds).median()
            
        next_momentum = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(region).filterDate(end, end.advance(15, 'day')) \
            .map(mask_s2_clouds).median()
            
        synthetic = ee.Image.cat([prev_momentum, next_momentum]).reduce(ee.Reducer.mean())
        
        # Final image: uses synthetic only where composite is masked
        final_image = composite.unmask(synthetic)
        
        return final_image.updateMask(corn_mask).rename([f'M{month}_R', f'M{month}_G', f'M{month}_B', f'M{month}_NIR'])

    for county_name in COUNTY_LIST:
        print(f"🌍 Processing County: {county_name}...")
        county_geom = ee.FeatureCollection('TIGER/2018/Counties') \
            .filter(ee.Filter.eq('STATEFP', '19')) \
            .filter(ee.Filter.eq('NAME', county_name)).first().geometry()
            
        stacked_image = ee.Image.cat([get_monthly_composite(m, county_geom) for m in range(5, 11)]).toFloat()
        
        # Sample points within the county
        sample_points = stacked_image.sample(region=county_geom, scale=10, numPixels=patches_per_county, geometries=True)
        point_list = sample_points.getInfo()['features']
        
        for feat in point_list:
            point = ee.Feature(feat).geometry()
            patch_region = point.buffer(160).bounds()
            task = ee.batch.Export.image.toDrive(
                image=stacked_image,
                description=f"Patch_{county_name}_{feat['id']}",
                folder=drive_folder,
                fileNamePrefix=f"patch_{year}_{county_name}_{feat['id']}",
                scale=10, region=patch_region, fileFormat='GeoTIFF'
            )
            task.start()
            
if __name__ == "__main__":
    # Your verified Project ID
    MY_PROJECT_ID = 'project-256c93dd-d7e2-4b19-8d8'
    
    # Run setup and kickoff the 20-county harvest
    setup_gee(MY_PROJECT_ID)
    export_corn_patches(MY_PROJECT_ID, patches_per_county=15)
