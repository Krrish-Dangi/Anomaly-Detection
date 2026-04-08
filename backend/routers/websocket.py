"""
WebSocket route for live camera detection streaming.
WS /ws/live/{camera_id}
"""

import asyncio
import json
import random
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import UCF_CRIME_CLASSES, UCF_TO_FRONTEND_EVENT

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/live/{camera_id}")
async def live_detection_stream(websocket: WebSocket, camera_id: str):
    """
    WebSocket endpoint for real-time detection streaming.
    In production, this would read from a camera stream and run inference.
    For now, it sends simulated detection messages for demo purposes.
    """
    await websocket.accept()

    try:
        frame_count = 0
        while True:
            frame_count += 1

            # Simulate detections (every few frames)
            detections = []
            alert = None

            if random.random() < 0.3:  # 30% chance of a detection per frame
                detections.append({
                    "label": "Person",
                    "confidence": random.randint(85, 99),
                    "bbox": {
                        "x": random.randint(50, 400),
                        "y": random.randint(50, 300),
                        "w": random.randint(80, 200),
                        "h": random.randint(150, 350),
                    },
                    "severity": "info",
                })

            # Rare anomaly alert (2% chance)
            if random.random() < 0.02:
                ucf_class = random.choice(UCF_CRIME_CLASSES[1:])  # Exclude Normal
                frontend_type = UCF_TO_FRONTEND_EVENT.get(ucf_class, "SuspiciousBehavior")
                conf = random.randint(75, 98)

                alert = {
                    "event_id": f"live-{camera_id}-{frame_count}",
                    "type": frontend_type,
                    "camera_id": camera_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "confidence": conf,
                    "frame_number": frame_count,
                    "thumbnail_url": f"/frames/{camera_id}_frame_{frame_count}.jpg",
                    "clip_url": "",
                    "bbox": {"x": 120, "y": 80, "w": 200, "h": 300},
                    "ucf_class": ucf_class,
                }

                detections.append({
                    "label": frontend_type,
                    "confidence": conf,
                    "bbox": alert["bbox"],
                    "severity": "danger" if conf > 85 else "warning",
                })

            message = {
                "msg_type": "alert" if alert else ("detection" if detections else "frame"),
                "camera_id": camera_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "frame_url": f"/frames/{camera_id}_latest.jpg",
                "detections": detections,
                "alert": alert,
            }

            await websocket.send_json(message)
            await asyncio.sleep(1)  # ~1 FPS for demo

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {camera_id}")
    except Exception as e:
        print(f"WebSocket error for {camera_id}: {e}")
