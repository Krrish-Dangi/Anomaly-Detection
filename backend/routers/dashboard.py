"""
Dashboard API routes.
GET /api/dashboard/stats — system overview stats
GET /api/dashboard/foot-traffic — foot traffic chart data
"""

import math
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from database import get_db
from models import Camera, Event
from schemas import DashboardStats, FootTrafficResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """System-wide statistics for the Dashboard page."""
    active_cameras = db.query(Camera).filter(Camera.active == True).count()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    threats_today = db.query(Event).filter(Event.timestamp >= today_start).count()

    # Compare with yesterday
    yesterday_start = today_start - timedelta(days=1)
    threats_yesterday = db.query(Event).filter(
        Event.timestamp >= yesterday_start,
        Event.timestamp < today_start,
    ).count()
    if threats_yesterday > 0:
        change_pct = round(((threats_today - threats_yesterday) / threats_yesterday) * 100)
    else:
        change_pct = 0

    return DashboardStats(
        active_cameras=active_cameras,
        threats_detected_today=threats_today,
        threats_change_pct=change_pct,
        system_uptime_pct=99.9,
        uptime_change_pct=0.1,
    )


@router.get("/foot-traffic", response_model=FootTrafficResponse)
def get_foot_traffic(window: str = "24h"):
    """
    Foot traffic data for chart visualization.
    Generates realistic-looking sine-wave based data.
    In production, this would aggregate actual detection counts.
    """
    if window == "1h":
        n_points = 12
        labels = [f"{i * 5}m" for i in range(n_points)]
    elif window == "6h":
        n_points = 12
        labels = [f"{i * 30}m" for i in range(n_points)]
    elif window == "7d":
        n_points = 7
        labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    else:  # 24h default
        n_points = 24
        labels = [f"{h:02d}:00" for h in range(24)]

    # Generate realistic foot-traffic curve (peaks at midday)
    import random
    random.seed(42)  # Deterministic for consistency
    values = []
    for i in range(n_points):
        # Sine curve peaking at ~60% through the period
        base = 0.3 + 0.5 * math.sin(math.pi * i / (n_points - 1))
        noise = random.uniform(-0.05, 0.05)
        values.append(round(max(0.0, min(1.0, base + noise)), 3))

    return FootTrafficResponse(window=window, labels=labels, values=values)
