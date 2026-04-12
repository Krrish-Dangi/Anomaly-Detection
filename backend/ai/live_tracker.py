"""
YOLOv8-Pose + BoT-SORT Live Tracker for real-time person detection & tracking.

This module handles:
  - Real-time person detection + pose estimation using YOLOv8n-pose
  - Persistent object tracking via BoT-SORT (built into ultralytics)
  - Skeletal heuristics: wrist velocity analysis for fighting detection
  - Interaction detection: inter-person distance for proximity awareness
  - Behavioral heuristics: loitering detection, zone breach alerts
  - Foot traffic counting over time windows

Used by:
  - WebSocket /ws/ingest/{camera_id}  for live dashboard feed
  - /api/dashboard/foot-traffic      for chart data
  - detector.py                      for person counting in video uploads
"""

import time
import math
from collections import deque
from itertools import combinations
from typing import Optional
from pathlib import Path

import cv2
import numpy as np
import torch

# GPU Device Selection: Safely attempts to use GPU 1, falls back to GPU 0, then CPU
DEVICE = "cuda:1" if torch.cuda.device_count() > 1 else ("cuda:0" if torch.cuda.is_available() else "cpu")

# Lazy import — ultralytics is heavy and not needed until first use
_yolo_pose_model = None
_yolo_detect_model = None


def _get_yolo_pose_model():
    """Lazy-load YOLOv8n-pose model on first call (for live tracking with keypoints)."""
    global _yolo_pose_model
    if _yolo_pose_model is None:
        try:
            from ultralytics import YOLO
            _yolo_pose_model = YOLO("yolov8n-pose.pt")
            print("[OK] YOLOv8n-pose model loaded for skeletal tracking")
        except Exception as e:
            print(f"[WARN] Failed to load YOLOv8n-pose: {e}")
            _yolo_pose_model = False  # Sentinel — don't retry
    return _yolo_pose_model if _yolo_pose_model is not False else None


def _get_yolo_model():
    """Lazy-load standard YOLOv8n model (for video upload person counting only)."""
    global _yolo_detect_model
    if _yolo_detect_model is None:
        try:
            from ultralytics import YOLO
            _yolo_detect_model = YOLO("yolov8n.pt")
            print("[OK] YOLOv8n model loaded for person detection")
        except Exception as e:
            print(f"[WARN] Failed to load YOLOv8n: {e}")
            _yolo_detect_model = False  # Sentinel — don't retry
    return _yolo_detect_model if _yolo_detect_model is not False else None


# ─────────────────────────────────────────────
# COCO Pose Keypoint Indices
# ─────────────────────────────────────────────
# 0: nose, 5: left_shoulder, 6: right_shoulder,
# 9: left_wrist, 10: right_wrist,
# 15: left_ankle, 16: right_ankle
KP_LEFT_WRIST = 9
KP_RIGHT_WRIST = 10
KP_NOSE = 0

# ─────────────────────────────────────────────
# Tunable Constants
# ─────────────────────────────────────────────
VELOCITY_THRESHOLD = 20       # px/frame — wrist speed to consider "aggressive"
MAX_VELOCITY = 80             # px/frame — caps the pose_conf scaling
INTERACTION_THRESHOLD = 150   # px — max center distance to count as "interacting"
WRIST_HISTORY_LENGTH = 10     # frames of wrist positions to keep per track


