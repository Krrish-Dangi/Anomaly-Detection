"""
SQLAlchemy ORM models for all database tables.
Covers: cameras, events, settings, analysis jobs, and users.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, JSON
)
from database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(String(20), unique=True, nullable=False)
    label = Column(String(50), nullable=False)
    location = Column(String(100), nullable=False)
    active = Column(Boolean, default=True)
    snapshot_url = Column(String(255), default="")
    stream_url = Column(String(255), default="")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(36), unique=True, default=generate_uuid, nullable=False)
    type = Column(String(50), nullable=False)  # ShelfTampering | Loitering | SuspiciousBehavior
    ucf_class = Column(String(50), nullable=True)  # Original UCF-Crime class
    camera_id = Column(String(20), nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    confidence = Column(Integer, nullable=False)  # 0-100
    frame_number = Column(Integer, nullable=True)
    thumbnail_url = Column(String(255), default="")
    clip_url = Column(String(255), default="")
    bbox_x = Column(Integer, nullable=True)
    bbox_y = Column(Integer, nullable=True)
    bbox_w = Column(Integer, nullable=True)
    bbox_h = Column(Integer, nullable=True)


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), unique=True, default=generate_uuid, nullable=False)
    status = Column(String(20), default="queued")  # queued | processing | done | failed
    video_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    people_detected = Column(Integer, default=0)
    objects_detected = Column(Integer, default=0)
    suspicious_events = Column(Integer, default=0)
    detection_logs = Column(JSON, default=list)  # List of log dicts
    error_message = Column(Text, nullable=True)


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(JSON, nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), default="Guest")
    email = Column(String(255), default="guest@gmail.com")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
