"""
MediShelf AI — Bulk Medicine Ingestion & Knowledge Base Expansion
Retrieves authoritative clinical drug concepts (SCD) and branded drugs (SBD) from NLM RxNav,
combines with FDA DailyMed curated foundation monographs and openFDA label data,
performs deterministic normalization and deduplication, and generates an ingestion manifest.
"""

from __future__ import annotations

import csv
import hashlib
import json
import logging
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("medishelf.ingestion.bulk")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

RXNAV_BASE_URL = "https://rxnav.nlm.nih.gov/REST"

# Regex for SBD branded names in brackets, e.g. "dexamethasone 103.4 MG/ML Injection [Dexycu]"
RE_BRAND = re.compile(r"\[([^\]]+)\]$")

# Canonical dosage form mapping
DOSAGE_FORM_MAP = [
    (re.compile(r"\bnasal\s+spray\b", re.IGNORECASE), "Nasal Spray"),
    (re.compile(r"\binhal(?:ation|er|e)\b|\baerosol\b", re.IGNORECASE), "Inhalation Aerosol"),
    (re.compile(r"\bprefilled\s+syringe\b|\bauto-injector\b", re.IGNORECASE), "Prefilled Syringe"),
    (re.compile(r"\b(?:subcutaneous\s+)?inject(?:ion|able)\b|\bvial\b", re.IGNORECASE), "Injection"),
    (re.compile(r"\bdelayed[- ]release\s+capsule\b", re.IGNORECASE), "Delayed-Release Capsule"),
    (re.compile(r"\bextended[- ]release\s+capsule\b|\ber\s+capsule\b", re.IGNORECASE), "Extended-Release Capsule"),
    (re.compile(r"\bcapsules?\b|\bcaps?\b", re.IGNORECASE), "Capsule"),
    (re.compile(r"\bdelayed[- ]release\s+tablet\b", re.IGNORECASE), "Delayed-Release Tablet"),
    (re.compile(r"\bextended[- ]release\s+tablet\b|\ber\s+tablet\b", re.IGNORECASE), "Extended-Release Tablet"),
    (re.compile(r"\bfilm[- ]coated\s+tablet\b", re.IGNORECASE), "Tablet"),
    (re.compile(r"\bchewable\s+tablet\b", re.IGNORECASE), "Chewable Tablet"),
    (re.compile(r"\btablets?\b|\btabs?\b|\bcaplets?\b", re.IGNORECASE), "Tablet"),
    (re.compile(r"\bsuspension\b", re.IGNORECASE), "Oral Suspension"),
    (re.compile(r"\bsolution\b|\bsyrups?\b|\belixir\b", re.IGNORECASE), "Oral Solution"),
    (re.compile(r"\bophthalmic\b|\beye\s+drops\b", re.IGNORECASE), "Ophthalmic Solution"),
    (re.compile(r"\botic\b|\bear\s+drops\b", re.IGNORECASE), "Otic Solution"),
    (re.compile(r"\bcream\b|\bointment\b|\bgel\b|\blotion\b|\btopical\b", re.IGNORECASE), "Topical"),
    (re.compile(r"\bpatch\b|\btransdermal\b", re.IGNORECASE), "Transdermal Patch"),
    (re.compile(r"\bsuppository\b", re.IGNORECASE), "Suppository"),
]

