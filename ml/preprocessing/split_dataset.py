import os
import shutil
import random
from pathlib import Path
from typing import Dict, List

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = PROJECT_ROOT / "ml" / "datasets" / "raw"
DATASETS_DIR = PROJECT_ROOT / "ml" / "datasets"


def split_dataset(seed: int = 42, train_ratio: float = 0.70, val_ratio: float = 0.15):
    random.seed(seed)
    train_dir = DATASETS_DIR / "train"
    val_dir = DATASETS_DIR / "val"
    test_dir = DATASETS_DIR / "test"

    # Reset split directories if already populated
    for split_path in [train_dir, val_dir, test_dir]:
        if split_path.exists():
            shutil.rmtree(split_path)
        split_path.mkdir(parents=True, exist_ok=True)

    class_dirs = [d for d in RAW_DIR.iterdir() if d.is_dir()]
    split_summary = {"train": 0, "val": 0, "test": 0, "by_class": {}}

    print("=" * 65)
    print("      MEDISHELF AI — DATA LEAKAGE-FREE DATASET PARTITIONER")
    print("=" * 65)
    print(f"Random Seed:        {seed}")
    print(f"Target Proportions: {int(train_ratio*100)}% Train / {int(val_ratio*100)}% Val / {int((1-train_ratio-val_ratio)*100)}% Test")
    print("-" * 65)

    for cdir in sorted(class_dirs, key=lambda d: d.name):
        class_name = cdir.name
        img_files = sorted(list(cdir.glob("*.jpg")) + list(cdir.glob("*.png")))
        
        # Shuffle deterministically
        random.shuffle(img_files)
        total = len(img_files)

        n_train = max(1, int(round(total * train_ratio)))
        n_val = max(1, int(round(total * val_ratio)))
        # Remaining goes to test set to ensure 100% assignment
        train_files = img_files[:n_train]
        val_files = img_files[n_train:n_train + n_val]
        test_files = img_files[n_train + n_val:]

        if not test_files and len(val_files) > 1:
            test_files.append(val_files.pop())

        for split_name, files, target_parent in [
            ("train", train_files, train_dir),
            ("val", val_files, val_dir),
            ("test", test_files, test_dir),
        ]:
            target_class_dir = target_parent / class_name
            target_class_dir.mkdir(parents=True, exist_ok=True)
            for f in files:
                shutil.copy2(f, target_class_dir / f.name)
            split_summary[split_name] += len(files)

        split_summary["by_class"][class_name] = {
            "train": len(train_files),
            "val": len(val_files),
            "test": len(test_files),
        }
        print(f"  [+] {class_name:<30} -> {len(train_files)} Train, {len(val_files)} Val, {len(test_files)} Test")

    total_all = split_summary['train'] + split_summary['val'] + split_summary['test']
    print(f"TOTALS: {split_summary['train']} Train | {split_summary['val']} Val | {split_summary['test']} Test ({total_all} Total)")
    print("[OK] Dataset partitioning complete! Test set isolated.")
    print("=" * 65)
    return split_summary


if __name__ == "__main__":
    split_dataset()
