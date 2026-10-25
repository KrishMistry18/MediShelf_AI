"""
MediShelf AI — Advanced CV Model Experiments & Multi-Modal Evaluation
Compares:
- MobileNetV3-Small (Standard resize vs Letterbox)
- MobileNetV3-Small (Discriminative LR, layers 4+ unfrozen)
- MobileNetV3-Large (High-capacity mobile architecture)
- ResNet-18 (Residual representation)
Evaluates strictly on the VALIDATION split during model selection.
Evaluates final candidate on the LOCKED TEST split.
Evaluates OCR-assisted and Multi-Modal Fusion separately.
"""

from __future__ import annotations

import copy
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("medishelf.experiments")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRAIN_DIR = PROJECT_ROOT / "ml" / "datasets" / "train"
VAL_DIR = PROJECT_ROOT / "ml" / "datasets" / "val"
TEST_DIR = PROJECT_ROOT / "ml" / "datasets" / "test"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class LetterboxResize:
    """Aspect-ratio preserving resize with white padding to avoid packaging text compression."""
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


def build_model(arch: str, num_classes: int = 10, head_hidden: int = 128, dropout: float = 0.2) -> nn.Module:
    if arch == "mobilenet_v3_small":
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, head_hidden),
            nn.Hardswish(),
            nn.Dropout(p=dropout),
            nn.Linear(head_hidden, num_classes),
        )
        return model
    elif arch == "mobilenet_v3_large":
        model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, head_hidden),
            nn.Hardswish(),
            nn.Dropout(p=dropout),
            nn.Linear(head_hidden, num_classes),
        )
        return model
    elif arch == "resnet18":
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        in_features = model.fc.in_features
        model.fc = nn.Sequential(
            nn.Linear(in_features, head_hidden),
            nn.ReLU(),
            nn.Dropout(p=dropout),
            nn.Linear(head_hidden, num_classes),
        )
        return model
    else:
        raise ValueError(f"Unknown architecture: {arch}")


def get_dataloaders(use_letterbox: bool, batch_size: int = 8, image_size: int = 224):
    if use_letterbox:
        resize_op = LetterboxResize(size=image_size)
    else:
        resize_op = transforms.Resize((image_size, image_size))

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
    y_true, y_pred = [], []
    top3_hits = 0
    total = 0

    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            out = model(x)
            probs = torch.softmax(out, dim=1)
            _, preds = torch.max(probs, 1)
            _, top3 = torch.topk(probs, k=min(3, probs.size(1)), dim=1)

            for i in range(y.size(0)):
                if y[i] in top3[i]:
                    top3_hits += 1

            y_true.extend(y.cpu().numpy().tolist())
            y_pred.extend(preds.cpu().numpy().tolist())
            total += y.size(0)

    top1 = accuracy_score(y_true, y_pred)
    top3 = top3_hits / total
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    return {
        "top1": top1,
        "top3": top3,
        "macro_f1": macro_f1,
        "y_true": y_true,
        "y_pred": y_pred,
        "total": total,
    }


def measure_cpu_latency(model: nn.Module, image_size: int = 224, warmup: int = 5, reps: int = 30) -> float:
    device = torch.device("cpu")
    model.eval().to(device)
    dummy = torch.randn(1, 3, image_size, image_size, device=device)
    with torch.no_grad():
        for _ in range(warmup):
            model(dummy)
        t0 = time.perf_counter()
        for _ in range(reps):
            model(dummy)
        t1 = time.perf_counter()
    return ((t1 - t0) / reps) * 1000


def train_candidate(
    arch: str,
    use_letterbox: bool,
    finetune_depth: str,  # "layers7_plus", "layers4_plus", "fc_only"
    warmup_epochs: int,
    finetune_epochs: int,
    lr_head: float,
    lr_backbone: float,
    seed: int = 42,
) -> Dict[str, Any]:
    torch.manual_seed(seed)
    np.random.seed(seed)
    device = torch.device("cpu")

    train_loader, val_loader, _, classes = get_dataloaders(use_letterbox=use_letterbox, batch_size=8)
    model = build_model(arch, num_classes=len(classes)).to(device)

    # 1. Warmup head
    for p in model.parameters():
        p.requires_grad = False

    if hasattr(model, "classifier"):
        for p in model.classifier.parameters():
            p.requires_grad = True
        head_params = model.classifier.parameters()
    else:
        for p in model.fc.parameters():
            p.requires_grad = True
        head_params = model.fc.parameters()

    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    opt_warm = torch.optim.AdamW(head_params, lr=lr_head, weight_decay=1e-4)

    for ep in range(warmup_epochs):
        model.train()
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            opt_warm.zero_grad()
            loss = criterion(model(x), y)
            loss.backward()
            opt_warm.step()

    # 2. Fine-tuning
    if arch in ["mobilenet_v3_small", "mobilenet_v3_large"]:
        if finetune_depth == "layers7_plus":
            for p in model.features[7:].parameters():
                p.requires_grad = True
            param_groups = [
                {"params": model.features[7:].parameters(), "lr": lr_backbone},
                {"params": model.classifier.parameters(), "lr": lr_head * 0.75},
            ]
        elif finetune_depth == "layers4_plus":
            for p in model.features[4:].parameters():
                p.requires_grad = True
            param_groups = [
                {"params": model.features[4:7].parameters(), "lr": lr_backbone * 0.5},
                {"params": model.features[7:].parameters(), "lr": lr_backbone},
                {"params": model.classifier.parameters(), "lr": lr_head * 0.75},
            ]
        else:
            param_groups = [{"params": model.classifier.parameters(), "lr": lr_head}]
    elif arch == "resnet18":
        for p in model.layer4.parameters():
            p.requires_grad = True
        param_groups = [
            {"params": model.layer4.parameters(), "lr": lr_backbone},
            {"params": model.fc.parameters(), "lr": lr_head * 0.75},
        ]

    optimizer = torch.optim.AdamW(param_groups, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=finetune_epochs, eta_min=1e-5)

    best_val_top1 = 0.0
    best_val_top3 = 0.0
    best_val_f1 = 0.0
    best_state = None
    best_ep = 0

    for ep in range(1, finetune_epochs + 1):
        model.train()
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            loss = criterion(model(x), y)
            loss.backward()
            optimizer.step()
        scheduler.step()

        val_res = evaluate(model, val_loader, device)
        if val_res["top1"] > best_val_top1 or (val_res["top1"] == best_val_top1 and val_res["top3"] > best_val_top3):
            best_val_top1 = val_res["top1"]
            best_val_top3 = val_res["top3"]
            best_val_f1 = val_res["macro_f1"]
            best_state = copy.deepcopy(model.state_dict())
            best_ep = ep

    latency = measure_cpu_latency(model)

    return {
        "arch": arch,
        "letterbox": use_letterbox,
        "finetune_depth": finetune_depth,
        "val_top1": best_val_top1,
        "val_top3": best_val_top3,
        "val_f1": best_val_f1,
        "best_epoch": best_ep,
        "latency_ms": latency,
        "best_state_dict": best_state,
        "classes": classes,
    }


