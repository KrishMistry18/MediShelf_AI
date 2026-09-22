"""
MediShelf AI — DailyMed SPL Ingestion Client
Queries the official NLM DailyMed REST API (dailymed.nlm.nih.gov)
to retrieve verifiable SPL (Structured Product Labeling) metadata, set IDs,
and official package insert URLs.
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

logger = logging.getLogger("medishelf.ingestion.dailymed")

DAILYMED_SPLS_URL = "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json"

TARGET_DAILYMED_DRUGS = [
    "Amlodipine and Telmisartan",
    "Amoxicillin and Clavulanate",
    "Sulfamethoxazole and Trimethoprim",
    "Losartan and Hydrochlorothiazide",
    "Lisinopril and Hydrochlorothiazide",
    "Metformin and Sitagliptin",
    "Atorvastatin",
    "Omeprazole",
    "Pantoprazole",
    "Ciprofloxacin",
    "Azithromycin",
    "Paracetamol",
    "Acetaminophen",
    "Ibuprofen",
]


def _http_get_json(url: str, timeout: int = 15) -> Optional[Dict[str, Any]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MediShelf-AI-OpenWorld/1.0 (DailyMed Client; Research and Verification)",
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


def fetch_dailymed_spls(output_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Fetches official SPL records from DailyMed Web API.
    """
    retrieved_at = datetime.now(timezone.utc).isoformat()
    all_records: List[Dict[str, Any]] = []
    seen_setids = set()

    print("Fetching DailyMed SPL records...")

    for drug_name in TARGET_DAILYMED_DRUGS:
        encoded = urllib.parse.quote(drug_name)
        url = f"{DAILYMED_SPLS_URL}?drug_name={encoded}&pagesize=5"
        print(f"  -> DailyMed search: '{drug_name}'...")
        data = _http_get_json(url)
        if not data or "data" not in data:
            continue

        for spl in data["data"]:
            setid = spl.get("setid")
            if not setid or setid in seen_setids:
                continue
            seen_setids.add(setid)

            title = spl.get("title", "")
            source_url = f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={setid}"

            record = {
                "source_name": "DailyMed",
                "source_identifier": setid,
                "source_url": source_url,
                "source_version": spl.get("published_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
                "retrieved_at": retrieved_at,
                "title": title,
                "spl_version": spl.get("spl_version", "1"),
            }
            all_records.append(record)
        time.sleep(0.2)

    print(f"Successfully collected {len(all_records)} DailyMed SPL records.")

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "source": "DailyMed (NLM / FDA)",
                    "retrieved_at": retrieved_at,
                    "total_records": len(all_records),
                    "records": all_records,
                },
                f,
                indent=2,
            )
        print(f"Saved DailyMed records to: {output_path}")

    return all_records


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent.parent
    target_json = base_dir / "data" / "sources" / "dailymed_raw.json"
    fetch_dailymed_spls(target_json)
