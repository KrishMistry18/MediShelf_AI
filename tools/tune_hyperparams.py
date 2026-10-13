"""
MediShelf AI — Hyperparameter & Seed Search on Validation Split
Tests learning rates, seeds, and head types to find the optimal configuration.
Held-out test set is NEVER touched.
"""

import sys
from pathlib import Path
from torchvision import datasets

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from tools.experiment_cv import (
    get_transforms_packaging_v1,
    train_and_eval,
)

train_dir = PROJECT_ROOT / "ml" / "datasets" / "train"
val_dir = PROJECT_ROOT / "ml" / "datasets" / "val"

t_train, t_eval = get_transforms_packaging_v1()
ds_train = datasets.ImageFolder(train_dir, transform=t_train)
ds_val = datasets.ImageFolder(val_dir, transform=t_eval)

print("=" * 65)
print("SEED & HYPERPARAMETER EXPLORATION ON VALIDATION SET")
print("=" * 65)

configs = [
    {"seed": 42, "lr_head": 5e-4, "lr_backbone": 8e-5, "epochs": 25, "head": "mlp_128"},
    {"seed": 101, "lr_head": 5e-4, "lr_backbone": 8e-5, "epochs": 25, "head": "mlp_128"},
    {"seed": 2024, "lr_head": 5e-4, "lr_backbone": 8e-5, "epochs": 25, "head": "mlp_128"},
    {"seed": 777, "lr_head": 5e-4, "lr_backbone": 8e-5, "epochs": 25, "head": "mlp_128"},
    {"seed": 42, "lr_head": 4e-4, "lr_backbone": 6e-5, "epochs": 30, "head": "mlp_128"},
    {"seed": 101, "lr_head": 4e-4, "lr_backbone": 6e-5, "epochs": 30, "head": "mlp_128"},
]

for cfg in configs:
    res = train_and_eval(
        train_dataset=ds_train,
        val_dataset=ds_val,
        arch="mobilenet_v3_small",
        head_type=cfg["head"],
        unfreeze_strategy="layers_7_plus",
        label_smoothing=0.05,
        finetune_epochs=cfg["epochs"],
        lr_head=cfg["lr_head"],
        lr_backbone=cfg["lr_backbone"],
        seed=cfg["seed"],
    )
    val_top1 = res["best_val_acc"] * 100
    val_top3 = res["best_val_top3"] * 100
    print(f"Seed {cfg['seed']:4d} | LR {cfg['lr_head']:.0e}/{cfg['lr_backbone']:.0e} | Epochs {cfg['epochs']:2d} -> "
          f"Val Top-1: {val_top1:5.1f}% | Top-3: {val_top3:5.1f}% | Loss: {res['best_val_loss']:.4f} (ep {res['best_epoch']:2d})")
