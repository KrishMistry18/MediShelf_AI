import argparse
import json
import logging
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("medishelf.train_classifier")


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
    print(f"Warmup Epochs:      {args.warmup_epochs}")
    print(f"Fine-tune Epochs:   {args.finetune_epochs}")
    print(f"LR (Head / Backbone): {args.lr_head} / {args.lr_backbone}")
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

    # Loss with class weights and label smoothing
    class_weights = compute_class_weights(train_dataset).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=args.label_smoothing)

    history: List[Dict[str, Any]] = []
    best_val_acc = -1.0
    best_val_loss = float("inf")
    best_checkpoint_path = model_save_dir / "medicine_classifier.pt"
    best_state_dict = None
    best_epoch = 0
    patience_counter = 0

    start_time = time.time()
    global_epoch = 0

    # Phase 1: Classification Head Warmup
    print("\n>>> Phase 1: Classification Head Warmup (Backbone Frozen)...")
    for p in model.features.parameters():
        p.requires_grad = False
    for p in model.classifier.parameters():
        p.requires_grad = True

    warmup_optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=args.lr_head, weight_decay=args.weight_decay)

    for ep in range(1, args.warmup_epochs + 1):
        global_epoch += 1
        model.train()
        train_loss, train_correct, total_train = 0.0, 0, 0
        for imgs, lbls in train_loader:
            imgs, lbls = imgs.to(device), lbls.to(device)
            warmup_optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, lbls)
            loss.backward()
            warmup_optimizer.step()
            train_loss += loss.item() * imgs.size(0)
            preds = outputs.argmax(dim=1)
            train_correct += (preds == lbls).sum().item()
            total_train += imgs.size(0)

        ep_train_loss = train_loss / total_train
        ep_train_acc = train_correct / total_train

        model.eval()
        val_loss, val_correct, total_val = 0.0, 0, 0
        with torch.no_grad():
            for imgs, lbls in val_loader:
                imgs, lbls = imgs.to(device), lbls.to(device)
                outputs = model(imgs)
                loss = criterion(outputs, lbls)
                val_loss += loss.item() * imgs.size(0)
                preds = outputs.argmax(dim=1)
                val_correct += (preds == lbls).sum().item()
                total_val += imgs.size(0)

        ep_val_loss = val_loss / total_val
        ep_val_acc = val_correct / total_val

        history.append({
            "phase": "warmup",
            "epoch": global_epoch,
            "train_loss": round(ep_train_loss, 4),
            "train_acc": round(ep_train_acc, 4),
            "val_loss": round(ep_val_loss, 4),
            "val_acc": round(ep_val_acc, 4),
        })

        if ep_val_acc > best_val_acc or (ep_val_acc == best_val_acc and ep_val_loss < best_val_loss):
            best_val_acc = ep_val_acc
            best_val_loss = ep_val_loss
            best_epoch = global_epoch
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            print(f"  [Warmup {ep}/{args.warmup_epochs}] Train Loss: {ep_train_loss:.4f} Acc: {ep_train_acc*100:.1f}% | "
                  f"Val Loss: {ep_val_loss:.4f} Acc: {ep_val_acc*100:.1f}% (*Best)")
        else:
            print(f"  [Warmup {ep}/{args.warmup_epochs}] Train Loss: {ep_train_loss:.4f} Acc: {ep_train_acc*100:.1f}% | "
                  f"Val Loss: {ep_val_loss:.4f} Acc: {ep_val_acc*100:.1f}%")

    # Phase 2: Progressive Fine-Tuning
    print("\n>>> Phase 2: High-Level Feature Fine-Tuning (Unfreezing Layers 7+)...")
    for idx, layer in enumerate(model.features):
        if idx >= 7:
            for p in layer.parameters():
                p.requires_grad = True
        else:
            for p in layer.parameters():
                p.requires_grad = False

    finetune_params = [
        {"params": [p for p in model.features[7:].parameters() if p.requires_grad], "lr": args.lr_backbone},
        {"params": model.classifier.parameters(), "lr": args.lr_head},
    ]
    finetune_optimizer = torch.optim.AdamW(finetune_params, weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(finetune_optimizer, T_max=args.finetune_epochs, eta_min=1e-6)

    for ep in range(1, args.finetune_epochs + 1):
        global_epoch += 1
        model.train()
        train_loss, train_correct, total_train = 0.0, 0, 0
        for imgs, lbls in train_loader:
            imgs, lbls = imgs.to(device), lbls.to(device)
            finetune_optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, lbls)
            loss.backward()
            finetune_optimizer.step()
            train_loss += loss.item() * imgs.size(0)
            preds = outputs.argmax(dim=1)
            train_correct += (preds == lbls).sum().item()
            total_train += imgs.size(0)

        scheduler.step()
        ep_train_loss = train_loss / total_train
        ep_train_acc = train_correct / total_train

        model.eval()
        val_loss, val_correct, total_val = 0.0, 0, 0
        with torch.no_grad():
            for imgs, lbls in val_loader:
                imgs, lbls = imgs.to(device), lbls.to(device)
                outputs = model(imgs)
                loss = criterion(outputs, lbls)
                val_loss += loss.item() * imgs.size(0)
                preds = outputs.argmax(dim=1)
                val_correct += (preds == lbls).sum().item()
                total_val += imgs.size(0)

        ep_val_loss = val_loss / total_val
        ep_val_acc = val_correct / total_val

        history.append({
            "phase": "finetune",
            "epoch": global_epoch,
            "train_loss": round(ep_train_loss, 4),
            "train_acc": round(ep_train_acc, 4),
            "val_loss": round(ep_val_loss, 4),
            "val_acc": round(ep_val_acc, 4),
        })

        improved = False
        if ep_val_acc > best_val_acc:
            improved = True
        elif ep_val_acc == best_val_acc and ep_val_loss < best_val_loss:
            improved = True

        if improved:
            best_val_acc = ep_val_acc
            best_val_loss = ep_val_loss
            best_epoch = global_epoch
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            patience_counter = 0
            print(f"  [Fine-tune {ep:02d}/{args.finetune_epochs:02d}] Train: {ep_train_loss:.4f} ({ep_train_acc*100:.1f}%) | "
                  f"Val: {ep_val_loss:.4f} ({ep_val_acc*100:.1f}%) (*Best Saved)")
        else:
            patience_counter += 1
            print(f"  [Fine-tune {ep:02d}/{args.finetune_epochs:02d}] Train: {ep_train_loss:.4f} ({ep_train_acc*100:.1f}%) | "
                  f"Val: {ep_val_loss:.4f} ({ep_val_acc*100:.1f}%) [patience {patience_counter}/{args.patience}]")
            if patience_counter >= args.patience:
                print(f"Early stopping triggered at epoch {global_epoch}.")
                break

    total_time = time.time() - start_time
    print("-" * 65)
    print(f"Training Complete in {total_time:.1f}s! Best Val Accuracy: {best_val_acc*100:.1f}% (Epoch {best_epoch})")

    # Save best checkpoint
    checkpoint = {
        "model_state_dict": best_state_dict,
        "class_names": class_names,
        "num_classes": num_classes,
        "architecture": args.model_arch,
        "image_size": args.image_size,
        "val_acc": round(best_val_acc, 4),
        "val_loss": round(best_val_loss, 4),
        "epoch": best_epoch,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_strategy": "two_phase_progressive_transfer_learning",
        "hyperparameters": {
            "warmup_epochs": args.warmup_epochs,
            "finetune_epochs": args.finetune_epochs,
            "batch_size": args.batch_size,
            "lr_head": args.lr_head,
            "lr_backbone": args.lr_backbone,
            "seed": args.seed,
            "optimizer": "AdamW",
            "scheduler": "CosineAnnealingLR",
        },
        "history": history,
    }
    torch.save(checkpoint, best_checkpoint_path)
    print(f"Model Checkpoint saved to: {best_checkpoint_path}")

    # Save training metadata
    meta = {
        "model_name": "MediShelf MobileNetV3 Classifier",
        "architecture": args.model_arch,
        "dataset_version": "2.0.0-dailymed-spl-expanded",
        "class_count": num_classes,
        "class_names": class_names,
        "image_size": args.image_size,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "framework_version": f"PyTorch {torch.__version__}",
        "hyperparameters": {
            "warmup_epochs": args.warmup_epochs,
            "finetune_epochs": args.finetune_epochs,
            "batch_size": args.batch_size,
            "lr_head": args.lr_head,
            "lr_backbone": args.lr_backbone,
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
    parser.add_argument("--warmup-epochs", type=int, default=5, help="Number of warmup epochs for classification head")
    parser.add_argument("--finetune-epochs", type=int, default=30, help="Number of progressive fine-tuning epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Mini-batch size")
    parser.add_argument("--lr-head", type=float, default=4e-4, help="Classification head learning rate")
    parser.add_argument("--lr-backbone", type=float, default=6e-5, help="Backbone feature learning rate")
    parser.add_argument("--weight-decay", type=float, default=1e-2, help="L2 regularization weight decay")
    parser.add_argument("--label-smoothing", type=float, default=0.05, help="Label smoothing epsilon")
    parser.add_argument("--image-size", type=int, default=224, help="Input image dimension")
    parser.add_argument("--patience", type=int, default=12, help="Early stopping patience")
    parser.add_argument("--seed", type=int, default=101, help="Random seed")
    parser.add_argument("--model-arch", type=str, default="mobilenet_v3_small", help="Model architecture")
    parser.add_argument("--dataset-dir", type=str, default=str(PROJECT_ROOT / "ml" / "datasets"))
    parser.add_argument("--output-dir", type=str, default=str(PROJECT_ROOT / "ml" / "artifacts"))

    cli_args = parser.parse_args()
    train_model(cli_args)
