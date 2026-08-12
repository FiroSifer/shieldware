import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import secrets
import jwt 
import time

from Model_modules.model import modelService
import db_modules as db

import traceback

#===================================================================================================#
JWT_SECRET = "super-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
ADMIN_USERNAME = "Admin"
ADMIN_PASSWORD = "Architeo2026"  

def create_jwt_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": time.time() + (12 * 3600) 
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_admin_token(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, 
            detail="Missing or invalid token format"
            )
    
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"]
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=403, detail="Token has expired")
    
    except jwt.PyJWTError:
        raise HTTPException(status_code=403, detail="Invalid token")
#==================================================================================================#

devices = {}
pending_device = {}
approved_device = {}

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

app = FastAPI(title="Real-Time System Monitor API", lifespan=lifespan)  

app = FastAPI(title="Real-Time System Monitor API", lifespan=lifespan)  

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)


@app.get("/")
async def home():
    return {"message": "Backend is running"}

@app.post("/login")
async def login(credentials: dict):

    username = credentials.get("username")
    password = credentials.get("password")

    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        token = create_jwt_token(username)
        return {"access_token": token, "token_type": "bearer"}

    raise HTTPException(
        status_code=401, 
        detail="Invalid username or password"
        )

@app.post("/device/enrollment_code")
async def add_pending_device(info : dict):

    enrollment_code = secrets.token_hex(4)
    pending_device[enrollment_code]={
        "name" : info["name"],
        "type" : info["type"],
        "ip"   : info["ip"]
    }
    return {
        "enrollment_code":enrollment_code,
        "status":"pending"
        }

@app.get("/device/pending")
async def get_pending_device(admin: str = Depends(verify_admin_token)):

    return[
        {"enrollment_code" : code, **info}
        for code , info in pending_device.items()
    ]

@app.post("/device/check_approval")
async def check_verification(data: dict):

    enrollment_code = data.get("enrollment_code")

    if enrollment_code in approved_device:
        return approved_device.pop(enrollment_code)

    if enrollment_code in pending_device:
        return {"status": "pending"}

    raise HTTPException(
        status_code=404, 
        detail="Enrollment code not found"
        )

@app.post("/device/rejected")
async def reject_devices(device : dict,admin: str = Depends(verify_admin_token)):

    enroll = device.get("enrollment_code")
    if enroll in pending_device:
        pending_device.pop(enroll)

        return{
            "status" : "rejected device",
            "enrollment_code"  : enroll
        }

    raise HTTPException(status_code=404,detail="Enrollment code not found")

@app.post("/device/approved")
async def add_devices(device : dict,admin: str = Depends(verify_admin_token)) :

    enroll=device.get("enrollment_code")

    if enroll not in pending_device :
        raise HTTPException(
            status_code=404,
            detail="Enrollment code not found"
            )

    device_info = pending_device.pop(enroll)

    device_id = secrets.token_hex(8)
    token = secrets.token_urlsafe(32)
    name = device_info["name"]
    type = device_info["type"]
    ip = device_info["ip"]

    db.save_device(device_id,name,type,ip,token)

    approved_device[enroll]={
        "status": "approved",
        "device_id": device_id,
        "token": token
    }

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

@app.delete("/device/{device_id}")
async def del_device(device_id: str,admin: str = Depends(verify_admin_token)):

    if device_id not in devices:
        raise HTTPException(
            status_code=404,
            detail="Device not found"
        )
    deleted = db.delect_device(device_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Device not registered"
        )

    del devices[device_id]

    print("device removed :",device_id)

    return{
        "status" : "device removed",
        "device_id" : device_id
    }


@app.post("/metrics")
async def rec_metrics(data : dict, authorization: str | None = Header(default=None)):

    device_id = data.get("device_id")

    if device_id is None :
        raise HTTPException(
            status_code=401,
            detail="Missing device id")
    
    if device_id not in devices:
        raise HTTPException(
            status_code=403,
            detail="Id not found")

    if authorization is None:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization token")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=403,
            detail="Invalid authorization format")
    
    token = authorization[7:]
    if token != devices[device_id]["token"]:
        raise HTTPException(
            status_code=403,
            detail="Invalid authorization"
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