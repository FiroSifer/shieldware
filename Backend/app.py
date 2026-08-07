import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import uvicorn

from model import modelService

import traceback

# Shared global state storing raw metrics and ML predictions
latest_data = {
    "metrics": {},
    "predicted": None,
}

@asynccontextmanager                                                                                  #didnt understand it
async def lifespan(app: FastAPI):
    # Runs once when server starts
    print("Loading ML artifacts into memory...")
    try:
        modelService.load_model()
        print("ML artifacts loaded successfully.")
    except Exception as e:
        print(f"Error loading ML artifacts: {e}")
    yield
    # Cleanup on server shutdown
    latest_data.clear()

# Single FastAPI app initialization
app = FastAPI(title="Real-Time System Monitor API", lifespan=lifespan)                                  #the diffrence between this nd the normale use


@app.get("/")
async def home():
    return {"message": "Backend is running"}

@app.post("/metrics")
async def rec_metrics(metrics : dict):
    global latest_data
    
    try:
        # Run inference immediately on incoming telemetry
        prediction_result = modelService.predict_model(metrics)
        
        # Save enriched state
        latest_data = {
            "metrics": metrics,
            "predicted": prediction_result
        }
        return {"status": "ok"}
    except Exception as e:
        traceback.print_exc()                                                                   #what it do exactly
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to WebSocket")
    global latest_data
    try:
        while True:
            # Stream combined telemetry + prediction to the frontend dashboard
            await websocket.send_json(dict(latest_data))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client disconnected from WebSocket")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)