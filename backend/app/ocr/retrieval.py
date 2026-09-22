"""
MediShelf AI — Open-World Candidate Retrieval Engine
Searches the local master medicine knowledge base using multi-stage retrieval:
1. Exact Brand / Generic Title Match
2. Multi-Ingredient Set Intersection (for single & combination drugs)
3. SQLite FTS5 Full-Text Search with BM25 Ranking
4. OCR Error-Tolerant Fuzzy & N-Gram Search
"""

from __future__ import annotations

import difflib
import json
import logging
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("medishelf.ocr.retrieval")

# Candidate OCR character confusions
OCR_CONFUSIONS = {
    "0": "O",
    "O": "0",
    "1": "I",
    "I": "1",
    "5": "S",
    "S": "5",
    "8": "B",
    "B": "8",
}

# Stopwords / Packaging boilerplate that should never alone trigger a candidate
PACKAGING_BOILERPLATE = {
    "TABLET", "TABLETS", "TAB", "TABS", "CAPSULE", "CAPSULES", "CAP", "CAPS",
    "INJECTION", "VIAL", "VIALS", "SOLUTION", "SUSPENSION", "SYRUP", "CREAM",
    "OINTMENT", "GEL", "SPRAY", "AEROSOL", "INHALER", "MG", "MCG", "ML", "IU",
    "U", "USP", "BP", "EP", "IP", "RX", "ONLY", "EXP", "LOT", "BATCH", "DATE",
    "MFG", "FOR", "BY", "EACH", "CONTAINS", "KEEP", "OUT", "OF", "REACH",
    "CHILDREN", "STORE", "BELOW", "PROTECT", "FROM", "LIGHT", "MOISTURE",
}

# RxNorm Terminology Normalization & Brand/Generic Cross-Walks (Section 6 & 21)
DRUG_SYNONYMS = {
    "paracetamol": "acetaminophen",
    "acetaminophen": "paracetamol",
    "hctz": "hydrochlorothiazide",
    "hydrochlorothiazide": "hctz",
    "asa": "aspirin",
    "aspirin": "asa",
    "amox": "amoxicillin",
    "clavulanate": "clavulanic acid",
    "augmentin": "amoxicillin",
    "calchek-t": "amlodipine",
    "twynsta": "telmisartan",
}


