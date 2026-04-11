"""
Training script for the ResNet18+LSTM anomaly classifier on UCF Crime.

Usage (from backend/ directory):
    python ai/train.py                         # train with defaults
    python ai/train.py --epochs 25 --bs 4      # custom settings
    python ai/train.py --resume                 # resume from last checkpoint
    python ai/train.py --device cuda            # force GPU

Features:
    - Class-weighted CrossEntropyLoss (handles imbalanced classes)
    - Early stopping (patience-based on val_loss)
    - Multi-clip sampling (3 clips per video)
    - ReduceLROnPlateau scheduler
    - Gradient clipping for stable training

The trained weights are saved to  ai/weights/anomaly_resnet18_lstm.pth
"""

import argparse
import os
import sys
import time
import json
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from tqdm import tqdm

# Ensure imports work when run from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import (
    BATCH_SIZE, LEARNING_RATE, NUM_EPOCHS, NUM_WORKERS,
    VALIDATION_SPLIT, NUM_CLASSES, UCF_CRIME_CLASSES,
    VIDEO_SEARCH_DIRS,
)
from ai.model import create_model
from ai.dataset import (
    UCFCrimeDataset, build_file_index,
    get_class_distribution, compute_class_weights,
)


WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"
WEIGHTS_PATH = WEIGHTS_DIR / "anomaly_resnet18_lstm.pth"
TRAIN_LOG_PATH = Path(__file__).resolve().parent / "train_log.json"


def parse_args():
    p = argparse.ArgumentParser(description="Train ResNet18+LSTM on UCF Crime")
    p.add_argument("--epochs", type=int, default=NUM_EPOCHS, help="Number of epochs")
    p.add_argument("--bs", type=int, default=BATCH_SIZE, help="Batch size")
    p.add_argument("--lr", type=float, default=LEARNING_RATE, help="Learning rate")
    p.add_argument("--device", type=str, default="auto", help="Device: auto|cpu|cuda|mps")
    p.add_argument("--workers", type=int, default=NUM_WORKERS, help="DataLoader workers")
    p.add_argument("--resume", action="store_true", help="Resume from existing weights")
    p.add_argument("--val-split", type=float, default=VALIDATION_SPLIT,
                   help="Fraction of training data for validation")
    p.add_argument("--clips", type=int, default=3,
                   help="Clips per video (multi-clip sampling)")
    p.add_argument("--patience", type=int, default=7,
                   help="Early stopping patience (epochs without val_loss improvement)")
    return p.parse_args()


