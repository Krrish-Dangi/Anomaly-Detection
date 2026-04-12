"""
WebSocket routes for camera streaming infrastructure.

Two endpoint types:
  - WS /ws/ingest/{camera_id}  — Edge devices (phones) push frames here
  - WS /ws/live/{camera_id}    — Dashboard clients listen for live frames here

Hybrid Detection Pipeline:
  1. YOLOv8-Pose (skeletal tracking) → wrist velocity + interaction detection
  2. ResNet18+LSTM (temporal context) → UCF-Crime class probabilities
  3. Adaptive Weighted Fusion → combines both models intelligently
  4. Temporal Smoothing + Cooldown → prevents spam and false positives
"""

import asyncio
import json
import os
import uuid
import time
import threading
import random
import base64
import cv2
import numpy as np
from collections import deque
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import (
    UCF_CRIME_CLASSES, UCF_TO_FRONTEND_EVENT,
    CLIP_LENGTH, FRAME_SIZE, NUM_CLASSES, BASE_DIR, CLIPS_DIR
)

router = APIRouter(tags=["WebSocket"])


# ─────────────────────────────────────────────
# Global AI caches (loaded once, shared across cameras)
# ─────────────────────────────────────────────

_trackers: dict[str, "LiveTracker"] = {}

# LSTM detector singleton — heavy, loaded once
_lstm_cache = {"instance": None, "attempted": False}


def _get_lstm_detector():
    """Get or create a cached AnomalyDetector (ResNet18+LSTM) instance."""
    if not _lstm_cache["attempted"]:
        _lstm_cache["attempted"] = True
        try:
            from ai.detector import AnomalyDetector
            det = AnomalyDetector()
            if det.model is not None:
                _lstm_cache["instance"] = det
                print("[OK] LSTM AnomalyDetector loaded and cached for live streams")
            else:
                print("[WARN] LSTM model weights not found — live UCF detection will use mock")
                _lstm_cache["instance"] = det  # still usable for mock
        except Exception as e:
            print(f"[WARN] Failed to load LSTM detector for live streams: {e}")
            _lstm_cache["instance"] = None
    return _lstm_cache["instance"]


def _get_tracker(camera_id: str):
    """Get or create a LiveTracker (YOLO-Pose) for a camera."""
    if camera_id not in _trackers:
        from ai.live_tracker import LiveTracker
        _trackers[camera_id] = LiveTracker(confidence=0.4, loiter_time_sec=10.0)
    return _trackers[camera_id]


# ─────────────────────────────────────────────
# Per-camera LSTM frame buffer for UCF detection
# ─────────────────────────────────────────────

# camera_id -> list of preprocessed numpy frames (CHW float32)
_lstm_frame_buffers: dict[str, list] = {}
# camera_id -> list of raw prediction probability arrays (for temporal smoothing)
_lstm_prob_buffers: dict[str, list] = {}
# camera_id -> raw frame idx counter
_lstm_frame_counters: dict[str, int] = {}
# camera_id -> threading.Lock to protect buffer
_lstm_locks: dict[str, threading.Lock] = {}
# camera_id -> latest crime detection results for dashboard stats broadcast
_live_crime_stats: dict[str, dict] = {}

