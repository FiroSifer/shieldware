from metrics import get_metrics
import requests
import time

url = "http://localhost:8000/metrics"

session = requests.Session()

while True:
    metrics = get_metrics()

    try:
        session.post(
            url,
            json=metrics,
            timeout=1
        )
        print("success server replied")

    except requests.exceptions.ConnectionError:
        print("server off waiting 5 second")

    except Exception as e:
        print("unexpected error:", e)

    time.sleep(0.01)       
