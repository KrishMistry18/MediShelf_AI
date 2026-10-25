import json

with open("ml/datasets/dataset_manifest.json", "r", encoding="utf-8") as f:
    manifest = json.load(f)

keywords = ["ifu", "insert", "guide", "diagram", "manual", "figure", "chart", "table", "step"]
ifus = [r for r in manifest if any(k in r.get("source_url", "").lower() for k in keywords)]

print(f"Total potential IFU/diagram images: {len(ifus)} out of {len(manifest)}")
for r in ifus:
    print(f"  {r['class_name']:<30} {r['file_name']} (split: {r['split']}) -> {r['source_url']}")
