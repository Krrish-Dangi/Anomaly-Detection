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

### 2. Configure the Frontend (React)
Install the required Node packages:
```bash
npm install
```

Since the project uses Supabase for database and authentication, you need to provide your API keys. We have included an example file for you:
1. Navigate to `src/lib/`.
2. Rename `supabase.js.example` to `supabase.js`.
3. Open `supabase.js` and paste your actual Supabase URL and Anon Key.

### 3. Configure the Backend (Python)
It is highly recommended to use a virtual environment for the Python dependencies.
```bash
cd backend

# Create and activate a virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

*(Note: The AI models require OpenCV, PyTorch, and Ultralytics. The first time you run the backend, YOLOv8 weights will automatically download).*

### 4. Run the Application

SentinelAI requires both the frontend and backend to be running simultaneously.

**Start the Backend (Terminal 1):**
```bash
cd backend
# Make sure your virtual environment is activated!
uvicorn main:app --reload --port 8000
```
*When the backend starts, it will automatically spin up a secure Cloudflare tunnel and print a URL like `https://random-words.trycloudflare.com` to your console.*

**Start the Frontend (Terminal 2):**
```bash
# From the root of the project
npm run dev
```

### 5. Access the Dashboard
Open your browser and navigate to `http://localhost:5173`. 
- **Local Testing:** The local frontend will automatically connect to your local backend.
- **Mobile Streaming:** Click "Connect Camera", scan the QR code with your phone, and start streaming!

---

## Built With
- **Frontend**: React, Vite, GSAP (Animations), Chart.js
- **Backend**: FastAPI, Uvicorn, SQLite, Cloudflare `cloudflared`
- **AI / ML**: PyTorch, Ultralytics (YOLOv8), OpenCV
- **Cloud Infrastructure**: Supabase (PostgreSQL & Auth), Vercel (Frontend Hosting)

## License
This project is for educational and hackathon purposes.