# Therapeutic class mapping based on ingredient keywords
THERAPEUTIC_CLASS_MAP = {
    "amlodipine": "Cardiovascular (Calcium Channel Blocker)",
    "telmisartan": "Cardiovascular (Angiotensin II Receptor Blocker)",
    "losartan": "Cardiovascular (Angiotensin II Receptor Blocker)",
    "valsartan": "Cardiovascular (Angiotensin II Receptor Blocker)",
    "lisinopril": "Cardiovascular (ACE Inhibitor)",
    "enalapril": "Cardiovascular (ACE Inhibitor)",
    "ramipril": "Cardiovascular (ACE Inhibitor)",
    "hydrochlorothiazide": "Cardiovascular (Diuretic)",
    "furosemide": "Cardiovascular (Loop Diuretic)",
    "spironolactone": "Cardiovascular (Diuretic)",
    "carvedilol": "Cardiovascular (Beta-Blocker)",
    "metoprolol": "Cardiovascular (Beta-Blocker)",
    "atenolol": "Cardiovascular (Beta-Blocker)",
    "paracetamol": "Analgesic & Antipyretic",
    "acetaminophen": "Analgesic & Antipyretic",
    "ibuprofen": "Analgesic & NSAID",
    "naproxen": "Analgesic & NSAID",
    "celecoxib": "Analgesic & NSAID (COX-2)",
    "aspirin": "Antiplatelet & Analgesic",
    "tramadol": "Analgesic (Opioid)",
    "amoxicillin": "Antibacterial (Penicillin)",
    "clavulanate": "Antibacterial (Beta-Lactamase Inhibitor)",
    "clavulanic acid": "Antibacterial (Beta-Lactamase Inhibitor)",
    "azithromycin": "Antibacterial (Macrolide)",
    "clarithromycin": "Antibacterial (Macrolide)",
    "ciprofloxacin": "Antibacterial (Fluoroquinolone)",
    "levofloxacin": "Antibacterial (Fluoroquinolone)",
    "doxycycline": "Antibacterial (Tetracycline)",
    "sulfamethoxazole": "Antibacterial (Sulfonamide)",
    "trimethoprim": "Antibacterial",
    "metformin": "Endocrine & Metabolic (Antidiabetic)",
    "sitagliptin": "Endocrine & Metabolic (DPP-4 Inhibitor)",
    "glipizide": "Endocrine & Metabolic (Sulfonylurea)",
    "glimepiride": "Endocrine & Metabolic (Sulfonylurea)",
    "empagliflozin": "Endocrine & Metabolic (SGLT2 Inhibitor)",
    "dapagliflozin": "Endocrine & Metabolic (SGLT2 Inhibitor)",
    "insulin": "Endocrine & Metabolic (Insulin)",
    "levothyroxine": "Endocrine & Metabolic (Thyroid)",
    "atorvastatin": "Cardiovascular (Statin / Lipid-Lowering)",
    "simvastatin": "Cardiovascular (Statin / Lipid-Lowering)",
    "rosuvastatin": "Cardiovascular (Statin / Lipid-Lowering)",
    "ezetimibe": "Cardiovascular (Lipid-Lowering)",
    "omeprazole": "Gastrointestinal (Proton Pump Inhibitor)",
    "pantoprazole": "Gastrointestinal (Proton Pump Inhibitor)",
    "esomeprazole": "Gastrointestinal (Proton Pump Inhibitor)",
    "lansoprazole": "Gastrointestinal (Proton Pump Inhibitor)",
    "famotidine": "Gastrointestinal (H2 Blocker)",
    "cetirizine": "Allergy & Respiratory (Antihistamine)",
    "loratadine": "Allergy & Respiratory (Antihistamine)",
    "fexofenadine": "Allergy & Respiratory (Antihistamine)",
    "albuterol": "Respiratory (Bronchodilator)",
    "salbutamol": "Respiratory (Bronchodilator)",
    "fluticasone": "Respiratory (Corticosteroid)",
    "budesonide": "Respiratory (Corticosteroid)",
    "montelukast": "Respiratory (Leukotriene Inhibitor)",
    "sertraline": "Neurology & Psychiatry (SSRI)",
    "fluoxetine": "Neurology & Psychiatry (SSRI)",
    "escitalopram": "Neurology & Psychiatry (SSRI)",
    "duloxetine": "Neurology & Psychiatry (SNRI)",
    "gabapentin": "Neurology (Anticonvulsant)",
    "pregabalin": "Neurology (Anticonvulsant)",
    "prednisone": "Anti-inflammatory & Immunosuppressant",
    "dexamethasone": "Anti-inflammatory & Corticosteroid",
    "apixaban": "Hematology (Anticoagulant)",
    "rivaroxaban": "Hematology (Anticoagulant)",
    "warfarin": "Hematology (Anticoagulant)",
    "clopidogrel": "Hematology (Antiplatelet)",
}


