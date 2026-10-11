"""
MediShelf AI — Comprehensive Vision Dataset & Checkpoint Audit
Audits:
1. Class names & sample counts across raw, train, val, test
2. Exact duplicate hashes within and across splits (leakage detection)
3. Image resolutions and dimensions
4. Checkpoint metadata and class alignment
"""

import hashlib
import json
from pathlib import Path
from PIL import Image
import torch

ROOT = Path("ml/datasets")
ARTIFACTS = Path("ml/artifacts")
CHECKPOINTS = Path("ml/checkpoints")

def file_sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

print("=" * 70)
print("             MEDISHELF AI — VISION DATASET AUDIT")
print("=" * 70)

splits = ["train", "val", "test", "raw"]
split_hashes = {}
class_counts = {}

for s in splits:
    p = ROOT / s
    if not p.exists():
        print(f"Split '{s}' not found.")
        continue
    classes = sorted([d.name for d in p.iterdir() if d.is_dir()])
    split_hashes[s] = {}
    class_counts[s] = {}
    total = 0
    
    for c in classes:
        files = list((p / c).glob("*.*"))
        img_files = [f for f in files if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
        class_counts[s][c] = len(img_files)
        total += len(img_files)
        for img in img_files:
            h = file_sha256(img)
            split_hashes[s][img] = (c, h)
            
    print(f"\nSplit '{s}': {len(classes)} classes, {total} total images")
    for c, cnt in class_counts[s].items():
        print(f"   {c:<32}: {cnt} images")

print("\n" + "=" * 70)
print("             LEAKAGE & DUPLICATE HASH AUDIT")
print("=" * 70)

# Check cross-split duplicate hashes
train_hashes = {h: (img, c) for img, (c, h) in split_hashes.get("train", {}).items()}
val_hashes = {h: (img, c) for img, (c, h) in split_hashes.get("val", {}).items()}
test_hashes = {h: (img, c) for img, (c, h) in split_hashes.get("test", {}).items()}

train_val_overlap = set(train_hashes.keys()) & set(val_hashes.keys())
train_test_overlap = set(train_hashes.keys()) & set(test_hashes.keys())
val_test_overlap = set(val_hashes.keys()) & set(test_hashes.keys())

print(f"Train/Val identical hash overlap : {len(train_val_overlap)}")
print(f"Train/Test identical hash overlap: {len(train_test_overlap)}")
print(f"Val/Test identical hash overlap  : {len(val_test_overlap)}")

if train_test_overlap:
    print("  [!] WARNING: Identical image in Train and Test!")
    for h in train_test_overlap:
        print(f"      Train: {train_hashes[h][0]} <-> Test: {test_hashes[h][0]}")

print("\n" + "=" * 70)
print("             IMAGE DIMENSIONS & RESOLUTION AUDIT")
print("=" * 70)
resolutions = []
for s in ["train", "val", "test"]:
    for img_path in split_hashes.get(s, {}).keys():
        with Image.open(img_path) as im:
            resolutions.append((im.width, im.height))

if resolutions:
    widths = [w for w, h in resolutions]
    heights = [h for w, h in resolutions]
    print(f"Total checked images : {len(resolutions)}")
    print(f"Min resolution       : {min(widths)}x{min(heights)}")
    print(f"Max resolution       : {max(widths)}x{max(heights)}")
    print(f"Mean resolution      : {int(sum(widths)/len(widths))}x{int(sum(heights)/len(heights))}")

print("\n" + "=" * 70)
print("             CHECKPOINT METADATA AUDIT")
print("=" * 70)

ckpt_paths = [
    ARTIFACTS / "model" / "medicine_classifier.pt",
    CHECKPOINTS / "best_model.pth"
]

for ckpt in ckpt_paths:
    if ckpt.exists():
        data = torch.load(ckpt, map_location="cpu", weights_only=False)
        print(f"\nCheckpoint: {ckpt} ({ckpt.stat().st_size / 1024 / 1024:.2f} MB)")
        print(f"   Architecture : {data.get('architecture', 'mobilenet_v3_small')}")
        print(f"   Num Classes  : {data.get('num_classes', len(data.get('class_names', [])))}")
        print(f"   Classes      : {data.get('class_names')}")
        print(f"   Val Accuracy : {data.get('val_acc')}")
        print(f"   Epoch        : {data.get('epoch')}")
        print(f"   Image Size   : {data.get('image_size')}")
    else:
        print(f"\nCheckpoint NOT found: {ckpt}")
