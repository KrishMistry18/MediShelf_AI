"""
MediShelf AI — Unified Medicine Resolution Layer
Provides a single authoritative resolution mechanism for medicines across:
1. Curated Local Catalog (MED-001 to MED-025)
2. Open-World Master Knowledge Base (RxNorm, DailyMed, openFDA)
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.medicine import Medicine
from app.ocr.retrieval import get_retriever
from app.schemas.medicine import MedicineResponse

logger = logging.getLogger("medishelf.services.medicine")


class MedicineResolutionService:
    """
    Architectural single point of truth for medicine identity and specification.
    Guarantees seamless resolution regardless of whether a medicine is from
    the foundational catalog or the expanded open-world knowledge base.
    """

    def __init__(self):
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        self.kb_db_path = base_dir / "data" / "medicines" / "medicine_knowledge.db"

    def _convert_kb_row_to_response(self, rec: Dict[str, Any]) -> MedicineResponse:
        """Converts an open-world master knowledge row into a normalized MedicineResponse schema."""
        retrieved_dt: Optional[datetime] = None
        if rec.get("retrieved_at"):
            try:
                retrieved_dt = datetime.fromisoformat(str(rec["retrieved_at"]).replace("Z", "+00:00"))
            except Exception:
                retrieved_dt = datetime.now(timezone.utc)
        else:
            retrieved_dt = datetime.now(timezone.utc)

        # Ensure active_ingredients is a JSON string
        active_ings = rec.get("active_ingredients")
        if isinstance(active_ings, list):
            active_ings_str = json.dumps(active_ings)
        elif isinstance(active_ings, str):
            active_ings_str = active_ings
        else:
            active_ings_str = "[]"

        # Handle temperature bounds (nullable for purely qualitative records)
        min_temp = float(rec["storage_min_temperature"]) if rec.get("storage_min_temperature") is not None else None
        max_temp = float(rec["storage_max_temperature"]) if rec.get("storage_max_temperature") is not None else None
        min_hum = float(rec["storage_min_humidity"]) if rec.get("storage_min_humidity") is not None else None
        max_hum = float(rec["storage_max_humidity"]) if rec.get("storage_max_humidity") is not None else None

        # Normalize canonical source name (NLM RxNorm, FDA DailyMed, openFDA)
        raw_source = rec.get("source_name") or rec.get("source") or ""
        raw_source_clean = raw_source.strip()
        if raw_source_clean in {"RxNorm", "NLM RxNorm"}:
            canonical_source = "NLM RxNorm"
        elif raw_source_clean in {"DailyMed", "FDA DailyMed"}:
            canonical_source = "FDA DailyMed"
        elif raw_source_clean.lower() == "openfda":
            canonical_source = "openFDA"
        elif raw_source_clean:
            canonical_source = raw_source_clean
        else:
            canonical_source = "NLM RxNorm / FDA DailyMed"

        return MedicineResponse(
            id=int(rec.get("id") or 99999),
            medicine_id=rec["medicine_id"],
            medicine_name=rec["medicine_name"],
            generic_name=rec["generic_name"],
            brand_name=rec.get("brand_name"),
            strength=rec.get("strength") or "Standard",
            dosage_form=rec.get("dosage_form") or "Tablet",
            category=rec.get("category") or "General Medicine",
            manufacturer=rec.get("manufacturer"),
            storage_min_temperature=min_temp,
            storage_max_temperature=max_temp,
            storage_min_humidity=min_hum,
            storage_max_humidity=max_hum,
            expiry_warning_days=int(rec.get("expiry_warning_days") or 60),
            image_class=rec.get("image_class"),
            canonical_name=rec.get("canonical_name") or rec["medicine_name"],
            active_ingredients=active_ings_str,
            route=rec.get("route"),
            rxnorm_cui=rec.get("rxnorm_cui"),
            ndc=rec.get("ndc"),
            source=canonical_source,
            source_id=rec.get("source_id"),
            source_url=rec.get("source_url") or "https://dailymed.nlm.nih.gov/",
            source_version=rec.get("source_version") or "2026-09",
            retrieved_at=retrieved_dt,
            created_at=retrieved_dt,
            updated_at=retrieved_dt,
        )

    def resolve_medicine(
        self,
        identifier: str,
        db: Optional[Session] = None,
    ) -> Optional[MedicineResponse]:
        """
        Resolves any medicine identifier into a normalized MedicineResponse.
        Checks:
        1. Local catalog database (exact, case-insensitive, or numeric PK)
        2. Master knowledge base SQLite store (medicine_id, source_id, rxnorm_cui, ndc)
        """
        if not identifier or not identifier.strip():
            return None

        clean_id = identifier.strip()

        # 1. Search in local catalog DB if session provided
        if db is not None:
            # Case-insensitive medicine_id match
            cat_row = (
                db.query(Medicine)
                .filter(func.lower(Medicine.medicine_id) == clean_id.lower())
                .first()
            )
            if not cat_row and clean_id.isdigit():
                cat_row = db.query(Medicine).filter(Medicine.id == int(clean_id)).first()

            if cat_row:
                return MedicineResponse.model_validate(cat_row)

        # 2. Search in master knowledge base SQLite database
        kb_rec = get_retriever().get_medicine_by_id(clean_id)
        if kb_rec:
            return self._convert_kb_row_to_response(kb_rec)

        # Fallback with case-insensitive / source-id search in knowledge base DB directly
        if self.kb_db_path.exists():
            try:
                conn = sqlite3.connect(self.kb_db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                # Try case-insensitive medicine_id or source_id
                cur.execute(
                    """
                    SELECT * FROM medicines_master
                    WHERE LOWER(medicine_id) = LOWER(?)
                       OR LOWER(source_id) = LOWER(?)
                       OR LOWER(rxnorm_cui) = LOWER(?)
                       OR LOWER(ndc) = LOWER(?)
                    LIMIT 1
                    """,
                    (clean_id, clean_id, clean_id, clean_id),
                )
                row = cur.fetchone()
                conn.close()
                if row:
                    return self._convert_kb_row_to_response(dict(row))
            except Exception as exc:
                logger.warning(f"Direct SQLite KB lookup failed for '{clean_id}': {exc}")

        return None

    def search_medicines(
        self,
        query: str,
        limit: int = 10,
        db: Optional[Session] = None,
    ) -> List[MedicineResponse]:
        """
        Searches medicines across both local catalog and master open-world index.
        Deduplicates by medicine_id, ordering local catalog matches first.
        """
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        results: List[MedicineResponse] = []
        seen_ids = set()

        # 1. Query local catalog
        if db is not None:
            term = f"%{clean_query}%"
            catalog_rows = (
                db.query(Medicine)
                .filter(
                    or_(
                        Medicine.medicine_name.ilike(term),
                        Medicine.generic_name.ilike(term),
                        Medicine.brand_name.ilike(term),
                        Medicine.medicine_id.ilike(term),
                        Medicine.canonical_name.ilike(term),
                    )
                )
                .order_by(Medicine.medicine_name.asc())
                .limit(limit)
                .all()
            )
            for row in catalog_rows:
                seen_ids.add(row.medicine_id.lower())
                results.append(MedicineResponse.model_validate(row))

        # 2. Query open-world knowledge base
        remaining = limit - len(results)
        if remaining > 0 and self.kb_db_path.exists():
            try:
                conn = sqlite3.connect(self.kb_db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                search_term = f"%{clean_query}%"
                cur.execute(
                    """
                    SELECT * FROM medicines_master
                    WHERE canonical_name LIKE ?
                       OR medicine_name LIKE ?
                       OR generic_name LIKE ?
                       OR brand_name LIKE ?
                       OR active_ingredients LIKE ?
                       OR medicine_id LIKE ?
                    ORDER BY CASE WHEN medicine_id LIKE ? THEN 0 ELSE 1 END, canonical_name ASC
                    LIMIT ?
                    """,
                    (search_term, search_term, search_term, search_term, search_term, search_term, f"{clean_query}%", limit * 2),
                )
                rows = cur.fetchall()
                conn.close()

                for row in rows:
                    rec = dict(row)
                    med_id = rec["medicine_id"].lower()
                    if med_id not in seen_ids:
                        seen_ids.add(med_id)
                        results.append(self._convert_kb_row_to_response(rec))
                        if len(results) >= limit:
                            break
            except Exception as exc:
                logger.warning(f"KB search failed for '{clean_query}': {exc}")

        return results

    def list_medicines_paginated(
        self,
        page: int = 1,
        page_size: int = 10,
        category: Optional[str] = None,
        search: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Tuple[List[MedicineResponse], int, int]:
        """
        Retrieves paginated medicines across the master knowledge base (27,326+ records).
        Filters by category and/or text search.
        Orders foundation monographs first, then alphabetically by canonical name.
        """
        import math

        page = max(1, page)
        page_size = max(1, min(100, page_size))
        offset = (page - 1) * page_size

        if self.kb_db_path.exists():
            try:
                conn = sqlite3.connect(self.kb_db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                conditions = []
                params = []

                if category and category.strip() and category.strip().upper() != "ALL":
                    conditions.append("category = ?")
                    params.append(category.strip())

                if search and search.strip():
                    term = search.strip()
                    conditions.append(
                        "(canonical_name LIKE ? OR medicine_name LIKE ? OR generic_name LIKE ? OR brand_name LIKE ? OR medicine_id LIKE ?)"
                    )
                    like_term = f"%{term}%"
                    params.extend([like_term, like_term, like_term, like_term, f"{term}%"])

                where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

                # Total count
                cur.execute(f"SELECT COUNT(*) FROM medicines_master {where_clause}", params)
                total = cur.fetchone()[0]

                total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1

                # Page items
                items_query = f"""
                    SELECT * FROM medicines_master
                    {where_clause}
                    ORDER BY CASE WHEN medicine_id LIKE 'MED-%' THEN 0 ELSE 1 END, canonical_name ASC
                    LIMIT ? OFFSET ?
                """
                cur.execute(items_query, params + [page_size, offset])
                rows = cur.fetchall()
                conn.close()

                items = [self._convert_kb_row_to_response(dict(r)) for r in rows]
                return items, total, total_pages
            except Exception as exc:
                logger.warning(f"Error querying KB for list_medicines: {exc}")

        # Fallback to SQL DB if session provided
        if db is not None:
            query = db.query(Medicine)
            if category and category.strip() and category.strip().upper() != "ALL":
                query = query.filter(Medicine.category == category.strip())
            if search and search.strip():
                term = f"%{search.strip()}%"
                query = query.filter(
                    or_(
                        Medicine.medicine_name.ilike(term),
                        Medicine.generic_name.ilike(term),
                        Medicine.brand_name.ilike(term),
                        Medicine.medicine_id.ilike(term),
                    )
                )
            total = query.count()
            import math
            total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1
            items = [
                MedicineResponse.model_validate(r)
                for r in query.order_by(Medicine.medicine_name.asc()).offset(offset).limit(page_size).all()
            ]
            return items, total, total_pages

        return [], 0, 1

    def get_category_counts(self, db: Optional[Session] = None) -> List[Any]:
        """Returns distinct categories and counts across the master knowledge base."""
        from app.schemas.medicine import CategoryCount

        if self.kb_db_path.exists():
            try:
                conn = sqlite3.connect(self.kb_db_path)
                cur = conn.cursor()
                cur.execute("""
                    SELECT category, COUNT(*) as cnt
                    FROM medicines_master
                    WHERE category IS NOT NULL AND category != ''
                    GROUP BY category
                    ORDER BY cnt DESC, category ASC
                """)
                rows = cur.fetchall()
                conn.close()
                return [CategoryCount(category=r[0], count=r[1]) for r in rows if r[0]]
            except Exception as exc:
                logger.warning(f"Error querying KB for categories: {exc}")

        if db is not None:
            rows = (
                db.query(Medicine.category, func.count(Medicine.id).label("count"))
                .group_by(Medicine.category)
                .order_by(func.count(Medicine.id).desc())
                .all()
            )
            return [CategoryCount(category=row[0], count=row[1]) for row in rows]

        return []


# Global singleton
medicine_resolution_service = MedicineResolutionService()
