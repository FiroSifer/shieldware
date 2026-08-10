import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header
import uvicorn
import secrets

from model import modelService
import db_modules as db

import traceback

devices = {}

@asynccontextmanager                                                                                 
async def lifespan(app: FastAPI):

    print("laoding devices Database...")

    db.init_database()

    print("Loading ML artifacts into memory...")

    try:
        modelService.load_model()
        print("ML artifacts loaded successfully.")
    except Exception as e:
        print(f"Error loading ML artifacts: {e}")

    rows = db.load_devices()
    for device_id, name, device_type, ip, token in rows:

        devices[device_id] = {
            "name": name,
            "type": device_type,
            "ip": ip,
            "token": token,
            "metrics": None,
            "prediction": None
        }

    print(f"{len(devices)} devices loaded.")

    yield
    devices.clear()
    print("server shutting down...")

# Single FastAPI app initialization
app = FastAPI(title="Real-Time System Monitor API", lifespan=lifespan)                                 


@app.get("/")
async def home():
    return {"message": "Backend is running"}

@app.post("/devices")
async def add_devices(device : dict) :

    global devices 
    
    device_id = secrets.token_hex(8)
    token = secrets.token_urlsafe(32)
    name = device["name"]
    type = device["type"]
    ip = device["ip"]

    db.save_device(device_id,name,type,ip,token)

    devices[device_id] = {
        "name" : name,
        "type" : type,
        "ip"   : ip,
        "token" : token,
        "metrics" : None,
        "prediction" : None,
    }


    print("device added:",device_id)

    return {
        "status": "device registered",
        "device_id": device_id,
        "token": token
    }

@app.delete("/devices/{device_id}")
async def del_device(device_id: str):

    if device_id not in devices:
        raise HTTPException(
            status_code=404,
            detail="Device not found"
        )
    deleted = db.delect_device(device_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Device not found on the database"
        )

    del devices[device_id]

    print("device removed :",device_id)

    return{
        "status" : "device removed",
        "device_id" : device_id
    }


@app.post("/metrics")
async def rec_metrics(data : dict, authorization: str | None = Header(default=None)):

    global devices
    device_id = data.get("device_id")
    if device_id is None :
        raise HTTPException(
            status=400,
            detail="Missing device id")
    elif device_id not in devices:
        raise HTTPException(
            status_code=403,
            detail="Id not identified")

    if authorization is None:
        raise HTTPException(
            status_code=400,
            detail="Missing authorization token")
    elif not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format")
    
    token = authorization[7:]
    if token != devices[device_id]["token"]:
        raise HTTPException(
            status_code=403,
            detail="Invalid token for this device"
            )

    metrics = data.get("metrics")

    if metrics is None:
        raise HTTPException(
            status_code=400,
            detail="Missing metrics"
        )

    devices[device_id]["metrics"]=metrics

    try:
        prediction_result = modelService.predict_model(metrics)

        devices[device_id]["prediction"]=prediction_result

        return {"status": "ok"}
    
    except Exception as e:
        traceback.print_exc()                                                                   
        raise HTTPException(
            status_code=500, 
            detail=f"Prediction error: {str(e)}"
            )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to WebSocket")
    global devices
    
    try:
        while True:

            devices_frontend = {
                device_id: {
                    key: value
                    for key, value in device.items()
                    if key != "token"
                }
                for device_id, device in devices.items()
            }

            await websocket.send_json(dict(devices_frontend))
            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        print("Client disconnected from WebSocket")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)