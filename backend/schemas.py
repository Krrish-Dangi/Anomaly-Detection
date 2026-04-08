"""
Pydantic schemas for API request/response models.
Matches the contract defined in ai_backend_plan_by_krrish.md.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Dashboard ──

class DashboardStats(BaseModel):
    active_cameras: int
    threats_detected_today: int
    threats_change_pct: float
    system_uptime_pct: float
    uptime_change_pct: float


class FootTrafficResponse(BaseModel):
    window: str
    labels: list[str]
    values: list[float]


# ── Cameras ──

class CameraSchema(BaseModel):
    camera_id: str
    label: str
    location: str
    active: bool
    snapshot_url: str
    stream_url: str

    class Config:
        from_attributes = True


class CamerasResponse(BaseModel):
    cameras: list[CameraSchema]


# ── Events ──

class BBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class EventSchema(BaseModel):
    event_id: str
    type: str
    camera_id: str
    timestamp: datetime
    confidence: int
    frame_number: Optional[int] = None
    thumbnail_url: str = ""
    clip_url: str = ""
    bbox: Optional[BBox] = None
    ucf_class: Optional[str] = None

    class Config:
        from_attributes = True


class EventChartData(BaseModel):
    labels: list[str]
    values: list[int]


class EventsResponse(BaseModel):
    total: int
    avg_confidence: int
    most_frequent_event: str
    chart: EventChartData
    events: list[EventSchema]


# ── Video Analysis ──

class DetectionLog(BaseModel):
    time: str
    text: str
    type: str  # info | warning | danger
    confidence: int


class AnalysisResponse(BaseModel):
    job_id: str
    status: str  # queued | processing | done | failed
    people_detected: int = 0
    objects_detected: int = 0
    suspicious_events: int = 0
    detection_logs: list[DetectionLog] = []
    events: list[EventSchema] = []


# ── Settings ──

class UserSettings(BaseModel):
    name: str = "Guest"
    email: str = "guest@gmail.com"


class AIDetectionSettings(BaseModel):
    suspicious_behavior: bool = True
    loitering: bool = True
    shelf_interaction: bool = True
    confidence_threshold: int = 80


class AlertSettings(BaseModel):
    desktop: bool = True
    email: bool = True
    sound: bool = True


class CameraConfig(BaseModel):
    camera_id: str
    location: str
    active: bool


class SystemSettings(BaseModel):
    dark_mode: bool = True
    data_retention: bool = False
    auto_export: bool = False


class FullSettings(BaseModel):
    user: UserSettings = UserSettings()
    ai_detection: AIDetectionSettings = AIDetectionSettings()
    alerts: AlertSettings = AlertSettings()
    cameras: list[CameraConfig] = []
    system: SystemSettings = SystemSettings()


# ── WebSocket ──

class DetectionMessage(BaseModel):
    label: str
    confidence: int
    bbox: BBox
    severity: str  # info | warning | danger


class WebSocketMessage(BaseModel):
    msg_type: str  # frame | detection | alert
    camera_id: str
    timestamp: datetime
    frame_url: str = ""
    detections: list[DetectionMessage] = []
    alert: Optional[EventSchema] = None
