"""
Video Analysis API routes.
POST /api/analyze         — upload a video file for analysis
GET  /api/analyze/{job_id} — poll job status and results
GET  /api/analyze/{job_id}/stream — SSE stream of real-time clip results
GET  /api/uploads/{job_id} — serve uploaded video for frontend playback
"""

import uuid
import shutil
import threading
import json
import asyncio
import time
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import AnalysisJob, Event
from schemas import AnalysisResponse, DetectionLog, EventSchema, BBox
from config import (
    UPLOAD_DIR, UCF_TO_FRONTEND_EVENT, UCF_CRIME_CLASSES,
    CLIP_LENGTH, NUM_CLASSES,
)

router = APIRouter(prefix="/api", tags=["Analysis"])

# In-memory store for streaming results (job_id -> list of SSE messages)
_stream_queues: dict[str, list] = {}
_stream_done: dict[str, bool] = {}

# Global cached detector instance (avoid re-loading model for every upload)
_detector_cache = {"instance": None, "attempted": False}


def _get_detector():
    """Get or create the cached AnomalyDetector instance."""
    if not _detector_cache["attempted"]:
        _detector_cache["attempted"] = True
        try:
            from ai.detector import AnomalyDetector
            _detector_cache["instance"] = AnomalyDetector()
            print("[OK] AI detector loaded and cached")
        except Exception as e:
            print(f"[WARN] AI model not available, will use mock: {e}")
            _detector_cache["instance"] = None
    return _detector_cache["instance"]


