# Architeo

**Intelligent Infrastructure Monitoring & Anomaly Detection**

Architeo is a proof-of-concept web platform designed to centralize the monitoring of IT infrastructure through real-time system and network telemetry.

The platform combines lightweight monitoring agents, a centralized FastAPI backend, a web-based dashboard, and a machine-learning model capable of detecting abnormal system behavior and identifying potential attack categories.

The project was developed as part of an internship project with the objective of exploring the integration of **infrastructure monitoring, distributed telemetry collection, containerization, and AI-based anomaly detection** within a single platform.

---

## Overview

Traditional infrastructure monitoring tools generally focus on displaying system metrics such as CPU, memory, disk, and network usage.

Architeo extends this approach by introducing an AI-based analysis layer capable of evaluating collected telemetry and detecting patterns associated with abnormal or potentially malicious behavior.

The platform follows a distributed architecture:

```text
                    ┌──────────────────────┐
                    │   Monitoring Agent   │
                    │                      │
                    │ CPU / RAM / Disk /   │
                    │ Network / System     │
                    │ metrics              │
                    └──────────┬───────────┘
                               │
                               │ HTTP
                               ▼
                    ┌──────────────────────┐
                    │   FastAPI Backend    │
                    │                      │
                    │ API / Authentication │
                    │ Data Processing      │
                    │ AI Prediction       │
                    └──────────┬───────────┘
                               │
                               │ WebSocket
                               ▼
                    ┌──────────────────────┐
                    │  Monitoring Dashboard│
                    │                      │
                    │ Real-time Metrics    │
                    │ Device Status        │
                    │ AI Detection         │
                    └──────────────────────┘
```

---

## Key Features

### Real-Time Infrastructure Monitoring

Monitoring agents collect system and network telemetry from monitored machines, including:

* CPU utilization
* CPU user/system/idle time
* RAM utilization
* Disk activity
* Network traffic
* Network packets
* System interrupts
* Page faults

Collected metrics are periodically transmitted to the central backend for processing.

### Multi-Machine Monitoring

Each monitored machine runs an independent agent responsible for collecting and transmitting its telemetry.

This allows the architecture to scale from a single monitored machine to multiple devices connected to the same central monitoring platform.

### AI-Based Anomaly Detection

Architeo integrates a machine-learning model trained on telemetry data to classify system behavior.

The model analyzes a selected set of infrastructure metrics and produces:

* A predicted class
* An anomaly/attack category
* A confidence score

The current model was trained using telemetry data derived from the **TON_IoT Windows 10 dataset**.

### Real-Time Dashboard

The frontend provides a centralized interface for monitoring connected devices.

The dashboard displays system information and dynamically updates monitoring data without requiring continuous page refreshes.

### WebSocket Communication

WebSockets are used between the backend and frontend to provide real-time updates to the monitoring interface.

This allows new telemetry and device status information to be reflected on the dashboard dynamically.

### Authentication

The backend includes authentication mechanisms for restricting access to administrative functionality.

JWT-based authentication is used to manage authenticated sessions.

### Containerized Architecture

The application is designed to run using Docker and Docker Compose.

The backend and frontend are separated into independent services, making the application easier to deploy and maintain.

---

## Architecture

The project is divided into four main components:

### 1. Monitoring Agent

Located in:

```text
Agent_app/
```

The monitoring agent is responsible for collecting telemetry from a monitored machine.

Main files:

```text
agents_code.py
metrics.py
```

The agent gathers system information and sends the resulting metrics to the central backend.

---

### 2. Backend

Located in:

```text
Backend/
```

The backend is implemented using **FastAPI**.

Its responsibilities include:

* Receiving telemetry from monitoring agents
* Processing incoming metrics
* Running AI predictions
* Managing application data
* Providing API endpoints
* Handling authentication
* Communicating real-time information to the frontend

Main components include:

```text
Backend/
├── app.py
├── db_modules.py
├── requirements.txt
├── Dockerfile
└── Model_modules/
```

---

### 3. Frontend

Located in:

```text
Frontend/
```

The frontend provides the monitoring dashboard.

It is implemented using:

* HTML
* CSS
* JavaScript
* WebSocket communication

The frontend is served through **Nginx**.

Structure:

```text
Frontend/
├── index.html
├── nginx.conf
├── dockerfile
└── static/
    ├── script.js
    └── style.css
```

---

### 4. AI Model

Located in:

```text
AI/
```

The AI component contains the training notebook and dataset used to develop the anomaly-detection model.

```text
AI/
├── AI_training.ipynb
└── dataset.csv
```

The model is based on a neural-network architecture and is trained to classify different types of system behavior based on infrastructure telemetry.

---

## Repository Structure