# How often to run LSTM inference (process a clip every N ingested frames)
# With camera at ~7.5 FPS and CLIP_LENGTH=16, every 16 frames ≈ 2.1 seconds
# We use a stride of 8 (overlap 50%) so inference runs every ~1 second
LSTM_STRIDE = max(CLIP_LENGTH // 2, 4)


# ─────────────────────────────────────────────
# Hybrid Fusion Engine State (per camera)
# ─────────────────────────────────────────────

# camera_id -> latest pose heuristic data from LiveTracker
_pose_data: dict[str, dict] = {}

# camera_id -> deque of smoothed confidence values for temporal gating
_hybrid_conf_buffers: dict[str, deque] = {}

# camera_id -> timestamp of last alert (for cooldown)
_last_alert_times: dict[str, float] = {}

# Fusion Constants
CONF_THRESHOLD = 0.90        # minimum smoothed confidence to trigger alert
COOLDOWN_SECONDS = 3.0       # minimum seconds between consecutive alerts
SMOOTHING_ALPHA = 0.6        # exponential smoothing weight for current frame
MOTION_THRESHOLD = 15.0      # avg wrist velocity to consider as "motion present"


# ─────────────────────────────────────────────
# Video Clip Recording Engine — Event-Based State Machine (Time-Driven)
# ─────────────────────────────────────────────
#
# Design:
#   _tick_recording() is called for EVERY ingested frame and handles ALL logic:
#     1. Maintains a rolling pre-roll buffer (_raw_buffers).
#     2. Tracks active anomaly events in _active_events.
#     3. Uses wall-clock time (not frame counts) for all phase transitions:
#        - RECORDING: anomaly is active. Frames accumulate.
#        - POST_ROLL: anomaly stopped. After 5s of silence, clip is saved.
#     4. Only ONE history entry per event. Continuous anomaly = ONE event.
#
#   _on_anomaly_detected() is called from the inference thread:
#     - If no active event: starts a new one (returns True → caller logs + broadcasts)
#     - If active event: refreshes last_anomaly_time and returns False (no duplicate)
#

# Timing constants
PRE_ROLL_SECONDS = 5.0     # seconds of footage before anomaly start
POST_ROLL_SECONDS = 5.0    # seconds of silence after anomaly ends before saving
ANOMALY_STALE_SECONDS = 3.0  # if no anomaly detection for this long, start post-roll
PRE_ROLL_FRAMES = 58       # ~7.7s at 7.5 FPS (generous buffer for 5s pre-roll)

# camera_id -> deque of recent raw frames (BGR numpy arrays)
_raw_buffers: dict[str, deque] = {}

# camera_id -> active event state dict or None
# {
#     "event_id": str,
#     "phase": "RECORDING" | "POST_ROLL",
#     "frames": list[np.ndarray],
#     "anomaly_count": int,
#     "last_anomaly_time": float,     # time.time() of the most recent anomaly detection
#     "post_roll_deadline": float,    # time.time() when POST_ROLL should end and clip is saved
#     "alert_data": dict,             # the original alert payload
# }
_active_events: dict[str, dict] = {}


def _save_clip_to_disk(camera_id: str, event_id: str, frames: list, anomaly_count: int):
    """Background thread: write accumulated frames to a single MP4 clip on disk."""
    if not frames:
        print(f"[CLIP] ⚠️ No frames to save for event {event_id[:8]}… on {camera_id}")
        return
    try:
        cam_dir = CLIPS_DIR / camera_id
        cam_dir.mkdir(parents=True, exist_ok=True)
        out_path = str(cam_dir / f"{event_id}.mp4")

        h, w = frames[0].shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        writer = cv2.VideoWriter(out_path, fourcc, 7.5, (w, h))
        if not writer.isOpened():
            print(f"[CLIP] ❌ Failed to open VideoWriter for {out_path}")
            return
        for f in frames:
            writer.write(f)
        writer.release()

        duration_sec = round(len(frames) / 7.5, 1)
        print(f"[CLIP] ✅ Saved {out_path} — {len(frames)} frames, "
              f"~{duration_sec}s, {anomaly_count} anomaly detections bundled")
    except Exception as e:
        print(f"[CLIP] ❌ Error saving clip for {camera_id}: {e}")


def _on_anomaly_detected(camera_id: str, alert_data: dict):
    """
    Called from the inference thread when an anomaly is confirmed.
    Returns True if this is a NEW event (caller should broadcast), False if extending existing.
    """
    now = time.time()

    with _pending_alerts_lock:
        evt = _active_events.get(camera_id)

        if evt is not None:
            # ── Existing event: extend it ──
            evt["phase"] = "RECORDING"
            evt["last_anomaly_time"] = now
            evt["anomaly_count"] += 1
            return False  # suppress duplicate alert — same event continues

        # ── New event: start recording ──
        event_id = alert_data["event_id"]
        pre_roll = list(_raw_buffers.get(camera_id, []))[-PRE_ROLL_FRAMES:]

        _active_events[camera_id] = {
            "event_id": event_id,
            "phase": "RECORDING",
            "frames": list(pre_roll),           # seed with ~5s of past footage
            "anomaly_count": 1,
            "last_anomaly_time": now,
            "post_roll_deadline": 0.0,
            "alert_data": alert_data,
        }
        print(f"[CLIP] 🎬 New event started on {camera_id} — pre-roll: {len(pre_roll)} frames")
        return True  # new event, caller should log + broadcast


def _tick_recording(camera_id: str, frame: np.ndarray):
    """
    Called for EVERY ingested frame. Handles ALL recording logic autonomously:
      1. Always append frame to _raw_buffers (rolling pre-roll window).
      2. If an event is active, append the frame to the event.
      3. Phase transitions are driven by wall-clock time:
         - RECORDING → POST_ROLL: when no anomaly detected for ANOMALY_STALE_SECONDS
         - POST_ROLL → finalize:  when post_roll_deadline is reached
         - POST_ROLL → RECORDING: if _on_anomaly_detected() resets the phase
    """
    # 1. Always maintain the rolling pre-roll buffer
    if camera_id not in _raw_buffers:
        _raw_buffers[camera_id] = deque(maxlen=PRE_ROLL_FRAMES)
    _raw_buffers[camera_id].append(frame.copy())

    # 2. Check for active event
    with _pending_alerts_lock:
        evt = _active_events.get(camera_id)
        if evt is None:
            return

        now = time.time()

        # Append the current frame to the event clip
        evt["frames"].append(frame.copy())

        if evt["phase"] == "RECORDING":
            # Check if anomaly has gone stale → transition to POST_ROLL
            silence_duration = now - evt["last_anomaly_time"]
            if silence_duration >= ANOMALY_STALE_SECONDS:
                evt["phase"] = "POST_ROLL"
                evt["post_roll_deadline"] = now + POST_ROLL_SECONDS
                print(f"[CLIP] ⏳ Event {evt['event_id'][:8]}… entering post-roll "
                      f"({evt['anomaly_count']} detections so far)")

        elif evt["phase"] == "POST_ROLL":
            # Check if post-roll deadline has passed → finalize clip
            if now >= evt["post_roll_deadline"]:
                finished_evt = _active_events.pop(camera_id)
                threading.Thread(
                    target=_save_clip_to_disk,
                    args=(
                        camera_id,
                        finished_evt["event_id"],
                        finished_evt["frames"],
                        finished_evt["anomaly_count"],
                    ),
                    daemon=True,
                ).start()
                print(f"[CLIP] 🎬 Event {finished_evt['event_id'][:8]}… finalized — "
                      f"{len(finished_evt['frames'])} total frames, "
                      f"{finished_evt['anomaly_count']} anomaly detections")


def _preprocess_frame_for_lstm(frame_bgr: np.ndarray) -> np.ndarray:
    """Preprocess a single BGR frame for the ResNet18+LSTM model."""
    resized = cv2.resize(frame_bgr, FRAME_SIZE)
    resized = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    resized = resized.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    resized = (resized - mean) / std
    resized = resized.transpose(2, 0, 1)  # HWC -> CHW
    return resized


def _run_lstm_on_clip(camera_id: str, clip_frames: np.ndarray) -> dict | None:
    """
    Run LSTM inference on a single clip.
    Returns the raw LSTM result dict (class, confidence) WITHOUT fusion.
    The fusion engine handles the final decision separately.
    """
    detector = _get_lstm_detector()
    if detector is None:
        return None

    import torch
    num_classes = len(UCF_CRIME_CLASSES)

    # ─── MOTION GATE ───
    # If the scene is completely static, the LSTM hallucinates crimes.
    motion_score = float(np.mean(np.abs(clip_frames[-1] - clip_frames[0])))

    if motion_score < 0.15:
        return {"lstm_class": "Normal", "lstm_conf": 0.0, "lstm_probs": None}

    if detector.model is not None:
        detector.model.eval()
        with torch.no_grad():
            tensor = torch.FloatTensor(clip_frames).unsqueeze(0).to(detector.device)
            logits = detector.model(tensor)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]  # Shape: (14,)
    else:
        # Mock inference probabilities
        probs = np.zeros(num_classes)
        if random.random() < 0.85:
            probs[0] = 1.0  # Normal
        else:
            class_idx = random.randint(1, num_classes - 1)
            probs[class_idx] = random.uniform(0.70, 0.97)
            probs[0] = 1.0 - probs[class_idx]

    class_idx = int(np.argmax(probs))
    conf = float(probs[class_idx])
    class_name = UCF_CRIME_CLASSES[class_idx]

    return {
        "lstm_class": class_name,
        "lstm_conf": conf,
        "lstm_probs": probs,
    }


