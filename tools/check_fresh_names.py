import json

with open("ml/datasets/dataset_manifest.json") as f:
    m = json.load(f)

for r in m:
    fn = r["file_name"]
    num = int(fn.replace("pkg_", "").replace(".jpg", ""))
    if num > 20:
        url = r.get("source_url", "")
        name = url.split("&name=")[-1] if "&name=" in url else url.split("/")[-1]
        print(f"{r['class_name'][:20]:<20} {fn} ({r['split']}): {name}")
