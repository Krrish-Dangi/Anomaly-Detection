"""
Events API routes.
GET /api/events — filtered event history with chart data
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from collections import Counter

from database import get_db
from models import Event
from schemas import EventSchema, EventsResponse, EventChartData, BBox

router = APIRouter(prefix="/api", tags=["Events"])


@router.get("/events", response_model=EventsResponse)
def get_events(
    date_range: str = Query("last7", regex="^(last7|last30|last90)$"),
    event_type: str = Query("all"),
    camera_id: str = Query("all"),
    min_confidence: int = Query(0, ge=0, le=100),
    db: Session = Depends(get_db),
):
    """
    Return filtered events with statistics and chart data.
    Replaces the hardcoded incidentData[] in EventHistory.jsx.
    """
    now = datetime.now(timezone.utc)

    # Date filter
    days_map = {"last7": 7, "last30": 30, "last90": 90}
    cutoff = now - timedelta(days=days_map.get(date_range, 7))

    query = db.query(Event).filter(Event.timestamp >= cutoff)

    # Event type filter
    if event_type != "all":
        query = query.filter(Event.type == event_type)

    # Camera filter
    if camera_id != "all":
        query = query.filter(Event.camera_id == camera_id)

    # Confidence filter
    query = query.filter(Event.confidence >= min_confidence)

    events = query.order_by(Event.timestamp.desc()).all()

    # Build event schemas
    event_schemas = []
    for e in events:
        bbox = None
        if e.bbox_x is not None:
            bbox = BBox(x=e.bbox_x, y=e.bbox_y, w=e.bbox_w, h=e.bbox_h)
        event_schemas.append(EventSchema(
            event_id=e.event_id,
            type=e.type,
            camera_id=e.camera_id,
            timestamp=e.timestamp,
            confidence=e.confidence,
            frame_number=e.frame_number,
            thumbnail_url=e.thumbnail_url,
            clip_url=e.clip_url,
            bbox=bbox,
            ucf_class=e.ucf_class,
        ))

    # Statistics
    total = len(event_schemas)
    avg_conf = round(sum(e.confidence for e in event_schemas) / total) if total > 0 else 0
    type_counts = Counter(e.type for e in event_schemas)
    most_frequent = type_counts.most_common(1)[0][0] if type_counts else "—"

    # Chart data — aggregate events by month
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    month_counts = [0] * 12
    for e in events:
        month_counts[e.timestamp.month - 1] += 1

    chart = EventChartData(labels=month_names[:8], values=month_counts[:8])

    return EventsResponse(
        total=total,
        avg_confidence=avg_conf,
        most_frequent_event=most_frequent,
        chart=chart,
        events=event_schemas,
    )
