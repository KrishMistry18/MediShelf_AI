"""
MediShelf AI — RxNorm Ingestion Client
Queries official NLM RxNav REST APIs to retrieve authentic clinical drug concepts (SCD/SBD),
multi-ingredient formulations, RxCUIs, and dosage forms.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("medishelf.ingestion.rxnorm")

RXNAV_BASE_URL = "https://rxnav.nlm.nih.gov/REST"

# Representative list of single-ingredient APIs and multi-ingredient clinical combinations
TARGET_DRUG_NAMES = [
    # Multi-ingredient combination products (Crucial for Section 8 & Section 1)
    "amlodipine / telmisartan",
    "amoxicillin / clavulanate",
    "sulfamethoxazole / trimethoprim",
    "losartan / hydrochlorothiazide",
    "lisinopril / hydrochlorothiazide",
    "metformin / sitagliptin",
    "metformin / glipizide",
    "fluticasone / salmeterol",
    "budesonide / formoterol",
    "atorvastatin / ezetimibe",
    "aspirin / dipyridamole",
    "acetaminophen / hydrocodone",
    "acetaminophen / oxycodone",
    "acetaminophen / codeine",
    
    # Core cardiovascular, metabolic, antimicrobial, respiratory, neurological medicines
    "amlodipine",
    "telmisartan",
    "amoxicillin",
    "clavulanate",
    "metformin",
    "atorvastatin",
    "omeprazole",
    "pantoprazole",
    "azithromycin",
    "ciprofloxacin",
    "doxycycline",
    "ibuprofen",
    "acetaminophen",
    "cetirizine",
    "losartan",
    "hydrochlorothiazide",
    "levothyroxine",
    "insulin human",
    "insulin glargine",
    "albuterol",
    "fluticasone",
    "sertraline",
    "montelukast",
    "clopidogrel",
    "gabapentin",
    "prednisone",
    "lisinopril",
    "simvastatin",
    "rosuvastatin",
    "empagliflozin",
    "dapagliflozin",
    "sitagliptin",
    "apixaban",
    "rivaroxaban",
    "furosemide",
    "spironolactone",
    "carvedilol",
    "metoprolol",
    "tramadol",
    "escitalopram",
    "duloxetine",
]


def _http_get_json(url: str, timeout: int = 15) -> Optional[Dict[str, Any]]:
    """Makes a GET request with proper User-Agent and JSON parsing."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MediShelf-AI-OpenWorld/1.0 (NLM RxNav Client; Research and Verification)",
            "Accept": "application/json",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
        except Exception as err:
            logger.warning(f"Request failed (attempt {attempt+1}/3) for {url}: {err}")
            time.sleep(1.0 * (attempt + 1))
    return None


def get_rxnav_version() -> str:
    """Fetches active RxNav version."""
    url = f"{RXNAV_BASE_URL}/version.json"
    data = _http_get_json(url)
    if data and "version" in data:
        return str(data["version"])
    return datetime.now(timezone.utc).strftime("%Y-%m")


def find_drugs_by_name(drug_name: str) -> List[Dict[str, Any]]:
    """
    Finds clinical drugs (SCD, SBD, BPCK, GPCK) matching a given name or combination.
    """
    encoded = urllib.parse.quote(drug_name.strip())
    url = f"{RXNAV_BASE_URL}/drugs.json?name={encoded}"
    data = _http_get_json(url)
    if not data or "drugGroup" not in data:
        return []

    concept_group = data["drugGroup"].get("conceptGroup", [])
    results: List[Dict[str, Any]] = []

    for group in concept_group:
        tty = group.get("tty", "")
        # SCD = Semantic Clinical Drug, SBD = Semantic Branded Drug
        if tty not in {"SCD", "SBD", "GPCK", "BPCK"}:
            continue

        for concept in group.get("conceptProperties", []):
            results.append({
                "rxcui": str(concept.get("rxcui", "")),
                "name": concept.get("name", ""),
                "synonym": concept.get("synonym", ""),
                "tty": tty,
                "language": concept.get("language", "ENG"),
                "suppress": concept.get("suppress", "N"),
            })

    return results


def get_concept_all_properties(rxcui: str) -> Dict[str, Any]:
    """Retrieves full property dictionary for an RxCUI."""
    url = f"{RXNAV_BASE_URL}/rxcui/{rxcui}/allProperties.json?prop=all"
    data = _http_get_json(url)
    props: Dict[str, Any] = {}
    if data and "propConceptGroup" in data:
        for p in data["propConceptGroup"].get("propConcept", []):
            name = p.get("propName")
            val = p.get("propValue")
            if name and val:
                props[name] = val
    return props


def fetch_rxnorm_corpus(output_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Fetches real clinical drug concepts across target single and combination medicines.
    Saves raw records with provenance metadata.
    """
    version = get_rxnav_version()
    retrieved_at = datetime.now(timezone.utc).isoformat()
    all_records: List[Dict[str, Any]] = []
    seen_rxcuis = set()

    print(f"Fetching RxNorm corpus (API Version: {version})...", flush=True)

    for drug_name in TARGET_DRUG_NAMES:
        print(f"  -> Querying RxNav: '{drug_name}'...", flush=True)
        drugs = find_drugs_by_name(drug_name)
        for drug in drugs:
            rxcui = drug["rxcui"]
            if not rxcui or rxcui in seen_rxcuis:
                continue
            seen_rxcuis.add(rxcui)

            record = {
                "source_name": "RxNorm",
                "source_identifier": rxcui,
                "source_url": f"https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={rxcui}",
                "source_version": version,
                "retrieved_at": retrieved_at,
                "rxcui": rxcui,
                "name": drug["name"],
                "synonym": drug.get("synonym", ""),
                "tty": drug["tty"],
                "queried_term": drug_name,
            }
            all_records.append(record)
        time.sleep(0.15)  # Respect API rate guidance

    print(f"Successfully collected {len(all_records)} distinct RxNorm clinical drug concepts.", flush=True)

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "source": "RxNorm (NLM / NIH)",
                    "api_version": version,
                    "retrieved_at": retrieved_at,
                    "total_records": len(all_records),
                    "records": all_records,
                },
                f,
                indent=2,
            )
        print(f"Saved RxNorm records to: {output_path}", flush=True)

    return all_records


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent.parent
    target_json = base_dir / "data" / "sources" / "rxnorm_raw.json"
    fetch_rxnorm_corpus(target_json)
