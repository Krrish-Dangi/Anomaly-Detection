# SentinelAI

**SentinelAI** is an advanced, hybrid AI surveillance platform designed for real-time anomaly detection in retail and public environments. It fuses deep learning architectures to not only identify criminal or suspicious activities (e.g., shoplifting, assault, burglary) but also provide explainable, human-centric context like foot traffic and live skeletal tracking.

Built as a full-stack solution, SentinelAI seamlessly bridges heavy Python-based AI models with a sleek, responsive React dashboard. It even includes a secure tunneling system to allow authorized mobile devices to act as instant wireless surveillance cameras from anywhere in the world.

## Key Features

- **Hybrid AI Pipeline**: Combines **ResNet18 + LSTM** (trained on the UCF-Crime dataset) for temporal action recognition with **YOLOv8-Pose** for real-time human detection and skeletal heuristics.
- **Mobile Camera Integration**: Scan a QR code on the dashboard to securely turn any smartphone into a live streaming IP camera via WebSockets and Cloudflare Tunnels.
- **Automated Incident Logging**: Suspicious events are automatically clipped into `.mp4` files and synced to a Supabase cloud database for historical review.
- **Live Analytics**: Real-time foot traffic tracking, unique person counting, and anomaly confidence scoring.
- **Zero-Config Remote Access**: The backend dynamically spins up a secure tunnel, exposing the API and WebSocket endpoints instantly without complex router configurations.

---

## Project Structure

The project is divided into two decoupled architectures:

```text
SentinelAI/
├── backend/                  # FastAPI / PyTorch Backend
│   ├── ai/                   # AI weights and PyTorch model architectures
│   ├── data/                 # Local SQLite DB and uploaded media
│   ├── output/               # Generated anomaly `.mp4` clips
│   ├── routers/              # API and WebSocket routes
│   └── main.py               # Uvicorn entry point & Cloudflare tunnel manager
│
├── src/                      # React / Vite Frontend
│   ├── components/           # Reusable UI widgets
│   ├── pages/                # Dashboard, Event History, and Video Analysis
│   ├── lib/                  # External services (Supabase auth)
│   └── index.css             # Vanilla CSS styling
│
└── package.json              # Frontend dependencies
```

---

## Getting Started

Follow these instructions to run SentinelAI on your local machine.

### Prerequisites
- **Node.js** (v16 or higher)
- **Python** (v3.9 or higher)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/Krrish-Dangi/Anomaly-Detection.git
cd Anomaly-Detection
```

### 2. Run the 1-Click Setup (Windows)
We have included an automated setup script that handles everything for you. Simply double-click **`start.bat`** from your file explorer, or run it in your terminal:
```cmd
start.bat
```

**What `start.bat` does automatically:**
1. Checks if Python and Node.js are installed.
2. Prompts you to configure your Supabase API keys if you haven't yet.
3. Creates a Python virtual environment and installs all AI backend dependencies.
4. Installs all React frontend packages.
5. Launches both the backend and frontend servers.
6. Opens the dashboard directly in your default web browser!

*(Note: The AI models require OpenCV, PyTorch, and Ultralytics. The first time you run the backend, YOLOv8 weights will automatically download. Additionally, a local SQLite database will be automatically created and seeded in `backend/data/surveillance.db` on your first startup — no manual database configuration required!)*

---

### Manual Installation (Mac/Linux)

If you are not on Windows or prefer to run it manually:

**1. Setup Frontend:**
```bash
npm install
# Rename src/lib/supabase.js.example to supabase.js and add your keys
npm run dev
```

**2. Setup Backend (New Terminal):**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Built With
- **Frontend**: React, Vite, GSAP (Animations), Chart.js
- **Backend**: FastAPI, Uvicorn, SQLite, Cloudflare `cloudflared`
- **AI / ML**: PyTorch, Ultralytics (YOLOv8), OpenCV
- **Cloud Infrastructure**: Supabase (PostgreSQL & Auth), Vercel (Frontend Hosting)

## License
This project is for educational and hackathon purposes.
