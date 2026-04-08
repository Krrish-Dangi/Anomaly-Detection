"""
Seed the database with initial demo data:
cameras, sample events, and default settings.
"""

import sys
from datetime import datetime, timezone, timedelta
from database import engine, SessionLocal, Base
from models import Camera, Event, Settings, User


def seed():
    """Drop and recreate all tables, then insert demo rows."""
    print("[DB] Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── Only seed if empty ──
        if db.query(Camera).count() > 0:
            print("[SKIP] Database already seeded. Skipping.")
            return

        # ── Cameras ──
        cameras = [
            Camera(camera_id="CAM-01", label="CAM-01", location="Entrance", active=True,
                   snapshot_url="/snapshots/cam01_latest.jpg", stream_url="rtsp://localhost/cam01"),
            Camera(camera_id="CAM-02", label="CAM-02", location="Aisle 3", active=True,
                   snapshot_url="/snapshots/cam02_latest.jpg", stream_url="rtsp://localhost/cam02"),
            Camera(camera_id="CAM-03", label="CAM-03", location="Checkout", active=True,
                   snapshot_url="/snapshots/cam03_latest.jpg", stream_url="rtsp://localhost/cam03"),
            Camera(camera_id="CAM-04", label="CAM-04", location="Stockroom", active=True,
                   snapshot_url="/snapshots/cam04_latest.jpg", stream_url="rtsp://localhost/cam04"),
        ]
        db.add_all(cameras)
        print("[OK] Cameras seeded: 4 cameras")

        # ── Sample events ──
        now = datetime.now(timezone.utc)
        events = [
            Event(type="ShelfTampering", ucf_class="Shoplifting", camera_id="CAM-01",
                  timestamp=now - timedelta(hours=2), confidence=94,
                  frame_number=401, thumbnail_url="/clips/cam01_shelf.jpg", clip_url="/clips/cam01_shelf.mp4",
                  bbox_x=120, bbox_y=80, bbox_w=200, bbox_h=300),
            Event(type="Loitering", ucf_class="Abuse", camera_id="CAM-02",
                  timestamp=now - timedelta(days=1), confidence=88,
                  thumbnail_url="/clips/cam02_loiter.jpg", clip_url="/clips/cam02_loiter.mp4",
                  bbox_x=200, bbox_y=150, bbox_w=120, bbox_h=250),
            Event(type="ShelfTampering", ucf_class="Stealing", camera_id="CAM-03",
                  timestamp=now - timedelta(days=2), confidence=91,
                  thumbnail_url="/clips/cam03_shelf.jpg", clip_url="/clips/cam03_shelf.mp4",
                  bbox_x=300, bbox_y=100, bbox_w=180, bbox_h=280),
            Event(type="ShelfTampering", ucf_class="Vandalism", camera_id="CAM-01",
                  timestamp=now - timedelta(days=4), confidence=96,
                  thumbnail_url="/clips/cam01_shelf2.jpg", clip_url="/clips/cam01_shelf2.mp4",
                  bbox_x=150, bbox_y=90, bbox_w=210, bbox_h=310),
            Event(type="SuspiciousBehavior", ucf_class="Assault", camera_id="CAM-02",
                  timestamp=now - timedelta(days=14), confidence=82,
                  thumbnail_url="/clips/cam02_suspicious.jpg", clip_url="/clips/cam02_suspicious.mp4",
                  bbox_x=180, bbox_y=120, bbox_w=160, bbox_h=270),
            Event(type="Loitering", ucf_class="Burglary", camera_id="CAM-04",
                  timestamp=now - timedelta(days=40), confidence=87,
                  thumbnail_url="/clips/cam04_loiter.jpg", clip_url="/clips/cam04_loiter.mp4",
                  bbox_x=250, bbox_y=130, bbox_w=140, bbox_h=260),
        ]
        db.add_all(events)
        print("[OK] Events seeded: 6 sample incidents")

        # ── Default settings ──
        default_settings = [
            Settings(key="ai_detection", value={
                "suspicious_behavior": True,
                "loitering": True,
                "shelf_interaction": True,
                "confidence_threshold": 80,
            }),
            Settings(key="alerts", value={
                "desktop": True,
                "email": True,
                "sound": True,
            }),
            Settings(key="system", value={
                "dark_mode": True,
                "data_retention": False,
                "auto_export": False,
            }),
        ]
        db.add_all(default_settings)
        print("[OK] Settings seeded: default config")

        # ── Default user ──
        user = User(name="Guest", email="guest@gmail.com")
        db.add(user)
        print("[OK] User seeded: Guest")

        db.commit()
        print("\n[OK] Database seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