def compute_hybrid_alert(
    pose_conf: float,
    lstm_conf: float,
    lstm_class: str,
    motion_score: float,
    person_count: int,
    interaction_score: int,
) -> dict:
    """
    Adaptive Weighted Fusion Engine.

    Combines YOLOv8-Pose heuristic confidence with LSTM temporal confidence
    using dynamic weighting based on scene conditions.

    Returns:
        {
            "final_conf": float,
            "final_class": str,
            "decision_mode": str,
            "reason_tags": [str],
            "severity_level": str,
        }
    """
    reason_tags = []

    # ─── Adaptive Weighting ───
    if pose_conf > 0.85:
        final_conf = 0.7 * pose_conf + 0.3 * lstm_conf
        decision_mode = "POSE_DOMINANT"
        reason_tags.append("High wrist velocity")
    elif motion_score > MOTION_THRESHOLD:
        final_conf = 0.6 * pose_conf + 0.4 * lstm_conf
        decision_mode = "MOTION_BLEND"
    else:
        final_conf = 0.4 * pose_conf + 0.6 * lstm_conf
        decision_mode = "LSTM_DOMINANT"

    # ─── Class Selection ───
    if pose_conf > lstm_conf:
        final_class = "Fighting"
    else:
        final_class = lstm_class

    # ─── False Positive Killers ───
    if person_count == 1:
        final_conf *= 0.5
        reason_tags.append("Single person penalty applied")
    
    if interaction_score == 0:
        final_conf *= 0.6
        reason_tags.append("No close interaction detected")
    else:
        reason_tags.append("Close proximity interaction")

    # ─── Confidence Cap ───
    final_conf = min(final_conf, 0.99)

    # ─── Severity Label ───
    if final_conf > 0.90:
        severity_level = "HIGH"
    elif final_conf > 0.75:
        severity_level = "MEDIUM"
    else:
        severity_level = "LOW"

    return {
        "final_conf": round(final_conf, 4),
        "final_class": final_class,
        "decision_mode": decision_mode,
        "reason_tags": reason_tags,
        "severity_level": severity_level,
    }


