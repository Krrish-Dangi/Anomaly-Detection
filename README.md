# 🛡️ SentinelAI: Real-Time Smart Retail Surveillance Platform

SentinelAI is an intelligent, live-streaming surveillance dashboard designed for retail environments. Moving beyond traditional offline video analysis, this platform provides **zero-latency real-time threat detection**. It achieves this by turning any mobile device into a secure security camera that streams over WebSockets via dynamic Cloudflare Tunnels, directly feeding into a high-speed YOLO + DeepSORT tracking backend.

---

## ✨ Core Features

- **🔴 Live Mobile Camera Streaming** — Use any smartphone as a surveillance camera. Connect instantly via QR Code and stream video frames in real-time over secure WebSockets.
- **⚡ Zero-Latency AI Detection** — Powered by YOLO (You Only Look Once) and DeepSORT for persistent, high-speed person tracking and bounding box overlays across all frames.
- **📊 Interactive Real-Time Dashboard** — Live updates to active threat counters, foot traffic graphs, and camera statuses directly fed by the detection engine.
- **📁 Cloud Incident History** — Persistent incident logging and filtering powered by Supabase Authentication and database services.
- **🌗 Stunning UI** — Dark/Light themes, smooth GSAP animations, native WebGL elements (via OGL), and an intuitive React architecture.

---

## 🛠️ Complete Technology Stack

The SentinelAI architecture is built for maximum speed and real-time responsiveness.

### 1. Frontend (Presentation & Streaming Client)
- **React 19 & Vite 7** — High-performance UI framework and build pipeline.
- **GSAP & OGL** — Professional-grade scroll animations and WebGL visual effects.
- **WebSocket Client** — For transmitting camera feeds from mobile clients and receiving live bounding-box updates.

### 2. Backend API (Application & Routing)
- **Python 3.11 & FastAPI** — Asynchronous backend server handling REST API queries and WebSocket connections.
- **Uvicorn** — High-performance ASGI web server.
- **Supabase** — Provides secure Email-based user Authentication and persistent, remote storage of event history.

### 3. AI / Machine Learning Engine (Zero-Latency Core)
- **YOLO (Object Detection)** — High-speed, single-pass neural network engineered for lightning-fast bounding box detection of people and objects.
- **DeepSORT (Object Tracking)** — Ensures persistent identity tracking across frames so that movement, behavior, and paths are recognized continuously rather than flash-detected.
- **OpenCV** — Real-time headless video frame manipulation.
- **Cloudflare Tunnel (`cloudflared`)** — Secure public tunneling to expose local UI and WebSocket streams to mobile phones over HTTPS. Managed natively by the backend.

---

## 🚀 Installation & Local Setup Guide

We have decoupled the system into independent frontend and backend servers. Since this system relies on cloud databases and local port tunneling, ensure you configure the `.env` variables carefully.

### Prerequisites
- [Node.js](https://nodejs.org/en) (v18 or higher)
- [Python 3.11.x](https://www.python.org/downloads/release/python-3119/)
- Git

---

### Step 1: External Service Setup (Important!)
SentinelAI heavily relies on two external services for its real-time functionality. You **must** configure these before running the app.

#### 1A. Install Cloudflare Tunnel (`cloudflared`)
Cloudflare creates a secure tunnel from the public internet to your local machine, allowing mobile phones to access the UI and stream video frames securely to the AI engine over HTTPS.
1. Download and install `cloudflared` for your OS: [Cloudflare Tunnel Downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Ensure the `cloudflared` executable is added to your system's PATH. 
3. *Note: There is no manual configuration required. The FastAPI backend automatically spawns the tunnel and captures the dynamic `.trycloudflare.com` URL on startup.*

#### 1B. Create a Supabase Project (For Database & Auth)
Supabase is used for user authentication and storing the persistent incident logs.
1. Sign up at [Supabase](https://supabase.com/) and create a new Project.
2. Once created, go to **Project Settings > API** to find your `Project URL` and `anon public key`.
3. Go to **Authentication > Providers** and ensure **Email** authentication is enabled.
4. *Note: As this is a decoupled system, the backend uses a local SQLite database for speed, but the frontend relies on Supabase for Auth.*

---

### Step 2: Clone the repository

```bash
git clone https://github.com/Krrish-Dangi/Anomaly-Detection.git
cd Anomaly-Detection
```

---

### Step 3: Environment Variables (Locally Secured)
Create a `.env` file in the **root directory** and add your Supabase credentials for Authentication and database access. Do **NOT** push this file to GitHub:
```env
VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

---

### Step 4: Start the AI Backend & Tunnel

The backend will automatically start the AI models and spawn the Cloudflare Tunnel in the background.

1. **Start the AI Backend** (In a new terminal window):
   ```bash
   cd backend
   
   # Activate your virtual environment
   # Windows: python -m venv venv; .\venv\Scripts\activate
   # macOS/Linux: python3 -m venv venv; source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Run the server
   uvicorn main:app --reload --port 8000
   ```
   *The terminal console will print `✅ Tunnel acquired: https://<random>.trycloudflare.com` once the tunnel is active.*

*(Note: Ensure your YOLO model weights are properly initialized inside `backend/ai/weights/` before starting the stream).*

---

### Step 5: Start the Frontend UI

With your backend running, launch the frontend dashboard. 

1. **Start the Web UI** (In a second terminal window):
   ```bash
   # Make sure you are in the project root: Anomaly-Detection
   npm install
   npm run dev
   ```
*(Note for Windows Users: If you face script execution policy errors in PowerShell, use `cmd /c "npm run dev"`).*

2. **Connect to the System:**
   - Open your browser to the local URL (usually `http://localhost:5173`).
   - Log in using your Supabase credentials.
   - Use the **Connect Camera** interface on the dashboard to scan the securely generated QR code using your mobile phone. Your live stream will instantly appear on the dashboard!

---

## 📂 System File Overview

```text
Anomaly-Detection/
├── backend/                   # Python FastAPI Backend
│   ├── ai/                    # YOLO & DeepSORT architecture & weights
│   ├── routers/               # API endpoint grouping and WebSocket sockets
│   └── main.py                # Server entry point
├── src/                       # React Frontend
│   ├── assets/                # Images & public media
│   ├── components/            # UI components and Video Players
│   ├── pages/                 # Full Page Renders (Dashboard, Settings)
│   ├── lib/                   # Supabase client config & API callers
│   └── App.jsx                # Application Router Map 
├── .env                       # Secrets/Ngrok configs (Do Not Commit)
├── package.json               # Node deps
└── README.md                  # Unified system documentation
```

---

## ⚖️ License
Designed and developed for academic/research purposes as part of a DTI (Design Thinking & Innovation) project. Not licensed for commercial use.
