"""
Dry-run test to see how many authentic images can be downloaded from DailyMed for each class
with strict dosage-form filters and max 2 images per SPL.
"""
import io
import json
import logging
import time
import urllib.parse
import urllib.request
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("test_harvest")

USER_AGENT = "MediShelfAI/1.0 (academic research; cv-packaging-dataset; contact@medishelf.edu)"

TARGET_CLASSES = {
    "paracetamol_500mg_tablet": {
        "drug_query": "acetaminophen",
        "title_includes": ["acetaminophen", "paracetamol"],
        "form_includes": ["tablet", "caplet"],
        "excludes": ["liquid", "suspension", "solution", "drops", "infant", "children", "suppository", "syrup", "tramadol", "hydrocodone", "oxycodone", "codeine"],
        "max_spls": 100,
    },
    "amoxicillin_500mg_capsule": {
        "drug_query": "amoxicillin",
        "title_includes": ["amoxicillin"],
        "form_includes": ["capsule"],
        "excludes": ["suspension", "powder for", "liquid", "injection", "tablet", "chewable"],
        "max_spls": 100,
    },
    "ibuprofen_400mg_tablet": {
        "drug_query": "ibuprofen",
        "title_includes": ["ibuprofen", "advil", "motrin"],
        "form_includes": ["tablet", "caplet", "ib"],
        "excludes": ["suspension", "infant", "drops", "liquid", "injection", "topical", "gel"],
        "max_spls": 100,
    },
    "metformin_500mg_tablet": {
        "drug_query": "metformin",
        "title_includes": ["metformin"],
        "form_includes": ["tablet"],
        "excludes": ["solution", "liquid", "oral solution"],
        "max_spls": 100,
    },
    "atorvastatin_20mg_tablet": {
        "drug_query": "atorvastatin",
        "title_includes": ["atorvastatin"],
        "form_includes": ["tablet"],
        "excludes": ["liquid", "suspension"],
        "max_spls": 100,
    },
    "omeprazole_20mg_capsule": {
        "drug_query": "omeprazole",
        "title_includes": ["omeprazole"],
        "form_includes": ["capsule", "delayed-release"],
        "excludes": ["injection", "powder for suspension", "suspension", "packet"],
        "max_spls": 100,
    },
    "ciprofloxacin_500mg_tablet": {
        "drug_query": "ciprofloxacin",
        "title_includes": ["ciprofloxacin"],
        "form_includes": ["tablet"],
        "excludes": ["ophthalmic", "otic", "injection", "suspension"],
        "max_spls": 100,
    },
    "cetirizine_10mg_tablet": {
        "drug_query": "cetirizine",
        "title_includes": ["cetirizine"],
        "form_includes": ["tablet"],
        "excludes": ["syrup", "solution", "drops", "liquid", "chewable", "gel"],
        "max_spls": 100,
    },
    "losartan_50mg_tablet": {
        "drug_query": "losartan",
        "title_includes": ["losartan"],
        "form_includes": ["tablet"],
        "excludes": ["liquid", "solution"],
        "max_spls": 100,
    },
    "humulin_r_100u_vial": {
        "drug_query": "insulin human",
        "title_includes": ["insulin", "humulin", "novolin"],
        "form_includes": ["vial", "injection", "solution"],
        "excludes": ["inhalation", "powder", "cartridge", "isophane", "70/30", "mix"],
        "max_spls": 50,
    },
}

def test_harvest_counts(target_per_class=35):
    results = {}
    for c_name, cfg in TARGET_CLASSES.items():
        drug_query = cfg["drug_query"]
        encoded_query = urllib.parse.quote(drug_query)
        max_spls = cfg.get("max_spls", 100)
        spl_url = f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name={encoded_query}&pagesize={max_spls}"
        req = urllib.request.Request(spl_url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                spl_data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.warning("Error fetching SPLs for %s: %s", c_name, e)
            results[c_name] = 0
            continue
            
        spl_list = spl_data.get("data", [])
        found_images = 0
        spls_used = 0
        for spl in spl_list:
            if found_images >= target_per_class:
                break
            title_lower = spl.get("title", "").lower()
            if not any(term in title_lower for term in cfg["title_includes"]):
                continue
            if not any(form in title_lower for form in cfg["form_includes"]):
                continue
            if any(exc in title_lower for exc in cfg["excludes"]):
                continue
            setid = spl.get("setid")
            media_url = f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setid}/media.json"
            try:
                m_req = urllib.request.Request(media_url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(m_req, timeout=8) as m_resp:
                    media_resp = json.loads(m_resp.read().decode("utf-8"))
            except Exception:
                continue
                
            media_items = media_resp.get("data", {}).get("media", [])
            spl_has_img = False
            for item in media_items:
                mime = item.get("mime_type", "").lower()
                name = item.get("name", "").lower()
                if "image" in mime or name.endswith((".jpg", ".jpeg", ".png")):
                    found_images += 1
                    spl_has_img = True
                    if found_images >= target_per_class:
                        break
            if spl_has_img:
                spls_used += 1
        logger.info("%-30s: %d images from %d SPLs", c_name, found_images, spls_used)
        results[c_name] = (found_images, spls_used)
    print("\nSummary:")
    for k, v in results.items():
        print(f"  {k:<30}: {v[0]} potential images across {v[1]} SPLs")

if __name__ == "__main__":
    test_harvest_counts(target_per_class=35)