class LiveTracker:
    """
    Real-time person tracker using YOLOv8n-pose + BoT-SORT.

    Tracks people across frames, assigns persistent IDs,
    extracts skeletal keypoints for heuristic fighting detection,
    and runs behavioral heuristics (loitering, zone breach).
    """

    def __init__(
        self,
        confidence: float = 0.4,
        loiter_time_sec: float = 10.0,
        loiter_radius_px: int = 50,
    ):
        self.confidence = confidence
        self.loiter_time_sec = loiter_time_sec
        self.loiter_radius_px = loiter_radius_px

        # Track history: {track_id: [(cx, cy, timestamp), ...]}
        self.track_history: dict[int, list[tuple[float, float, float]]] = {}
        # Wrist position history for velocity: {track_id: deque([(lw_x, lw_y, rw_x, rw_y), ...])}
        self.wrist_history: dict[int, deque] = {}
        # Active alerts to avoid repeating
        self.active_alerts: set[int] = set()
        # Foot traffic counter
        self.total_unique_ids: set[int] = set()
        # Zone definitions: [{"name": str, "polygon": [(x,y),...]}]
        self.zones: list[dict] = []

        self.model = _get_yolo_pose_model()

    def set_zones(self, zones: list[dict]):
        """Set restricted zone polygons for breach detection."""
        self.zones = zones

    def process_frame(self, frame: np.ndarray) -> dict:
        """
        Process a single frame through YOLOv8-Pose + BoT-SORT.

        Args:
            frame: BGR numpy array from cv2

        Returns:
            {
                "boxes": [{...}],
                "alerts": [{...}],
                "person_count": int,
                "total_unique": int,
                "pose_conf": float,          # 0.0–0.95 fighting confidence from skeleton
                "interaction_score": int,     # number of close person-pairs
                "avg_wrist_velocity": float,  # average wrist speed across all tracks
            }
        """
        if self.model is None:
            result = self._mock_result()
            result["pose_conf"] = 0.0
            result["interaction_score"] = 0
            result["avg_wrist_velocity"] = 0.0
            return result

        # Run YOLOv8-Pose with BoT-SORT tracking — only detect 'person' class (0)
        results = self.model.track(
            frame,
            tracker="botsort.yaml",
            persist=True,
            classes=[0],  # person only
            conf=self.confidence,
            verbose=False,
            device=DEVICE,
        )

        boxes_out = []
        alerts = []
        now = time.time()
        track_centers: dict[int, tuple[float, float]] = {}
        all_wrist_velocities = []

        if results and results[0].boxes is not None:
            boxes = results[0].boxes
            keypoints = results[0].keypoints  # Access pose keypoints

            for i, box in enumerate(boxes):
                # Get bounding box
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0])
                track_id = int(box.id[0]) if box.id is not None else -1

                w = x2 - x1
                h = y2 - y1
                cx = x1 + w // 2
                cy = y1 + h // 2

                boxes_out.append({
                    "id": track_id,
                    "x": int(x1),
                    "y": int(y1),
                    "w": int(w),
                    "h": int(h),
                    "label": "Person",
                    "confidence": round(conf, 2),
                })

                if track_id >= 0:
                    self.total_unique_ids.add(track_id)
                    track_centers[track_id] = (cx, cy)

                    # Update track history
                    if track_id not in self.track_history:
                        self.track_history[track_id] = []
                    self.track_history[track_id].append((cx, cy, now))

                    # Trim old history (keep last 30 seconds)
                    self.track_history[track_id] = [
                        (x, y, t) for x, y, t in self.track_history[track_id]
                        if now - t < 30
                    ]

                    # ── Extract wrist keypoints ──
                    if keypoints is not None and i < len(keypoints.xy):
                        kp_xy = keypoints.xy[i].cpu().numpy()  # Shape: (17, 2)
                        if len(kp_xy) > KP_RIGHT_WRIST:
                            lw_x, lw_y = float(kp_xy[KP_LEFT_WRIST][0]), float(kp_xy[KP_LEFT_WRIST][1])
                            rw_x, rw_y = float(kp_xy[KP_RIGHT_WRIST][0]), float(kp_xy[KP_RIGHT_WRIST][1])

                            # Store wrist history
                            if track_id not in self.wrist_history:
                                self.wrist_history[track_id] = deque(maxlen=WRIST_HISTORY_LENGTH)
                            self.wrist_history[track_id].append((lw_x, lw_y, rw_x, rw_y))

                            # Compute wrist velocity if we have at least 2 data points
                            velocity = self._compute_wrist_velocity(track_id)
                            if velocity is not None:
                                all_wrist_velocities.append(velocity)

                    # ── Loitering check ──
                    alert = self._check_loitering(track_id, cx, cy, now)
                    if alert:
                        alerts.append(alert)

                    # ── Zone breach check ──
                    alert = self._check_zone_breach(track_id, cx, y2)  # foot position
                    if alert:
                        alerts.append(alert)

        # ── Interaction Detection ──
        interaction_score = self._compute_interaction_score(track_centers)

        # ── Pose Confidence Calculation ──
        avg_wrist_velocity = float(np.mean(all_wrist_velocities)) if all_wrist_velocities else 0.0
        pose_conf = self._compute_pose_confidence(avg_wrist_velocity, interaction_score)

        return {
            "boxes": boxes_out,
            "alerts": alerts,
            "person_count": len(boxes_out),
            "total_unique": len(self.total_unique_ids),
            "pose_conf": round(pose_conf, 4),
            "interaction_score": interaction_score,
            "avg_wrist_velocity": round(avg_wrist_velocity, 2),
        }

    def _compute_wrist_velocity(self, track_id: int) -> Optional[float]:
        """Compute the average wrist velocity (px/frame) for a track over recent frames."""
        history = self.wrist_history.get(track_id)
        if history is None or len(history) < 2:
            return None

        velocities = []
        for j in range(1, len(history)):
            prev = history[j - 1]
            curr = history[j]
            # Left wrist velocity
            lw_vel = math.sqrt((curr[0] - prev[0]) ** 2 + (curr[1] - prev[1]) ** 2)
            # Right wrist velocity
            rw_vel = math.sqrt((curr[2] - prev[2]) ** 2 + (curr[3] - prev[3]) ** 2)
            velocities.append(max(lw_vel, rw_vel))  # Take the faster wrist

        return float(np.mean(velocities)) if velocities else None

    def _compute_interaction_score(self, track_centers: dict[int, tuple[float, float]]) -> int:
        """Count number of person-pairs within INTERACTION_THRESHOLD distance."""
        if len(track_centers) < 2:
            return 0

        score = 0
        for (idA, posA), (idB, posB) in combinations(track_centers.items(), 2):
            dist = math.sqrt((posA[0] - posB[0]) ** 2 + (posA[1] - posB[1]) ** 2)
            if dist < INTERACTION_THRESHOLD:
                score += 1
        return score

    def _compute_pose_confidence(self, avg_wrist_velocity: float, interaction_score: int) -> float:
        """
        Calculate fighting confidence from pose heuristics.
        
        Returns 0.0 if conditions for fighting are not met,
        otherwise scales up to 0.95 based on wrist velocity.
        """
        # Must have both fast wrist movement AND people interacting
        if avg_wrist_velocity < VELOCITY_THRESHOLD or interaction_score == 0:
            return 0.0

        # Scale confidence: velocity 20 -> 0.50, velocity 80+ -> 0.95
        raw_conf = (avg_wrist_velocity - VELOCITY_THRESHOLD) / (MAX_VELOCITY - VELOCITY_THRESHOLD)
        pose_conf = min(0.95, 0.50 + raw_conf * 0.45)
        return max(0.0, pose_conf)

    def _check_loitering(self, track_id: int, cx: float, cy: float, now: float) -> Optional[dict]:
        """Check if a person has been stationary for too long."""
        history = self.track_history.get(track_id, [])
        if len(history) < 5:
            return None

        first_time = history[0][2]
        duration = now - first_time

        if duration < self.loiter_time_sec:
            return None

        # Check if they stayed within radius
        avg_x = np.mean([p[0] for p in history])
        avg_y = np.mean([p[1] for p in history])
        max_drift = max(
            math.sqrt((p[0] - avg_x) ** 2 + (p[1] - avg_y) ** 2)
            for p in history
        )

        if max_drift < self.loiter_radius_px and track_id not in self.active_alerts:
            self.active_alerts.add(track_id)
            return {
                "type": "Loitering",
                "track_id": track_id,
                "message": f"Person #{track_id} has been stationary for {duration:.0f}s",
                "duration": round(duration, 1),
            }
        return None

    def _check_zone_breach(self, track_id: int, cx: float, foot_y: float) -> Optional[dict]:
        """Check if a person's position is inside a restricted zone polygon."""
        for zone in self.zones:
            polygon = np.array(zone["polygon"], dtype=np.float32)
            # Point-in-polygon test using OpenCV
            result = cv2.pointPolygonTest(polygon, (float(cx), float(foot_y)), False)
            if result >= 0:
                alert_key = track_id * 1000 + hash(zone["name"]) % 1000
                if alert_key not in self.active_alerts:
                    self.active_alerts.add(alert_key)
                    return {
                        "type": "ZoneBreach",
                        "track_id": track_id,
                        "message": f"Person #{track_id} entered restricted zone: {zone['name']}",
                        "zone": zone["name"],
                    }
        return None

    def _mock_result(self) -> dict:
        """Fallback when YOLO is not available."""
        import random
        count = random.randint(0, 4)
        boxes = []
        for i in range(count):
            boxes.append({
                "id": i,
                "x": random.randint(50, 500),
                "y": random.randint(50, 300),
                "w": random.randint(60, 150),
                "h": random.randint(120, 300),
                "label": "Person",
                "confidence": round(random.uniform(0.6, 0.95), 2),
            })
        return {
            "boxes": boxes,
            "alerts": [],
            "person_count": count,
            "total_unique": count,
        }

    def reset(self):
        """Reset all tracking state for a new session."""
        self.track_history.clear()
        self.wrist_history.clear()
        self.active_alerts.clear()
        self.total_unique_ids.clear()


def count_people_in_frame(frame: np.ndarray) -> int:
    """
    Quick utility to count people in a single frame using YOLO.
    Used by detector.py for video upload analysis person counting.
    """
    model = _get_yolo_model()
    if model is None:
        return 0

    results = model(frame, classes=[0], conf=0.4, verbose=False, device=DEVICE)
    if results and results[0].boxes is not None:
        return len(results[0].boxes)
    return 0


def analyze_foot_traffic(video_path: str, sample_fps: float = 2.0) -> list[dict]:
    """
    Analyze a video file and return per-second person counts for foot traffic charts.

    Args:
        video_path: Path to video file
        sample_fps: How many frames per second to sample (2.0 = every 0.5s)

    Returns:
        List of {"time_sec": float, "count": int} entries
    """
    model = _get_yolo_model()
    if model is None:
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_interval = max(1, int(fps / sample_fps))

    traffic_data = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            count = count_people_in_frame(frame)
            time_sec = round(frame_idx / fps, 1)
            traffic_data.append({"time_sec": time_sec, "count": count})

        frame_idx += 1

    cap.release()
    return traffic_data
