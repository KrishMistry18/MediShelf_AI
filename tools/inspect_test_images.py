import json
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEST_DIR = PROJECT_ROOT / "ml" / "datasets" / "test"

with open(PROJECT_ROOT / "ml" / "datasets" / "dataset_manifest.json") as f:
    manifest = json.load(f)

manifest_by_relpath = {}
for r in manifest:
    # Match by class and filename
    manifest_by_relpath[(r["class_name"], r["file_name"])] = r

print(f"{'Class':<28} {'File':<12} {'Size':<12} {'Source / Title'}")
print("-" * 80)
for class_dir in sorted(TEST_DIR.iterdir()):
    if not class_dir.is_dir(): continue
    for img_path in sorted(class_dir.glob("*.jpg")):
        im = Image.open(img_path)
        meta = manifest_by_relpath.get((class_dir.name, img_path.name), {})
        title = meta.get("spl_title", "")
        url = meta.get("source_url", "")
        desc = url.split("&name=")[-1] if "&name=" in url else url.split("/")[-1]
        print(f"{class_dir.name:<28} {img_path.name:<12} {im.size[0]}x{im.size[1]:<6} {desc[:35]}")
