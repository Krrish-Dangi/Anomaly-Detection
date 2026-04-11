"""
PyTorch Dataset for UCF Crime video classification.

Handles the complex directory layout of the UCF Crime dataset:
- Training list uses relative paths like  Category/filename.mp4
- Test list uses nested paths like  Anomaly-Videos-Part-1/.../Category/filename.mp4
- Actual videos are scattered across multiple Part directories

The dataset builds a filename->path index once, then resolves each
video by its basename for fast, reliable lookups.

Supports:
- Multi-clip sampling (multiple temporal windows per video)
"""

import os
import sys
import random
import numpy as np
from pathlib import Path

import cv2
import torch
from torch.utils.data import Dataset

# Add parent dir so config is importable when run from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import (
    DATASET_DIR, TRAIN_LIST, TEST_LIST,
    VIDEO_SEARCH_DIRS, UCF_CRIME_CLASSES,
    CLIP_LENGTH, FRAME_SIZE,
)


def build_file_index(search_dirs: list[Path]) -> dict[str, Path]:
    """
    Recursively scan all search directories and build a
    filename -> absolute-path mapping for every .mp4 file found.
    """
    index: dict[str, Path] = {}
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        for root, _dirs, files in os.walk(search_dir):
            for fname in files:
                if fname.lower().endswith(".mp4"):
                    full_path = Path(root) / fname
                    if fname not in index:
                        index[fname] = full_path
    return index


def _class_from_path(rel_path: str) -> str:
    """
    Extract the class name from a dataset list entry.
    """
    parts = rel_path.replace("\\", "/").split("/")
    for part in reversed(parts[:-1]):
        if part in UCF_CRIME_CLASSES:
            return part
    if "Normal" in rel_path:
        return "Normal"
    return parts[0]


class UCFCrimeDataset(Dataset):
    """
    PyTorch Dataset that reads video clips from the UCF Crime dataset.

    Each sample returns:
        clip  -  FloatTensor of shape (CLIP_LENGTH, 3, H, W)
        label -  int class index  (0 = Normal, 1..13 = anomaly types)
    """

    def __init__(
        self,
        split: str = "train",
        clip_length: int = CLIP_LENGTH,
        frame_size: tuple[int, int] = FRAME_SIZE,
        clips_per_video: int = 1,
        augment: bool = False,
        file_index: dict[str, Path] | None = None,
    ):
        super().__init__()
        self.clip_length = clip_length
        self.frame_size = frame_size
        self.clips_per_video = clips_per_video
        self.augment = augment
        self.class_to_idx = {c: i for i, c in enumerate(UCF_CRIME_CLASSES)}

        # Build or reuse the file index
        self.file_index = file_index or build_file_index(VIDEO_SEARCH_DIRS)

        # Parse the split file
        list_path = TRAIN_LIST if split == "train" else TEST_LIST
        if not list_path.exists():
            raise FileNotFoundError(f"Split file not found: {list_path}")

        self._videos: list[tuple[Path, int]] = []
        skipped = 0
        
        with open(list_path, "r") as f:
            for line in f:
                rel = line.strip()
                if not rel:
                    continue
                basename = os.path.basename(rel)
                abs_path = self.file_index.get(basename)
                if abs_path is None or not abs_path.exists():
                    skipped += 1
                    continue
                class_name = _class_from_path(rel)
                label = self.class_to_idx.get(class_name, 0)
                self._videos.append((abs_path, label))

        # Expand samples for multi-clip sampling
        self.samples: list[tuple[Path, int]] = []
        for video_path, label in self._videos:
            for _ in range(self.clips_per_video):
                self.samples.append((video_path, label))

        if skipped:
            print(f"[WARN] [{split}] Skipped {skipped} videos (file not found on disk)")
        print(f"[OK] [{split}] Loaded {len(self._videos)} videos "
              f"x {clips_per_video} clips = {len(self.samples)} samples")

    def _read_clip(self, video_path: Path) -> np.ndarray | None:
        """
        Read a clip of clip_length frames from a video.
        Uses uniform sampling across the entire video.
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return None

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total < self.clip_length:
            cap.release()
            return None

        if self.augment:
            # Random temporal window for training diversity
            window_size = max(self.clip_length, total // 2)
            window_size = min(window_size, total)
            start = random.randint(0, total - window_size)
            indices = np.linspace(start, start + window_size - 1,
                                  self.clip_length, dtype=int)
        else:
            indices = np.linspace(0, total - 1, self.clip_length, dtype=int)

        frames = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret:
                cap.release()
                return None

            frame = cv2.resize(frame, self.frame_size)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = frame.astype(np.float32) / 255.0

            # ImageNet normalization
            mean = np.array([0.485, 0.456, 0.406])
            std = np.array([0.229, 0.224, 0.225])
            frame = (frame - mean) / std
            frame = frame.transpose(2, 0, 1)  # HWC -> CHW
            frames.append(frame)

        cap.release()
        return np.array(frames, dtype=np.float32)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        path, label = self.samples[idx]
        clip = self._read_clip(path)

        if clip is None:
            clip = np.zeros(
                (self.clip_length, 3, self.frame_size[1], self.frame_size[0]),
                dtype=np.float32,
            )

        return torch.from_numpy(clip), label


def get_class_distribution(dataset: UCFCrimeDataset) -> dict[str, int]:
    """Return a {class_name: count} dict for a loaded dataset (unique videos only)."""
    counts = {c: 0 for c in UCF_CRIME_CLASSES}
    for _, label in dataset._videos:
        counts[UCF_CRIME_CLASSES[label]] += 1
    return counts


def compute_class_weights(dataset: UCFCrimeDataset) -> torch.Tensor:
    """
    Compute inverse-frequency class weights for CrossEntropyLoss.
    Classes with fewer samples get higher weight.
    """
    dist = get_class_distribution(dataset)
    counts = [max(dist[c], 1) for c in UCF_CRIME_CLASSES]  # avoid div-by-0
    total = sum(counts)
    n_classes = len(counts)
    weights = [total / (n_classes * c) for c in counts]
    return torch.FloatTensor(weights)