def _run_analysis_streaming(job_id: str, video_path: str):
    """
    Background thread that runs the AI model clip-by-clip,
    pushing each result into the stream queue for SSE delivery.
    """
    import random

    # Initialize stream queue FIRST so SSE endpoint can connect immediately
    _stream_queues[job_id] = []
    _stream_done[job_id] = False

    print(f"\n[ANALYSIS] Starting analysis for job {job_id}")
    print(f"[ANALYSIS] Video path: {video_path}")

    db = SessionLocal()
    try:
        job = db.query(AnalysisJob).filter(AnalysisJob.job_id == job_id).first()
        if not job:
            print(f"[ERROR] Job {job_id} not found in DB")
            _stream_done[job_id] = True
            return

        job.status = "processing"
        db.commit()

        # Get video metadata using cv2
        total_frames = 0
        fps = 30
        duration = 0
        width = 640
        height = 480

        try:
            import cv2
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                _push_event(job_id, "error", {"message": "Cannot open video file"})
                job.status = "failed"
                job.error_message = "Cannot open video file"
                db.commit()
                _stream_done[job_id] = True
                return

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            duration = total_frames / fps if fps > 0 else 0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            print(f"[ANALYSIS] Video: {total_frames} frames, {fps:.1f} FPS, {duration:.1f}s, {width}x{height}")
        except Exception as e:
            print(f"[WARN] Could not get video metadata: {e}")
            total_frames = 300
            fps = 30
            duration = 10

        # Send video metadata first
        _push_event(job_id, "metadata", {
            "total_frames": total_frames,
            "fps": round(fps, 2),
            "duration": round(duration, 2),
            "width": width,
            "height": height,
        })

        # Send initial log
        _push_event(job_id, "log", {
            "time": "00:00:00",
            "text": f"Video loaded — {total_frames} frames at {fps:.0f} FPS ({duration:.1f}s)",
            "type": "info",
            "confidence": 100,
        })

        # Try to get cached detector
        detector = _get_detector()

        # Extract and process clips one-by-one
        if detector and detector.model is not None:
            print("[ANALYSIS] Using real AI model")
            _process_with_model(job_id, video_path, detector, total_frames, fps, width, height, db, job)
        else:
            print("[ANALYSIS] Using mock analysis")
            _process_mock(job_id, video_path, total_frames, fps, width, height, db, job)

    except Exception as e:
        print(f"[ERROR] Analysis failed: {e}")
        import traceback
        traceback.print_exc()
        try:
            job = db.query(AnalysisJob).filter(AnalysisJob.job_id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                db.commit()
        except Exception:
            pass
        _push_event(job_id, "error", {"message": str(e)})
        _stream_done[job_id] = True
    finally:
        # ALWAYS mark the stream as done so SSE doesn't hang forever
        _stream_done[job_id] = True
        db.close()
        print(f"[ANALYSIS] Thread finished for job {job_id}")


class SimplePersonTracker:
    """Lightweight IOU-based person tracker."""

    def __init__(self, iou_thresh=0.2, max_gone=30):
        self.next_id = 1
        self.tracks = {}  # id -> {bbox, last_frame}
        self.iou_thresh = iou_thresh
        self.max_gone = max_gone

    @staticmethod
    def _iou(a, b):
        x1 = max(a['x'], b['x'])
        y1 = max(a['y'], b['y'])
        x2 = min(a['x'] + a['w'], b['x'] + b['w'])
        y2 = min(a['y'] + a['h'], b['y'] + b['h'])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        union = a['w'] * a['h'] + b['w'] * b['h'] - inter
        return inter / union if union > 0 else 0

    def update(self, bboxes, frame):
        used = set()
        result = []
        for tid in list(self.tracks):
            best_iou, best_i = 0, -1
            for i, b in enumerate(bboxes):
                if i in used:
                    continue
                iou = self._iou(self.tracks[tid]['bbox'], b)
                if iou > best_iou:
                    best_iou = iou
                    best_i = i
            if best_iou >= self.iou_thresh and best_i >= 0:
                self.tracks[tid] = {'bbox': bboxes[best_i], 'last_frame': frame}
                used.add(best_i)
                result.append({'id': tid, 'bbox': bboxes[best_i]})
            elif frame - self.tracks[tid]['last_frame'] > self.max_gone:
                del self.tracks[tid]
            else:
                result.append({'id': tid, 'bbox': self.tracks[tid]['bbox']})
        for i, b in enumerate(bboxes):
            if i not in used:
                self.tracks[self.next_id] = {'bbox': b, 'last_frame': frame}
                result.append({'id': self.next_id, 'bbox': b})
                self.next_id += 1
        return result

    @property
    def unique_count(self):
        return self.next_id - 1


def _conclude_event(job_id, evt, fps):
    """Send a concluded anomaly event via SSE."""
    start_sec = evt['start_frame'] / fps if fps > 0 else 0
    end_sec = evt['end_frame'] / fps if fps > 0 else 0
    data = {
        "event_id": evt.get('event_id', str(uuid.uuid4())),
        "type": evt['frontend_type'],
        "ucf_class": evt['class_name'],
        "start_time": _format_time(start_sec),
        "end_time": _format_time(end_sec),
        "start_frame": evt['start_frame'],
        "end_frame": evt['end_frame'],
        "peak_confidence": evt['peak_conf'],
        "duration_sec": round(end_sec - start_sec, 1),
        "clip_count": evt['clip_count'],
    }
    _push_event(job_id, "event_concluded", data)
    # Also send as a log entry
    severity = "danger" if evt['peak_conf'] > 85 else "warning"
    _push_event(job_id, "log", {
        "time": _format_time(start_sec),
        "end_time": _format_time(end_sec),
        "text": f"{evt['class_name']} detected",
        "type": severity,
        "confidence": evt['peak_conf'],
        "is_event": True,
        "duration_sec": round(end_sec - start_sec, 1),
    })


def _process_with_model(job_id, video_path, detector, total_frames, fps, width, height, db, job):
    """Process video with real AI model + HOG person detection + event consolidation."""
    import torch
    import cv2
    import numpy as np
    from config import FRAME_SIZE

    # Read all frames — keep raw for HOG, preprocessed for model
    cap = cv2.VideoCapture(video_path)
    raw_frames = []
    model_frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        raw_frames.append(frame)
        resized = cv2.resize(frame, FRAME_SIZE)
        resized = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        resized = resized.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        resized = (resized - mean) / std
        resized = resized.transpose(2, 0, 1)
        model_frames.append(resized)
    cap.release()

    # Build clips
    clips, clip_starts = [], []
    stride = CLIP_LENGTH // 2
    for i in range(0, len(model_frames) - CLIP_LENGTH + 1, stride):
        clip = np.array(model_frames[i:i + CLIP_LENGTH])
        if len(clip) == CLIP_LENGTH:
            clips.append(clip)
            clip_starts.append(i)

    total_clips = len(clips)

    # Initialize HOG person detector for counting
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    max_concurrent_people = 0

    # Event consolidation state
    current_event = None
    concluded_events = []
    all_logs = []
    unique_event_types = set()

    _push_event(job_id, "progress", {"total_clips": total_clips, "processed": 0})

    detector.model.eval()
    with torch.no_grad():
        for idx, (clip, start_frame) in enumerate(zip(clips, clip_starts)):
            # ── 1. Classify clip ──
            tensor = torch.FloatTensor(clip).unsqueeze(0).to(detector.device)
            logits = detector.model(tensor)
            probs = torch.softmax(logits, dim=1)
            conf_val, pred = torch.max(probs, dim=1)
            class_idx = pred.item()
            conf = int(conf_val.item() * 100)
            class_name = UCF_CRIME_CLASSES[class_idx]
            timestamp_sec = start_frame / fps if fps > 0 else 0
            video_progress = (start_frame + CLIP_LENGTH) / total_frames if total_frames > 0 else 0

            # ── 2. Person count via HOG (no bounding boxes sent) ──
            mid_idx = min(start_frame + CLIP_LENGTH // 2, len(raw_frames) - 1)
            det_frame = cv2.resize(raw_frames[mid_idx], (640, 480))
            try:
                rects, _ = hog.detectMultiScale(
                    det_frame, winStride=(8, 8), padding=(4, 4), scale=1.05
                )
                people_in_frame = len(rects)
            except Exception:
                people_in_frame = 0
            max_concurrent_people = max(max_concurrent_people, people_in_frame)

            # ── 3. Event consolidation ──
            if class_name != "Normal" and conf >= 75:
                frontend_type = UCF_TO_FRONTEND_EVENT.get(class_name, "SuspiciousBehavior")
                unique_event_types.add(class_name)
                if current_event and current_event['class_name'] == class_name:
                    # Extend existing event
                    current_event['end_frame'] = start_frame + CLIP_LENGTH
                    current_event['peak_conf'] = max(current_event['peak_conf'], conf)
                    current_event['clip_count'] += 1
                else:
                    # Conclude previous event if different type
                    if current_event:
                        _conclude_event(job_id, current_event, fps)
                        concluded_events.append(current_event)
                    # Start new event
                    current_event = {
                        'event_id': str(uuid.uuid4()),
                        'class_name': class_name,
                        'frontend_type': frontend_type,
                        'start_frame': start_frame,
                        'end_frame': start_frame + CLIP_LENGTH,
                        'peak_conf': conf,
                        'clip_count': 1,
                    }
            else:
                # Normal clip — close any running event
                if current_event:
                    _conclude_event(job_id, current_event, fps)
                    concluded_events.append(current_event)
                    current_event = None

            # ── 3. Progress + stats ──
            _push_event(job_id, "progress", {
                "total_clips": total_clips,
                "processed": idx + 1,
                "video_progress": round(video_progress * 100, 1),
            })
            _push_event(job_id, "stats", {
                "people_detected": max_concurrent_people,
                "objects_detected": len(unique_event_types),
                "suspicious_events": len(concluded_events) + (1 if current_event else 0),
            })

            time.sleep(0.15)

    # Conclude final event
    if current_event:
        _conclude_event(job_id, current_event, fps)
        concluded_events.append(current_event)

    # Final summary
    total_suspicious = len(concluded_events)
    summary_log = {
        "time": _format_time(total_frames / fps if fps > 0 else 0),
        "text": f"Analysis complete — {total_suspicious} anomaly events from {total_clips} clips",
        "type": "info" if total_suspicious == 0 else "warning",
        "confidence": 100,
    }
    all_logs.append(summary_log)
    _push_event(job_id, "log", summary_log)

    # Update DB
    job.status = "done"
    job.completed_at = datetime.now(timezone.utc)
    job.people_detected = max_concurrent_people
    job.objects_detected = len(unique_event_types)
    job.suspicious_events = total_suspicious
    job.detection_logs = all_logs

    for evt in concluded_events:
        event = Event(
            event_id=evt['event_id'],
            type=evt['frontend_type'],
            ucf_class=evt['class_name'],
            camera_id="UPLOAD",
            timestamp=datetime.now(timezone.utc),
            confidence=evt['peak_conf'],
            frame_number=evt['start_frame'],
        )
        db.add(event)

    db.commit()

    _push_event(job_id, "complete", {
        "people_detected": max_concurrent_people,
        "objects_detected": len(unique_event_types),
        "suspicious_events": total_suspicious,
    })
    _stream_done[job_id] = True


def _process_mock(job_id, video_path, total_frames, fps, width, height, db, job):
    """Mock processing with simulated person tracking and event consolidation."""
    import random

    random.seed(hash(video_path) % 2**32)

    num_clips = max(1, total_frames // (CLIP_LENGTH // 2))
    num_clips = min(num_clips, 40)

    # Simulate 2-4 persons with motion paths
    num_persons = random.randint(2, 4)
    mock_persons = []
    for i in range(num_persons):
        mock_persons.append({
            'id': i + 1,
            'x': random.uniform(15, 65), 'y': random.uniform(20, 55),
            'w': random.uniform(8, 14), 'h': random.uniform(18, 28),
            'vx': random.uniform(-0.8, 0.8), 'vy': random.uniform(-0.4, 0.4),
            'appear': random.randint(0, num_clips // 4),
            'disappear': random.randint(num_clips * 3 // 4, num_clips),
        })

    # Pre-decide which clips are anomalous (create 1-3 anomaly event blocks)
    ucf_classes = ["Shoplifting", "Vandalism", "Fighting", "Robbery", "Burglary"]
    anomaly_blocks = []
    num_blocks = random.randint(1, min(3, num_clips // 5))
    for _ in range(num_blocks):
        start = random.randint(2, num_clips - 4)
        length = random.randint(2, min(6, num_clips - start))
        cls = random.choice(ucf_classes)
        anomaly_blocks.append((start, start + length, cls))
    anomaly_blocks.sort()

    current_event = None
    concluded_events = []
    all_logs = []
    unique_event_types = set()

    _push_event(job_id, "progress", {"total_clips": num_clips, "processed": 0})

    for idx in range(num_clips):
        start_frame = idx * (CLIP_LENGTH // 2)
        timestamp_sec = start_frame / fps if fps > 0 else 0
        video_progress = (start_frame + CLIP_LENGTH) / total_frames if total_frames > 0 else 0



        # Check if this clip is in an anomaly block
        is_anomaly = False
        anomaly_class = None
        for (a_start, a_end, a_cls) in anomaly_blocks:
            if a_start <= idx < a_end:
                is_anomaly = True
                anomaly_class = a_cls
                break

        if is_anomaly:
            conf = random.randint(78, 98)
            frontend_type = UCF_TO_FRONTEND_EVENT.get(anomaly_class, "SuspiciousBehavior")
            unique_event_types.add(anomaly_class)
            if current_event and current_event['class_name'] == anomaly_class:
                current_event['end_frame'] = start_frame + CLIP_LENGTH
                current_event['peak_conf'] = max(current_event['peak_conf'], conf)
                current_event['clip_count'] += 1
            else:
                if current_event:
                    _conclude_event(job_id, current_event, fps)
                    concluded_events.append(current_event)
                current_event = {
                    'event_id': str(uuid.uuid4()),
                    'class_name': anomaly_class,
                    'frontend_type': frontend_type,
                    'start_frame': start_frame,
                    'end_frame': start_frame + CLIP_LENGTH,
                    'peak_conf': conf,
                    'clip_count': 1,
                }
        else:
            if current_event:
                _conclude_event(job_id, current_event, fps)
                concluded_events.append(current_event)
                current_event = None

        # Progress + stats
        _push_event(job_id, "progress", {
            "total_clips": num_clips,
            "processed": idx + 1,
            "video_progress": round(min(video_progress * 100, 100), 1),
        })
        _push_event(job_id, "stats", {
            "people_detected": num_persons,
            "objects_detected": len(unique_event_types),
            "suspicious_events": len(concluded_events) + (1 if current_event else 0),
        })

        time.sleep(0.15)

    # Conclude final event
    if current_event:
        _conclude_event(job_id, current_event, fps)
        concluded_events.append(current_event)

    total_suspicious = len(concluded_events)
    summary_log = {
        "time": _format_time(total_frames / fps if fps > 0 else 0),
        "text": f"Analysis complete — {total_suspicious} anomaly events from {num_clips} clips",
        "type": "info" if total_suspicious == 0 else "warning",
        "confidence": 100,
    }
    all_logs.append(summary_log)
    _push_event(job_id, "log", summary_log)

    job.status = "done"
    job.completed_at = datetime.now(timezone.utc)
    job.people_detected = num_persons
    job.objects_detected = len(unique_event_types)
    job.suspicious_events = total_suspicious
    job.detection_logs = all_logs

    for evt in concluded_events:
        event = Event(
            event_id=evt['event_id'],
            type=evt['frontend_type'],
            ucf_class=evt['class_name'],
            camera_id="UPLOAD",
            timestamp=datetime.now(timezone.utc),
            confidence=evt['peak_conf'],
            frame_number=evt['start_frame'],
        )
        db.add(event)

    db.commit()

    _push_event(job_id, "complete", {
        "people_detected": num_persons,
        "objects_detected": len(unique_event_types),
        "suspicious_events": total_suspicious,
    })
    _stream_done[job_id] = True


def _push_event(job_id: str, event_type: str, data: dict):
    """Push an SSE event into the in-memory queue."""
    if job_id not in _stream_queues:
        _stream_queues[job_id] = []
    _stream_queues[job_id].append({
        "type": event_type,
        "data": data,
        "ts": time.time(),
    })


def _format_time(seconds: float) -> str:
    """Format seconds into MM:SS:FF."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    frames = int((seconds * 100) % 100)
    return f"{mins:02d}:{secs:02d}:{frames:02d}"


# ===== ROUTES =====

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_video(
    video: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a video file for AI analysis.
    Returns a job_id for streaming/polling results.
    """
    job_id = str(uuid.uuid4())
    ext = Path(video.filename).suffix or ".mp4"
    save_path = UPLOAD_DIR / f"{job_id}{ext}"

    with open(save_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    job = AnalysisJob(job_id=job_id, video_path=str(save_path))
    db.add(job)
    db.commit()

    # Run streaming analysis in background thread
    thread = threading.Thread(
        target=_run_analysis_streaming,
        args=(job_id, str(save_path)),
    )
    thread.daemon = True
    thread.start()

    return AnalysisResponse(job_id=job_id, status="queued")


@router.get("/analyze/{job_id}/stream")
async def stream_analysis(job_id: str, request: Request):
    """
    SSE endpoint — streams real-time clip-by-clip analysis results.
    Frontend connects with EventSource after uploading.
    """
    async def event_generator():
        cursor = 0
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            queue = _stream_queues.get(job_id, [])
            # Send any new events
            while cursor < len(queue):
                evt = queue[cursor]
                yield f"event: {evt['type']}\ndata: {json.dumps(evt['data'])}\n\n"
                cursor += 1

            # If done, send final event and break
            if _stream_done.get(job_id, False) and cursor >= len(queue):
                yield f"event: done\ndata: {{}}\n\n"
                break

            await asyncio.sleep(0.1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/uploads/{job_id}")
async def serve_uploaded_video(job_id: str, db: Session = Depends(get_db)):
    """Serve uploaded video file for frontend playback."""
    job = db.query(AnalysisJob).filter(AnalysisJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    video_path = Path(job.video_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    # Determine media type
    suffix = video_path.suffix.lower()
    media_types = {
        ".mp4": "video/mp4",
        ".avi": "video/x-msvideo",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".wmv": "video/x-ms-wmv",
        ".webm": "video/webm",
    }
    media_type = media_types.get(suffix, "video/mp4")

    return FileResponse(
        path=str(video_path),
        media_type=media_type,
        filename=video_path.name,
    )


@router.get("/analyze/{job_id}", response_model=AnalysisResponse)
def get_analysis_status(job_id: str, db: Session = Depends(get_db)):
    """Poll the status and results of an analysis job."""
    job = db.query(AnalysisJob).filter(AnalysisJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    logs = [DetectionLog(**log) for log in (job.detection_logs or [])]

    events = db.query(Event).filter(Event.camera_id == "UPLOAD").order_by(Event.timestamp.desc()).limit(10).all()
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

    return AnalysisResponse(
        job_id=job.job_id,
        status=job.status,
        people_detected=job.people_detected,
        objects_detected=job.objects_detected,
        suspicious_events=job.suspicious_events,
        detection_logs=logs,
        events=event_schemas,
    )
