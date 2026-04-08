"""
FastAPI Application — Smart Retail Surveillance System Backend.

Entry point: uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import CORS_ORIGINS, MEDIA_DIR, DATA_DIR
from database import engine, Base
from seed import seed

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
    print("[OK] Backend ready!\n")
    yield
    # ── Shutdown ──
    print("[STOP] Shutting down...")


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
app.mount("/clips", StaticFiles(directory=str(MEDIA_DIR / "clips")), name="clips")
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
        ],
    }