# ─────────────────────────────────────────────
# File-based event logging
# ─────────────────────────────────────────────

LOGS_DIR = BASE_DIR / "logs" / "cameras"


def _log_event_to_file(camera_id: str, event_data: dict):
    """Append a JSON event line to backend/logs/cameras/<camera_id>/event.log"""
    cam_log_dir = LOGS_DIR / camera_id
    cam_log_dir.mkdir(parents=True, exist_ok=True)
    log_file = cam_log_dir / "event.log"
    entry = {
        "timestamp": event_data.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "event_id": event_data.get("event_id", str(uuid.uuid4())),
        "ucf_class": event_data.get("ucf_class", "Unknown"),
        "type": event_data.get("type", "SuspiciousBehavior"),
        "confidence": event_data.get("confidence", 0),
        "camera_id": camera_id,
        "message": event_data.get("message", ""),
        "severity_level": event_data.get("severity_level", ""),
        "decision_mode": event_data.get("decision_mode", ""),
        "reason_tags": event_data.get("reason_tags", []),
    }
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[LOG] Event written to {log_file}: {entry['ucf_class']} ({entry['confidence']}%)")


def _save_event_to_db(event_data: dict):
    """Save a detected crime event to the local SQLite database."""
    try:
        from database import SessionLocal
        from models import Event
        db = SessionLocal()
        event = Event(
            event_id=event_data.get("event_id", str(uuid.uuid4())),
            type=event_data.get("type", "SuspiciousBehavior"),
            ucf_class=event_data.get("ucf_class", "Unknown"),
            camera_id=event_data.get("camera_id", "LIVE"),
            timestamp=datetime.now(timezone.utc),
            confidence=event_data.get("confidence", 0),
            clip_url=event_data.get("clip_url", ""),
            frame_number=0,
        )
        db.add(event)
        db.commit()
        db.close()
    except Exception as e:
        print(f"[WARN] Failed to save live event to DB: {e}")


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

    async def broadcast_alert(self, camera_id: str, alert_data: dict, data: bytes):
        """Send an explicit alert event along with the snapshot bytes to all viewers."""
        if camera_id not in self.live_clients:
            return
        dead = []
        b64 = base64.b64encode(data).decode("ascii")
        for client in self.live_clients[camera_id]:
            try:
                await client.send_json({
                    "type": "alert",
                    "camera_id": camera_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "frame": b64,
                    "alert": alert_data
                })
            except Exception:
                dead.append(client)
        
        # Clean up dead connections
        for d in dead:
            self.live_clients[camera_id] = [
                c for c in self.live_clients[camera_id] if c is not d
            ]

    async def broadcast_crime_alert(self, camera_id: str, crime_data: dict, frame_bytes: bytes):
        """Broadcast a hybrid crime detection alert to all viewers of a camera."""
        if camera_id not in self.live_clients:
            return
        dead = []
        b64 = base64.b64encode(frame_bytes).decode("ascii")
        for client in self.live_clients[camera_id]:
            try:
                await client.send_json({
                    "type": "crime_alert",
                    "camera_id": camera_id,
                    "timestamp": crime_data.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    "frame": b64,
                    "alert": crime_data,
                })
            except Exception:
                dead.append(client)
        for d in dead:
            self.live_clients[camera_id] = [
                c for c in self.live_clients[camera_id] if c is not d
            ]

    def get_active_cameras(self) -> list:
        """Return list of camera_ids that have an active ingest stream."""
        return list(self.ingest_connections.keys())


