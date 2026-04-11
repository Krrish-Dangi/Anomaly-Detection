"""
WebSocket routes for camera streaming infrastructure.

Two endpoint types:
  - WS /ws/ingest/{camera_id}  — Edge devices (phones) push frames here
  - WS /ws/live/{camera_id}    — Dashboard clients listen for live frames here
"""

import asyncio
import json
import random
import base64
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import UCF_CRIME_CLASSES, UCF_TO_FRONTEND_EVENT

router = APIRouter(tags=["WebSocket"])


# ─────────────────────────────────────────────
# Connection Manager
# ─────────────────────────────────────────────
class ConnectionManager:
    """
    Manages two pools of WebSocket connections per camera_id:
      - ingest: a single edge-device connection pushing frames
      - viewers: dashboard clients watching the live feed
    """

    def __init__(self):
        # camera_id -> WebSocket (one producer per camera)
        self.ingest_connections: Dict[str, WebSocket] = {}
        # camera_id -> [WebSocket, ...] (many consumers per camera)
        self.live_clients: Dict[str, List[WebSocket]] = {}

    # ── Ingest (producer) ──

    async def connect_ingest(self, camera_id: str, ws: WebSocket):
        await ws.accept()
        self.ingest_connections[camera_id] = ws
        print(f"[INGEST] Camera '{camera_id}' connected.")

    def disconnect_ingest(self, camera_id: str):
        self.ingest_connections.pop(camera_id, None)
        print(f"[INGEST] Camera '{camera_id}' disconnected.")

    def has_ingest(self, camera_id: str) -> bool:
        return camera_id in self.ingest_connections

    # ── Live viewers (consumers) ──

    async def connect_live(self, camera_id: str, ws: WebSocket):
        await ws.accept()
        if camera_id not in self.live_clients:
            self.live_clients[camera_id] = []
        self.live_clients[camera_id].append(ws)
        print(f"[LIVE] Viewer joined camera '{camera_id}' "
              f"(total: {len(self.live_clients[camera_id])})")

    def disconnect_live(self, camera_id: str, ws: WebSocket):
        if camera_id in self.live_clients:
            self.live_clients[camera_id] = [
                c for c in self.live_clients[camera_id] if c is not ws
            ]
            print(f"[LIVE] Viewer left camera '{camera_id}' "
                  f"(remaining: {len(self.live_clients[camera_id])})")

    async def broadcast_to_viewers(self, camera_id: str, data: bytes):
        """Send raw frame bytes to every dashboard viewer for this camera."""
        if camera_id not in self.live_clients:
            return
        dead = []
        for client in self.live_clients[camera_id]:
            try:
                # Send as base64 JSON so the browser <img> can consume it
                b64 = base64.b64encode(data).decode("ascii")
                await client.send_json({
                    "type": "frame",
                    "camera_id": camera_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "frame": b64,
                })
            except Exception:
                dead.append(client)
        # Clean up dead connections
        for d in dead:
            self.live_clients[camera_id] = [
                c for c in self.live_clients[camera_id] if c is not d
            ]

    def get_active_cameras(self) -> list:
        """Return list of camera_ids that have an active ingest stream."""
        return list(self.ingest_connections.keys())


manager = ConnectionManager()


# ─────────────────────────────────────────────
# Endpoint: Ingest frames from edge device
# ─────────────────────────────────────────────
@router.websocket("/ws/ingest/{camera_id}")
async def ingest_stream(websocket: WebSocket, camera_id: str):
    """
    Edge device (mobile phone) connects here and continuously
    sends binary JPEG/WebP frame data.
    """
    await manager.connect_ingest(camera_id, websocket)

    try:
        while True:
            # Receive raw image bytes from the mobile device
            data = await websocket.receive_bytes()
            # Immediately relay to all dashboard viewers
            await manager.broadcast_to_viewers(camera_id, data)
    except WebSocketDisconnect:
        manager.disconnect_ingest(camera_id)
    except Exception as e:
        print(f"[INGEST] Error for camera '{camera_id}': {e}")
        manager.disconnect_ingest(camera_id)


# ─────────────────────────────────────────────
# Endpoint: Dashboard viewers watch the feed
# ─────────────────────────────────────────────
@router.websocket("/ws/live/{camera_id}")
async def live_detection_stream(websocket: WebSocket, camera_id: str):
    """
    Dashboard clients connect here to receive live frames.

    If the camera has an active ingest stream, it receives real frames.
    Otherwise, it falls back to simulated detection data for demo purposes.
    """
    await manager.connect_live(camera_id, websocket)

    try:
        if manager.has_ingest(camera_id):
            # Real stream is active — frames are pushed by broadcast_to_viewers.
            # Keep the connection alive by waiting for incoming messages
            # (the client might send control messages like pause/resume).
            while True:
                # Just keep the connection alive; frames arrive via broadcast
                try:
                    msg = await asyncio.wait_for(
                        websocket.receive_text(), timeout=30.0
                    )
                    # Handle any control messages from the dashboard client
                    if msg == "ping":
                        await websocket.send_json({"type": "pong"})
                except asyncio.TimeoutError:
                    # Send a heartbeat to keep the connection alive
                    await websocket.send_json({"type": "heartbeat"})
        else:
            # No real camera — fall back to simulated detections
            frame_count = 0
            while True:
                frame_count += 1

                detections = []
                alert = None

                if random.random() < 0.3:
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

                if random.random() < 0.02:
                    ucf_class = random.choice(UCF_CRIME_CLASSES[1:])
                    frontend_type = UCF_TO_FRONTEND_EVENT.get(
                        ucf_class, "SuspiciousBehavior"
                    )
                    conf = random.randint(75, 98)

                    alert = {
                        "event_id": f"live-{camera_id}-{frame_count}",
                        "type": frontend_type,
                        "camera_id": camera_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "confidence": conf,
                        "frame_number": frame_count,
                        "thumbnail_url": (
                            f"/frames/{camera_id}_frame_{frame_count}.jpg"
                        ),
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
                    "type": (
                        "alert" if alert
                        else ("detection" if detections else "frame")
                    ),
                    "camera_id": camera_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "frame_url": f"/frames/{camera_id}_latest.jpg",
                    "detections": detections,
                    "alert": alert,
                }

                await websocket.send_json(message)
                await asyncio.sleep(1)

    except WebSocketDisconnect:
        manager.disconnect_live(camera_id, websocket)
    except Exception as e:
        print(f"[LIVE] Error for camera '{camera_id}': {e}")
        manager.disconnect_live(camera_id, websocket)


# ─────────────────────────────────────────────
# REST helper: list active cameras
# ─────────────────────────────────────────────
@router.get("/api/streams/active", tags=["Streams"])
async def get_active_streams():
    """Return list of camera_ids with active ingest streams."""
    return {"cameras": manager.get_active_cameras()}
