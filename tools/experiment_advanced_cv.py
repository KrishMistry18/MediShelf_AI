"""
MediShelf AI — Controlled Model Experiments on Expanded Dataset (300 images)
Evaluates strictly against the VALIDATION partition (n=50, 5 per class).
Never touches the locked test split during experimentation.
"""

from __future__ import annotations

import copy
import json
import logging
import random
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("medishelf.experiments")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = PROJECT_ROOT / "ml" / "datasets"
TRAIN_DIR = DATASETS_DIR / "train"
VAL_DIR = DATASETS_DIR / "val"
CHECKPOINT_DIR = PROJECT_ROOT / "ml" / "checkpoints"
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class LetterboxResize:
    """Aspect-preserving resize with neutral padding to prevent packaging text distortion."""
    def __init__(self, size: int = 224, fill=(255, 255, 255)):
        self.size = size
        self.fill = fill

    def __call__(self, img: Image.Image) -> Image.Image:
        w, h = img.size
        scale = self.size / max(w, h)
        new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
        resized = img.resize((new_w, new_h), Image.Resampling.BILINEAR)
        padded = Image.new("RGB", (self.size, self.size), self.fill)
        pad_x = (self.size - new_w) // 2
        pad_y = (self.size - new_h) // 2
        padded.paste(resized, (pad_x, pad_y))
        return padded


def set_seed(seed: int = 101):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def build_model(arch: str, num_classes: int = 10, head_hidden: int = 256, dropout: float = 0.2):
    if arch == "mobilenet_v3_small":
        base = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        in_features = base.classifier[0].in_features
        base.classifier = nn.Sequential(
            nn.Linear(in_features, head_hidden),
            nn.Hardswish(),
            nn.Dropout(p=dropout),
            nn.Linear(head_hidden, num_classes),
        )
        return base
    elif arch == "mobilenet_v3_large":
        base = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.DEFAULT)
        in_features = base.classifier[0].in_features
        base.classifier = nn.Sequential(
            nn.Linear(in_features, head_hidden),
            nn.Hardswish(),
            nn.Dropout(p=dropout),
            nn.Linear(head_hidden, num_classes),
        )
        return base
    elif arch == "resnet18":
        base = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        in_features = base.fc.in_features
        base.fc = nn.Sequential(
            nn.Linear(in_features, head_hidden),
            nn.ReLU(),
            nn.Dropout(p=dropout),
            nn.Linear(head_hidden, num_classes),
        )
        return base
    elif arch == "efficientnet_b0":
        base = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        in_features = base.classifier[1].in_features
        base.classifier = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, head_hidden),
            nn.SiLU(),
            nn.Dropout(p=dropout),
            nn.Linear(head_hidden, num_classes),
        )
        return base
    else:
        raise ValueError(f"Unknown architecture: {arch}")


def evaluate_val(model: nn.Module, val_loader: DataLoader, device: torch.device):
    model.eval()
    y_true = []
    y_pred = []
    top3_correct = 0
    total = 0
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()

    with torch.no_grad():
        for inputs, targets in val_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            total_loss += loss.item() * targets.size(0)

            probs = torch.softmax(outputs, dim=1)
            _, preds = torch.max(probs, 1)

            # Top 3
            _, top3_indices = torch.topk(probs, k=min(3, probs.size(1)), dim=1)
            for i in range(targets.size(0)):
                if targets[i] in top3_indices[i]:
                    top3_correct += 1

            y_true.extend(targets.cpu().numpy().tolist())
            y_pred.extend(preds.cpu().numpy().tolist())
            total += targets.size(0)

    top1 = accuracy_score(y_true, y_pred)
    top3 = top3_correct / total
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    avg_loss = total_loss / total

    return {
        "top1": top1,
        "top3": top3,
        "macro_f1": macro_f1,
        "loss": avg_loss,
        "y_true": y_true,
        "y_pred": y_pred,
    }


