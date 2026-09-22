"""
MediShelf AI — Master Index Builder & Fast Retrieval Engine
Compiles normalized medicine knowledge into an indexed SQLite store with FTS5
full-text search and inverted ingredient tables for sub-millisecond retrieval.
"""

from __future__ import annotations

import csv
import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("medishelf.ingestion.build_index")


def build_master_index(
    curated_csv_path: Optional[Path] = None,
    normalized_json_path: Optional[Path] = None,
    output_db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Constructs the master SQLite database with FTS5 search index and inverted ingredient index.
    Combines curated foundation records with expanded open-world knowledge.
    """
    base_dir = Path(__file__).resolve().parent.parent.parent
    if curated_csv_path is None:
        curated_csv_path = base_dir / "data" / "medicines" / "medicines.csv"
    if normalized_json_path is None:
        normalized_json_path = base_dir / "data" / "medicines" / "normalized_medicine_index.json"
    if output_db_path is None:
        output_db_path = base_dir / "data" / "medicines" / "medicine_knowledge.db"

    output_db_path.parent.mkdir(parents=True, exist_ok=True)

    # Remove existing index db if present to rebuild cleanly
    if output_db_path.exists():
        output_db_path.unlink()

    conn = sqlite3.connect(output_db_path)
    cur = conn.cursor()

    # 1. Create Master Table
    cur.execute("""
        CREATE TABLE medicines_master (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id TEXT UNIQUE NOT NULL,
            canonical_name TEXT NOT NULL,
            medicine_name TEXT NOT NULL,
            generic_name TEXT NOT NULL,
            brand_name TEXT,
            active_ingredients TEXT NOT NULL, -- JSON list of strings
            strength TEXT NOT NULL,
            dosage_form TEXT NOT NULL,
            route TEXT,
            category TEXT NOT NULL,
            manufacturer TEXT,
            storage_min_temperature REAL NOT NULL,
            storage_max_temperature REAL NOT NULL,
            storage_min_humidity REAL,
            storage_max_humidity REAL,
            expiry_warning_days INTEGER NOT NULL DEFAULT 60,
            image_class TEXT,
            rxnorm_cui TEXT,
            ndc TEXT,
            source_name TEXT NOT NULL,
            source_id TEXT,
            source_url TEXT NOT NULL,
            source_version TEXT,
            retrieved_at TEXT NOT NULL
        )
    """)

    # 2. Create FTS5 Full Text Index
    cur.execute("""
        CREATE VIRTUAL TABLE medicines_fts USING fts5(
            medicine_id UNINDEXED,
            medicine_name,
            generic_name,
            brand_name,
            active_ingredients,
            strength,
            dosage_form,
            manufacturer,
            tokenize='porter unicode61'
        )
    """)

    # 3. Create Inverted Ingredient Index Table
    cur.execute("""
        CREATE TABLE ingredient_index (
            ingredient TEXT NOT NULL,
            medicine_id TEXT NOT NULL,
            PRIMARY KEY (ingredient, medicine_id)
        )
    """)
    cur.execute("CREATE INDEX idx_ingredient ON ingredient_index (ingredient)")

    all_records: List[Dict[str, Any]] = []
    seen_ids = set()

    # Ingest Curated Foundation Records (MED-001 to MED-025)
    if curated_csv_path.exists():
        with open(curated_csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                med_id = row["medicine_id"].strip()
                seen_ids.add(med_id)

                # Parse ingredients from generic name
                raw_gen = row["generic_name"].strip()
                ingredients = [i.strip().lower() for i in re_split_ingredients(raw_gen)]

                rec = {
                    "medicine_id": med_id,
                    "canonical_name": row["medicine_name"].strip(),
                    "medicine_name": row["medicine_name"].strip(),
                    "generic_name": raw_gen,
                    "brand_name": row.get("brand_name", "").strip() or None,
                    "active_ingredients": ingredients,
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
                    "source_name": row["source"].strip(),
                    "source_id": med_id,
                    "source_url": row["source_url"].strip(),
                    "source_version": "2026-09",
                    "retrieved_at": "2026-09-01T00:00:00Z",
                }
                all_records.append(rec)

    # Ingest Expanded Knowledge Base Records
    if normalized_json_path.exists():
        with open(normalized_json_path, "r", encoding="utf-8") as f:
            norm_data = json.load(f)
            for rec in norm_data.get("records", []):
                med_id = rec["medicine_id"]
                if med_id in seen_ids:
                    continue
                seen_ids.add(med_id)
                all_records.append(rec)

    # Insert into SQLite and Indices
    for rec in all_records:
        ing_json = json.dumps(rec["active_ingredients"])
        ing_space = " ".join(rec["active_ingredients"])

        cur.execute("""
            INSERT INTO medicines_master (
                medicine_id, canonical_name, medicine_name, generic_name, brand_name,
                active_ingredients, strength, dosage_form, route, category, manufacturer,
                storage_min_temperature, storage_max_temperature, storage_min_humidity,
                storage_max_humidity, expiry_warning_days, image_class, rxnorm_cui,
                ndc, source_name, source_id, source_url, source_version, retrieved_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec["medicine_id"],
            rec["canonical_name"],
            rec["medicine_name"],
            rec["generic_name"],
            rec.get("brand_name"),
            ing_json,
            rec["strength"],
            rec["dosage_form"],
            rec.get("route"),
            rec["category"],
            rec.get("manufacturer"),
            rec["storage_min_temperature"],
            rec["storage_max_temperature"],
            rec.get("storage_min_humidity"),
            rec.get("storage_max_humidity"),
            rec.get("expiry_warning_days", 60),
            rec.get("image_class"),
            rec.get("rxnorm_cui"),
            rec.get("ndc"),
            rec["source_name"],
            rec.get("source_id"),
            rec["source_url"],
            rec.get("source_version"),
            rec["retrieved_at"],
        ))

        # FTS5 Indexing
        cur.execute("""
            INSERT INTO medicines_fts (
                medicine_id, medicine_name, generic_name, brand_name,
                active_ingredients, strength, dosage_form, manufacturer
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec["medicine_id"],
            rec["medicine_name"],
            rec["generic_name"],
            rec.get("brand_name", "") or "",
            ing_space,
            rec["strength"],
            rec["dosage_form"],
            rec.get("manufacturer", "") or "",
        ))

        # Inverted Ingredient Index
        for ing in rec["active_ingredients"]:
            clean_ing = ing.strip().lower()
            if clean_ing:
                cur.execute("""
                    INSERT OR IGNORE INTO ingredient_index (ingredient, medicine_id)
                    VALUES (?, ?)
                """, (clean_ing, rec["medicine_id"]))

    conn.commit()
    conn.close()

    print(f"Master index successfully built at {output_db_path} with {len(all_records)} verified records.")

    return {
        "total_records": len(all_records),
        "db_path": str(output_db_path),
    }


def re_split_ingredients(generic_name: str) -> List[str]:
    import re
    cleaned = generic_name.lower()
    cleaned = re.sub(r"\b(besylate|hydrochloride|hcl|potassium|sodium|calcium|maleate|sulfate|tartrate|hyclate)\b", "", cleaned)
    parts = re.split(r"[/+;]|\band\b", cleaned)
    return [p.strip() for p in parts if p.strip()]


if __name__ == "__main__":
    build_master_index()
