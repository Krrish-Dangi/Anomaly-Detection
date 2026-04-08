"""
Quick validation script to verify the UCF Crime dataset integration.

Run from the backend/ directory:
    python ai/validate_dataset.py

Checks:
  1. Dataset directory exists and key files are present
  2. Video file index can be built
  3. Training and test split files can be parsed
  4. Reports class distribution
  5. Loads a sample clip and verifies tensor shape
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import (
    DATASET_DIR, TRAIN_LIST, TEST_LIST, ANNOTATION_FILE,
    VIDEO_SEARCH_DIRS, UCF_CRIME_CLASSES,
    CLIP_LENGTH, FRAME_SIZE,
)
from ai.dataset import build_file_index, UCFCrimeDataset, get_class_distribution


def main():
    print(f"\n{'='*60}")
    print(f"  UCF Crime Dataset — Validation Report")
    print(f"{'='*60}\n")

    # ── 1. Check paths ──
    checks = [
        ("Dataset directory", DATASET_DIR),
        ("Training list", TRAIN_LIST),
        ("Test list", TEST_LIST),
        ("Annotations", ANNOTATION_FILE),
    ]
    all_ok = True
    for label, path in checks:
        exists = path.exists()
        status = "[OK]" if exists else "[FAIL]"
        print(f"  {status} {label}: {path}")
        if not exists:
            all_ok = False

    if not all_ok:
        print("\n[FAIL] Some required files are missing. Cannot continue.")
        return

    # ── 2. Build file index ──
    print(f"\n[SCAN] Scanning video search directories...")
    t0 = time.time()
    file_index = build_file_index(VIDEO_SEARCH_DIRS)
    elapsed = time.time() - t0
    print(f"   Found {len(file_index)} unique .mp4 files in {elapsed:.1f}s")

    # Show a few sample entries
    sample_keys = list(file_index.keys())[:5]
    for k in sample_keys:
        print(f"     {k}  ->  {file_index[k]}")

    # ── 3. Load datasets ──
    print(f"\n[LOAD] Loading TRAIN split...")
    train_ds = UCFCrimeDataset(split="train", file_index=file_index)

    print(f"\n[LOAD] Loading TEST split...")
    test_ds = UCFCrimeDataset(split="test", file_index=file_index)

    # ── 4. Class distribution ──
    print(f"\n[DIST] Training class distribution:")
    dist = get_class_distribution(train_ds)
    total_train = sum(dist.values())
    for cls_name, count in dist.items():
        pct = (count / total_train * 100) if total_train else 0
        bar = "#" * min(int(pct * 2), 40)
        print(f"    {cls_name:20s}  {count:5d}  ({pct:5.1f}%)  {bar}")
    print(f"    {'TOTAL':20s}  {total_train:5d}")

    # ── 5. Sample clip test ──
    if len(train_ds) > 0:
        print(f"\n[CLIP] Loading sample clip from first training video...")
        t0 = time.time()
        clip, label = train_ds[0]
        elapsed = time.time() - t0
        print(f"   Shape   : {tuple(clip.shape)}")
        print(f"   Expected: ({CLIP_LENGTH}, 3, {FRAME_SIZE[1]}, {FRAME_SIZE[0]})")
        print(f"   Label   : {label} ({UCF_CRIME_CLASSES[label]})")
        print(f"   dtype   : {clip.dtype}")
        print(f"   Time    : {elapsed:.1f}s")

        expected = (CLIP_LENGTH, 3, FRAME_SIZE[1], FRAME_SIZE[0])
        if tuple(clip.shape) == expected:
            print(f"   [OK] Shape matches!")
        else:
            print(f"   [FAIL] Shape mismatch!")
    else:
        print("\n[WARN] No training samples loaded -- cannot test clip loading.")

    print(f"\n{'='*60}")
    print(f"  Validation complete!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