manager = ConnectionManager()


# ─────────────────────────────────────────────
# Background LSTM inference thread per camera
# ─────────────────────────────────────────────

# Pending crime alerts to broadcast (filled by bg thread, consumed by async loop)
# camera_id -> list of crime_data_dicts
_pending_crime_alerts: dict[str, list] = {}
_pending_alerts_lock = threading.Lock()


def _lstm_inference_loop(camera_id: str):
    """
    Background thread that continuously checks the frame buffer for camera_id.
    When enough frames are accumulated, runs LSTM and then fuses with pose data
    through the hybrid engine. Queues alerts if the fusion output passes all filters.
    """
    print(f"[HYBRID] Inference thread started for camera '{camera_id}'")

    while True:
        lock = _lstm_locks.get(camera_id)
        if lock is None:
            break  # camera disconnected

        time.sleep(0.3)  # Check every 300ms

        with lock:
            buf = _lstm_frame_buffers.get(camera_id, [])
            if len(buf) < CLIP_LENGTH:
                continue
            # Take a clip and slide the window
            clip_frames = np.array(buf[:CLIP_LENGTH])
            _lstm_frame_buffers[camera_id] = buf[LSTM_STRIDE:]

        # ── Step 1: Run LSTM inference ──
        lstm_result = _run_lstm_on_clip(camera_id, clip_frames)
        if lstm_result is None:
            continue

        lstm_class = lstm_result["lstm_class"]
        lstm_conf = lstm_result["lstm_conf"]

        # ── Step 2: Read latest pose heuristic data from tracker ──
        pose_data = _pose_data.get(camera_id, {})
        pose_conf = pose_data.get("pose_conf", 0.0)
        person_count = pose_data.get("person_count", 0)
        interaction_score = pose_data.get("interaction_score", 0)
        avg_wrist_velocity = pose_data.get("avg_wrist_velocity", 0.0)

        # ── Step 3: Hybrid Fusion ──
        fusion = compute_hybrid_alert(
            pose_conf=pose_conf,
            lstm_conf=lstm_conf,
            lstm_class=lstm_class,
            motion_score=avg_wrist_velocity,
            person_count=person_count,
            interaction_score=interaction_score,
        )

        final_conf = fusion["final_conf"]
        final_class = fusion["final_class"]
        decision_mode = fusion["decision_mode"]
        reason_tags = fusion["reason_tags"]
        severity_level = fusion["severity_level"]

        # ── Decision Transparency Logging ──
        print(f"[HYBRID-LOG] cam={camera_id} | "
              f"pose={pose_conf:.2f} lstm={lstm_conf:.2f} -> final={final_conf:.2f} | "
              f"class={final_class} | mode={decision_mode} | "
              f"persons={person_count} interact={interaction_score} | "
              f"severity={severity_level} | reasons={reason_tags}")

        # ── Step 4: Temporal Smoothing ──
        conf_buffer = _hybrid_conf_buffers.get(camera_id)
        if conf_buffer is None:
            continue

        if len(conf_buffer) > 0:
            prev_conf = conf_buffer[-1]
            smooth_conf = SMOOTHING_ALPHA * final_conf + (1 - SMOOTHING_ALPHA) * prev_conf
        else:
            smooth_conf = final_conf
        conf_buffer.append(smooth_conf)

        # ── Step 5: Alert Gating ──
        is_anomaly = False

        # Only consider anomalous if class is NOT Normal
        if final_class != "Normal":
            # Require last 5 smoothed values all above threshold
            recent = list(conf_buffer)[-5:]
            if len(recent) >= 5 and all(c > CONF_THRESHOLD for c in recent):
                is_anomaly = True

        if is_anomaly:
            # ── Anomaly confirmed: notify the event state machine ──
            conf_percent = int(smooth_conf * 100)
            frontend_type = UCF_TO_FRONTEND_EVENT.get(final_class, "SuspiciousBehavior")

            event_id = str(uuid.uuid4())
            clip_url = f"/clips/{camera_id}/{event_id}.mp4"

            alert_data = {
                "event_id": event_id,
                "type": frontend_type,
                "ucf_class": final_class,
                "confidence": conf_percent,
                "camera_id": camera_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"{final_class} detected on {camera_id} ({conf_percent}%)",
                "severity_level": severity_level,
                "decision_mode": decision_mode,
                "reason_tags": reason_tags,
                "clip_url": clip_url,
            }

            is_new_event = _on_anomaly_detected(camera_id, alert_data)

            if is_new_event:
                # This is the START of a brand-new anomaly event.
                # Log, save to DB, and broadcast ONCE.
                print(f"[HYBRID] 🚨 {final_class} on {camera_id} ({conf_percent}%) "
                      f"[{severity_level}] [{decision_mode}]")

                _log_event_to_file(camera_id, alert_data)
                _save_event_to_db(alert_data)

                with _pending_alerts_lock:
                    if camera_id not in _pending_crime_alerts:
                        _pending_crime_alerts[camera_id] = []
                    _pending_crime_alerts[camera_id].append(alert_data)
            # else: existing event extended silently — no duplicate log/alert
        # else: no anomaly this cycle — _tick_recording() handles post-roll transition automatically

        # Check if camera still active
        if camera_id not in _lstm_locks:
            break

    print(f"[HYBRID] Inference thread stopped for camera '{camera_id}'")


