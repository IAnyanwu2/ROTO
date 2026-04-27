from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from model_trainer import CornYieldModel, TemporalAttention
from gee_realtime import init_gee, get_realtime_corn_patch
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="ROTO Global Crop Yield API")

# Setup CORS to allow the React Frontend to communicate with this Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    lat: float
    lon: float
    county: str = "Iowa" 
    drought: float = 0.0
    sunlight: float = 1.0
    storm: bool = False

# Load Model Weights globally on server start
spatial_model = None
temporal_model = None
county_benchmarks = {}

@app.on_event("startup")
def load_ai_engine():
    global spatial_model, temporal_model
    project_id = 'project-256c93dd-d7e2-4b19-8d8'
    init_gee(project_id)
    
    print("Starting ROTO AI Backend...")
    try:
        spatial_model = CornYieldModel(pretrained=False)
        temporal_model = TemporalAttention()
        
        # Load weights on the CPU for the API to avoid GPU server requirement
        spatial_model.load_state_dict(torch.load('spatial_model_FINAL.pth', map_location='cpu'))
        temporal_model.load_state_dict(torch.load('temporal_model_FINAL.pth', map_location='cpu'))
        
        spatial_model.eval()
        temporal_model.eval()
        print("AI Models Online.")
        
        # Load County Benchmarks
        import json
        import os
        json_path = 'iowa_county_yields.json'
        if os.path.exists(json_path):
            with open(json_path, 'r') as f:
                global county_benchmarks
                county_benchmarks = json.load(f)
            print(f"Dataset Ready: {len(county_benchmarks)} county benchmarks loaded.")
        else:
            print(f"Warning: {json_path} NOT FOUND! Benchmarking will use defaults.")
            
    except Exception as e:
        print(f"CRITICAL ERROR during startup: {e}")
        print(f"Warning: Could not locate .pth weight files. Make sure they are in the scripts folder! Error: {e}")


@app.post("/api/predict")
async def predict_yield_from_coord(req: PredictionRequest):
    yield_estimate = 0.0
    # 1. Scope Boundary Enforcement
    iowa_bounds = {"lat_min": 40.3, "lat_max": 43.5, "lon_min": -96.6, "lon_max": -90.1}
    
    if not (iowa_bounds["lat_min"] <= req.lat <= iowa_bounds["lat_max"] and 
            iowa_bounds["lon_min"] <= req.lon <= iowa_bounds["lon_max"]):
        return {
            "status": "error",
            "message": "Out of Bounds. The ROTO model is only certified for Iowa, USA.",
            "predicted_yield": 0.0
        }

    # 2. Tornado Disaster Simulation (Zero-out logic)
    if spatial_model is None:
        raise HTTPException(status_code=500, detail="AI weights not loaded.")

    # 2. Pull base array from Google Earth Engine
    tensor = get_realtime_corn_patch(lat=req.lat, lon=req.lon) # Shape: (6, 4, 32, 32)
    
    if tensor is None:
        raise HTTPException(status_code=400, detail="GEE extraction failed.")

    # --- 🎲 SIMULATION ENGINE (SPECTRAL AUGMENTATION) ---
    # Bands: 0:Red, 1:Green, 2:Blue, 3:NIR
    
    # 🌩️ Storm/Tornado: Wipe out September (index 4)
    if req.storm:
        tensor[4, :, :, :] = 0.05 # Low biomass residue
        
    # ☀️ Sunlight: Scale overall brightness
    tensor[:, 0, :, :] *= req.sunlight # Adjust Red
    tensor[:, 3, :, :] *= req.sunlight # Adjust NIR
        
    # 🍂 Drought: Decline NIR towards harvest (Step 3, 4, 5 are July-Oct)
    if req.drought > 0:
        decay = 1.0 - (0.35 * req.drought)
        tensor[3:, 3, :, :] *= decay 
        tensor[3:, 0, :, :] *= (1.0 + 0.1 * req.drought) # Stress-induced redness
        
    # --- 📈 NDVI TIME-SERIES CALCULATION ---
    # Mean NDVI per month: (NIR - Red) / (NIR + Red)
    ndvi_trend = []
    for m in range(6):
        red_mean = tensor[m, 0, :, :].mean()
        nir_mean = tensor[m, 3, :, :].mean()
        ndvi = (nir_mean - red_mean) / (nir_mean + red_mean + 1e-6)
        print(f"DEBUG: Month {m} -> Red: {red_mean:.3f}, NIR: {nir_mean:.3f}, NDVI: {ndvi:.3f}")
        ndvi_trend.append(round(float(ndvi), 4))
        
    # 3. Neural Network Inference
    x = torch.tensor(tensor).unsqueeze(0).float()
    
    with torch.no_grad():
        batch_size, seq_len, c, h, w = x.shape
        x_flat = x.view(batch_size * seq_len, c, h, w)
        features = spatial_model(x_flat).view(batch_size, seq_len, -1)
        prediction, _ = temporal_model(features)
        yield_estimate = prediction.item()
        
    # 4. Benchmarking (Dynamic Lookup)
    county_avg = 201.0
    for ck in county_benchmarks.keys():
        if ck in req.county:
            county_avg = county_benchmarks[ck]
            break

    # 2. Disaster Simulation 
    # (Note: Physical spectral modification happens in the 'Simulation Engine' block above)
    if req.storm:
        return {
            "status": "success",
            "predicted_yield": 0.0,
            "county_actual": float(county_avg),
            "ndvi_trend": [float(n) for n in ndvi_trend],
            "location": f"{req.county} (STORM DAMAGE)",
            "lat": req.lat,
            "lon": req.lon,
            "unit": "bu/acre"
        }

    print(f"Results for {req.county}: AI={yield_estimate:.1f}, Actual={county_avg:.1f}")
    
    return {
        "status": "success",
        "predicted_yield": round(yield_estimate, 1),
        "county_actual": float(county_avg), 
        "ndvi_trend": ndvi_trend,
        "location": f"{req.county} Research Zone",
        "lat": req.lat,
        "lon": req.lon,
        "unit": "bu/acre"
    }

if __name__ == "__main__":
    # When you want to run the server, simply execute `python api.py`
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
