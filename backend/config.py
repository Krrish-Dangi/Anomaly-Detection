"""
Central configuration for the backend.
All paths and settings are configured here.
"""

import os
from pathlib import Path

# ── Base directories ──
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
MEDIA_DIR = DATA_DIR / "media"
CLIPS_DIR = MEDIA_DIR / "clips"
SNAPSHOTS_DIR = MEDIA_DIR / "snapshots"
FRAMES_DIR = MEDIA_DIR / "frames"

# Create directories if they don't exist
for d in [DATA_DIR, UPLOAD_DIR, MEDIA_DIR, CLIPS_DIR, SNAPSHOTS_DIR, FRAMES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── Database ──
DATABASE_URL = f"sqlite:///{DATA_DIR / 'surveillance.db'}"

# ── AI Model ──
MODEL_WEIGHTS_PATH = os.getenv("MODEL_WEIGHTS_PATH", str(BASE_DIR / "ai" / "weights" / "anomaly_resnet18_lstm.pth"))
NUM_CLASSES = 14  # UCF-Crime: 13 anomaly classes + 1 normal
CLIP_LENGTH = 16  # Number of frames per clip
FRAME_SIZE = (112, 112)  # Resize frames to this size

# UCF-Crime class labels
UCF_CRIME_CLASSES = [
    "Normal",
    "Abuse",
    "Arrest",
    "Arson",
    "Assault",
    "Burglary",
    "Explosion",
    "Fighting",
    "RoadAccidents",
    "Robbery",
    "Shooting",
    "Shoplifting",
    "Stealing",
    "Vandalism",
]

# Mapping UCF-Crime classes → frontend event types
UCF_TO_FRONTEND_EVENT = {
    "Normal": None,
    "Abuse": "SuspiciousBehavior",
    "Arrest": "SuspiciousBehavior",
    "Arson": "SuspiciousBehavior",
    "Assault": "SuspiciousBehavior",
    "Burglary": "SuspiciousBehavior",
    "Explosion": "SuspiciousBehavior",
    "Fighting": "SuspiciousBehavior",
    "RoadAccidents": "SuspiciousBehavior",
    "Robbery": "SuspiciousBehavior",
    "Shooting": "SuspiciousBehavior",
    "Shoplifting": "ShelfTampering",
    "Stealing": "ShelfTampering",
    "Vandalism": "ShelfTampering",
}

# ── UCF Crime Dataset ──
DATASET_DIR = BASE_DIR.parent / "Anomaly-Detection-Dataset-UCF"
TRAIN_LIST = DATASET_DIR / "Anomaly_Train.txt"
TEST_LIST = DATASET_DIR / "Anomaly_Test.txt"
ANNOTATION_FILE = DATASET_DIR / "Temporal_Anomaly_Annotation_for_Testing_Videos.txt"

# Directories to search for video files (dataset has nested structure)
VIDEO_SEARCH_DIRS = [
    DATASET_DIR / "Anomaly-Videos-Part-1",
    DATASET_DIR / "Anomaly-Videos-Part_2",
    DATASET_DIR / "Anomaly-Videos-Part-3",
    DATASET_DIR / "Anomaly-Videos-Part-4",
    DATASET_DIR / "Training_Normal_Videos_Anomaly",    # only exists if extracted
    DATASET_DIR / "Testing_Normal_Videos_Anomaly",
    DATASET_DIR / "Normal_Videos_for_Event_Recognition",
    # Some videos may also be directly in category folders at dataset root
    DATASET_DIR / "Burglary",
    DATASET_DIR / "Explosion",
    DATASET_DIR / "Shooting",
    DATASET_DIR / "FightingA_Part1",
    DATASET_DIR / "FightingA_Part11",
    DATASET_DIR / "FightingA_Part2",
    DATASET_DIR / "FightingA_Part3",
    # User-extracted normal videos folder
    DATASET_DIR / "All_Data" / "All_Data",
]

# ── Training Hyperparameters ──
BATCH_SIZE = 4
LEARNING_RATE = 1e-4
NUM_EPOCHS = 25
NUM_WORKERS = 2  # DataLoader workers (keep low on Windows)
VALIDATION_SPLIT = 0.15  # fraction of training data for validation

# ── Server ──
CORS_ORIGINS = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
