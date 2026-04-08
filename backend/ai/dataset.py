"""
PyTorch Dataset for UCF Crime video classification.

Handles the complex directory layout of the UCF Crime dataset:
- Training list uses relative paths like  Category/filename.mp4
- Test list uses nested paths like  Anomaly-Videos-Part-1/.../Category/filename.mp4
- Actual videos are scattered across multiple Part directories

The dataset builds a filename->path index once, then resolves each
video by its basename for fast, reliable lookups.

Supports:
- Data augmentation (random crop, horizontal flip, color jitter)
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

# Add parent dir so config is importable when running from backend/
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

    Augmentation (training only):
        - Random temporal offset (different clip window each call)
        - Random horizontal flip
        - Random brightness/contrast jitter
        - Random crop (128->112) instead of direct resize
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
        """
        Args:
            split:  'train' or 'test'
            clip_length:  number of frames per clip
            frame_size:  (W, H) to resize frames
            clips_per_video:  how many clips to sample per video (multiplies dataset size)
            augment:  whether to apply data augmentation
            file_index:  pre-built filename->path map (avoids rescanning)
        """
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
        # Each video appears clips_per_video times; different clip each time due to randomness
        self.samples: list[tuple[Path, int]] = []
        for video_path, label in self._videos:
            for _ in range(self.clips_per_video):
                self.samples.append((video_path, label))

        if skipped:
            print(f"[WARN] [{split}] Skipped {skipped} videos (file not found on disk)")
        print(f"[OK] [{split}] Loaded {len(self._videos)} videos "
              f"x {clips_per_video} clips = {len(self.samples)} samples")

    # ── augmentation helpers ──

    def _augment_frame(self, frame: np.ndarray) -> np.ndarray:
        """Apply augmentation to a single frame (H, W, C) in [0, 1] range."""
        # Random horizontal flip (applied consistently per clip via seed)
        if self._flip:
            frame = np.ascontiguousarray(frame[:, ::-1, :])

        # Random brightness shift (-0.15 to +0.15)
        frame = frame + self._brightness
        frame = np.clip(frame, 0.0, 1.0)

        # Random contrast (0.8 to 1.2)
        mean = frame.mean()
        frame = (frame - mean) * self._contrast + mean
        frame = np.clip(frame, 0.0, 1.0)

        return frame

    def _random_crop(self, frame: np.ndarray, target_h: int, target_w: int) -> np.ndarray:
        """Random crop from a slightly larger frame (training) or center crop (test)."""
        h, w = frame.shape[:2]
        if h <= target_h or w <= target_w:
            return frame

        if self.augment:
            y = random.randint(0, h - target_h)
            x = random.randint(0, w - target_w)
        else:
            y = (h - target_h) // 2
            x = (w - target_w) // 2

        return frame[y:y + target_h, x:x + target_w]

    # ── clip reading ──

    def _read_clip(self, video_path: Path) -> np.ndarray | None:
        """
        Read a clip of `clip_length` frames from a video.
        Training: random temporal window + augmentation
        Testing:  uniform sampling across entire video
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return None

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total < self.clip_length:
            cap.release()
            return None

        # --- Frame sampling strategy ---
        if self.augment:
            # Random contiguous window, then sample uniformly within it
            window_size = max(self.clip_length, total // 2)
            window_size = min(window_size, total)
            start = random.randint(0, total - window_size)
            indices = np.linspace(start, start + window_size - 1,
                                  self.clip_length, dtype=int)
        else:
            # Uniform across entire video (deterministic)
            indices = np.linspace(0, total - 1, self.clip_length, dtype=int)

        # Pre-generate augmentation params (consistent across clip)
        if self.augment:
            self._flip = random.random() < 0.5
            self._brightness = random.uniform(-0.15, 0.15)
            self._contrast = random.uniform(0.8, 1.2)

        # Resize to slightly larger than target for random cropping
        if self.augment:
            load_size = (self.frame_size[0] + 16, self.frame_size[1] + 16)  # 128x128
        else:
            load_size = self.frame_size  # 112x112

        frames = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret:
                cap.release()
                return None

            frame = cv2.resize(frame, load_size)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = frame.astype(np.float32) / 255.0

            # Apply augmentation before normalization
            if self.augment:
                frame = self._augment_frame(frame)
                frame = self._random_crop(frame, self.frame_size[1], self.frame_size[0])

            # ImageNet normalization
            mean = np.array([0.485, 0.456, 0.406])
            std = np.array([0.229, 0.224, 0.225])
            frame = (frame - mean) / std
            frame = frame.transpose(2, 0, 1)  # HWC -> CHW
            frames.append(frame)

        cap.release()
        return np.array(frames, dtype=np.float32)

    # ── Dataset interface ──

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