def pick_device(requested: str) -> torch.device:
    if requested != "auto":
        return torch.device(requested)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(loader, desc="  Train", leave=False,
                bar_format="{l_bar}{bar:30}{r_bar}")
    for clips, labels in pbar:
        clips = clips.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        logits = model(clips)
        loss = criterion(logits, labels)
        loss.backward()
        # Gradient clipping for stable training
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        running_loss += loss.item() * clips.size(0)
        _, preds = logits.max(dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        pbar.set_postfix(loss=f"{loss.item():.3f}",
                         acc=f"{correct/total:.3f}")

    return running_loss / total, correct / total


@torch.no_grad()
def validate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(loader, desc="  Val  ", leave=False,
                bar_format="{l_bar}{bar:30}{r_bar}")
    for clips, labels in pbar:
        clips = clips.to(device)
        labels = labels.to(device)

        logits = model(clips)
        loss = criterion(logits, labels)

        running_loss += loss.item() * clips.size(0)
        _, preds = logits.max(dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        pbar.set_postfix(loss=f"{loss.item():.3f}",
                         acc=f"{correct/total:.3f}")

    return running_loss / total, correct / total


def main():
    args = parse_args()
    device = pick_device(args.device)
    print(f"\n{'='*60}")
    print(f"  ResNet18+LSTM  UCF Crime Trainer")
    print(f"{'='*60}")
    print(f"  Device      : {device}")
    print(f"  Epochs      : {args.epochs}")
    print(f"  Batch size  : {args.bs}")
    print(f"  LR          : {args.lr}")
    print(f"  Val split   : {args.val_split}")
    print(f"  Clips/video : {args.clips}")
    print(f"  Patience    : {args.patience}")
    print(f"  Grad clip   : 1.0")
    print(f"  Class weights: ON (inverse frequency)")
    print(f"{'='*60}\n")

    # ── 1. Build file index ──
    print("[SCAN] Building video file index...")
    file_index = build_file_index(VIDEO_SEARCH_DIRS)
    print(f"   Found {len(file_index)} unique video files\n")

    # ── 2. Load dataset with multi-clip sampling ──
    print("[LOAD] Loading training dataset...")
    full_dataset = UCFCrimeDataset(
        split="train",
        file_index=file_index,
        clips_per_video=args.clips,
        augment=True,
    )

    dist = get_class_distribution(full_dataset)
    print("\n  Class distribution (unique videos):")
    for cls_name, count in dist.items():
        bar = "#" * min(count, 50)
        print(f"    {cls_name:20s}  {count:5d}  {bar}")

    # ── 3. Compute class weights ──
    class_weights = compute_class_weights(full_dataset).to(device)
    print(f"\n  Class weights (top 3 heaviest):")
    weight_pairs = [(UCF_CRIME_CLASSES[i], w.item())
                    for i, w in enumerate(class_weights) if dist[UCF_CRIME_CLASSES[i]] > 0]
    for name, w in sorted(weight_pairs, key=lambda x: -x[1])[:3]:
        print(f"    {name:20s}  {w:.2f}x")

    # ── 4. Train/val split ──
    n_val = int(len(full_dataset) * args.val_split)
    n_train = len(full_dataset) - n_val
    train_ds, val_ds = random_split(full_dataset, [n_train, n_val])
    print(f"\n  Train: {n_train}  |  Val: {n_val}\n")

    train_loader = DataLoader(
        train_ds, batch_size=args.bs, shuffle=True,
        num_workers=args.workers, pin_memory=(device.type == "cuda"),
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.bs, shuffle=False,
        num_workers=args.workers, pin_memory=(device.type == "cuda"),
    )

    # ── 5. Create model ──
    model = create_model(num_classes=NUM_CLASSES, device=str(device))

    if args.resume and WEIGHTS_PATH.exists():
        print(f"[RESUME] Resuming from {WEIGHTS_PATH}")
        state = torch.load(WEIGHTS_PATH, map_location=device)
        model.load_state_dict(state)

    # Class-weighted CrossEntropyLoss
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr,
        weight_decay=1e-4,
    )
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=3, verbose=False,
    )

    # ── 6. Training loop with early stopping ──
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    best_val_loss = float("inf")
    best_val_acc = 0.0
    epochs_no_improve = 0
    train_history = []

    epoch_bar = tqdm(range(1, args.epochs + 1), desc="Epochs",
                     bar_format="{l_bar}{bar:30}{r_bar}")
    for epoch in epoch_bar:
        t0 = time.time()
        epoch_bar.set_description(f"Epoch {epoch}/{args.epochs}")

        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device,
        )
        val_loss, val_acc = validate(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        elapsed = time.time() - t0
        current_lr = optimizer.param_groups[0]["lr"]

        train_history.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
            "lr": current_lr,
            "time_s": round(elapsed, 1),
        })

        epoch_bar.set_postfix(
            tr_loss=f"{train_loss:.3f}", tr_acc=f"{train_acc:.3f}",
            vl_loss=f"{val_loss:.3f}", vl_acc=f"{val_acc:.3f}",
            time=f"{elapsed:.0f}s",
        )
        tqdm.write(f"  Epoch {epoch:3d} | "
                   f"train {train_loss:.4f} / {train_acc:.3f} | "
                   f"val {val_loss:.4f} / {val_acc:.3f} | "
                   f"{elapsed:.0f}s | lr={current_lr:.2e}")

        # Save best model based on val_loss
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            epochs_no_improve = 0
            torch.save(model.state_dict(), WEIGHTS_PATH)
            tqdm.write(f"  [SAVE] Best model (val_loss={val_loss:.3f}, "
                       f"val_acc={val_acc:.3f}) -> {WEIGHTS_PATH}")
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= args.patience:
                tqdm.write(f"\n  [STOP] Early stopping triggered after "
                           f"{args.patience} epochs without improvement")
                break

    # Save training log
    log_data = {
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": round(best_val_acc, 4),
        "epochs_run": len(train_history),
        "history": train_history,
    }
    with open(TRAIN_LOG_PATH, "w") as f:
        json.dump(log_data, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  Training complete!")
    print(f"  Best val loss: {best_val_loss:.4f}")
    print(f"  Best val accuracy: {best_val_acc:.3f}")
    print(f"  Weights saved to: {WEIGHTS_PATH}")
    print(f"  Log saved to: {TRAIN_LOG_PATH}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
