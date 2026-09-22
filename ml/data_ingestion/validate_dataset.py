"""
MediShelf AI — Open-World Knowledge Base Auditor & Coverage Reporter
Validates schema integrity, provenance, and computes actual statistics
across the ingested medicine knowledge base.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("medishelf.ingestion.validate")

REQUIRED_MASTER_FIELDS = [
    "medicine_id",
    "canonical_name",
    "generic_name",
    "strength",
    "dosage_form",
    "category",
    "storage_min_temperature",
    "storage_max_temperature",
    "source_name",
    "source_url",
]


def audit_master_knowledge_base(
    db_path: Optional[Path] = None,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Audits the master knowledge base SQLite database.
    Returns (is_valid, report_dictionary).
    """
    base_dir = Path(__file__).resolve().parent.parent.parent
    if db_path is None:
        db_path = base_dir / "data" / "medicines" / "medicine_knowledge.db"

    if not db_path.exists():
        return False, {
            "status": "FAILED",
            "error": f"Database not found at {db_path}",
            "total_records": 0,
        }

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    errors: List[str] = []
    warnings: List[str] = []

    # Fetch all records
    cur.execute("SELECT * FROM medicines_master")
    rows = cur.fetchall()

    total_records = len(rows)
    valid_records = 0
    unique_ids = set()
    all_ingredients = set()
    all_brands = set()
    all_manufacturers = set()
    all_dosage_forms = set()
    combination_products_count = 0
    sources_count: Dict[str, int] = {}

    for idx, row in enumerate(rows, 1):
        row_dict = dict(row)
        med_id = row_dict.get("medicine_id", "")
        row_errors: List[str] = []

        # 1. Required fields
        for field in REQUIRED_MASTER_FIELDS:
            val = row_dict.get(field)
            if val is None or (isinstance(val, str) and not val.strip()):
                row_errors.append(f"Record {idx} ({med_id}): Missing required field '{field}'.")

        # 2. Duplicate ID
        if med_id:
            if med_id in unique_ids:
                row_errors.append(f"Record {idx}: Duplicate medicine_id '{med_id}'.")
            unique_ids.add(med_id)

        # 3. Temperature validation
        min_t = row_dict.get("storage_min_temperature")
        max_t = row_dict.get("storage_max_temperature")
        if min_t is not None and max_t is not None:
            if min_t > max_t:
                row_errors.append(f"Record {idx} ({med_id}): Inverted temperature range ({min_t}°C > {max_t}°C).")
            if min_t < -40 or max_t > 60:
                warnings.append(f"Record {idx} ({med_id}): Extreme temperature [{min_t}°C, {max_t}°C].")

        # 4. Source URL validation
        url = row_dict.get("source_url", "")
        if url and not (url.startswith("http://") or url.startswith("https://")):
            row_errors.append(f"Record {idx} ({med_id}): Invalid source_url format: {url}")

        # 5. Extract statistics
        ing_raw = row_dict.get("active_ingredients", "[]")
        try:
            ingredients = json.loads(ing_raw) if isinstance(ing_raw, str) else ing_raw
        except Exception:
            ingredients = []

        if len(ingredients) > 1:
            combination_products_count += 1

        for ing in ingredients:
            all_ingredients.add(ing.lower().strip())

        brand = row_dict.get("brand_name")
        if brand:
            for b in brand.split("/"):
                b_clean = b.strip()
                if b_clean:
                    all_brands.add(b_clean)

        mfr = row_dict.get("manufacturer")
        if mfr and mfr.strip():
            all_manufacturers.add(mfr.strip())

        df = row_dict.get("dosage_form")
        if df and df.strip():
            all_dosage_forms.add(df.strip())

        src = row_dict.get("source_name", "Unknown")
        sources_count[src] = sources_count.get(src, 0) + 1

        if not row_errors:
            valid_records += 1
        else:
            errors.extend(row_errors)

    conn.close()

    is_valid = len(errors) == 0 and total_records >= 25

    report = {
        "status": "PASSED" if is_valid else "FAILED",
        "total_records": total_records,
        "valid_records": valid_records,
        "unique_medicine_ids": len(unique_ids),
        "unique_active_ingredients": len(all_ingredients),
        "unique_brands": len(all_brands),
        "unique_manufacturers": len(all_manufacturers),
        "unique_dosage_forms": len(all_dosage_forms),
        "combination_products": combination_products_count,
        "sources_breakdown": sources_count,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors[:20],  # first 20 if any
        "warnings": warnings[:20],
    }

    return is_valid, report


def print_coverage_report(report: Dict[str, Any]) -> None:
    print("=" * 65)
    print("      MEDISHELF AI — KNOWLEDGE BASE AUDIT & COVERAGE")
    print("=" * 65)
    print(f"Status:                      {report['status']}")
    print(f"Total Medicine Records:      {report['total_records']}")
    print(f"Valid Records:               {report['valid_records']}")
    print(f"Unique Active Ingredients:   {report['unique_active_ingredients']}")
    print(f"Unique Commercial Brands:    {report['unique_brands']}")
    print(f"Unique Manufacturers:        {report['unique_manufacturers']}")
    print(f"Unique Dosage Forms:         {report['unique_dosage_forms']}")
    print(f"Combination Drug Products:   {report['combination_products']}")
    print("-" * 65)
    print("Sources Breakdown:")
    for src, cnt in report.get("sources_breakdown", {}).items():
        print(f"  - {src}: {cnt} records")
    print("-" * 65)
    print(f"Errors: {report['error_count']} | Warnings: {report['warning_count']}")
    print("=" * 65)


if __name__ == "__main__":
    passed, rep = audit_master_knowledge_base()
    print_coverage_report(rep)
