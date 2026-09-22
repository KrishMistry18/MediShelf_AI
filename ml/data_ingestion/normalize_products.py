"""
MediShelf AI — Medicine Normalization & Deduplication Pipeline
Normalizes raw records from RxNorm, openFDA, and DailyMed into canonical,
source-backed pharmaceutical knowledge representations.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("medishelf.ingestion.normalize")

# Mapping of keywords to canonical dosage forms
DOSAGE_FORM_MAP = [
    (re.compile(r"\bnasal\s+spray\b", re.IGNORECASE), "Nasal Spray"),
    (re.compile(r"\binhal(?:ation|er|e)\b|\baerosol\b", re.IGNORECASE), "Inhalation Aerosol"),
    (re.compile(r"\b(?:subcutaneous\s+)?inject(?:ion|able)\b|\bvial\b|\bprefilled\s+pen\b|\bauto-injector\b", re.IGNORECASE), "Subcutaneous Injection"),
    (re.compile(r"\bdelayed[- ]release\s+capsule\b", re.IGNORECASE), "Delayed-Release Capsule"),
    (re.compile(r"\bextended[- ]release\s+capsule\b|\ber\s+capsule\b", re.IGNORECASE), "Extended-Release Capsule"),
    (re.compile(r"\bcapsules?\b|\bcaps?\b", re.IGNORECASE), "Capsule"),
    (re.compile(r"\bdelayed[- ]release\s+tablet\b", re.IGNORECASE), "Delayed-Release Tablet"),
    (re.compile(r"\bextended[- ]release\s+tablet\b|\ber\s+tablet\b", re.IGNORECASE), "Extended-Release Tablet"),
    (re.compile(r"\bfilm[- ]coated\s+tablet\b", re.IGNORECASE), "Tablet"),
    (re.compile(r"\btablets?\b|\btabs?\b|\bcaplets?\b", re.IGNORECASE), "Tablet"),
    (re.compile(r"\bsuspension\b", re.IGNORECASE), "Oral Suspension"),
    (re.compile(r"\bsolution\b|\bsyrups?\b|\belixir\b", re.IGNORECASE), "Solution"),
    (re.compile(r"\bcream\b|\bointment\b|\bgel\b|\blotion\b", re.IGNORECASE), "Topical"),
]

# Therapeutic class mapping based on ingredient
THERAPEUTIC_CLASS_MAP = {
    "amlodipine": "Antihypertensive (Calcium Channel Blocker)",
    "telmisartan": "Antihypertensive (Angiotensin II Receptor Blocker)",
    "losartan": "Antihypertensive (Angiotensin II Receptor Blocker)",
    "lisinopril": "Antihypertensive (ACE Inhibitor)",
    "hydrochlorothiazide": "Diuretic / Antihypertensive",
    "paracetamol": "Analgesic / Antipyretic",
    "acetaminophen": "Analgesic / Antipyretic",
    "ibuprofen": "Analgesic / NSAID",
    "amoxicillin": "Antibiotic (Penicillin)",
    "clavulanate": "Beta-Lactamase Inhibitor",
    "clavulanic acid": "Beta-Lactamase Inhibitor",
    "metformin": "Antidiabetic (Biguanide)",
    "sitagliptin": "Antidiabetic (DPP-4 Inhibitor)",
    "glipizide": "Antidiabetic (Sulfonylurea)",
    "atorvastatin": "Antihyperlipidemic (Statin)",
    "simvastatin": "Antihyperlipidemic (Statin)",
    "rosuvastatin": "Antihyperlipidemic (Statin)",
    "omeprazole": "Gastrointestinal (Proton Pump Inhibitor)",
    "pantoprazole": "Gastrointestinal (Proton Pump Inhibitor)",
    "azithromycin": "Antibiotic (Macrolide)",
    "ciprofloxacin": "Antibiotic (Fluoroquinolone)",
    "doxycycline": "Antibiotic (Tetracycline)",
    "cetirizine": "Antihistamine (H1 Blocker)",
    "levothyroxine": "Endocrine (Thyroid Hormone)",
    "insulin human": "Endocrine (Insulin Hormone)",
    "insulin glargine": "Endocrine (Long-Acting Insulin)",
    "albuterol": "Respiratory (Short-Acting Beta2 Agonist)",
    "salbutamol": "Respiratory (Short-Acting Beta2 Agonist)",
    "fluticasone": "Corticosteroid / Anti-inflammatory",
    "salmeterol": "Respiratory (Long-Acting Beta2 Agonist)",
    "budesonide": "Corticosteroid / Respiratory",
    "formoterol": "Respiratory (Long-Acting Beta2 Agonist)",
    "sertraline": "Antidepressant (SSRI)",
    "montelukast": "Respiratory (Leukotriene Receptor Antagonist)",
    "clopidogrel": "Antiplatelet / Hematologic",
    "gabapentin": "Anticonvulsant / Neuropathic",
    "prednisone": "Corticosteroid / Anti-inflammatory",
    "sulfamethoxazole": "Antibacterial (Sulfonamide)",
    "trimethoprim": "Antibacterial",
    "apixaban": "Anticoagulant (Factor Xa Inhibitor)",
    "rivaroxaban": "Anticoagulant (Factor Xa Inhibitor)",
    "furosemide": "Loop Diuretic",
    "spironolactone": "Potassium-Sparing Diuretic",
    "carvedilol": "Beta-Blocker / Antihypertensive",
    "metoprolol": "Beta-Blocker / Antihypertensive",
    "tramadol": "Analgesic (Opioid Agonist)",
    "escitalopram": "Antidepressant (SSRI)",
    "duloxetine": "Antidepressant (SNRI)",
}


def normalize_strength_str(raw_strength: str) -> str:
    """Normalizes strength spacing and units."""
    if not raw_strength:
        return ""
    cleaned = raw_strength.strip()
    cleaned = re.sub(r"\s*([/|+])\s*", r" \1 ", cleaned)
    cleaned = re.sub(r"(\d+(?:\.\d+)?)\s*([a-zA-Z]+)", r"\1 \2", cleaned)
    cleaned = re.sub(r"\biu\b", "U", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bmg\b", "mg", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bmcg\b", "mcg", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bml\b", "mL", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def normalize_dosage_form_str(text: str) -> str:
    """Classifies dosage form string into standard form."""
    if not text:
        return "Tablet"
    for pattern, canonical in DOSAGE_FORM_MAP:
        if pattern.search(text):
            return canonical
    return "Tablet"


def extract_active_ingredients_from_name(name: str) -> List[str]:
    """
    Extracts active ingredients from RxNorm or clinical drug title.
    e.g. 'amlodipine 5 MG / telmisartan 40 MG Oral Tablet' -> ['amlodipine', 'telmisartan']
    """
    cleaned = name.lower()
    # Remove dosage forms and strengths
    cleaned = re.sub(r"\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|u|iu|%)\b", "", cleaned)
    cleaned = re.sub(r"\b(?:oral|tablet|capsule|injection|solution|suspension|film[- ]coated|delayed[- ]release|extended[- ]release)\b", "", cleaned)
    parts = re.split(r"[/+;]|\band\b", cleaned)
    ingredients = []
    for p in parts:
        token = p.strip()
        # Remove salt suffixes for canonical ingredient matching
        token = re.sub(r"\b(besylate|hydrochloride|hcl|potassium|sodium|calcium|maleate|sulfate|tartrate|fumarate|hyclate|mesylate)\b", "", token)
        token = re.sub(r"[^a-z\s-]", "", token).strip()
        if token and len(token) > 2:
            ingredients.append(token)
    return sorted(list(set(ingredients)))


def infer_storage_requirements(ingredients: List[str], dosage_form: str, storage_statement: str = "") -> Tuple[float, float, Optional[float], Optional[float], str]:
    """
    Infers verifiable storage criteria following USP and FDA standards:
    - Biologicals, insulins: 2.0 to 8.0 C (Refrigerate, Do not freeze)
    - Room temperature solid dosage: 20.0 to 25.0 C (excursions 15.0 to 30.0 C)
    - Liquid suspensions / antibiotics: 15.0 to 25.0 C or 2.0 to 8.0 C
    """
    ing_str = " ".join(ingredients).lower()
    
    # Check for cold chain items
    if "insulin" in ing_str or "vaccine" in ing_str:
        return 2.0, 8.0, None, None, "USP / FDA Label Monograph — Refrigerate between 2°C and 8°C. Do not freeze."
    
    # Check explicit statement text if available
    stmt_lower = storage_statement.lower()
    if "2 to 8" in stmt_lower or "2°c to 8°c" in stmt_lower or "refrigerat" in stmt_lower:
        return 2.0, 8.0, None, None, storage_statement[:200]
    
    if "15 to 30" in stmt_lower or "15°c to 30°c" in stmt_lower:
        return 15.0, 30.0, None, None, storage_statement[:200]
    
    if "20 to 25" in stmt_lower or "20°c to 25°c" in stmt_lower:
        return 20.0, 25.0, None, None, storage_statement[:200]

    # Standard Controlled Room Temperature (USP <659>)
    return 20.0, 25.0, None, None, "USP Controlled Room Temperature (20°C to 25°C, excursions permitted to 15°C to 30°C)."


def normalize_rxnorm_record(rec: Dict[str, Any], index: int) -> Dict[str, Any]:
    """Converts a raw RxNorm record into a canonical medicine product."""
    rxcui = rec.get("rxcui", f"RXN-{index:04d}")
    raw_name = rec.get("name", "")
    
    # Extract ingredients
    ingredients = extract_active_ingredients_from_name(raw_name)
    if not ingredients and rec.get("queried_term"):
        ingredients = extract_active_ingredients_from_name(rec["queried_term"])

    # Extract dosage form
    dosage_form = normalize_dosage_form_str(raw_name)

    # Extract strength
    strength_matches = re.findall(r"\b(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|u|iu|%))\b", raw_name, flags=re.IGNORECASE)
    strength = " / ".join(strength_matches) if strength_matches else "Standard"
    strength = normalize_strength_str(strength)

    # Determine therapeutic category
    category = "General Pharmaceutical"
    for ing in ingredients:
        if ing in THERAPEUTIC_CLASS_MAP:
            category = THERAPEUTIC_CLASS_MAP[ing]
            break

    min_temp, max_temp, min_hum, max_hum, source_desc = infer_storage_requirements(ingredients, dosage_form)

    # Format generic / commercial name
    medicine_name = raw_name
    generic_name = " / ".join(ing.title() for ing in ingredients) if ingredients else raw_name

    return {
        "medicine_id": f"RXN-{rxcui}",
        "canonical_name": raw_name,
        "medicine_name": medicine_name,
        "generic_name": generic_name,
        "brand_name": rec.get("synonym") or None,
        "active_ingredients": ingredients,
        "strength": strength,
        "dosage_form": dosage_form,
        "category": category,
        "manufacturer": None,
        "route": "Oral" if "tablet" in dosage_form.lower() or "capsule" in dosage_form.lower() else "Systemic",
        "storage_min_temperature": min_temp,
        "storage_max_temperature": max_temp,
        "storage_min_humidity": min_hum,
        "storage_max_humidity": max_hum,
        "expiry_warning_days": 60,
        "image_class": None,
        "rxnorm_cui": rxcui,
        "ndc": None,
        "source_name": "RxNorm",
        "source_id": rxcui,
        "source_url": rec.get("source_url") or f"https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={rxcui}",
        "source_version": rec.get("source_version", "2026-09"),
        "retrieved_at": rec.get("retrieved_at", datetime.now(timezone.utc).isoformat()),
    }


def normalize_openfda_record(rec: Dict[str, Any], index: int) -> Dict[str, Any]:
    """Converts a raw openFDA label record into a canonical medicine product."""
    spl_id = rec.get("source_identifier", f"FDA-{index:04d}")
    set_id = rec.get("set_id", spl_id)
    
    brand_names = rec.get("brand_names", [])
    generic_names = rec.get("generic_names", [])
    substances = rec.get("active_ingredients", [])
    manufacturers = rec.get("manufacturers", [])
    routes = rec.get("routes", [])
    ndcs = rec.get("product_ndcs", [])
    storage_stmt = rec.get("storage_statement", "")

    # Clean active ingredients
    ingredients = []
    for s in substances:
        ing = s.lower().strip()
        ing = re.sub(r"\b(besylate|hydrochloride|hcl|potassium|sodium|calcium|maleate|sulfate|tartrate)\b", "", ing).strip()
        if ing:
            ingredients.append(ing)
    ingredients = sorted(list(set(ingredients)))

    primary_brand = brand_names[0].title() if brand_names else None
    primary_generic = " / ".join(g.title() for g in generic_names) if generic_names else (" / ".join(i.title() for i in ingredients) if ingredients else "Pharmaceutical Formulation")
    primary_manufacturer = manufacturers[0] if manufacturers else None
    primary_route = routes[0].title() if routes else "Oral"
    primary_ndc = ndcs[0] if ndcs else None

    # Dosage form & strength from statement or generic
    full_text = f"{' '.join(brand_names)} {' '.join(generic_names)} {storage_stmt}"
    dosage_form = normalize_dosage_form_str(full_text)
    
    strength_matches = re.findall(r"\b(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|u|iu|%))\b", full_text, flags=re.IGNORECASE)
    strength = " / ".join(strength_matches[:2]) if strength_matches else "Standard"
    strength = normalize_strength_str(strength)

    # Category
    category = "General Pharmaceutical"
    for ing in ingredients:
        if ing in THERAPEUTIC_CLASS_MAP:
            category = THERAPEUTIC_CLASS_MAP[ing]
            break

    min_temp, max_temp, min_hum, max_hum, source_desc = infer_storage_requirements(ingredients, dosage_form, storage_stmt)

    med_name = f"{primary_brand} ({primary_generic})" if primary_brand else primary_generic
    if strength and strength != "Standard" and strength not in med_name:
        med_name = f"{med_name} {strength}"

    return {
        "medicine_id": f"FDA-{spl_id[:12]}",
        "canonical_name": med_name,
        "medicine_name": med_name,
        "generic_name": primary_generic,
        "brand_name": " / ".join(brand_names) if brand_names else None,
        "active_ingredients": ingredients,
        "strength": strength,
        "dosage_form": dosage_form,
        "category": category,
        "manufacturer": primary_manufacturer,
        "route": primary_route,
        "storage_min_temperature": min_temp,
        "storage_max_temperature": max_temp,
        "storage_min_humidity": min_hum,
        "storage_max_humidity": max_hum,
        "expiry_warning_days": 60,
        "image_class": None,
        "rxnorm_cui": None,
        "ndc": primary_ndc,
        "source_name": "openFDA / DailyMed",
        "source_id": spl_id,
        "source_url": rec.get("source_url") or f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={set_id}",
        "source_version": rec.get("source_version", "2026-09"),
        "retrieved_at": rec.get("retrieved_at", datetime.now(timezone.utc).isoformat()),
    }


def normalize_all_sources(
    rxnorm_path: Optional[Path] = None,
    openfda_path: Optional[Path] = None,
    output_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """
    Consolidates raw ingested files from all sources into a normalized,
    deduplicated medicine knowledge index.
    """
    base_dir = Path(__file__).resolve().parent.parent.parent
    if rxnorm_path is None:
        rxnorm_path = base_dir / "data" / "sources" / "rxnorm_raw.json"
    if openfda_path is None:
        openfda_path = base_dir / "data" / "sources" / "openfda_raw.json"
    if output_path is None:
        output_path = base_dir / "data" / "medicines" / "normalized_medicine_index.json"

    normalized_records: List[Dict[str, Any]] = []
    seen_signatures: Set[str] = set()

    # 1. Process RxNorm
    if rxnorm_path.exists():
        with open(rxnorm_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            rx_records = data.get("records", [])
            for idx, rec in enumerate(rx_records, 1):
                norm = normalize_rxnorm_record(rec, idx)
                # Deduplication key: active ingredients + strength + dosage form
                ing_sig = "-".join(norm["active_ingredients"])
                sig = f"{ing_sig}|{norm['strength']}|{norm['dosage_form']}".lower()
                if sig not in seen_signatures:
                    seen_signatures.add(sig)
                    normalized_records.append(norm)

    # 2. Process openFDA
    if openfda_path.exists():
        with open(openfda_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            fda_records = data.get("records", [])
            for idx, rec in enumerate(fda_records, 1):
                norm = normalize_openfda_record(rec, idx)
                ing_sig = "-".join(norm["active_ingredients"])
                sig = f"{ing_sig}|{norm['strength']}|{norm['dosage_form']}".lower()
                if sig not in seen_signatures and norm["active_ingredients"]:
                    seen_signatures.add(sig)
                    normalized_records.append(norm)

    print(f"Total normalized and deduplicated medicine records: {len(normalized_records)}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_records": len(normalized_records),
                "records": normalized_records,
            },
            f,
            indent=2,
        )

    return normalized_records


if __name__ == "__main__":
    normalize_all_sources()
