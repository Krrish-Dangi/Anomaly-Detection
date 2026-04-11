"""
Dashboard API routes.
GET /api/dashboard/stats — system overview stats (live from SQLite)
GET /api/dashboard/foot-traffic — real event-count chart data
"""

import math
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
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
        system_uptime_pct=0.0,
        uptime_change_pct=0.0,
    )


@router.get("/foot-traffic", response_model=FootTrafficResponse)
def get_foot_traffic(window: str = "24h", db: Session = Depends(get_db)):
    """
    Foot traffic / threat data for chart visualization.
    Aggregates REAL events from the SQLite database bucketed by time.
    Falls back to zeros if no events exist (clean chart).
    """
    now = datetime.now(timezone.utc)

    if window == "1h":
        n_points = 12
        interval_sec = 300  # 5 minutes
        cutoff = now - timedelta(hours=1)
        labels = [f"{i * 5}m" for i in range(n_points)]
    elif window == "6h":
        n_points = 12
        interval_sec = 1800  # 30 minutes
        cutoff = now - timedelta(hours=6)
        labels = [f"{i * 30}m" for i in range(n_points)]
    elif window == "7d":
        n_points = 7
        interval_sec = 86400  # 1 day
        cutoff = now - timedelta(days=7)
        labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    else:  # 24h default
        n_points = 24
        interval_sec = 3600  # 1 hour
        cutoff = now - timedelta(hours=24)
        labels = [f"{h:02d}:00" for h in range(24)]

    # Query all events in the window
    events = db.query(Event).filter(Event.timestamp >= cutoff).all()

    # Bucket events into time slots
    counts = [0] * n_points
    for event in events:
        # Calculate which bucket this event falls into
        if event.timestamp.tzinfo is None:
            event_time = event.timestamp.replace(tzinfo=timezone.utc)
        else:
            event_time = event.timestamp
        delta = (event_time - cutoff).total_seconds()
        bucket = int(delta / interval_sec)
        if 0 <= bucket < n_points:
            counts[bucket] += 1

    # Normalize to 0.0-1.0 range for the chart
    max_count = max(counts) if max(counts) > 0 else 1
    values = [round(c / max_count, 3) for c in counts]

    return FootTrafficResponse(window=window, labels=labels, values=values)
