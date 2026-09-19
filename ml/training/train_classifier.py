import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models
from torchvision.models import MobileNet_V3_Small_Weights

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.image_pipeline import get_train_transforms, get_eval_transforms


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def build_model(num_classes: int, architecture: str = "mobilenet_v3_small") -> nn.Module:
    """
    Constructs a lightweight transfer learning classifier using pretrained ImageNet weights.
    """
    if architecture == "mobilenet_v3_small":
        weights = MobileNet_V3_Small_Weights.DEFAULT
        model = models.mobilenet_v3_small(weights=weights)

        # Freeze earlier feature layers to prevent distortion of foundational visual features
        for param in model.features[:-2].parameters():
            param.requires_grad = False

        # Replace final classification head
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(128, num_classes)
        )
    else:
        raise ValueError(f"Unsupported architecture: {architecture}")

    return model


def compute_class_weights(dataset: datasets.ImageFolder) -> torch.Tensor:
    """
    Computes inverse frequency class weights to balance loss gradients.
    """
    targets = [s[1] for s in dataset.samples]
    class_counts = np.bincount(targets, minlength=len(dataset.classes))
    total_samples = len(targets)
    weights = total_samples / (len(dataset.classes) * class_counts.astype(np.float32))
    return torch.tensor(weights, dtype=torch.float32)


def train_model(args):
    set_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    dataset_dir = Path(args.dataset_dir)
    train_dir = dataset_dir / "train"
    val_dir = dataset_dir / "val"
    output_dir = Path(args.output_dir)

    model_save_dir = output_dir / "model"
    meta_save_dir = output_dir / "metadata"
    metrics_save_dir = output_dir / "metrics"
    for d in [model_save_dir, meta_save_dir, metrics_save_dir]:
        d.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("     MEDISHELF AI — CV TRANSFER LEARNING TRAINING PIPELINE")
    print("=" * 65)
    print(f"Device:             {device}")
    print(f"Architecture:       {args.model_arch}")
    print(f"Image Resolution:   {args.image_size}x{args.image_size}")
    print(f"Batch Size:         {args.batch_size}")
    print(f"Epochs:             {args.epochs}")
    print(f"Initial LR:         {args.lr}")
    print(f"Seed:               {args.seed}")
    print("-" * 65)

    # Load datasets
    train_dataset = datasets.ImageFolder(train_dir, transform=get_train_transforms(args.image_size))
    val_dataset = datasets.ImageFolder(val_dir, transform=get_eval_transforms(args.image_size))

    class_names = train_dataset.classes
    num_classes = len(class_names)
    print(f"Detected {num_classes} Classes: {class_names}")
    print(f"Training Samples:   {len(train_dataset)}")
    print(f"Validation Samples: {len(val_dataset)}")

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)

    # Initialize model
    model = build_model(num_classes, args.model_arch).to(device)

    # Loss with class weights
    class_weights = compute_class_weights(train_dataset).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr,
        weight_decay=1e-4
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_val_acc = 0.0
    best_checkpoint_path = model_save_dir / "medicine_classifier.pt"
    history: List[Dict[str, float]] = []

    start_time = time.time()

    for epoch in range(1, args.epochs + 1):
        # 1. Training loop
        model.train()
        train_loss = 0.0
        train_correct = 0
        total_train = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            train_correct += torch.sum(preds == labels.data).item()
            total_train += images.size(0)

        scheduler.step()

        epoch_train_loss = train_loss / total_train
        epoch_train_acc = train_correct / total_train

        # 2. Validation loop
        model.eval()
        val_loss = 0.0
        val_correct = 0
        total_val = 0

        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)

                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_correct += torch.sum(preds == labels.data).item()
                total_val += images.size(0)

        epoch_val_loss = val_loss / total_val if total_val > 0 else 0
        epoch_val_acc = val_correct / total_val if total_val > 0 else 0

        history.append({
            "epoch": epoch,
            "train_loss": round(epoch_train_loss, 4),
            "train_acc": round(epoch_train_acc, 4),
            "val_loss": round(epoch_val_loss, 4),
            "val_acc": round(epoch_val_acc, 4),
        })

        is_best = epoch_val_acc >= best_val_acc
        if is_best:
            best_val_acc = epoch_val_acc
            # Save checkpoint state dict & class metadata
            checkpoint = {
                "model_state_dict": model.state_dict(),
                "class_names": class_names,
                "num_classes": num_classes,
                "architecture": args.model_arch,
                "image_size": args.image_size,
                "val_acc": best_val_acc,
                "epoch": epoch,
            }
            torch.save(checkpoint, best_checkpoint_path)

        star = " (*Best Saved)" if is_best else ""
        print(f"Epoch [{epoch:02d}/{args.epochs:02d}] "
              f"Train Loss: {epoch_train_loss:.4f} Acc: {epoch_train_acc*100:.1f}% | "
              f"Val Loss: {epoch_val_loss:.4f} Acc: {epoch_val_acc*100:.1f}%{star}")

    total_time = time.time() - start_time
    print("-" * 65)
    print(f"Training Complete in {total_time:.1f}s! Best Val Accuracy: {best_val_acc*100:.1f}%")
    print(f"Model Checkpoint saved to: {best_checkpoint_path}")

    # Save training metadata
    meta = {
        "model_name": "MediShelf MobileNetV3 Classifier",
        "architecture": args.model_arch,
        "dataset_version": "1.0.0-dailymed-spl",
        "class_count": num_classes,
        "class_names": class_names,
        "image_size": args.image_size,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "framework_version": f"PyTorch {torch.__version__}",
        "hyperparameters": {
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "lr": args.lr,
            "seed": args.seed,
            "optimizer": "AdamW",
            "scheduler": "CosineAnnealingLR",
        },
        "best_val_accuracy": round(best_val_acc, 4),
        "history": history,
    }
    with open(meta_save_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return checkpoint


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train MobileNetV3 Medicine Package Classifier")
    parser.add_argument("--epochs", type=int, default=6, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Mini-batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--image-size", type=int, default=224, help="Input image dimension")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--model-arch", type=str, default="mobilenet_v3_small", help="Model architecture")
    parser.add_argument("--dataset-dir", type=str, default=str(PROJECT_ROOT / "ml" / "datasets"))
    parser.add_argument("--output-dir", type=str, default=str(PROJECT_ROOT / "ml" / "artifacts"))

    cli_args = parser.parse_args()
    train_model(cli_args)
