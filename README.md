# 🚑 MediCare Express — AI Ambulance Dispatch & Real-Time Rerouting Platform

![License](https://img.shields.io/badge/License-MIT-emerald.svg)
![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TailwindCSS-blue)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20Socket.io-green)
![Python](https://img.shields.io/badge/ML%20%26%20Vision-Python%20%7C%20FastAPI%20%7C%20OpenCV-yellow)
![TomTom](https://img.shields.io/badge/Maps-TomTom%20Calculate%20Route%20API-red)
![OpenWeatherMap](https://img.shields.io/badge/Weather-OpenWeatherMap%20API-orange)

**MediCare Express** is a next-generation emergency medical dispatch and live ambulance tracking platform designed to minimize response times during medical emergencies. 

Instead of relying on static point-to-point GPS navigation, **MediCare Express** continuously fuses **TomTom Driving Routes**, **OpenWeatherMap Live Feeds**, **OpenCV Computer Vision AI** (via mobile/device camera scan), and a **Python Machine Learning Delay Prediction Engine** to dynamically reroute ambulances onto the fastest, safest paths in real time.

---

## 🌟 Key Features

- **🚑 Patient Emergency Request & Auto-Matching**: Patients request an ambulance (Accident, Cardiac, Pregnancy, Breathing) with automatic GPS geolocation or Kolkata destination coordinates. Matches the nearest available driver using MongoDB `$near` 2DSphere indexing.
- **🗺️ TomTom Driving Route Optimization**: Calculates 3 candidate driving routes with high-precision GPS waypoints powered by the TomTom Calculate Route API (`HOf9Ecax1EmTmK2aKIUmnpcKgSh5pU99`).
- **🌦️ Live Weather Penalty Engine**: Integrates OpenWeatherMap API (`ef9149057dc991fc2c59c9a2f30926d0`) to assess rainfall rates, visibility reduction, and atmospheric penalties in real time.
- **📷 Device/Mobile Camera Traffic Analysis (OpenCV Vision AI)**: Drivers can tap **"Get Suggestion from Traffic Camera"** to stream WebRTC live camera video, capture a traffic frame, and run OpenCV Canny edge density & Laplacian motion algorithms to count vehicles and evaluate road congestion.
- **🧠 Python ML Delay Prediction Engine**: Evaluates candidate routes by predicting traffic congestion delays ($\text{Total Travel Time} = \text{Base ETA} + \text{ML Delay}$) and automatically switches to alternative bypasses when heavy rain or gridlock occurs.
- **📡 Real-Time Socket.io Live Tracking**: Streams driver GPS location updates to patient and driver dashboards with Leaflet/OpenStreetMap polyline map overlays.
- **📍 Kolkata Regional Hub Defaulting**: Built-in Kolkata geofence validation (`22.5726° N`, `88.3639° E`) with driver location controls.

---

## 🏗️ System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │             MediCare Express Web App         │
                               │        (React 18 + Vite + Leaflet Maps)      │
                               └──────┬──────────────────────────────┬────────┘
                                      │                              │
                     Socket.io / HTTP │                              │ WebRTC Live Stream
                                      ▼                              ▼
┌───────────────────────────────────────────┐      ┌───────────────────────────────────────────┐
│        Express.js Backend Service        │      │        Device / Mobile Camera             │
│            (Node.js / MongoDB)            │      │       (WebRTC Video Capture)              │
└──────┬──────────────────────┬─────────────┘      └─────────────────────┬─────────────────────┘
       │                      │                                          │
       │ HTTP                 │ HTTP                                     │ Base64 Image Frame
       ▼                      ▼                                          ▼
┌───────────────┐     ┌───────────────┐                    ┌───────────────────────────┐
│ OpenWeatherMap│     │ TomTom Route  │                    │ OpenCV Vision AI Service  │
│  Weather API  │     │   Calculate   │                    │ (Python FastAPI + OpenCV) │
└───────────────┘     └───────────────┘                    └─────────────┬─────────────┘
                                                                         │
                                                                         │ Vision Metrics
                                      ┌──────────────────────────────────┘ (Vehicle Count, Density)
                                      ▼
                        ┌───────────────────────────┐
                        │   Python ML Delay Engine  │
                        │    (FastAPI / Predict)    │
                        └───────────────────────────┘
```

---

## 🛠️ Technology Stack

| Domain | Technology | Description |
|:---|:---|:---|
| **Frontend** | React 18, Vite, TailwindCSS, Leaflet, Socket.io-client | Responsive glassmorphism dashboard, WebRTC video capture, Leaflet polyline map |
| **Backend** | Node.js, Express, MongoDB (Mongoose), Socket.io, JWT | REST APIs, `$near` 2DSphere geospatial query, real-time WebSocket broadcasting |
| **ML Engine** | Python 3.10, FastAPI, Pydantic, Uvicorn | Feature scoring, delay calculation model, congestion index computation |
| **Vision AI** | Python 3.10, OpenCV (`cv2`), NumPy | Canny edge density detection, Laplacian motion variance, frame decoding |
| **APIs** | TomTom Routing API, OpenWeatherMap API | Driving route geometry, polyline waypoints, weather observation feeds |

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.10+
- [MongoDB](https://www.mongodb.com/) running locally on `localhost:27017` (or Docker)
- [Git](https://git-scm.com/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Shubhankarmaity/MediCare-Express-.git
cd MediCare-Express-
```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in the root directory and in `backend/.env`:

```bash
cp .env.example .env
cp .env.example backend/.env
```

**`.env` File Content:**
```env
NODE_ENV=development
BACKEND_PORT=5000
MONGODB_URI=mongodb://localhost:27017/ambulance_ai
JWT_SECRET=medicare_express_jwt_secret_key_2026
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
ML_SERVICE_URL=http://localhost:8001
CAMERA_SERVICE_URL=http://localhost:8002
WEATHER_API_KEY=your_openweathermap_api_key
MAP_API_KEY=your_tomtom_api_key
```

*(Note: Never commit `.env` containing private API keys to GitHub! `.gitignore` handles this automatically.)*

---

### Step 3: Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd ../frontend
npm install
```

#### ML & Camera Services (Python)
```bash
cd ../ml-service
pip install -r requirements.txt

cd ../camera-service
pip install -r requirements.txt
```

---

### Step 4: Seed Default Credentials (Kolkata Hub)
```bash
cd ../backend
node src/seed.js
```

---

### Step 5: Start All Services

Open 4 separate terminal windows:

```bash
# Terminal 1: Backend API (Port 5000)
cd backend && npm run dev

# Terminal 2: Frontend App (Port 5173)
cd frontend && npm run dev

# Terminal 3: ML Service (Port 8001)
cd ml-service && python -m uvicorn app.main:app --port 8001 --reload

# Terminal 4: Camera Service (Port 8002)
cd camera-service && python -m uvicorn app.main:app --port 8002 --reload
```

Or using **Docker Compose**:
```bash
docker compose up --build
```

---

## 🔑 Default Test Credentials

| Role | Access URL | Email | Password | Default Hub |
|:---|:---|:---|:---|:---|
| **Patient** | [http://localhost:5173/login/patient](http://localhost:5173/login/patient) | `patient@ambulance.com` | `patient123` | Kolkata (`22.5726`, `88.3639`) |
| **Driver** | [http://localhost:5173/login/driver](http://localhost:5173/login/driver) | `driver@ambulance.com` | `driver123` | Kolkata (`22.5726`, `88.3639`) |

---

## 📡 API Endpoints Summary

### Backend (`http://localhost:5000`)
- `POST /api/auth/register` — Account registration
- `POST /api/auth/login` — User authentication (JWT token output)
- `POST /api/bookings` — Create emergency ambulance request
- `GET /api/bookings/active` — Fetch active booking status
- `PATCH /api/bookings/:id/accept` — Driver accepts booking
- `POST /api/routes/suggest` — Evaluates candidate routes with TomTom + Weather + ML Service
- `POST /api/camera/analyze` — Forwards captured camera frame to OpenCV Vision Service

### ML Service (`http://localhost:8001`)
- `POST /predict` — Calculates predicted delay seconds & congestion score from weather & traffic inputs

### Camera Service (`http://localhost:8002`)
- `POST /analyze/frame` — Decodes base64 image frame, runs OpenCV Canny edge & Laplacian motion detection

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

**Developed with ❤️ for Emergency Medical Response Technology.**
