import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from tqdm import tqdm

from config import VALIDATION_SPLIT, NUM_CLASSES, BATCH_SIZE, NUM_WORKERS, VIDEO_SEARCH_DIRS
from ai.model import create_model
from ai.dataset import UCFCrimeDataset, build_file_index, compute_class_weights

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Build index & dataset
    file_index = build_file_index(VIDEO_SEARCH_DIRS)
    full_dataset = UCFCrimeDataset(split="train", file_index=file_index, clips_per_video=3, augment=False)
    
    # Validation split - using a hardcoded generator or manual seed to try and get stable results
    n_val = int(len(full_dataset) * VALIDATION_SPLIT)
    n_train = len(full_dataset) - n_val
    _, val_ds = random_split(
        full_dataset, 
        [n_train, n_val], 
        generator=torch.Generator().manual_seed(42)
    )
    
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
    
    weights_path = Path(__file__).resolve().parent / "weights" / "anomaly_resnet18_lstm.pth"
    if not weights_path.exists():
        print("Weights not found.")
        return
        
    model = create_model(num_classes=NUM_CLASSES, device=str(device))
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()

    class_weights = compute_class_weights(full_dataset).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    running_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for clips, labels in tqdm(val_loader, desc="Evaluating"):
            clips, labels = clips.to(device), labels.to(device)
            logits = model(clips)
            loss = criterion(logits, labels)
            
            running_loss += loss.item() * clips.size(0)
            _, preds = logits.max(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    val_loss = running_loss / total
    val_acc = correct / total
    
    print(f"\n==========================================")
    print(f"Evaluation Results of Last Model")
    print(f"==========================================")
    print(f"Loss: {val_loss:.4f}")
    print(f"Accuracy: {val_acc:.4f} ({correct}/{total})")
    print(f"==========================================")

if __name__ == "__main__":
    main()