def run_experiment(exp_cfg: Dict[str, Any], device: torch.device) -> Dict[str, Any]:
    logger.info("=" * 70)
    logger.info("Running: %s", exp_cfg["name"])
    logger.info("Config: %s", exp_cfg)
    logger.info("=" * 70)

    set_seed(exp_cfg.get("seed", 101))
    image_size = exp_cfg.get("image_size", 224)

    # Transforms
    if exp_cfg.get("letterbox", True):
        resize_op = LetterboxResize(size=image_size)
    else:
        resize_op = transforms.Resize((image_size, image_size))

    train_transform_list = [resize_op]
    if exp_cfg.get("rotation", True):
        train_transform_list.append(transforms.RandomRotation(degrees=(-7, 7)))
    if exp_cfg.get("color_jitter", True):
        train_transform_list.append(transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.10))
    train_transform_list.extend([
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    train_transforms = transforms.Compose(train_transform_list)

    val_transforms = transforms.Compose([
        resize_op,
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    train_ds = datasets.ImageFolder(str(TRAIN_DIR), transform=train_transforms)
    val_ds = datasets.ImageFolder(str(VAL_DIR), transform=val_transforms)

    batch_size = exp_cfg.get("batch_size", 8)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    num_classes = len(train_ds.classes)
    model = build_model(
        exp_cfg["arch"],
        num_classes=num_classes,
        head_hidden=exp_cfg.get("head_hidden", 256),
        dropout=exp_cfg.get("dropout", 0.2),
    ).to(device)

    # Measure CPU latency
    sample_input = torch.randn(1, 3, image_size, image_size, device=device)
    model.eval()
    for _ in range(5):
        model(sample_input)
    t0 = time.perf_counter()
    for _ in range(25):
        model(sample_input)
    latency_ms = (time.perf_counter() - t0) / 25 * 1000

    criterion = nn.CrossEntropyLoss(label_smoothing=exp_cfg.get("label_smoothing", 0.05))

    # Phase 1: Warmup classifier head
    warmup_epochs = exp_cfg.get("warmup_epochs", 5)
    for p in model.parameters():
        p.requires_grad = False

    if hasattr(model, "classifier"):
        for p in model.classifier.parameters():
            p.requires_grad = True
        head_params = model.classifier.parameters()
    elif hasattr(model, "fc"):
        for p in model.fc.parameters():
            p.requires_grad = True
        head_params = model.fc.parameters()
    else:
        head_params = model.parameters()

    optimizer = torch.optim.AdamW(head_params, lr=exp_cfg["lr_head"], weight_decay=exp_cfg.get("weight_decay", 1e-2))

    for ep in range(1, warmup_epochs + 1):
        model.train()
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

    # Phase 2: Fine-tuning
    finetune_depth = exp_cfg.get("finetune_depth", "layers7_plus")
    if exp_cfg["arch"] in ["mobilenet_v3_small", "mobilenet_v3_large"]:
        if finetune_depth == "layers7_plus":
            for p in model.features[7:].parameters():
                p.requires_grad = True
            param_groups = [
                {"params": model.features[7:].parameters(), "lr": exp_cfg["lr_backbone"]},
                {"params": model.classifier.parameters(), "lr": exp_cfg["lr_head"]},
            ]
        elif finetune_depth == "layers4_plus":
            for p in model.features[4:7].parameters():
                p.requires_grad = True
            for p in model.features[7:].parameters():
                p.requires_grad = True
            param_groups = [
                {"params": model.features[4:7].parameters(), "lr": exp_cfg["lr_backbone"] * 0.4},
                {"params": model.features[7:].parameters(), "lr": exp_cfg["lr_backbone"]},
                {"params": model.classifier.parameters(), "lr": exp_cfg["lr_head"]},
            ]
        elif finetune_depth == "full":
            for p in model.features.parameters():
                p.requires_grad = True
            param_groups = [
                {"params": model.features.parameters(), "lr": exp_cfg["lr_backbone"]},
                {"params": model.classifier.parameters(), "lr": exp_cfg["lr_head"]},
            ]
    elif exp_cfg["arch"] == "resnet18":
        for p in model.layer3.parameters():
            p.requires_grad = True
        for p in model.layer4.parameters():
            p.requires_grad = True
        param_groups = [
            {"params": list(model.layer3.parameters()) + list(model.layer4.parameters()), "lr": exp_cfg["lr_backbone"]},
            {"params": model.fc.parameters(), "lr": exp_cfg["lr_head"]},
        ]
    elif exp_cfg["arch"] == "efficientnet_b0":
        for p in model.features[5:].parameters():
            p.requires_grad = True
        param_groups = [
            {"params": model.features[5:].parameters(), "lr": exp_cfg["lr_backbone"]},
            {"params": model.classifier.parameters(), "lr": exp_cfg["lr_head"]},
        ]

    finetune_epochs = exp_cfg.get("finetune_epochs", 30)
    optimizer = torch.optim.AdamW(param_groups, weight_decay=exp_cfg.get("weight_decay", 1e-2))
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=finetune_epochs, eta_min=1e-6)

    best_val_top1 = 0.0
    best_val_top3 = 0.0
    best_val_f1 = 0.0
    best_epoch = 0
    best_state_dict = None

    for ep in range(1, finetune_epochs + 1):
        model.train()
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

        scheduler.step()

        val_metrics = evaluate_val(model, val_loader, device)
        if val_metrics["top1"] > best_val_top1 or (val_metrics["top1"] == best_val_top1 and val_metrics["top3"] > best_val_top3):
            best_val_top1 = val_metrics["top1"]
            best_val_top3 = val_metrics["top3"]
            best_val_f1 = val_metrics["macro_f1"]
            best_epoch = ep
            best_state_dict = copy.deepcopy(model.state_dict())

    logger.info(
        "Exp '%s' finished: Best Val Top-1: %.4f (%d/50) | Top-3: %.4f (%d/50) | F1: %.4f at Ep %d | Latency: %.1f ms",
        exp_cfg["name"],
        best_val_top1,
        int(round(best_val_top1 * 50)),
        best_val_top3,
        int(round(best_val_top3 * 50)),
        best_val_f1,
        best_epoch,
        latency_ms,
    )

    return {
        "name": exp_cfg["name"],
        "arch": exp_cfg["arch"],
        "val_top1": best_val_top1,
        "val_top3": best_val_top3,
        "val_f1": best_val_f1,
        "best_epoch": best_epoch,
        "latency_ms": latency_ms,
        "best_state_dict": best_state_dict,
        "config": exp_cfg,
    }


def main():
    device = torch.device("cpu")
    logger.info("Running experiments on device: %s", device)

    experiments = [
        {
            "name": "Exp 1: Baseline MobileNetV3-Small (Direct Resize 224x224)",
            "arch": "mobilenet_v3_small",
            "letterbox": False,
            "image_size": 224,
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "finetune_depth": "layers7_plus",
            "lr_head": 4e-4,
            "lr_backbone": 6e-5,
            "label_smoothing": 0.05,
            "weight_decay": 1e-2,
            "head_hidden": 256,
            "dropout": 0.2,
            "seed": 101,
        },
        {
            "name": "Exp 2: Aspect-Preserving Letterbox (LetterboxResize 224x224)",
            "arch": "mobilenet_v3_small",
            "letterbox": True,
            "image_size": 224,
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "finetune_depth": "layers7_plus",
            "lr_head": 4e-4,
            "lr_backbone": 6e-5,
            "label_smoothing": 0.05,
            "weight_decay": 1e-2,
            "head_hidden": 256,
            "dropout": 0.2,
            "seed": 101,
        },
        {
            "name": "Exp 3: Discriminative Deep Fine-Tuning (Layers 4+ Unfrozen)",
            "arch": "mobilenet_v3_small",
            "letterbox": True,
            "image_size": 224,
            "warmup_epochs": 5,
            "finetune_epochs": 30,
            "finetune_depth": "layers4_plus",
            "lr_head": 4e-4,
            "lr_backbone": 6e-5,
            "label_smoothing": 0.05,
            "weight_decay": 1e-2,
            "head_hidden": 256,
            "dropout": 0.2,
            "seed": 101,
        },
        {
            "name": "Exp 4: Deep Fine-Tuning with Regularization & Label Smoothing 0.08",
            "arch": "mobilenet_v3_small",
            "letterbox": True,
            "image_size": 224,
            "warmup_epochs": 5,
            "finetune_epochs": 30,
            "finetune_depth": "layers4_plus",
            "lr_head": 3.5e-4,
            "lr_backbone": 5e-5,
            "label_smoothing": 0.08,
            "weight_decay": 1.5e-2,
            "head_hidden": 256,
            "dropout": 0.25,
            "seed": 777,
        },
        {
            "name": "Exp 5: Architecture Comparison: MobileNetV3-Large",
            "arch": "mobilenet_v3_large",
            "letterbox": True,
            "image_size": 224,
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "finetune_depth": "layers7_plus",
            "lr_head": 4e-4,
            "lr_backbone": 6e-5,
            "label_smoothing": 0.05,
            "weight_decay": 1e-2,
            "head_hidden": 256,
            "dropout": 0.2,
            "seed": 101,
        },
        {
            "name": "Exp 6: Architecture Comparison: ResNet-18",
            "arch": "resnet18",
            "letterbox": True,
            "image_size": 224,
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "finetune_depth": "layers3_plus",
            "lr_head": 4e-4,
            "lr_backbone": 6e-5,
            "label_smoothing": 0.05,
            "weight_decay": 1e-2,
            "head_hidden": 256,
            "dropout": 0.2,
            "seed": 101,
        },
    ]

    results = []
    best_overall_top1 = 0.0
    best_overall_exp = None

    for exp in experiments:
        res = run_experiment(exp, device)
        results.append(res)
        if res["val_top1"] > best_overall_top1 or (res["val_top1"] == best_overall_top1 and res["val_top3"] > (best_overall_exp.get("val_top3", 0) if best_overall_exp else 0)):
            best_overall_top1 = res["val_top1"]
            best_overall_exp = res
            # Save candidate checkpoint
            ckpt_path = CHECKPOINT_DIR / "candidate_best.pth"
            torch.save(
                {
                    "architecture": res["arch"],
                    "state_dict": res["best_state_dict"],
                    "val_top1": res["val_top1"],
                    "val_top3": res["val_top3"],
                    "val_f1": res["val_f1"],
                    "config": res["config"],
                    "class_names": sorted([d.name for d in TRAIN_DIR.iterdir() if d.is_dir()]),
                    "image_size": res["config"].get("image_size", 224),
                },
                ckpt_path,
            )
            logger.info("Saved best candidate checkpoint to %s (Val Top-1: %.4f)", ckpt_path, best_overall_top1)

    print("\n" + "=" * 90)
    print("                      CONTROLLED EXPERIMENT SUMMARY (VALIDATION SPLIT n=50)")
    print("=" * 90)
    print(f"{'Experiment':<50} | {'Val Top-1':<10} | {'Val Top-3':<10} | {'Val F1':<8} | {'Latency':<8}")
    print("-" * 90)
    for r in results:
        print(f"{r['name']:<50} | {r['val_top1']*100:>8.2f}% | {r['val_top3']*100:>8.2f}% | {r['val_f1']:>8.4f} | {r['latency_ms']:>6.1f} ms")
    print("=" * 90)


if __name__ == "__main__":
    main()