def _start_lstm_for_camera(camera_id: str):
    """Initialize LSTM buffers, hybrid state, and start the background inference thread."""
    _lstm_frame_buffers[camera_id] = []
    _lstm_prob_buffers[camera_id] = []
    _lstm_frame_counters[camera_id] = 0
    _lstm_locks[camera_id] = threading.Lock()
    _live_crime_stats[camera_id] = {"total_crimes": 0, "latest": None}

    # Hybrid fusion state
    _pose_data[camera_id] = {}
    _hybrid_conf_buffers[camera_id] = deque(maxlen=10)
    _last_alert_times[camera_id] = 0.0

    thread = threading.Thread(
        target=_lstm_inference_loop,
        args=(camera_id,),
        daemon=True,
    )
    thread.start()


def _stop_lstm_for_camera(camera_id: str):
    """Clean up LSTM + hybrid resources for a camera."""
    _lstm_frame_buffers.pop(camera_id, None)
    _lstm_prob_buffers.pop(camera_id, None)
    _lstm_frame_counters.pop(camera_id, None)
    _lstm_locks.pop(camera_id, None)  # thread will exit on next iteration
    _live_crime_stats.pop(camera_id, None)
    _pose_data.pop(camera_id, None)
    _hybrid_conf_buffers.pop(camera_id, None)
    _last_alert_times.pop(camera_id, None)
    _raw_buffers.pop(camera_id, None)
    _active_events.pop(camera_id, None)
    with _pending_alerts_lock:
        _pending_crime_alerts.pop(camera_id, None)


