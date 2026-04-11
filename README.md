# 🛡️ SentinelAI: AI-Powered Smart Retail Surveillance System

An intelligent full-stack surveillance system built for retail environments. SentinelAI automates video monitoring by leveraging a deep learning model (ResNet18 + LSTM) to detect and classify anomalous activities such as **shoplifting**, **robbery**, **assault**, and **vandalism** in real-time — helping store managers respond faster and reduce losses.

This project was built as part of a Design Thinking & Innovation (DTI) project.

---

## ✨ System Features

- **📊 Central Dashboard** — Live overview with active camera feeds, daily threat counters, foot traffic trends, and system uptime.
- **🎬 AI Video Analysis** — Upload surveillance footage for immediate deep learning inference. Replaces constant human monitoring by highlighting high-priority events with bounding box tracking and time-stamped logs.
- **📁 Event History** — Persistent incident logs with powerful filtering (date, event type, camera, confidence level) powered by SQLite and SQLAlchemy.
- **⚙️ Dynamic System Settings** — Fully functional settings panel to manage AI detection targets, confidence thresholds, cross-platform alerts, and Camera I/O.
- **🌗 Stunning UI** — Dark/Light themes, smooth GSAP animations, native WebGL elements (via OGL), and an intuitive React architecture.

---

## 🛠️ Complete Technology Stack

The system architecture spans three distinct tiers, ensuring scalability and performance:

### 1. Frontend (Presentation Tier)
- **React 19 & Vite 7** — Fast UI framework paired with a sub-second HMR build tool.
- **React Router v7** — Dynamic, client-side nested routing.
- **GSAP & OGL** — Professional-grade scroll animations and WebGL effects.
- **Vanilla CSS** — Strict design system with variables for fast styling.
- **Supabase** — Provides secure Email-based user Authentication.

### 2. Backend API (Application Tier)
- **Python 3.11** — Required for optimal PyTorch CUDA compatibility and performance.
- **FastAPI & Uvicorn** — High-performance, async REST API server with built-in WebSockets.
- **SQLAlchemy & SQLite** — Simple, file-based database for managing cameras, jobs, events, and settings.
- **Pydantic** — Strict data validation for APIs.

### 3. AI / Machine Learning Engine
- **PyTorch (2.5)** — Model inference operations.
- **ResNet18** — A lightweight, pretrained Convolutional Neural Network (CNN) serving as a spatial feature extractor. Early layers are frozen to leverage ImageNet knowledge. 
- **LSTM (2-layer)** — Recurrent Neural Network that interprets sequences of frames (temporal reasoning) to classify actions over time.
- **OpenCV** — Real-time headless video frame extraction and matrix preparation.

---

## 🏗️ Deep Learning Architecture

The system achieves **96.7% accuracy** across 13 distinct anomaly classes (such as Arson, Burglary, Fighting, RoadAccidents, and more) plus normal activity. 

**How it works under the hood:**
1. **Clip Extraction:** Video feeds are sliced into dense, overlapping 16-frame sequences.
2. **Spatial Parsing:** Each frame enters ResNet18, returning a rich 512-dimensional spatial feature vector.
3. **Temporal Reasoning:** Sequences are passed to a 2-layer LSTM. The model monitors the change in spatial coordinates to derive and understand actions taking place over time.
4. **Classification Head:** Probabilities are sorted using a custom softmax classifier with inverse-frequency weighting, mapping results to the 14 UCF-Crime Dataset categories. 

---

## 🚀 Installation & Local Setup Guide

We have decoupled the system into independent frontend and backend servers. Follow these steps to run the dashboard and AI model locally.

### Prerequisites
- [Node.js](https://nodejs.org/en) (v18 or higher)
- [Python 3.11.x](https://www.python.org/downloads/release/python-3119/)
- Git

### Step 1: Clone the repository

```bash
git clone https://github.com/Krrish-Dangi/Anomaly-Detection.git
cd Anomaly-Detection
```

### Step 2: Environment Variables
Create a `.env` file in the root directory and add your Supabase credentials for Authentication:
```env
VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

### Step 3: Start the Backend & AI Engine

The frontend relies heavily on data coming from the AI Backend. Let's start the API first.

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Virtual Environment:
   * **Windows (PowerShell):** `python -m venv venv; .\venv\Scripts\activate`
   * **macOS/Linux:** `python3 -m venv venv; source venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server (it auto-generates the local SQLite database):
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   > The API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs). 

*(Note: Custom AI model weights can be configured by setting `$env:MODEL_WEIGHTS_PATH` before starting the server. It looks for `backend/ai/weights/anomaly_resnet18_lstm.pth` by default).*

### Step 4: Start the Frontend UI

Open a second terminal window (keep the backend server running) and move to the root directory (`Anomaly-Detection`).

1. Install Node modules:
   ```bash
   npm install
   ```
2. Start Vite Development Server:
   ```bash
   npm run dev
   ```
*(Note for Windows Users: If you face script execution policy errors in PowerShell, use `cmd /c "npm run dev"`).*

You can now visit your local system at `http://localhost:5173`. 

---

## 📂 System File Overview

```text
Anomaly-Detection/
├── backend/                   # Python FastAPI Backend
│   ├── ai/                    # Deep learning models & weights
│   ├── data/                  # SQLite storage (surveillance.db)
│   ├── routers/               # API endpoint grouping
│   ├── database.py            # SQLAlchemy setup
│   └── main.py                # Server entry point
├── src/                       # React 19 Frontend
│   ├── assets/                # Images & public media
│   ├── components/            # UI pieces (DashboardLayout, Alerts, Visuals)
│   ├── pages/                 # Full Page Renders (Settings, History)
│   ├── lib/                   # Supabase client config & API callers
│   └── App.jsx                # Application Router Map 
├── .env                       # Secrets (Requires manual creation)
├── package.json               # Node deps
└── README.md                  # Unified system documentation
```

---

## ⚖️ License
Designed and developed for academic/research purposes as part of a DTI (Design Thinking & Innovation) project. Not licensed for commercial use.
