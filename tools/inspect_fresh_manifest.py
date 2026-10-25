import json
from pathlib import Path

manifest = json.loads(Path('ml/datasets/dataset_manifest.json').read_text(encoding='utf-8'))
fresh = [r for r in manifest if int(r['file_name'].replace('pkg_', '').replace('.jpg', '')) > 20]
print(f"Total fresh images: {len(fresh)}")
for r in fresh[:30]:
    c = r['class_name']
    fn = r['file_name']
    dim = r['dimensions']
    t = r['spl_title'][:50]
    print(f"{c:<28} | {fn} | {dim} | {t}")
