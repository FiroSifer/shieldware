from metrics import get_metrics
import requests as rq
import time
import json
import sys
import socket
import os
Config_file = "device_config.json"
server_url = "http://localhost:8000"

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def load_config():
    if os.path.exists(Config_file):
        with open(Config_file,"r") as f:
            return json.load(f)
    return {}        

def save_config(config):
    with open(Config_file,"w") as f:
        json.dump(config,f,indent=4)

def enroll_device(config):
    payload = {
        "name" : config.get("name",socket.gethostname()),
        "type" : config.get("type","windows"),
        "ip"   : get_local_ip(),
    }   

    print("Initiating handshake with the main server...")     
    try:
        res = rq.post(
            url=f"{server_url}/device/enrollment_code",
            json=payload
        )
        res.raise_for_status()
        enrollment_code = res.json()["enrollment_code"]
        print(f"Enrolled. Code: [{enrollment_code}]. Waiting for admin approval...")

    except Exception as e:
        print("connection failed during enrollment.")
        sys.exit(1)

    while True:
        time.sleep(3)

        verification = rq.post(
            url=f"{server_url}/device/check_approval",
            json={"enrollment_code":enrollment_code}
        )
        
        if verification.status_code == 404:
            print("Enrolement rejected, Exiting.")
            sys.exit(1)

        if verification.status_code == 200:
            data = verification.json()
            
            if "token" in data:
                print("Device approved by admin!")
                config["device_id"]=data["device_id"]
                config["token"]=data["token"]
                save_config(config)
                return config
            print("pending admin approval...")

def start_streaming(config):
    headers = {"Authorization": f"Bearer {config['token']}"}
    print(f"Streaming metrics for ID: {config['device_id']}")

    while True:
  
        current_metrics = get_metrics() 

        payload = {
            "device_id": config["device_id"],
            "metrics": current_metrics,
        }

        try:
            res = rq.post(f"{server_url}/metrics", json=payload, headers=headers)

            if res.status_code in (401, 403):
                print("Token revoked or device deleted. Deleting local credentials...")
                if os.path.exists(Config_file):
                    os.remove(Config_file)
                sys.exit(1)

        except Exception as e:
            print(f"Temporary server disconnection: {e}")

        time.sleep(1)

def main():
    config = load_config()

    # Step 1: Execute Handshake if credentials are missing
    if "device_id" not in config or "token" not in config:
        config = enroll_device(config)

    # Step 2: Continuous Metric Streaming
    start_streaming(config)


if __name__ == "__main__":
    main()
            

