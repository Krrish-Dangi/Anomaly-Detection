# Project Setup & Requirements

This document provides a comprehensive guide for developers to set up the SentinelAI (Smart Retail Surveillance) system locally. It covers all dependencies, installation commands, and private settings (like Supabase and environment variables) required to run both the frontend and backend.

## 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Python** (v3.11.x recommended)
- **Git**

---

## 2. Environment Variables & Private Settings
Some configurations are private and must not be pushed to GitHub. You will need to create `.env` files for both the frontend and backend.

### Frontend (.env)
Create a `.env` file in the **root directory** of the project and add your Supabase credentials:

```env
VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

> **Note:** Currently, the Supabase credentials might be hardcoded in `src/lib/supabase.js` for development. Please update `src/lib/supabase.js` to use `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` to keep your credentials secure.

### Backend Context
The backend relies on local SQLite database (`backend/data/surveillance.db`) which is auto-generated upon starting the API. 
If your AI model weights are stored in a custom path, you can set the `MODEL_WEIGHTS_PATH` environment variable in your terminal before running the backend:

```bash
# Windows (PowerShell)
$env:MODEL_WEIGHTS_PATH="C:\Path\To\anomaly_resnet18_lstm.pth"

# macOS / Linux
export MODEL_WEIGHTS_PATH="/path/to/anomaly_resnet18_lstm.pth"
```
*(By default, the backend looks for the weights at `backend/ai/weights/anomaly_resnet18_lstm.pth`)*

---

## 3. Supabase Setup for Team Members
If another developer is setting up this project, they need access to the Supabase project to perform full testing:
1. Contact the project owner to get an invitation to the **Supabase Dashboard**.
2. **Authentication Settings:** Ensure that **Email Authentication** is enabled in Supabase as the system uses it for logging in to the dashboard.
3. If applicable, apply any database migrations manually using the SQL Editor in Supabase (though currently, the backend heavily relies on its local SQLite).

---

## 4. Complete Installation Guide

### Step 4.1: Frontend Setup
The frontend is built with React, Vite, GSAP, and OGL. 

1. **Navigate to the project root:**
   ```bash
   cd "Anomaly Detection"
   ```

2. **Install all frontend dependencies:**
   ```bash
   npm install
   ```
   *This single command will install everything listed in `package.json`, including `@supabase/supabase-js`, `react-router-dom`, `gsap`, and `ogl`.*

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

### Step 4.2: Backend Setup
The backend is a FastAPI application that handles the AI Video processing using PyTorch and OpenCV.

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (highly recommended):**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment:**
   - **Windows:**
     ```bash
     venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     source venv/bin/activate
     ```

4. **Install all backend dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *This command installs FastAPI, PyTorch, SQLAlchemy, OpenCV, Uvicorn, and other AI/backend tools.*

5. **Start the backend server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend API will be available at `http://localhost:8000`. You can test the setup by visiting `http://localhost:8000/docs` in your browser to view the interactive API documentation.

---

## Technical Summary of Dependencies

### Frontend (package.json)
- `@supabase/supabase-js`: Supabase database & auth client
- `gsap`: Advanced animations
- `ogl`: WebGL 3D rendering
- `react`, `react-dom`, `react-router-dom`: UI and Routing infrastructure
- `@vitejs/plugin-react`, `vite`: Fast build tool and dev server

### Backend (requirements.txt)
- `fastapi`, `uvicorn[standard]`: High-performance async web framework
- `sqlalchemy`: Database ORM for SQLite
- `pydantic`, `python-multipart`, `aiofiles`: Data validation and file handling
- `torch`, `torchvision`, `numpy`: PyTorch models and tensor operations
- `opencv-python-headless`, `Pillow`: Video frame processing
- `websockets`: Real-time streaming for live surveillance
