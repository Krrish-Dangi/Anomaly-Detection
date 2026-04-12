"""
FastAPI Application — Smart Retail Surveillance System Backend.

Entry point: uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
import httpx
import threading
import subprocess
import re
import socket
import os

from config import CORS_ORIGINS, MEDIA_DIR, DATA_DIR, CLIPS_DIR
from database import engine, Base
from seed import seed

# Global states
network_state = {
    "cloudflare_url": None,
    "cloudflared_process": None,
}

def get_local_ip():
    """Detects the reliable LAN IP using a UDP socket (avoids 127.0.0.1 and virtual adapters)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def start_cloudflared():
    """Spawns cloudflared in the background and continuously extracts the URL."""
    try:
        if os.name == 'nt':
            os.system("taskkill /f /im cloudflared.exe >nul 2>&1")
        else:
            os.system("pkill -9 cloudflared >/dev/null 2>&1")
    except Exception:
        pass

    print("[CLOUDFLARE] Starting cloudflared tunnel on port 8000...")
    
    # Path to the locally downloaded cloudflared.exe
    cloudflared_path = os.path.join(os.path.dirname(__file__), "cloudflared.exe")
    
    process = subprocess.Popen(
        f'"{cloudflared_path}" tunnel --url http://localhost:8000',
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=True
    )
    network_state["cloudflared_process"] = process

    regex = re.compile(r'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)')
    for line in process.stdout:
        match = regex.search(line)
        if match and not network_state["cloudflare_url"]:
            network_state["cloudflare_url"] = match.group(1)
            print(f"[CLOUDFLARE] ✅ Tunnel acquired: {network_state['cloudflare_url']}")
    print("[CLOUDFLARE] Process exited.")

# Import all routers
from routers.dashboard import router as dashboard_router
from routers.cameras import router as cameras_router
from routers.events import router as events_router
from routers.settings import router as settings_router
from routers.analyze import router as analyze_router
from routers.websocket import router as websocket_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # ── Startup ──
    print("[START] Starting Smart Retail Surveillance Backend...")
    Base.metadata.create_all(bind=engine)
    seed()  # Seed demo data (idempotent)
    
    # Start Cloudflare Tunnel
    t = threading.Thread(target=start_cloudflared, daemon=True)
    t.start()
    
    print("[OK] Backend ready!\n")
    yield
    # ── Shutdown ──
    print("[STOP] Shutting down...")
    if network_state["cloudflared_process"]:
        print("[CLOUDFLARE] Terminating tunnel process...")
        network_state["cloudflared_process"].terminate()



app = FastAPI(
    title="Smart Retail Surveillance API",
    description="AI-Powered anomaly detection backend using ResNet18+LSTM on UCF-Crime dataset",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving for media ──
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
CLIPS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/clips", StaticFiles(directory=str(CLIPS_DIR)), name="clips")
app.mount("/snapshots", StaticFiles(directory=str(MEDIA_DIR / "snapshots")), name="snapshots")
app.mount("/frames", StaticFiles(directory=str(MEDIA_DIR / "frames")), name="frames")

# ── Register routers ──
app.include_router(dashboard_router)
app.include_router(cameras_router)
app.include_router(events_router)
app.include_router(settings_router)
app.include_router(analyze_router)
app.include_router(websocket_router)


@app.get("/")
def root():
    return {
        "name": "Smart Retail Surveillance API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "GET  /api/dashboard/stats",
            "GET  /api/dashboard/foot-traffic",
            "GET  /api/cameras",
            "POST /api/analyze",
            "GET  /api/analyze/{job_id}",
            "GET  /api/events",
            "GET  /api/settings",
            "PUT  /api/settings",
            "WS   /ws/live/{camera_id}",
            "GET  /api/system/network",
        ],
    }

import asyncio

@app.get("/api/system/network")
async def get_network():
    """Returns the Cloudflare Tunnel URL and robust Local IP."""
    local_ip = get_local_ip()
    # Retry logic if URL is not yet scraped
    for _ in range(30):  # wait up to 15 seconds
        if network_state["cloudflare_url"] is not None:
            break
        await asyncio.sleep(0.5)
        
    return {
        "cloudflare_url": network_state["cloudflare_url"],
        "local_ip": local_ip
    }

# HTTPX client for reverse proxying to Vite
vite_client = httpx.AsyncClient(base_url="http://localhost:5173")

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_frontend(request: Request, path: str):
    """
    Catch-all route that proxies unmatched HTTP requests to the Vite dev server (port 5173).
    Ensures that mobile devices accessing the Cloudflare URL can load the React frontend.
    WebSocket endpoints like /ws/ingest are handled before this route.
    """
    url = f"http://localhost:5173/{path}"
    if request.url.query:
        url += f"?{request.url.query}"
        
    exclude_headers = {'host', 'connection', 'upgrade'}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in exclude_headers}
    
    req = vite_client.build_request(
        request.method,
        url,
        headers=headers,
        content=await request.body()
    )
    resp = await vite_client.send(req, stream=True)
    
    return StreamingResponse(
        resp.aiter_raw(),
        status_code=resp.status_code,
        headers={k: v for k, v in resp.headers.items() if k.lower() not in ('content-length', 'transfer-encoding', 'content-encoding')}
    )