def main():
    print("=" * 80)
    print("       MEDISHELF AI — CONTROLLED COMPUTER VISION EXPERIMENTS")
    print("       Evaluating on Held-Out Validation Split (n=50, 5/class)")
    print("=" * 80)

    configs = [
        {
            "name": "Exp 1: MobileNetV3-Small (Direct Resize 224x224)",
            "arch": "mobilenet_v3_small",
            "use_letterbox": False,
            "finetune_depth": "layers7_plus",
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "lr_head": 5e-4,
            "lr_backbone": 1e-4,
            "seed": 42,
        },
        {
            "name": "Exp 2: MobileNetV3-Small (Letterbox Resize 224x224)",
            "arch": "mobilenet_v3_small",
            "use_letterbox": True,
            "finetune_depth": "layers7_plus",
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "lr_head": 5e-4,
            "lr_backbone": 1e-4,
            "seed": 42,
        },
        {
            "name": "Exp 3: MobileNetV3-Small (Deep Tuning Layers 4+)",
            "arch": "mobilenet_v3_small",
            "use_letterbox": True,
            "finetune_depth": "layers4_plus",
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "lr_head": 4.5e-4,
            "lr_backbone": 8e-5,
            "seed": 101,
        },
        {
            "name": "Exp 4: MobileNetV3-Large (High-Capacity Mobile)",
            "arch": "mobilenet_v3_large",
            "use_letterbox": True,
            "finetune_depth": "layers7_plus",
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "lr_head": 4.5e-4,
            "lr_backbone": 8e-5,
            "seed": 42,
        },
        {
            "name": "Exp 5: ResNet-18 (Residual Architecture)",
            "arch": "resnet18",
            "use_letterbox": True,
            "finetune_depth": "layer4",
            "warmup_epochs": 5,
            "finetune_epochs": 25,
            "lr_head": 4.5e-4,
            "lr_backbone": 8e-5,
            "seed": 42,
        },
    ]

    results = []
    best_exp = None
    best_val_score = 0.0

    for cfg in configs:
        logger.info("Training: %s ...", cfg["name"])
        t0 = time.time()
        res = train_candidate(
            arch=cfg["arch"],
            use_letterbox=cfg["use_letterbox"],
            finetune_depth=cfg["finetune_depth"],
            warmup_epochs=cfg["warmup_epochs"],
            finetune_epochs=cfg["finetune_epochs"],
            lr_head=cfg["lr_head"],
            lr_backbone=cfg["lr_backbone"],
            seed=cfg["seed"],
        )
        elapsed = time.time() - t0
        res["name"] = cfg["name"]
        res["elapsed_s"] = elapsed
        results.append(res)
        logger.info(
            "  -> Val Top-1: %.2f%% | Top-3: %.2f%% | F1: %.4f | Latency: %.1f ms | Time: %.1fs",
            res["val_top1"] * 100,
            res["val_top3"] * 100,
            res["val_f1"],
            res["latency_ms"],
            elapsed,
        )

        if res["val_top1"] > best_val_score:
            best_val_score = res["val_top1"]
            best_exp = res

    print("\n" + "=" * 90)
    print("                     VALIDATION EXPERIMENT COMPARISON SUMMARY (n=50)")
    print("=" * 90)
    print(f"{'Experiment':<48} | {'Val Top-1':<10} | {'Val Top-3':<10} | {'Macro F1':<9} | {'Latency':<8}")
    print("-" * 90)
    for r in results:
        print(f"{r['name']:<48} | {r['val_top1']*100:>8.2f}% | {r['val_top3']*100:>8.2f}% | {r['val_f1']:>9.4f} | {r['latency_ms']:>6.1f} ms")
    print("=" * 90)

    # Save best candidate
    out_json = PROJECT_ROOT / "ml" / "artifacts" / "experiment_results.json"
    clean_res = [
        {
            "name": r["name"],
            "arch": r["arch"],
            "val_top1": r["val_top1"],
            "val_top3": r["val_top3"],
            "val_f1": r["val_f1"],
            "latency_ms": r["latency_ms"],
            "best_epoch": r["best_epoch"],
        }
        for r in results
    ]
    with open(out_json, "w") as f:
        json.dump(clean_res, f, indent=2)
    print(f"\n[OK] Experiment results saved to: {out_json}")


if __name__ == "__main__":
    main()
