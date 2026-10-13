"""
MediShelf AI — Model Experimentation and Ablation Suite
Compares architectures, augmentations, and training strategies strictly on validation split.
Held-out test set is NEVER accessed during this search.
"""

import copy
import random
import sys
import time
from pathlib import Path
from typing import Dict, Any, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms
from torchvision.models import (
    MobileNet_V3_Small_Weights,
    MobileNet_V3_Large_Weights,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed) if torch.cuda.is_available() else None


# ---------------------------------------------------------------------------
# Augmentation Variations
# ---------------------------------------------------------------------------

def get_transforms_baseline(image_size: int = 224):
    """Original flawed transforms: random horizontal flip + center crop."""
    train_t = transforms.Compose([
        transforms.Resize((int(image_size * 1.15), int(image_size * 1.15))),
        transforms.RandomCrop(image_size),
        transforms.RandomHorizontalFlip(p=0.3),  # Flips text!
        transforms.RandomRotation(degrees=10),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    eval_t = transforms.Compose([
        transforms.Resize((int(image_size * 1.15), int(image_size * 1.15))),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    return train_t, eval_t


def get_transforms_packaging_v1(image_size: int = 224):
    """
    Packaging-aware transforms:
    - NO horizontal flip (preserves text orientation)
    - Direct resize without edge crop (preserves border text and dosage)
    - Mild rotation and color jitter
    """
    train_t = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomRotation(degrees=(-7, 7)),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    eval_t = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    return train_t, eval_t


def get_transforms_packaging_v2(image_size: int = 224):
    """
    Packaging-aware transforms with perspective and slight scaling:
    - NO horizontal flip
    - Mild random perspective (camera angle variation)
    - Mild affine scale (0.92 to 1.05)
    - Mild rotation (-8 to 8)
    - Color jitter
    """
    train_t = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomPerspective(distortion_scale=0.12, p=0.4),
        transforms.RandomAffine(degrees=(-8, 8), scale=(0.92, 1.05), shear=(-4, 4)),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1, hue=0.02),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    eval_t = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    return train_t, eval_t


# ---------------------------------------------------------------------------
# Model Builders
# ---------------------------------------------------------------------------

def build_model(arch: str, head_type: str, num_classes: int = 10) -> nn.Module:
    if arch == "mobilenet_v3_small":
        model = models.mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        if head_type == "mlp_128":  # Baseline structure
            model.classifier[3] = nn.Sequential(
                nn.Linear(in_features, 128),
                nn.Hardswish(),
                nn.Dropout(p=0.2),
                nn.Linear(128, num_classes)
            )
        elif head_type == "mlp_256":
            model.classifier[3] = nn.Sequential(
                nn.Linear(in_features, 256),
                nn.Hardswish(),
                nn.Dropout(p=0.2),
                nn.Linear(256, num_classes)
            )
        elif head_type == "linear":
            model.classifier[3] = nn.Linear(in_features, num_classes)
        else:
            raise ValueError(f"Unknown head_type: {head_type}")
    elif arch == "mobilenet_v3_large":
        model = models.mobilenet_v3_large(weights=MobileNet_V3_Large_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        if head_type == "mlp_128":
            model.classifier[3] = nn.Sequential(
                nn.Linear(in_features, 128),
                nn.Hardswish(),
                nn.Dropout(p=0.2),
                nn.Linear(128, num_classes)
            )
        elif head_type == "mlp_256":
            model.classifier[3] = nn.Sequential(
                nn.Linear(in_features, 256),
                nn.Hardswish(),
                nn.Dropout(p=0.2),
                nn.Linear(256, num_classes)
            )
        elif head_type == "linear":
            model.classifier[3] = nn.Linear(in_features, num_classes)
        else:
            raise ValueError(f"Unknown head_type: {head_type}")
    else:
        raise ValueError(f"Unknown arch: {arch}")

    return model


# ---------------------------------------------------------------------------
# Training Pipeline
# ---------------------------------------------------------------------------

def train_and_eval(
    train_dataset,
    val_dataset,
    arch: str,
    head_type: str,
    unfreeze_strategy: str,  # "layers_7_plus", "full_discriminative", "full_uniform"
    label_smoothing: float = 0.05,
    warmup_epochs: int = 5,
    finetune_epochs: int = 25,
    batch_size: int = 8,
    lr_head: float = 5e-4,
    lr_backbone: float = 6e-5,
    weight_decay: float = 1e-2,
    seed: int = 42,
) -> Dict[str, Any]:
    set_seed(seed)
    device = torch.device("cpu")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    model = build_model(arch, head_type, num_classes=10).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=label_smoothing)

    # Phase 1: Warmup
    for p in model.features.parameters():
        p.requires_grad = False
    for p in model.classifier.parameters():
        p.requires_grad = True

    opt_warmup = torch.optim.AdamW(model.classifier.parameters(), lr=lr_head, weight_decay=weight_decay)

    for ep in range(warmup_epochs):
        model.train()
        for imgs, lbls in train_loader:
            opt_warmup.zero_grad()
            out = model(imgs)
            loss = criterion(out, lbls)
            loss.backward()
            opt_warmup.step()

    # Phase 2: Fine-tuning
    if unfreeze_strategy == "layers_7_plus":
        for idx, layer in enumerate(model.features):
            for p in layer.parameters():
                p.requires_grad = (idx >= 7)
        params = [
            {"params": [p for p in model.features[7:].parameters() if p.requires_grad], "lr": lr_backbone},
            {"params": model.classifier.parameters(), "lr": lr_head},
        ]
    elif unfreeze_strategy == "full_discriminative":
        for p in model.features.parameters():
            p.requires_grad = True
        # Earlier layers get smaller lr, later layers get moderate lr, head gets full lr
        n_layers = len(model.features)
        split_point = n_layers // 2
        early_params = [p for i in range(split_point) for p in model.features[i].parameters()]
        late_params = [p for i in range(split_point, n_layers) for p in model.features[i].parameters()]
        params = [
            {"params": early_params, "lr": lr_backbone * 0.3},
            {"params": late_params, "lr": lr_backbone},
            {"params": model.classifier.parameters(), "lr": lr_head},
        ]
    elif unfreeze_strategy == "full_uniform":
        for p in model.features.parameters():
            p.requires_grad = True
        params = [
            {"params": model.features.parameters(), "lr": lr_backbone},
            {"params": model.classifier.parameters(), "lr": lr_head},
        ]
    else:
        raise ValueError(f"Unknown unfreeze_strategy: {unfreeze_strategy}")

    opt_ft = torch.optim.AdamW(params, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(opt_ft, T_max=finetune_epochs, eta_min=1e-6)

    best_val_acc = 0.0
    best_val_loss = float("inf")
    best_val_top3 = 0.0
    best_state = None
    best_epoch = 0

    for ep in range(1, finetune_epochs + 1):
        model.train()
        train_loss, train_correct, n_train = 0.0, 0, 0
        for imgs, lbls in train_loader:
            opt_ft.zero_grad()
            out = model(imgs)
            loss = criterion(out, lbls)
            loss.backward()
            opt_ft.step()
            train_loss += loss.item() * imgs.size(0)
            train_correct += (out.argmax(dim=1) == lbls).sum().item()
            n_train += imgs.size(0)

        scheduler.step()

        # Validation
        model.eval()
        val_loss, val_correct, val_top3_count, n_val = 0.0, 0, 0, 0
        with torch.no_grad():
            for imgs, lbls in val_loader:
                out = model(imgs)
                loss = criterion(out, lbls)
                val_loss += loss.item() * imgs.size(0)
                preds = out.argmax(dim=1)
                val_correct += (preds == lbls).sum().item()
                # top3
                _, top3_idx = out.topk(min(3, out.size(1)), dim=1)
                for i in range(imgs.size(0)):
                    if lbls[i] in top3_idx[i]:
                        val_top3_count += 1
                n_val += imgs.size(0)

        val_acc = val_correct / n_val
        val_loss = val_loss / n_val
        val_top3 = val_top3_count / n_val

        improved = (val_acc > best_val_acc) or (val_acc == best_val_acc and val_loss < best_val_loss)
        if improved:
            best_val_acc = val_acc
            best_val_loss = val_loss
            best_val_top3 = val_top3
            best_epoch = ep
            best_state = copy.deepcopy(model.state_dict())

    return {
        "best_val_acc": best_val_acc,
        "best_val_top3": best_val_top3,
        "best_val_loss": round(best_val_loss, 4),
        "best_epoch": best_epoch,
        "final_train_acc": train_correct / n_train,
    }


def run_all_experiments():
    train_dir = PROJECT_ROOT / "ml" / "datasets" / "train"
    val_dir = PROJECT_ROOT / "ml" / "datasets" / "val"

    configs = [
        # 1. Baseline reproduced
        {
            "name": "Exp 1: Baseline (Flip + Crop + Head 128 + Layers 7+)",
            "arch": "mobilenet_v3_small",
            "head": "mlp_128",
            "transforms": "baseline",
            "unfreeze": "layers_7_plus",
            "smoothing": 0.0,
            "lr_head": 5e-4,
            "lr_backbone": 8e-5,
            "epochs": 20,
        },
        # 2. Fix augmentations only (no flip, no crop)
        {
            "name": "Exp 2: Packaging Aug V1 (No Flip, Full Res) + Head 128",
            "arch": "mobilenet_v3_small",
            "head": "mlp_128",
            "transforms": "packaging_v1",
            "unfreeze": "layers_7_plus",
            "smoothing": 0.05,
            "lr_head": 5e-4,
            "lr_backbone": 8e-5,
            "epochs": 25,
        },
        # 3. Packaging Aug V2 (Affine + Perspective) + Full Discriminative
        {
            "name": "Exp 3: Packaging Aug V2 + Discriminative Fine-Tuning (Small)",
            "arch": "mobilenet_v3_small",
            "head": "mlp_128",
            "transforms": "packaging_v2",
            "unfreeze": "full_discriminative",
            "smoothing": 0.05,
            "lr_head": 4e-4,
            "lr_backbone": 5e-5,
            "epochs": 30,
        },
        # 4. Packaging Aug V2 + Head 256 + Discriminative Fine-Tuning
        {
            "name": "Exp 4: Packaging Aug V2 + Head 256 + Discriminative (Small)",
            "arch": "mobilenet_v3_small",
            "head": "mlp_256",
            "transforms": "packaging_v2",
            "unfreeze": "full_discriminative",
            "smoothing": 0.05,
            "lr_head": 4e-4,
            "lr_backbone": 5e-5,
            "epochs": 30,
        },
        # 5. MobileNetV3-Large + Packaging Aug V2 + Head 128
        {
            "name": "Exp 5: MobileNetV3-Large + Head 128 + Discriminative",
            "arch": "mobilenet_v3_large",
            "head": "mlp_128",
            "transforms": "packaging_v2",
            "unfreeze": "full_discriminative",
            "smoothing": 0.05,
            "lr_head": 4e-4,
            "lr_backbone": 4e-5,
            "epochs": 30,
        },
        # 6. MobileNetV3-Large + Packaging Aug V2 + Head 256
        {
            "name": "Exp 6: MobileNetV3-Large + Head 256 + Discriminative",
            "arch": "mobilenet_v3_large",
            "head": "mlp_256",
            "transforms": "packaging_v2",
            "unfreeze": "full_discriminative",
            "smoothing": 0.05,
            "lr_head": 4e-4,
            "lr_backbone": 4e-5,
            "epochs": 30,
        },
    ]

    print("=" * 75)
    print("MEDISHELF AI — SYSTEMATIC CV EXPERIMENTATION (VALIDATION SPLIT ONLY)")
    print("=" * 75)

    results = []
    for cfg in configs:
        t0 = time.time()
        print(f"\nRunning {cfg['name']}...")
        if cfg["transforms"] == "baseline":
            t_train, t_eval = get_transforms_baseline()
        elif cfg["transforms"] == "packaging_v1":
            t_train, t_eval = get_transforms_packaging_v1()
        else:
            t_train, t_eval = get_transforms_packaging_v2()

        ds_train = datasets.ImageFolder(train_dir, transform=t_train)
        ds_val = datasets.ImageFolder(val_dir, transform=t_eval)

        res = train_and_eval(
            train_dataset=ds_train,
            val_dataset=ds_val,
            arch=cfg["arch"],
            head_type=cfg["head"],
            unfreeze_strategy=cfg["unfreeze"],
            label_smoothing=cfg["smoothing"],
            finetune_epochs=cfg["epochs"],
            lr_head=cfg["lr_head"],
            lr_backbone=cfg["lr_backbone"],
        )
        elapsed = time.time() - t0
        res["name"] = cfg["name"]
        res["elapsed_s"] = round(elapsed, 1)
        results.append(res)
        print(f"  -> Best Val Top-1: {res['best_val_acc']*100:.2f}% | Top-3: {res['best_val_top3']*100:.2f}% | "
              f"Loss: {res['best_val_loss']} (epoch {res['best_epoch']}) in {elapsed:.1f}s")

    print("\n" + "=" * 75)
    print("EXPERIMENT SUMMARY (VALIDATION SPLIT)")
    print("=" * 75)
    for r in results:
        print(f"{r['name']:<60} | Val Top-1: {r['best_val_acc']*100:>5.1f}% | Top-3: {r['best_val_top3']*100:>5.1f}%")


if __name__ == "__main__":
    run_all_experiments()
