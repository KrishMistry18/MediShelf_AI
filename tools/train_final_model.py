"""
MediShelf AI — Final Optimized Model Training & Evaluation Pipeline
Trains the selected MobileNetV3-Small architecture with:
- Discriminative deep fine-tuning (layers 4+ unfrozen)
- Differential learning rates (backbone 8e-5, head 4e-4)
- 5 Warmup epochs + 35 Fine-tuning epochs with Cosine Annealing
- Label smoothing 0.05
- Aspect-preserving letterbox resizing & safe packaging augmentations
Synchronizes checkpoint to ml/artifacts/model/medicine_classifier.pt
Computes independent test metrics on locked test split (n=50) -> test_metrics.json
"""

from __future__ import annotations

import copy
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
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("medishelf.train_final")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = PROJECT_ROOT / "ml" / "datasets"
TRAIN_DIR = DATASETS_DIR / "train"
VAL_DIR = DATASETS_DIR / "val"
TEST_DIR = DATASETS_DIR / "test"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "model" / "medicine_classifier.pt"
METADATA_PATH = ARTIFACTS_DIR / "metadata" / "metadata.json"
METRICS_PATH = ARTIFACTS_DIR / "metrics" / "test_metrics.json"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class LetterboxResize:
    def __init__(self, size: int = 224, fill=(255, 255, 255)):
        self.size = size
        self.fill = fill

    def __call__(self, img: Image.Image) -> Image.Image:
        w, h = img.size
        scale = self.size / max(w, h)
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        resized = img.resize((nw, nh), Image.Resampling.BILINEAR)
        padded = Image.new("RGB", (self.size, self.size), self.fill)
        pad_x = (self.size - nw) // 2
        pad_y = (self.size - nh) // 2
        padded.paste(resized, (pad_x, pad_y))
        return padded


def set_seed(seed: int = 101):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def build_classifier(num_classes: int = 10) -> nn.Module:
    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    in_features = model.classifier[3].in_features  # 1024
    model.classifier[3] = nn.Sequential(
        nn.Linear(in_features, 128),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(128, num_classes),
    )
    return model


