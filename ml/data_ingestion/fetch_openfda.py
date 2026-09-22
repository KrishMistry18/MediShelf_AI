"""
MediShelf AI — openFDA Ingestion Client
Queries the official openFDA Drug Product & Labeling APIs (api.fda.gov)
to harvest verifiable FDA packaging labels, manufacturer details, NDC identifiers,
active ingredient lists, and approved storage criteria.
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

logger = logging.getLogger("medishelf.ingestion.openfda")

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

TARGET_QUERIES = [
    # Multi-ingredient combination products
    "openfda.substance_name:\"AMLODIPINE\"+AND+openfda.substance_name:\"TELMISARTAN\"",
    "openfda.substance_name:\"AMOXICILLIN\"+AND+openfda.substance_name:\"CLAVULANATE\"",
    "openfda.substance_name:\"SULFAMETHOXAZOLE\"+AND+openfda.substance_name:\"TRIMETHOPRIM\"",
    "openfda.substance_name:\"LOSARTAN\"+AND+openfda.substance_name:\"HYDROCHLOROTHIAZIDE\"",
    "openfda.substance_name:\"LISINOPRIL\"+AND+openfda.substance_name:\"HYDROCHLOROTHIAZIDE\"",
    "openfda.substance_name:\"METFORMIN\"+AND+openfda.substance_name:\"SITAGLIPTIN\"",
    
    # Key single ingredient medicines
    "openfda.generic_name:\"AMLODIPINE\"",
    "openfda.generic_name:\"TELMISARTAN\"",
    "openfda.generic_name:\"PARACETAMOL\"+OR+openfda.generic_name:\"ACETAMINOPHEN\"",
    "openfda.generic_name:\"AMOXICILLIN\"",
    "openfda.generic_name:\"METFORMIN\"",
    "openfda.generic_name:\"ATORVASTATIN\"",
    "openfda.generic_name:\"OMEPRAZOLE\"",
    "openfda.generic_name:\"AZITHROMYCIN\"",
    "openfda.generic_name:\"CIPROFLOXACIN\"",
    "openfda.generic_name:\"IBUPROFEN\"",
    "openfda.generic_name:\"CETIRIZINE\"",
    "openfda.generic_name:\"LEVOTHYROXINE\"",
    "openfda.generic_name:\"INSULIN\"",
    "openfda.generic_name:\"ALBUTEROL\"",
    "openfda.generic_name:\"PANTOPRAZOLE\"",
    "openfda.generic_name:\"SERTRALINE\"",
    "openfda.generic_name:\"MONTELUKAST\"",
    "openfda.generic_name:\"CLOPIDOGREL\"",
    "openfda.generic_name:\"GABAPENTIN\"",
]


def _http_get_json(url: str, timeout: int = 15) -> Optional[Dict[str, Any]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MediShelf-AI-OpenWorld/1.0 (openFDA Client; Education and Integrity Verification)",
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


def fetch_openfda_corpus(output_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Fetches real FDA labeling records via openFDA search.
    """
    retrieved_at = datetime.now(timezone.utc).isoformat()
    all_records: List[Dict[str, Any]] = []
    seen_ids = set()

    print("Fetching openFDA drug labeling corpus...", flush=True)

    for query_str in TARGET_QUERIES:
        url = f"{OPENFDA_LABEL_URL}?search={query_str}&limit=5"
        print(f"  -> Querying openFDA: {query_str[:50]}...", flush=True)
        data = _http_get_json(url)
        if not data or "results" not in data:
            continue

        meta = data.get("meta", {})
        last_updated = meta.get("last_updated", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

        for item in data["results"]:
            spl_id = item.get("id") or item.get("set_id")
            if not spl_id or spl_id in seen_ids:
                continue
            seen_ids.add(spl_id)

            openfda_info = item.get("openfda", {})
            brand_names = openfda_info.get("brand_name", [])
            generic_names = openfda_info.get("generic_name", [])
            substances = openfda_info.get("substance_name", [])
            manufacturers = openfda_info.get("manufacturer_name", [])
            ndcs = openfda_info.get("product_ndc", [])
            routes = openfda_info.get("route", [])

            # Extract storage statement
            storage_texts = item.get("storage_and_handling", [])
            storage_text = " ".join(storage_texts) if storage_texts else ""

            # Extract dosage & administration
            dosage_texts = item.get("dosage_and_administration", [])
            dosage_text = " ".join(dosage_texts[:2]) if dosage_texts else ""

            set_id = item.get("set_id", spl_id)
            source_url = f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={set_id}"

            record = {
                "source_name": "openFDA / DailyMed",
                "source_identifier": spl_id,
                "set_id": set_id,
                "source_url": source_url,
                "source_version": last_updated,
                "retrieved_at": retrieved_at,
                "brand_names": brand_names,
                "generic_names": generic_names,
                "active_ingredients": substances,
                "manufacturers": manufacturers,
                "product_ndcs": ndcs,
                "routes": routes,
                "storage_statement": storage_text,
                "effective_time": item.get("effective_time", ""),
            }
            all_records.append(record)

        time.sleep(0.2)

    print(f"Successfully collected {len(all_records)} distinct openFDA product labeling records.", flush=True)

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "source": "openFDA Drug Labeling (U.S. FDA)",
                    "retrieved_at": retrieved_at,
                    "total_records": len(all_records),
                    "records": all_records,
                },
                f,
                indent=2,
            )
        print(f"Saved openFDA records to: {output_path}", flush=True)

    return all_records


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent.parent
    target_json = base_dir / "data" / "sources" / "openfda_raw.json"
    fetch_openfda_corpus(target_json)
