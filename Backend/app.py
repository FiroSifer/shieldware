from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from metrics import get_metrics
import uvicorn
import asyncio

app=FastAPI()

app.mount("/static", StaticFiles(directory="./Frontend/static"), name="static")

@app.get("/")
async def home():
    return FileResponse("./Frontend/index.html")

@app.websocket("/ws")
async def websocket_endpoint(websocket : WebSocket):
    await websocket.accept()
    try:
        while True:
            m=get_metrics()
            await websocket.send_json(m)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client Disconnected")
             



if __name__=="__main__":
    uvicorn.run("app:app",host="127.0.0.1",port=8000,reload=True) 