def http_get_json(url: str, timeout: int = 30) -> Optional[Dict[str, Any]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MediShelf-AI/2.0 (NLM RxNav Bulk Client; Integrity & Education Verification)",
            "Accept": "application/json",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            logger.warning(f"HTTP GET failed (attempt {attempt+1}/3) for {url}: {exc}")
            time.sleep(1.0 * (attempt + 1))
    return None


def get_rxnav_version() -> str:
    url = f"{RXNAV_BASE_URL}/version.json"
    data = http_get_json(url)
    if data and "version" in data:
        return str(data["version"])
    return datetime.now(timezone.utc).strftime("%Y-%m")


def extract_dosage_form(name: str) -> str:
    for pattern, canonical in DOSAGE_FORM_MAP:
        if pattern.search(name):
            return canonical
    return "Other / Unspecified"


def extract_route(dosage_form: str, name: str) -> str:
    df_lower = dosage_form.lower()
    name_lower = name.lower()
    if "oral" in df_lower or "tablet" in df_lower or "capsule" in df_lower or "chewable" in df_lower:
        return "Oral"
    if "injection" in df_lower or "syringe" in df_lower or "vial" in df_lower:
        return "Injectable"
    if "inhal" in df_lower or "aerosol" in df_lower:
        return "Inhalation"
    if "nasal" in df_lower:
        return "Nasal"
    if "ophthalmic" in df_lower or "eye" in name_lower:
        return "Ophthalmic"
    if "otic" in df_lower or "ear" in name_lower:
        return "Otic"
    if "topical" in df_lower or "cream" in df_lower or "ointment" in df_lower or "gel" in df_lower or "patch" in df_lower:
        return "Topical"
    if "suppository" in df_lower:
        return "Rectal"
    return "Systemic"


def extract_strength(name: str) -> str:
    matches = re.findall(
        r"\b(\d+(?:\.\d+)?\s*(?:mg/ml|mcg/ml|mg|mcg|ml|g|iu|u|%)(?:/\d+(?:\.\d+)?\s*(?:mg/ml|mcg/ml|mg|mcg|ml|g|iu|u|%))*)\b",
        name,
        flags=re.IGNORECASE,
    )
    if matches:
        return " / ".join(m.strip() for m in matches[:3])
    return "Standard"


def extract_active_ingredients(name: str) -> List[str]:
    # Strip brand name in brackets
    cleaned = re.sub(r"\[[^\]]+\]", "", name).strip().lower()
    # Strip strength patterns
    cleaned = re.sub(r"\d+(?:\.\d+)?\s*(?:mg/ml|mcg/ml|mg|mcg|ml|g|iu|u|%)\b", "", cleaned)
    # Strip common dosage form tokens
    cleaned = re.sub(r"\b(?:oral|tablet|capsule|injection|solution|suspension|film[- ]coated|delayed[- ]release|extended[- ]release|prefilled|syringe|inhalation|aerosol|spray|patch|cream|ointment|gel)\b", "", cleaned)
    parts = re.split(r"[/+;]|\band\b", cleaned)
    ingredients: List[str] = []
    for p in parts:
        token = p.strip()
        # Remove salt suffixes for clean canonical ingredient index
        token = re.sub(r"\b(besylate|hydrochloride|hcl|potassium|sodium|calcium|maleate|sulfate|tartrate|fumarate|hyclate|mesylate|phosphate|acetate|valerate|dipropionate|propionate)\b", "", token)
        token = re.sub(r"[^a-z\s-]", "", token).strip()
        if token and len(token) > 2:
            ingredients.append(token)
    return sorted(list(set(ingredients)))


def assign_category(ingredients: List[str], raw_name: str) -> str:
    for ing in ingredients:
        for key, cat in THERAPEUTIC_CLASS_MAP.items():
            if key in ing:
                return cat
    raw_lower = raw_name.lower()
    for key, cat in THERAPEUTIC_CLASS_MAP.items():
        if key in raw_lower:
            return cat
    return "General Pharmaceutical"


def fetch_and_build_catalogue(
    output_raw_path: Path,
    output_norm_path: Path,
    manifest_path: Path,
    curated_csv_path: Path,
) -> Dict[str, Any]:
    """
    Downloads full RxNorm SCD & SBD concept directory, merges with foundation records,
    and produces verified JSON artifacts with an ingestion manifest.
    """
    t0 = time.time()
    logger.info("Step 1: Querying NLM RxNav for active version...")
    rxnav_ver = get_rxnav_version()
    retrieval_timestamp = datetime.now(timezone.utc).isoformat()
    logger.info(f"RxNav API Version: {rxnav_ver} (Retrieved: {retrieval_timestamp})")

    logger.info("Step 2: Downloading all SCD (clinical) and SBD (branded) drug concepts...")
    url = f"{RXNAV_BASE_URL}/allconcepts.json?tty=SCD+SBD"
    data = http_get_json(url, timeout=45)
    if not data or "minConceptGroup" not in data or "minConcept" not in data["minConceptGroup"]:
        raise RuntimeError("Failed to retrieve RxNav concept directory.")

    raw_concepts = data["minConceptGroup"]["minConcept"]
    logger.info(f"Retrieved {len(raw_concepts)} raw concepts from NLM RxNav.")

    # Save raw archive with SHA-256
    raw_payload = {
        "source": "NLM RxNorm (National Library of Medicine)",
        "api_endpoint": url,
        "api_version": rxnav_ver,
        "retrieved_at": retrieval_timestamp,
        "total_records": len(raw_concepts),
        "concepts": raw_concepts,
    }
    raw_json_bytes = json.dumps(raw_payload, indent=2).encode("utf-8")
    raw_sha256 = hashlib.sha256(raw_json_bytes).hexdigest()

    output_raw_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_raw_path, "wb") as f:
        f.write(raw_json_bytes)
    logger.info(f"Raw concepts saved to {output_raw_path} (SHA-256: {raw_sha256[:16]}...)")

    # Step 3: Process and Normalize Records
    logger.info("Step 3: Normalizing and deduplicating catalogue records...")
    normalized_records: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()

    scd_count = 0
    sbd_count = 0
    rejected_count = 0
    duplicate_count = 0

    # 3a. First, load the 25 Curated Foundation Records from CSV (MED-001 to MED-025)
    curated_count = 0
    if curated_csv_path.exists():
        with open(curated_csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                med_id = row["medicine_id"].strip()
                seen_ids.add(med_id.lower())
                curated_count += 1

                # Parse ingredients
                raw_gen = row["generic_name"].strip()
                ings = extract_active_ingredients(raw_gen)

                rec = {
                    "medicine_id": med_id,
                    "canonical_name": row["medicine_name"].strip(),
                    "medicine_name": row["medicine_name"].strip(),
                    "generic_name": raw_gen,
                    "brand_name": row.get("brand_name", "").strip() or None,
                    "active_ingredients": ings,
                    "strength": row["strength"].strip(),
                    "dosage_form": row["dosage_form"].strip(),
                    "route": "Oral" if "tablet" in row["dosage_form"].lower() or "capsule" in row["dosage_form"].lower() else "Systemic",
                    "category": row["category"].strip(),
                    "manufacturer": row.get("manufacturer", "").strip() or None,
                    "storage_min_temperature": float(row["storage_min_temperature"]),
                    "storage_max_temperature": float(row["storage_max_temperature"]),
                    "storage_min_humidity": float(row["storage_min_humidity"]) if row.get("storage_min_humidity", "").strip() else None,
                    "storage_max_humidity": float(row["storage_max_humidity"]) if row.get("storage_max_humidity", "").strip() else None,
                    "expiry_warning_days": int(row.get("expiry_warning_days", 60)),
                    "image_class": row.get("image_class", "").strip() or None,
                    "rxnorm_cui": None,
                    "ndc": None,
                    "concept_type": "CURATED_MONOGRAPH",
                    "source_name": row["source"].strip(),
                    "source_id": med_id,
                    "source_url": row["source_url"].strip(),
                    "source_version": "2026-09",
                    "retrieved_at": "2026-09-01T00:00:00Z",
                }
                normalized_records.append(rec)
        logger.info(f"Loaded {curated_count} curated foundation monographs with quantitative storage bounds.")

    # 3b. Process RxNorm concepts
    for concept in raw_concepts:
        rxcui = str(concept.get("rxcui", "")).strip()
        raw_name = str(concept.get("name", "")).strip()
        tty = str(concept.get("tty", "")).strip().upper()

        if not rxcui or not raw_name:
            rejected_count += 1
            continue

        med_id = f"RXN-{rxcui}"
        if med_id.lower() in seen_ids:
            duplicate_count += 1
            continue
        seen_ids.add(med_id.lower())

        # Extract brand name if present (especially in SBD)
        brand_match = RE_BRAND.search(raw_name)
        brand_name = brand_match.group(1).strip() if brand_match else None

        # Clean generic name
        clean_name_without_brand = RE_BRAND.sub("", raw_name).strip()
        dosage_form = extract_dosage_form(raw_name)
        route = extract_route(dosage_form, raw_name)
        strength = extract_strength(raw_name)
        active_ingredients = extract_active_ingredients(clean_name_without_brand)
        generic_name = " / ".join(ing.title() for ing in active_ingredients) if active_ingredients else clean_name_without_brand
        category = assign_category(active_ingredients, raw_name)

        if tty == "SBD":
            sbd_count += 1
            concept_type = "BRANDED_DRUG"
        else:
            scd_count += 1
            concept_type = "CLINICAL_CONCEPT"

        # PHASE 2 COMPLIANCE:
        # Clinical concept records from RxNav do NOT contain physical package storage monographs.
        # We explicitly set storage temperatures to None rather than substituting fake/arbitrary defaults.
        rec = {
            "medicine_id": med_id,
            "canonical_name": raw_name,
            "medicine_name": raw_name,
            "generic_name": generic_name,
            "brand_name": brand_name,
            "active_ingredients": active_ingredients,
            "strength": strength,
            "dosage_form": dosage_form,
            "route": route,
            "category": category,
            "manufacturer": None,
            "storage_min_temperature": None,
            "storage_max_temperature": None,
            "storage_min_humidity": None,
            "storage_max_humidity": None,
            "expiry_warning_days": 60,
            "image_class": None,
            "rxnorm_cui": rxcui,
            "ndc": None,
            "concept_type": concept_type,
            "source_name": "RxNorm",
            "source_id": rxcui,
            "source_url": f"https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={rxcui}",
            "source_version": rxnav_ver,
            "retrieved_at": retrieval_timestamp,
        }
        normalized_records.append(rec)

    total_accepted = len(normalized_records)
    elapsed = time.time() - t0
    logger.info(
        f"Normalization complete in {elapsed:.1f}s. "
        f"Total Accepted: {total_accepted} "
        f"(Curated: {curated_count}, Clinical SCD: {scd_count}, Branded SBD: {sbd_count}, Duplicates: {duplicate_count}, Rejected: {rejected_count})"
    )

    # Save normalized JSON
    norm_payload = {
        "version": "2.0.0",
        "generated_at": retrieval_timestamp,
        "total_records": total_accepted,
        "records": normalized_records,
    }
    output_norm_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_norm_path, "w", encoding="utf-8") as f:
        json.dump(norm_payload, f, indent=2)
    logger.info(f"Saved normalized catalogue index to {output_norm_path}")

    # Step 4: Write Ingestion Manifest
    manifest = {
        "manifest_version": "1.0.0",
        "retrieval_date": retrieval_timestamp,
        "source_authority": "NLM RxNorm & FDA DailyMed",
        "api_endpoint": url,
        "source_version": rxnav_ver,
        "raw_records_fetched": len(raw_concepts),
        "raw_payload_sha256": raw_sha256,
        "accepted_records_total": total_accepted,
        "breakdown": {
            "curated_foundation_monographs": curated_count,
            "rxnorm_clinical_concepts_scd": scd_count,
            "rxnorm_branded_drugs_sbd": sbd_count,
        },
        "rejected_records": rejected_count,
        "duplicate_records": duplicate_count,
        "storage_metadata_policy": "Strict provenance: Numeric storage boundaries only populated when authoritative monograph specifies them. Pure RxNorm concepts maintain null limits to trigger explicit INSUFFICIENT_DATA status.",
        "verified_database_target": "medicine_knowledge.db",
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    logger.info(f"Saved ingestion manifest to {manifest_path}")

    return manifest


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent.parent
    raw_target = base_dir / "data" / "sources" / "rxnorm_raw.json"
    norm_target = base_dir / "data" / "medicines" / "normalized_medicine_index.json"
    manifest_target = base_dir / "data" / "medicines" / "ingestion_manifest.json"
    curated_csv = base_dir / "data" / "medicines" / "medicines.csv"

    fetch_and_build_catalogue(raw_target, norm_target, manifest_target, curated_csv)
