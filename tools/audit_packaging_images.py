import json
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "ml" / "datasets" / "raw"

# Check each class in raw
results = {}
for class_dir in sorted(RAW_DIR.iterdir()):
    if not class_dir.is_dir():
        continue
    cname = class_dir.name
    files = sorted(class_dir.glob("*.jpg"))
    results[cname] = len(files)
    print(f"{cname:<30}: {len(files)} raw images")

print(f"Total raw images: {sum(results.values())}")
