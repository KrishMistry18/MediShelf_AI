import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from PIL import Image

TARGET_CLASSES: Dict[str, Dict[str, str]] = {
    "paracetamol_500mg_tablet": {"drug_name": "acetaminophen", "filter_keyword": "tablet"},
    "amoxicillin_500mg_capsule": {"drug_name": "amoxicillin", "filter_keyword": "capsule"},
    "ibuprofen_400mg_tablet": {"drug_name": "ibuprofen", "filter_keyword": "tablet"},
    "metformin_500mg_tablet": {"drug_name": "metformin", "filter_keyword": "tablet"},
    "atorvastatin_20mg_tablet": {"drug_name": "atorvastatin", "filter_keyword": "tablet"},
    "omeprazole_20mg_capsule": {"drug_name": "omeprazole", "filter_keyword": "capsule"},
    "ciprofloxacin_500mg_tablet": {"drug_name": "ciprofloxacin", "filter_keyword": "tablet"},
    "cetirizine_10mg_tablet": {"drug_name": "cetirizine", "filter_keyword": "tablet"},
    "losartan_50mg_tablet": {"drug_name": "losartan", "filter_keyword": "tablet"},
    "humulin_r_100u_vial": {"drug_name": "insulin human", "filter_keyword": "injection"},
}

USER_AGENT = "MediShelfAI/1.0 (academic research; contact@medishelf.edu)"
BASE_RAW_DIR = Path(__file__).resolve().parent / "raw"


def fetch_spls_for_drug(drug_name: str, max_spls: int = 15) -> List[Dict]:
    url = f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name={urllib.parse.quote(drug_name)}&pagesize={max_spls}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
            return data.get("data", [])
    except Exception as e:
        print(f"  [!] Failed fetching SPLs for {drug_name}: {e}")
        return []


def fetch_media_for_spl(setid: str) -> List[Dict]:
    url = f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setid}/media.json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            return data.get("data", {}).get("media", [])
    except Exception:
        return []


def download_image(img_url: str) -> Tuple[bool, Optional[Image.Image], Optional[bytes]]:
    req = urllib.request.Request(img_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw_bytes = resp.read()
            im = Image.open(io.BytesIO(raw_bytes))
            im.verify()  # verify image integrity
            # Reopen for actual conversion
            im = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
            if im.width >= 100 and im.height >= 100:
                return True, im, raw_bytes
    except Exception:
        pass
    return False, None, None


def populate_dataset(images_per_class: int = 12):
    BASE_RAW_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []

    print("=" * 65)
    print("   MEDISHELF AI — AUTHENTIC DAILYMED SPL IMAGE HARVESTER")
    print("=" * 65)

    for image_class, query_info in TARGET_CLASSES.items():
        drug_name = query_info["drug_name"]
        class_dir = BASE_RAW_DIR / image_class
        class_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n[*] Harvesting class '{image_class}' (Drug: {drug_name})...")
        spls = fetch_spls_for_drug(drug_name)
        saved_count = len(list(class_dir.glob("*.jpg")))
        print(f"    Found {len(spls)} SPL submissions. Current saved: {saved_count}")

        for spl in spls:
            if saved_count >= images_per_class:
                break

            setid = spl.get("setid")
            title = spl.get("title", "")
            media_items = fetch_media_for_spl(setid)

            for item in media_items:
                if saved_count >= images_per_class:
                    break

                img_url = item.get("url")
                name = item.get("name", "pkg.jpg")
                mime = item.get("mime_type", "")

                # Skip non-images
                if "image" not in mime.lower() and not name.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue

                success, im, _ = download_image(img_url)
                if success and im:
                    saved_count += 1
                    file_name = f"pkg_{saved_count:03d}.jpg"
                    file_path = class_dir / file_name
                    im.save(file_path, "JPEG", quality=90)
                    manifest.append({
                        "image_class": image_class,
                        "file_name": file_name,
                        "file_path": str(file_path),
                        "setid": setid,
                        "spl_title": title,
                        "source_url": img_url,
                        "dimensions": [im.width, im.height]
                    })
                    print(f"    [+] Saved {file_name} ({im.width}x{im.height}) from SPL: {setid[:12]}...")
                    time.sleep(0.15)  # respectful rate limiting

        print(f"    Total saved for {image_class}: {saved_count} images")

    # Save manifest
    manifest_path = BASE_RAW_DIR.parent / "dataset_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 65)
    print(f"[OK] Harvesting Complete! Manifest saved to: {manifest_path}")
    print("=" * 65)


if __name__ == "__main__":
    populate_dataset(images_per_class=10)
