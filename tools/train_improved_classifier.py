"""
MediShelf AI — Improved Transfer Learning Training Pipeline (Step 4)
Implements:
1. Two-phase progressive transfer learning (Phase 1: Head warmup, Phase 2: Top backbone fine-tuning)
2. Differential learning rates (backbone lr=1.5e-4, head lr=6e-4)
3. Cosine annealing learning rate scheduling
4. Inverse class weighting for balanced cross-entropy loss
5. Early stopping with checkpointing based on validation accuracy & loss
6. Reproducible seed control (seed=42)
7. Full training history logging into JSON metadata
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models
from torchvision.models import MobileNet_V3_Small_Weights

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.image_pipeline import get_eval_transforms, get_train_transforms

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("medishelf.train_improved")


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def build_model(num_classes: int) -> nn.Module:
    weights = MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)

    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(
        nn.Linear(in_features, 128),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(128, num_classes)
    )
    return model


def compute_class_weights(dataset: datasets.ImageFolder) -> torch.Tensor:
    targets = [s[1] for s in dataset.samples]
    class_counts = np.bincount(targets, minlength=len(dataset.classes))
    total_samples = len(targets)
    weights = total_samples / (len(dataset.classes) * class_counts.astype(np.float32))
    return torch.tensor(weights, dtype=torch.float32)


def run_training(
    dataset_dir: Path = PROJECT_ROOT / "ml" / "datasets",
    candidate_save_path: Path = PROJECT_ROOT / "ml" / "artifacts" / "model" / "medicine_classifier_improved_candidate.pt",
    warmup_epochs: int = 5,
    finetune_epochs: int = 18,
    batch_size: int = 8,
    lr_head: float = 6e-4,
    lr_backbone: float = 1.2e-4,
    patience: int = 7,
    seed: int = 42,
) -> Dict[str, Any]:
    dataset_dir = Path(dataset_dir)
    candidate_save_path = Path(candidate_save_path)
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_dir = dataset_dir / "train"
    val_dir = dataset_dir / "val"

    train_dataset = datasets.ImageFolder(train_dir, transform=get_train_transforms(224))
    val_dataset = datasets.ImageFolder(val_dir, transform=get_eval_transforms(224))

    class_names = train_dataset.classes
    num_classes = len(class_names)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    model = build_model(num_classes).to(device)
    class_weights = compute_class_weights(train_dataset).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    logger.info("=" * 65)
    logger.info("   MEDISHELF AI — TWO-PHASE PROGRESSIVE CLASSIFIER TRAINING")
    logger.info("=" * 65)
    logger.info("Device              : %s", device)
    logger.info("Classes             : %d -> %s", num_classes, class_names)
    logger.info("Training images     : %d", len(train_dataset))
    logger.info("Validation images   : %d", len(val_dataset))
    logger.info("Warmup Epochs (Head): %d (lr=%s)", warmup_epochs, lr_head)
    logger.info("Fine-tune Epochs    : %d (backbone lr=%s, head lr=%s)", finetune_epochs, lr_backbone, lr_head)
    logger.info("Early stop patience : %d", patience)
    logger.info("-" * 65)

    history: List[Dict[str, Any]] = []
    best_val_acc = -1.0
    best_val_loss = float("inf")
    best_state_dict = None
    best_epoch = 0
    patience_counter = 0

    candidate_save_path.parent.mkdir(parents=True, exist_ok=True)

    # -------------------------------------------------------------
    # PHASE 1: Head Warmup (Backbone completely frozen)
    # -------------------------------------------------------------
    logger.info("\n>>> Starting Phase 1: Classification Head Warmup...")
    for param in model.features.parameters():
        param.requires_grad = False
    for param in model.classifier.parameters():
        param.requires_grad = True

    warmup_optimizer = torch.optim.AdamW(
        model.classifier.parameters(),
        lr=lr_head,
        weight_decay=1e-4,
    )

    global_epoch = 0
    for ep in range(1, warmup_epochs + 1):
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

        # Validation
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
            logger.info("  [Warmup %d/%d] Train Loss: %.4f Acc: %.1f%% | Val Loss: %.4f Acc: %.1f%% (*Best)",
                        ep, warmup_epochs, ep_train_loss, ep_train_acc * 100, ep_val_loss, ep_val_acc * 100)
        else:
            logger.info("  [Warmup %d/%d] Train Loss: %.4f Acc: %.1f%% | Val Loss: %.4f Acc: %.1f%%",
                        ep, warmup_epochs, ep_train_loss, ep_train_acc * 100, ep_val_loss, ep_val_acc * 100)

    # -------------------------------------------------------------
    # PHASE 2: Progressive Fine-Tuning (Unfreeze higher-level blocks)
    # -------------------------------------------------------------
    logger.info("\n>>> Starting Phase 2: High-Level Feature Fine-Tuning...")
    # MobileNetV3-Small features has 13 layers (0 to 12).
    # Unfreeze from layer 7 onwards (high-level visual abstraction).
    for idx, layer in enumerate(model.features):
        if idx >= 7:
            for p in layer.parameters():
                p.requires_grad = True
        else:
            for p in layer.parameters():
                p.requires_grad = False

    finetune_params = [
        {"params": [p for p in model.features[7:].parameters() if p.requires_grad], "lr": lr_backbone},
        {"params": model.classifier.parameters(), "lr": lr_head * 0.75},
    ]

    finetune_optimizer = torch.optim.AdamW(finetune_params, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(finetune_optimizer, T_max=finetune_epochs, eta_min=1e-5)

    for ep in range(1, finetune_epochs + 1):
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

        # Validation
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
            logger.info("  [Fine-tune %02d/%02d] Train: %.4f (%.1f%%) | Val: %.4f (%.1f%%) (*Best Saved)",
                        ep, finetune_epochs, ep_train_loss, ep_train_acc * 100, ep_val_loss, ep_val_acc * 100)
        else:
            patience_counter += 1
            logger.info("  [Fine-tune %02d/%02d] Train: %.4f (%.1f%%) | Val: %.4f (%.1f%%) [patience: %d/%d]",
                        ep, finetune_epochs, ep_train_loss, ep_train_acc * 100, ep_val_loss, ep_val_acc * 100,
                        patience_counter, patience)
            if patience_counter >= patience:
                logger.info("Early stopping triggered at epoch %d.", global_epoch)
                break

    # Save candidate checkpoint
    checkpoint = {
        "model_state_dict": best_state_dict,
        "class_names": class_names,
        "num_classes": num_classes,
        "architecture": "mobilenet_v3_small",
        "image_size": 224,
        "val_acc": round(best_val_acc, 4),
        "val_loss": round(best_val_loss, 4),
        "epoch": best_epoch,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_strategy": "two_phase_progressive_transfer_learning",
        "hyperparameters": {
            "warmup_epochs": warmup_epochs,
            "finetune_epochs": finetune_epochs,
            "batch_size": batch_size,
            "lr_head": lr_head,
            "lr_backbone": lr_backbone,
            "seed": seed,
            "optimizer": "AdamW",
            "scheduler": "CosineAnnealingLR",
        },
        "history": history,
    }
    torch.save(checkpoint, candidate_save_path)
    logger.info("=" * 65)
    logger.info("Candidate model saved to: %s", candidate_save_path)
    logger.info("Best Validation Accuracy: %.2f%% (Epoch %d)", best_val_acc * 100, best_epoch)
    logger.info("=" * 65)

    return checkpoint


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Improved MobileNetV3 Medicine Packaging Classifier")
    parser.add_argument("--warmup-epochs", type=int, default=5)
    parser.add_argument("--finetune-epochs", type=int, default=18)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--lr-head", type=float, default=6e-4)
    parser.add_argument("--lr-backbone", type=float, default=1.2e-4)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    run_training(
        warmup_epochs=args.warmup_epochs,
        finetune_epochs=args.finetune_epochs,
        batch_size=args.batch_size,
        lr_head=args.lr_head,
        lr_backbone=args.lr_backbone,
        seed=args.seed,
    )
