import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from tqdm import tqdm

from config import VALIDATION_SPLIT, NUM_CLASSES, BATCH_SIZE, NUM_WORKERS, VIDEO_SEARCH_DIRS, UCF_CRIME_CLASSES
from ai.model import create_model
from ai.dataset import UCFCrimeDataset, build_file_index, compute_class_weights
from sklearn.metrics import classification_report, confusion_matrix

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Build index & dataset
    file_index = build_file_index(VIDEO_SEARCH_DIRS)
    full_dataset = UCFCrimeDataset(split="train", file_index=file_index, clips_per_video=3, augment=False)
    
    # Validation split - hardcoded generator seed
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
    model.load_state_dict(torch.load(weights_path, map_location=device, weights_only=True))
    model.eval()

    class_weights = compute_class_weights(full_dataset).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    running_loss = 0.0
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for clips, labels in tqdm(val_loader, desc="Evaluating"):
            clips, labels = clips.to(device), labels.to(device)
            logits = model(clips)
            loss = criterion(logits, labels)
            
            running_loss += loss.item() * clips.size(0)
            _, preds = logits.max(dim=1)
            
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    total = len(all_labels)
    val_loss = running_loss / total
    
    print("\n--- Generating Metrics ---")
    
    # Filter classes that actually exist in the validation set for the report to avoid errors
    unique_labels = [int(x) for x in sorted(list(set(all_labels) | set(all_preds)))]
    target_names = [UCF_CRIME_CLASSES[i] for i in unique_labels]
    
    report = classification_report(all_labels, all_preds, target_names=target_names, output_dict=True, zero_division=0)
    conf_matrix = confusion_matrix(all_labels, all_preds).tolist()
    
    results = {
        "val_loss": val_loss,
        "classification_report": report,
        "confusion_matrix": conf_matrix,
        "classes": UCF_CRIME_CLASSES,
        "unique_labels_used": unique_labels
    }
    
    output_path = Path(__file__).resolve().parent / "eval_results.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=4)
        
    print(f"Results saved to {output_path}")

if __name__ == "__main__":
    main()