```text
Architeo/
│
├── AI/
│   ├── AI_training.ipynb
│   └── dataset.csv
│
├── Agent_app/
│   ├── agents_code.py
│   └── metrics.py
│
├── Agent_app_copy_ddos/
│   ├── agents_code.py
│   └── metrics.py
│
├── Backend/
│   ├── Model_modules/
│   ├── app.py
│   ├── db_modules.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
│
├── Frontend/
│   ├── static/
│   │   ├── script.js
│   │   └── style.css
│   ├── index.html
│   ├── nginx.conf
│   └── dockerfile
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

# Getting Started

## Prerequisites

Before running Architeo, make sure the following tools are installed:

* Git
* Docker
* Docker Compose

The monitoring agent also requires Python when it is executed directly on a host machine.

---

## 1. Clone the Repository

```bash
git clone <REPOSITORY_URL>
cd Architeo
```

Replace `<REPOSITORY_URL>` with the URL of this repository.

---

## 2. Start the Application

The backend and frontend can be started using Docker Compose:

```bash
docker compose up --build
```

or, depending on the Docker Compose version:

```bash
docker-compose up --build
```

Docker will build the required images and start the application services.

To run the services in the background:

```bash
docker compose up --build -d
```

---

## 3. Access the Dashboard

Once the containers are running, open the monitoring dashboard in a web browser:

```text
http://localhost
```

The backend API is exposed separately and can be accessed through:

```text
http://localhost:8000
```

The exact ports may be modified through `docker-compose.yml`.

---

# Running the Monitoring Agent

The monitoring agent runs on the machine that needs to be monitored.

Navigate to:

```bash
cd Agent_app
```

Install the required Python dependencies if necessary:

```bash
pip install psutil requests
```

Then run:

```bash
python agents_code.py
```

The agent collects telemetry from the host machine and communicates with the Architeo backend.

> The backend address configured inside the agent must point to the machine running the Architeo server.

For example, when the backend is running on another machine, replace `localhost` with the appropriate server IP address.

---

# Using Architeo

Once the platform is running, the general workflow is:

### 1. Start the Architeo backend and frontend

Run the Docker Compose configuration.

### 2. Start a monitoring agent

Launch the agent on the machine that should be monitored.

### 3. Connect the agent to the backend

Configure the agent with the address of the Architeo server.

### 4. Monitor the device

The collected telemetry is transmitted to the backend and displayed on the dashboard.

### 5. Analyze system behavior

The backend processes the received metrics and sends them through the AI model.

The dashboard can then indicate the detected state and associated confidence level.

---

# Machine Learning

The anomaly-detection component was developed using telemetry data from the **TON_IoT dataset**.

The training pipeline includes:

1. Dataset preparation
2. Feature selection
3. Data preprocessing
4. Class balancing
5. Model training
6. Validation
7. Performance evaluation
8. Model export for integration into the backend

The selected telemetry features include metrics related to:

* CPU activity
* Memory utilization
* Disk operations
* Network traffic
* Network packets
* System interrupts
* Page faults

The model uses a neural-network architecture to classify observed system behavior.

The training process and experimentation can be found in:

```text
AI/AI_training.ipynb
```

---

# Technology Stack

| Component         | Technology              |
| ----------------- | ----------------------- |
| Backend           | Python / FastAPI        |
| Frontend          | HTML / CSS / JavaScript |
| Web Server        | Nginx                   |
| Communication     | HTTP / WebSocket        |
| System Monitoring | psutil                  |
| Database          | SQLite                  |
| Authentication    | JWT                     |
| Machine Learning  | Python / TensorFlow     |
| Containerization  | Docker / Docker Compose |
| Dataset           | TON_IoT                 |

---

# Project Goals

The main objectives of Architeo are to explore:

* Centralized infrastructure monitoring
* Distributed telemetry collection
* Real-time system visualization
* AI-assisted anomaly detection
* Communication between monitoring agents and a central server
* WebSocket-based real-time updates
* Containerized deployment
* Separation between frontend, backend, and monitoring agents

The project is primarily intended as a **proof of concept and experimentation platform**, rather than a production-ready infrastructure monitoring solution.

---

# Current Limitations

Architeo is an internship proof of concept and therefore has several limitations.

### Operating System Support

The monitoring agent was primarily tested on Windows.

Linux support would require adapting certain system-specific monitoring mechanisms.

### Dataset Limitations

The AI model was trained using a limited subset of telemetry features from the TON_IoT dataset.

Performance on real-world infrastructure may therefore differ from the results obtained during training and evaluation.

### Scalability

The current implementation has not been extensively tested with large numbers of simultaneously monitored machines.

Additional work would be required for production-scale deployments.

### Production Deployment

The current repository focuses on the proof-of-concept implementation.

Production deployment would require additional mechanisms such as:

* HTTPS/TLS
* More robust authentication and authorization
* Secure agent enrollment
* Centralized time-series storage
* Monitoring and logging infrastructure
* High availability
* CI/CD
* Improved observability
* Stronger security controls

---

# Future Improvements

Possible future developments include:

* Full Linux support
* Improved agent management
* Secure device enrollment
* Role-based access control
* Historical metric visualization
* Time-series database integration
* Advanced alerting
* Email/notification integration
* Improved AI models
* Online anomaly detection
* Automatic model retraining
* Scalable multi-server architecture
* Production-grade deployment

---

# Project Status

**Status: Proof of Concept — Internship Project**

The current implementation demonstrates the complete monitoring pipeline:

```text
Machine
   ↓
Monitoring Agent
   ↓
Telemetry Collection
   ↓
FastAPI Backend
   ↓
AI Analysis
   ↓
WebSocket
   ↓
Monitoring Dashboard
```

The project demonstrates the feasibility of combining infrastructure monitoring with AI-assisted anomaly detection in a lightweight, containerized architecture.

---



