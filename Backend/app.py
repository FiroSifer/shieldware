from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import asyncio

app=FastAPI()

latest_metrics = {}

@app.get("/")
async def home():
    return {"message": "Backend is running"}

@app.post("/metrics")
async def rec_metrics(metrics : dict ):
    global latest_metrics
    latest_metrics = metrics
    print(f"Metrics updated: {latest_metrics}")
    return {"status":"ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket : WebSocket):
    global latest_metrics
    await websocket.accept()
    print("Client connected")
    try:
        while True:
            await websocket.send_json(latest_metrics)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client Disconnected")
             



if __name__=="__main__":
    uvicorn.run("app:app",host="0.0.0.0",port=8000,reload=True) 

