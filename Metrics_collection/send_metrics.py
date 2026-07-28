from metrics import get_metrics
import requests
import time

url = "http://localhost:8000/metrics"

while True:
    metrics = get_metrics()
    try:
        requests.post(url,json=metrics)
        print("success server replied")  
    except requests.exceptions.ConnectionError:
        print("server off waiting 5 second")
    except Exception as e :
        print("unexpetd error accured",e)    
    time.sleep(5)        