def get_dataloaders(batch_size: int = 8, image_size: int = 224):
    resize_op = LetterboxResize(size=image_size)

    train_tf = transforms.Compose([
        resize_op,
        transforms.RandomRotation(degrees=(-7, 7)),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.10),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    eval_tf = transforms.Compose([
        resize_op,
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    train_ds = datasets.ImageFolder(str(TRAIN_DIR), transform=train_tf)
    val_ds = datasets.ImageFolder(str(VAL_DIR), transform=eval_tf)
    test_ds = datasets.ImageFolder(str(TEST_DIR), transform=eval_tf)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    return train_loader, val_loader, test_loader, train_ds.classes


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device):
    model.eval()
    y_true, y_pred, y_probs = [], [], []
    top3_hits = 0
    total = 0
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()

    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            out = model(x)
            loss = criterion(out, y)
            total_loss += loss.item() * y.size(0)

            probs = torch.softmax(out, dim=1)
            _, preds = torch.max(probs, 1)
            _, top3 = torch.topk(probs, k=min(3, probs.size(1)), dim=1)

            for i in range(y.size(0)):
                if y[i] in top3[i]:
                    top3_hits += 1

            y_true.extend(y.cpu().numpy().tolist())
            y_pred.extend(preds.cpu().numpy().tolist())
            y_probs.extend(probs.cpu().numpy().tolist())
            total += y.size(0)

    top1 = accuracy_score(y_true, y_pred)
    top3 = top3_hits / total
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    avg_loss = total_loss / total

    return {
        "top1": top1,
        "top3": top3,
        "macro_f1": macro_f1,
        "loss": avg_loss,
        "y_true": y_true,
        "y_pred": y_pred,
        "y_probs": y_probs,
        "total": total,
    }


def train_and_sync():
    set_seed(101)
    device = torch.device("cpu")
    logger.info("Starting training pipeline on device: %s", device)

    train_loader, val_loader, test_loader, class_names = get_dataloaders(batch_size=8)
    num_classes = len(class_names)
    logger.info("Classes (%d): %s", num_classes, class_names)

    model = build_classifier(num_classes).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)

    warmup_epochs = 5
    finetune_epochs = 35
    lr_head = 4.5e-4
    lr_backbone = 8.0e-5

    history: List[Dict[str, Any]] = []

    # Phase 1: Warmup
    logger.info(">>> Phase 1: Classification Head Warmup (5 epochs)...")
    for p in model.parameters():
        p.requires_grad = False
    for p in model.classifier.parameters():
        p.requires_grad = True

    opt_warm = torch.optim.AdamW(model.classifier.parameters(), lr=lr_head, weight_decay=1e-4)

    for ep in range(1, warmup_epochs + 1):
        model.train()
        train_loss, train_correct, n_train = 0.0, 0, 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            opt_warm.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            opt_warm.step()
            train_loss += loss.item() * y.size(0)
            train_correct += (out.argmax(1) == y).sum().item()
            n_train += y.size(0)

        val_m = evaluate(model, val_loader, device)
        history.append({
            "phase": "warmup",
            "epoch": ep,
            "train_loss": round(train_loss / n_train, 4),
            "train_acc": round(train_correct / n_train, 4),
            "val_loss": round(val_m["loss"], 4),
            "val_acc": round(val_m["top1"], 4),
        })
        logger.info("  Warmup [%d/%d] Train Loss: %.4f Acc: %.1f%% | Val Loss: %.4f Acc: %.1f%%",
                    ep, warmup_epochs, train_loss / n_train, (train_correct / n_train) * 100, val_m["loss"], val_m["top1"] * 100)

    # Phase 2: Deep fine-tuning
    logger.info(">>> Phase 2: Discriminative Deep Fine-Tuning (35 epochs)...")
    for p in model.features[4:].parameters():
        p.requires_grad = True

    param_groups = [
        {"params": model.features[4:7].parameters(), "lr": lr_backbone * 0.5},
        {"params": model.features[7:].parameters(), "lr": lr_backbone},
        {"params": model.classifier.parameters(), "lr": lr_head * 0.75},
    ]
    optimizer = torch.optim.AdamW(param_groups, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=finetune_epochs, eta_min=1e-5)

    best_val_score = 0.0
    best_state_dict = None
    best_ep = 0

    for ep in range(1, finetune_epochs + 1):
        global_ep = warmup_epochs + ep
        model.train()
        train_loss, train_correct, n_train = 0.0, 0, 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * y.size(0)
            train_correct += (out.argmax(1) == y).sum().item()
            n_train += y.size(0)

        scheduler.step()
        val_m = evaluate(model, val_loader, device)

        history.append({
            "phase": "finetune",
            "epoch": global_ep,
            "train_loss": round(train_loss / n_train, 4),
            "train_acc": round(train_correct / n_train, 4),
            "val_loss": round(val_m["loss"], 4),
            "val_acc": round(val_m["top1"], 4),
        })

        if val_m["top1"] > best_val_score:
            best_val_score = val_m["top1"]
            best_state_dict = copy.deepcopy(model.state_dict())
            best_ep = global_ep
            logger.info("  Fine-tune [%02d/%02d] Train Acc: %.1f%% | Val Acc: %.1f%% (*Best)",
                        ep, finetune_epochs, (train_correct / n_train) * 100, val_m["top1"] * 100)
        else:
            logger.info("  Fine-tune [%02d/%02d] Train Acc: %.1f%% | Val Acc: %.1f%%",
                        ep, finetune_epochs, (train_correct / n_train) * 100, val_m["top1"] * 100)

    # Load best checkpoint for final evaluation
    model.load_state_dict(best_state_dict)
    model.eval()

    # Final independent test set evaluation (n=50)
    logger.info("\n>>> Evaluating Best Checkpoint on Locked Independent Test Split (n=50)...")
    test_res = evaluate(model, test_loader, device)
    y_true = test_res["y_true"]
    y_pred = test_res["y_pred"]

    cm = confusion_matrix(y_true, y_pred, labels=list(range(num_classes))).tolist()
    cr = classification_report(y_true, y_pred, target_names=class_names, output_dict=True, zero_division=0)

    per_class_metrics = {}
    for c_idx, c_name in enumerate(class_names):
        c_stats = cr.get(c_name, {})
        per_class_metrics[c_name] = {
            "precision": round(c_stats.get("precision", 0.0), 4),
            "recall": round(c_stats.get("recall", 0.0), 4),
            "f1-score": round(c_stats.get("f1-score", 0.0), 4),
            "support": int(c_stats.get("support", 0)),
        }

    top1_acc = round(test_res["top1"], 4)
    top3_acc = round(test_res["top3"], 4)
    macro_p = round(cr["macro avg"]["precision"], 4)
    macro_r = round(cr["macro avg"]["recall"], 4)
    macro_f1 = round(cr["macro avg"]["f1-score"], 4)
    weighted_p = round(cr["weighted avg"]["precision"], 4)
    weighted_r = round(cr["weighted avg"]["recall"], 4)
    weighted_f1 = round(cr["weighted avg"]["f1-score"], 4)

    logger.info("=================================================================")
    logger.info("               FINAL INDEPENDENT TEST SET RESULTS                ")
    logger.info("=================================================================")
    logger.info("Top-1 Accuracy : %.2f%% (%d/%d)", top1_acc * 100, int(round(top1_acc * 50)), 50)
    logger.info("Top-3 Accuracy : %.2f%% (%d/%d)", top3_acc * 100, int(round(top3_acc * 50)), 50)
    logger.info("Macro Precision: %.4f", macro_p)
    logger.info("Macro Recall   : %.4f", macro_r)
    logger.info("Macro F1       : %.4f", macro_f1)
    logger.info("=================================================================")

    # 1. Save checkpoint
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_data = {
        "model_state_dict": best_state_dict,
        "class_names": class_names,
        "num_classes": num_classes,
        "architecture": "mobilenet_v3_small",
        "image_size": 224,
        "val_acc": round(best_val_score, 4),
        "test_top1": top1_acc,
        "test_top3": top3_acc,
        "test_macro_f1": macro_f1,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_strategy": "two_phase_discriminative_deep_fine_tuning",
        "hyperparameters": {
            "warmup_epochs": warmup_epochs,
            "finetune_epochs": finetune_epochs,
            "batch_size": 8,
            "lr_head": lr_head,
            "lr_backbone": lr_backbone,
            "seed": 101,
            "optimizer": "AdamW",
            "scheduler": "CosineAnnealingLR",
        },
        "history": history,
    }
    torch.save(checkpoint_data, MODEL_PATH)
    logger.info("[OK] Production checkpoint saved to: %s", MODEL_PATH)

    # 2. Save test metrics JSON
    metrics_data = {
        "evaluation_dataset": "Isolated Authentic Test Split (16.7%)",
        "sample_count": 50,
        "class_names": class_names,
        "top1_accuracy": top1_acc,
        "top3_accuracy": top3_acc,
        "macro_precision": macro_p,
        "macro_recall": macro_r,
        "macro_f1": macro_f1,
        "weighted_precision": weighted_p,
        "weighted_recall": weighted_r,
        "weighted_f1": weighted_f1,
        "per_class": per_class_metrics,
        "confusion_matrix": cm,
    }
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    logger.info("[OK] Test metrics saved to: %s", METRICS_PATH)

    # 3. Save metadata JSON
    metadata_data = {
        "model_name": "MediShelf MobileNetV3 Classifier",
        "architecture": "mobilenet_v3_small",
        "dataset_version": "3.0.0-dailymed-spl-300-verified",
        "class_count": num_classes,
        "class_names": class_names,
        "image_size": 224,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "framework_version": f"PyTorch {torch.__version__}",
        "hyperparameters": {
            "warmup_epochs": warmup_epochs,
            "finetune_epochs": finetune_epochs,
            "batch_size": 8,
            "lr_head": lr_head,
            "lr_backbone": lr_backbone,
            "seed": 101,
            "optimizer": "AdamW",
            "scheduler": "CosineAnnealingLR",
        },
        "best_val_accuracy": round(best_val_score, 4),
        "history": history,
    }
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata_data, f, indent=2)
    logger.info("[OK] Model metadata saved to: %s", METADATA_PATH)


if __name__ == "__main__":
    train_and_sync()
