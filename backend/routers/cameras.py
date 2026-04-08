"""
Camera API routes.
GET /api/cameras — list all cameras
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Camera
from schemas import CameraSchema, CamerasResponse

router = APIRouter(prefix="/api", tags=["Cameras"])


@router.get("/cameras", response_model=CamerasResponse)
def get_cameras(db: Session = Depends(get_db)):
    """Return all cameras with their status and snapshot URLs."""
    cameras = db.query(Camera).all()
    return CamerasResponse(
        cameras=[CameraSchema.model_validate(cam) for cam in cameras]
    )
