import subprocess
import sys
import time

# Start the collector using the active venv's Python binary
collector = subprocess.Popen([sys.executable, "Metrics_collection/send_metrics.py"])

# Wait a little so the collector is ready
time.sleep(10)

# Start Docker Compose (Backend + Frontend)
docker = subprocess.Popen(["docker", "compose", "up"])

try:
    # Wait until Docker Compose exits
    docker.wait()
finally:
    # Safely stop the collector when Docker stops or if interrupted (Ctrl+C)
    collector.terminate()