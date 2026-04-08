"""
Settings API routes.
GET  /api/settings — retrieve current settings
PUT  /api/settings — save/update settings
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Settings as SettingsModel, Camera, User
from schemas import (
    FullSettings, UserSettings, AIDetectionSettings,
    AlertSettings, CameraConfig, SystemSettings,
)

router = APIRouter(prefix="/api", tags=["Settings"])


def _load_setting(db: Session, key: str, default=None):
    """Helper to load a setting by key."""
    row = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    return row.value if row else default


def _save_setting(db: Session, key: str, value):
    """Helper to upsert a setting by key."""
    row = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SettingsModel(key=key, value=value))


@router.get("/settings", response_model=FullSettings)
def get_settings(db: Session = Depends(get_db)):
    """Return the full settings config."""
    # User
    user = db.query(User).first()
    user_settings = UserSettings(
        name=user.name if user else "Guest",
        email=user.email if user else "guest@gmail.com",
    )

    # AI Detection
    ai_data = _load_setting(db, "ai_detection", {})
    ai_settings = AIDetectionSettings(**ai_data) if ai_data else AIDetectionSettings()

    # Alerts
    alert_data = _load_setting(db, "alerts", {})
    alert_settings = AlertSettings(**alert_data) if alert_data else AlertSettings()

    # Cameras
    cameras = db.query(Camera).all()
    camera_configs = [
        CameraConfig(camera_id=c.camera_id, location=c.location, active=c.active)
        for c in cameras
    ]

    # System
    sys_data = _load_setting(db, "system", {})
    sys_settings = SystemSettings(**sys_data) if sys_data else SystemSettings()

    return FullSettings(
        user=user_settings,
        ai_detection=ai_settings,
        alerts=alert_settings,
        cameras=camera_configs,
        system=sys_settings,
    )


@router.put("/settings")
def update_settings(settings: FullSettings, db: Session = Depends(get_db)):
    """Save the full settings config."""
    # User profile
    user = db.query(User).first()
    if user:
        user.name = settings.user.name
        user.email = settings.user.email
    else:
        db.add(User(name=settings.user.name, email=settings.user.email))

    # AI Detection
    _save_setting(db, "ai_detection", settings.ai_detection.model_dump())

    # Alerts
    _save_setting(db, "alerts", settings.alerts.model_dump())

    # System
    _save_setting(db, "system", settings.system.model_dump())

    # Camera config
    for cam_cfg in settings.cameras:
        cam = db.query(Camera).filter(Camera.camera_id == cam_cfg.camera_id).first()
        if cam:
            cam.location = cam_cfg.location
            cam.active = cam_cfg.active

    db.commit()
    return {"status": "ok", "message": "Settings saved successfully"}