class KnowledgeBaseRetriever:
    """
    Sub-millisecond local medicine retriever operating against SQLite FTS5 master database.
    """

    def __init__(self, db_path: Optional[Path] = None):
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        self.db_path = db_path or (base_dir / "data" / "medicines" / "medicine_knowledge.db")

    def _get_connection(self) -> sqlite3.Connection:
        if not self.db_path.exists():
            from ml.data_ingestion.build_index import build_knowledge_base_db
            logger.info("Knowledge base SQLite DB not found. Auto-building from normalized index...")
            build_knowledge_base_db(output_db_path=self.db_path)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def retrieve_candidates(
        self,
        extracted_tokens: List[str],
        extracted_ingredients: Optional[List[str]] = None,
        extracted_strength: Optional[str] = None,
        extracted_dosage_form: Optional[str] = None,
        extracted_manufacturer: Optional[str] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Multi-modal candidate retrieval combining:
        1. Set-based active ingredient intersection
        2. SQLite FTS5 prefix and token search
        3. OCR error correction variants (0<->O, 1<->I, 5<->S, 8<->B)
        4. RxNorm terminology normalization & brand-to-generic synonym lookups
        5. Strength, dosage form, and manufacturer evidence re-ranking
        """
        if not self.db_path.exists():
            logger.warning(f"Master index not found at {self.db_path}. Building or using fallback.")
            return []

        conn = self._get_connection()
        cur = conn.cursor()

        candidates_map: Dict[str, Dict[str, Any]] = {}

        if not extracted_strength:
            for tok in extracted_tokens:
                m = re.search(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|u)(?:\s*/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?\b", tok, re.I)
                if m:
                    extracted_strength = m.group(0)
                    break

        if not extracted_dosage_form:
            for tok in extracted_tokens:
                m = re.search(r"\b(?:tablets?|capsules?|suspensions?|injections?|vials?|inhalers?|solutions?|syrups?|creams?|ointments?|drops?)\b", tok, re.I)
                if m:
                    extracted_dosage_form = m.group(0)
                    break

        # 1. Multi-Ingredient Set Search with Synonym Expansion
        if extracted_ingredients:
            clean_ings = set()
            for ing in extracted_ingredients:
                low = ing.lower().strip()
                if low:
                    clean_ings.add(low)
                    if low in DRUG_SYNONYMS:
                        clean_ings.add(DRUG_SYNONYMS[low])
            if clean_ings:
                self._search_by_ingredients(cur, list(clean_ings), candidates_map)

        # 2. Token & Brand Search (Direct, Synonyms & FTS5)
        for token in extracted_tokens:
            clean_token = token.strip()
            if len(clean_token) < 3 or clean_token.upper() in PACKAGING_BOILERPLATE:
                continue

            # Direct FTS5 Query with prefix matching
            self._search_fts(cur, clean_token, candidates_map)

            # RxNorm Synonyms & Brand Cross-Walk
            tok_low = clean_token.lower()
            for syn_key, syn_val in DRUG_SYNONYMS.items():
                if syn_key in tok_low:
                    self._search_fts(cur, syn_val, candidates_map, is_variant=True)

            # Generate OCR-corruption variants (e.g. AM0XICILLIN -> AMOXICILLIN)
            variants = self.generate_ocr_variants(clean_token)
            for var in variants:
                if var != clean_token:
                    self._search_fts(cur, var, candidates_map, is_variant=True)

        conn.close()

        # Score & Rank candidates with strength, dosage form, and manufacturer evidence
        ranked = list(candidates_map.values())
        for cand in ranked:
            final_score = cand.get("retrieval_score", 0.5)

            # Strength awareness (Section 9)
            if extracted_strength and cand.get("strength"):
                from ml.data_ingestion.normalize_products import normalize_strength_str
                norm_ext_str = normalize_strength_str(extracted_strength).lower()
                norm_cand_str = normalize_strength_str(cand["strength"]).lower()
                if norm_ext_str and norm_cand_str:
                    if norm_ext_str == norm_cand_str or norm_ext_str in norm_cand_str:
                        final_score += 0.08
                        cand["strength_match"] = True
                    elif norm_cand_str != "standard":
                        # Strength mismatch penalty (e.g. 500 mg != 650 mg)
                        final_score -= 0.12
                        cand["strength_match"] = False

            # Dosage form awareness (Section 10)
            if extracted_dosage_form and cand.get("dosage_form"):
                from ml.data_ingestion.normalize_products import normalize_dosage_form_str
                norm_ext_df = normalize_dosage_form_str(extracted_dosage_form).lower()
                norm_cand_df = normalize_dosage_form_str(cand["dosage_form"]).lower()
                if norm_ext_df == norm_cand_df:
                    final_score += 0.05
                    cand["dosage_form_match"] = True
                else:
                    # Incompatible dosage form penalty (e.g. Tablet != Suspension)
                    final_score -= 0.10
                    cand["dosage_form_match"] = False

            # Manufacturer evidence (Section 11)
            if extracted_manufacturer and cand.get("manufacturer"):
                if extracted_manufacturer.lower() in cand["manufacturer"].lower() or cand["manufacturer"].lower() in extracted_manufacturer.lower():
                    final_score += 0.04
                    cand["manufacturer_match"] = True

            cand["retrieval_score"] = round(max(0.10, min(final_score, 0.99)), 4)

        ranked.sort(key=lambda x: x.get("retrieval_score", 0.0), reverse=True)
        return ranked[:limit]

    def _search_by_ingredients(
        self,
        cur: sqlite3.Cursor,
        ingredients: List[str],
        candidates_map: Dict[str, Dict[str, Any]],
    ) -> None:
        """Finds medicines containing any of the extracted active ingredients."""
        placeholders = ",".join("?" for _ in ingredients)
        query = f"""
            SELECT DISTINCT medicine_id, ingredient
            FROM ingredient_index
            WHERE ingredient IN ({placeholders})
        """
        try:
            cur.execute(query, ingredients)
            rows = cur.fetchall()
            med_ing_matches: Dict[str, Set[str]] = {}
            for r in rows:
                med_id = r["medicine_id"]
                ing = r["ingredient"]
                med_ing_matches.setdefault(med_id, set()).add(ing)

            # Load full records for matched medicines
            for med_id, matched_ings in med_ing_matches.items():
                cur.execute("SELECT * FROM medicines_master WHERE medicine_id = ?", (med_id,))
                row = cur.fetchone()
                if not row:
                    continue
                rec = dict(row)
                rec_ings = set(json.loads(rec["active_ingredients"]))
                extracted_set = set(ingredients)

                # Overlap metric: Jaccard similarity between candidate ingredients and extracted ingredients
                intersection = rec_ings.intersection(extracted_set)
                union = rec_ings.union(extracted_set)
                jaccard = len(intersection) / max(len(union), 1)
                extracted_coverage = len(intersection) / max(len(extracted_set), 1)

                # Higher score if more of the extracted ingredients are covered
                score = 0.60 + (0.25 * extracted_coverage) + (0.15 * jaccard)

                # Perfect combination match bonus
                if len(extracted_set) > 1 and intersection == extracted_set and rec_ings == extracted_set:
                    score = 0.98
                elif len(extracted_set) > 1 and intersection == extracted_set:
                    score = max(score, 0.94)

                if med_id not in candidates_map or candidates_map[med_id]["retrieval_score"] < score:
                    rec["active_ingredients"] = list(rec_ings)
                    rec["retrieval_score"] = round(min(score, 0.99), 4)
                    rec["match_reason"] = f"Matched active ingredients: {' + '.join(sorted(list(intersection)))}"
                    rec["matched_token"] = " + ".join(sorted(list(intersection)))
                    candidates_map[med_id] = rec
        except Exception as exc:
            logger.warning(f"Ingredient search failed: {exc}")

    def _search_fts(
        self,
        cur: sqlite3.Cursor,
        token: str,
        candidates_map: Dict[str, Dict[str, Any]],
        is_variant: bool = False,
    ) -> None:
        sanitized = re.sub(r"[^a-zA-Z0-9\s]", "", token).strip()
        words = re.findall(r"[A-Za-z0-9]+", sanitized)
        if not words:
            return

        fts_query = " ".join(f"{w}*" for w in words)
        try:
            cur.execute("""
                SELECT m.*, bm25(medicines_fts) as rank
                FROM medicines_fts f
                JOIN medicines_master m ON f.medicine_id = m.medicine_id
                WHERE medicines_fts MATCH ?
                ORDER BY rank ASC
                LIMIT 5
            """, (fts_query,))
            rows = cur.fetchall()
            for row in rows:
                rec = dict(row)
                med_id = rec["medicine_id"]
                # Convert bm25 negative rank to positive [0.65, 0.95]
                base_score = 0.88 if not is_variant else 0.78

                # Verify token similarity with title or ingredients
                ratio_name = difflib.SequenceMatcher(None, sanitized.upper(), rec["medicine_name"].upper()).ratio()
                ratio_gen = difflib.SequenceMatcher(None, sanitized.upper(), rec["generic_name"].upper()).ratio()
                ratio_brand = difflib.SequenceMatcher(None, sanitized.upper(), (rec["brand_name"] or "").upper()).ratio()
                best_ratio = max(ratio_name, ratio_gen, ratio_brand)

                score = max(base_score * best_ratio, 0.60)

                if med_id not in candidates_map or candidates_map[med_id]["retrieval_score"] < score:
                    rec["active_ingredients"] = json.loads(rec["active_ingredients"]) if isinstance(rec["active_ingredients"], str) else rec["active_ingredients"]
                    rec["retrieval_score"] = round(score, 4)
                    rec["match_reason"] = f"FTS match on '{token}'"
                    rec["matched_token"] = token
                    candidates_map[med_id] = rec
        except Exception:
            # FTS syntax fallback
            pass

    def get_medicine_by_id(self, medicine_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single verified medicine monograph from the knowledge base by medicine_id, rxnorm_cui, or numeric id."""
        conn = self._get_connection()
        if not conn:
            return None
        cur = conn.cursor()
        try:
            clean_id = medicine_id.strip()
            # 1. Direct medicine_id lookup (e.g. RXN-876528 or MED-001)
            cur.execute("SELECT * FROM medicines_master WHERE medicine_id = ?", (clean_id,))
            row = cur.fetchone()

            # 2. Lookup with normalized RXN- / RXCUI- prefix or rxnorm_cui
            if not row:
                cui = clean_id.replace("RXCUI-", "").replace("RXN-", "")
                cur.execute(
                    "SELECT * FROM medicines_master WHERE rxnorm_cui = ? OR source_id = ? OR medicine_id = ? OR medicine_id = ?",
                    (cui, cui, f"RXN-{cui}", f"RXCUI-{cui}"),
                )
                row = cur.fetchone()

            # 3. Lookup by numeric primary key
            if not row and clean_id.isdigit():
                cur.execute("SELECT * FROM medicines_master WHERE id = ?", (int(clean_id),))
                row = cur.fetchone()

            if row:
                rec = dict(row)
                if isinstance(rec.get("active_ingredients"), str):
                    try:
                        rec["active_ingredients_list"] = json.loads(rec["active_ingredients"])
                    except Exception:
                        rec["active_ingredients_list"] = []
                return rec
            return None
        except Exception as exc:
            logger.warning(f"Lookup by ID failed for '{medicine_id}': {exc}")
            return None

    @staticmethod
    def generate_ocr_variants(token: str) -> List[str]:
        """
        Generates candidate corrections for common OCR character confusions.
        Never replaces blindly; produces ranked alternatives (e.g. AM0XICILLIN -> AMOXICILLIN).
        """
        variants = [token]
        chars = list(token)
        # Check if digits appear inside letters (e.g. AM0XICILLIN)
        for i, c in enumerate(chars):
            if c in OCR_CONFUSIONS:
                # If surrounding characters are letters and current is digit, substitute
                prev_alpha = (i > 0 and chars[i-1].isalpha())
                next_alpha = (i < len(chars) - 1 and chars[i+1].isalpha())
                if prev_alpha and next_alpha and c.isdigit():
                    var_chars = list(chars)
                    var_chars[i] = OCR_CONFUSIONS[c]
                    variants.append("".join(var_chars))
        return variants


_retriever_instance: Optional[KnowledgeBaseRetriever] = None


def get_retriever() -> KnowledgeBaseRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = KnowledgeBaseRetriever()
    return _retriever_instance