def _feed_frame_to_lstm(camera_id: str, frame_bgr: np.ndarray):
    """Add a preprocessed frame to the LSTM buffer (called from ingest loop)."""
    lock = _lstm_locks.get(camera_id)
    if lock is None:
        return

    # Preprocess
    preprocessed = _preprocess_frame_for_lstm(frame_bgr)

    with lock:
        _lstm_frame_buffers[camera_id].append(preprocessed)
        _lstm_frame_counters[camera_id] = _lstm_frame_counters.get(camera_id, 0) + 1

        # Cap buffer size to prevent memory explosion (keep last 64 frames)
        if len(_lstm_frame_buffers[camera_id]) > 64:
            _lstm_frame_buffers[camera_id] = _lstm_frame_buffers[camera_id][-64:]


# ─────────────────────────────────────────────
# Endpoint: Ingest frames from edge device
# ─────────────────────────────────────────────
@router.websocket("/ws/ingest/{camera_id}")
async def ingest_stream(websocket: WebSocket, camera_id: str):
    """
    Edge device (mobile phone) connects here and continuously
    sends binary JPEG/WebP frame data.
    
    Every frame:
      1. YOLOv8-Pose tracking → bounding boxes + pose heuristics
      2. Feed into LSTM buffer → background thread runs hybrid fusion
      3. Broadcast annotated frame to dashboard viewers
    """
    await manager.connect_ingest(camera_id, websocket)
    tracker = _get_tracker(camera_id)
    tracker.reset()

    # Start background LSTM + Hybrid inference for this camera
    _start_lstm_for_camera(camera_id)

    # Pre-warm the LSTM detector on first camera connect
    _get_lstm_detector()

    try:
        while True:
            # Receive raw image bytes from the mobile device
            data = await websocket.receive_bytes()
            
            # Decode for YOLO-Pose tracking
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is not None:
                # Tick the recording state machine (handles pre-roll buffer + active recording + post-roll finalization)
                _tick_recording(camera_id, frame)

                result = tracker.process_frame(frame)
                
                # Feed every frame to LSTM buffer (background thread handles inference)
                _feed_frame_to_lstm(camera_id, frame)

                # ── Store pose data for hybrid fusion engine ──
                _pose_data[camera_id] = {
                    "pose_conf": result.get("pose_conf", 0.0),
                    "person_count": result.get("person_count", 0),
                    "interaction_score": result.get("interaction_score", 0),
                    "avg_wrist_velocity": result.get("avg_wrist_velocity", 0.0),
                }

                # Draw YOLO bounding boxes on frame
                for box in result["boxes"]:
                    x, y, w, h = box["x"], box["y"], box["w"], box["h"]
                    is_alert = any(a.get("track_id") == box["id"] for a in result["alerts"])
                    color = (0, 0, 255) if is_alert else (0, 255, 0)
                    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
                    cv2.putText(frame, f"ID: {box['id']}", (x, max(0, y - 10)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                # Draw YOLO-based alerts (loitering, etc.)
                for alert in result["alerts"]:
                    cv2.putText(frame, f"ALERT: {alert['type']}", (10, 30),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

                # Check for pending hybrid crime alerts from the background thread
                pending = []
                with _pending_alerts_lock:
                    if camera_id in _pending_crime_alerts and _pending_crime_alerts[camera_id]:
                        pending = _pending_crime_alerts[camera_id][:]
                        _pending_crime_alerts[camera_id] = []

                # Draw hybrid crime label on frame if we just got an alert
                for crime in pending:
                    sev = crime.get("severity_level", "")
                    label = f"{sev} THREAT: {crime['ucf_class']} ({crime['confidence']}%)"
                    cv2.putText(frame, label, (10, 65),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)

                # Re-encode annotated frame
                ret, buffer = cv2.imencode('.jpg', frame)
                if ret:
                    data = buffer.tobytes()
                    
                # Broadcast YOLO alerts to viewers
                for alert in result["alerts"]:
                    await manager.broadcast_alert(camera_id, alert, data)

                # Broadcast hybrid crime alerts to viewers
                for crime in pending:
                    await manager.broadcast_crime_alert(camera_id, crime, data)

            # Relay the annotated frame to all dashboard viewers
            await manager.broadcast_to_viewers(camera_id, data)

    except WebSocketDisconnect:
        manager.disconnect_ingest(camera_id)
    except Exception as e:
        print(f"[INGEST] Error for camera '{camera_id}': {e}")
        manager.disconnect_ingest(camera_id)
    finally:
        _stop_lstm_for_camera(camera_id)
        if camera_id in _trackers:
            _trackers[camera_id].reset()


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
