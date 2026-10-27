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
    "rifampicin": "rifampin",
    "rifampin": "rifampicin",
    "salbutamol": "albuterol",
    "albuterol": "salbutamol",
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
        extracted_release_type: Optional[str] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Multi-modal candidate retrieval combining:
        1. Set-based active ingredient intersection with asymmetry penalties
        2. SQLite FTS5 prefix and token search
        3. OCR error correction variants (0<->O, 1<->I, 5<->S, 8<->B)
        4. RxNorm terminology normalization & brand-to-generic synonym lookups
        5. Strength, dosage form, release type, and manufacturer evidence re-ranking
        """
        if not self.db_path.exists():
            logger.warning(f"Master index not found at {self.db_path}. Building or using fallback.")
            return []

        conn = self._get_connection()
        cur = conn.cursor()

        candidates_map: Dict[str, Dict[str, Any]] = {}

        if not extracted_strength:
            for tok in extracted_tokens:
                m = re.search(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|u)(?:\s*(?:/|\bper\b)\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?\b", tok, re.I)
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

            # Skip if token is purely numbers and packaging boilerplate units (e.g. "500 ML", "500 mg", "100 tabs")
            letters = re.findall(r"[A-Za-z]{2,}", clean_token)
            if not letters or all(w.upper() in PACKAGING_BOILERPLATE for w in letters):
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

        # Score & Rank candidates with strength, dosage form, release profile, and manufacturer evidence
        ranked = list(candidates_map.values())
        for cand in ranked:
            final_score = cand.get("retrieval_score", 0.5)

            # Strength awareness (Section 9)
            if extracted_strength and cand.get("strength"):
                from ml.data_ingestion.normalize_products import normalize_strength_str
                norm_ext_str = normalize_strength_str(extracted_strength).lower()
                norm_cand_str = normalize_strength_str(cand["strength"]).lower()
                if norm_ext_str and norm_cand_str:
                    if norm_ext_str == norm_cand_str:
                        final_score += 0.15
                        cand["strength_match"] = True
                    elif "/" in norm_cand_str and norm_ext_str in norm_cand_str:
                        # Candidate is combination strength; if query was single-ingredient, penalize combination
                        cand_ings = cand.get("active_ingredients", [])
                        if len(cand_ings) > 1 and extracted_ingredients and len(extracted_ingredients) == 1:
                            final_score -= 0.25
                            cand["strength_match"] = False
                        else:
                            final_score += 0.05
                            cand["strength_match"] = True
                    elif norm_cand_str != "standard":
                        # Strength mismatch penalty (e.g. 500 mg != 650 mg or 160 mg != 500 mg)
                        final_score -= 0.25
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
                    final_score -= 0.20
                    cand["dosage_form_match"] = False

            # Release profile awareness (SR, ER, XR, CR, DR vs IR)
            if extracted_release_type:
                cand_name_low = f"{cand.get('medicine_name', '')} {cand.get('dosage_form', '')}".lower()
                is_sr = any(tag in cand_name_low for tag in ["extended", "sustained", "delayed", "controlled", "sr", "er", "xr", "cr", "dr"])
                if extracted_release_type in ["SR", "ER", "XR", "CR", "DR"]:
                    if is_sr:
                        final_score += 0.08
                        cand["release_type_match"] = True
                    else:
                        final_score -= 0.20
                        cand["release_type_match"] = False
                elif extracted_release_type == "IR":
                    if is_sr:
                        final_score -= 0.20
                        cand["release_type_match"] = False
                    else:
                        cand["release_type_match"] = True

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
        """Finds medicines containing any of the extracted active ingredients, with asymmetric penalties."""
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

                intersection = rec_ings.intersection(extracted_set)
                cand_coverage = len(intersection) / max(len(rec_ings), 1)
                ext_coverage = len(intersection) / max(len(extracted_set), 1)
                extra_ings = rec_ings - extracted_set
                missing_ings = extracted_set - rec_ings

                # Exact ingredient set match (both single and combination)
                if rec_ings == extracted_set:
                    if len(extracted_set) > 1:
                        score = 0.98
                    else:
                        score = 0.92
                else:
                    # Incomplete or over-complete candidate:
                    score = 0.50 + (0.25 * cand_coverage) + (0.15 * ext_coverage)
                    # Heavy penalties for unmentioned extra ingredients or missing required ingredients
                    score -= (0.20 * len(extra_ings))
                    score -= (0.20 * len(missing_ings))
                    score = max(0.10, score)

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
        words = [w for w in re.findall(r"[A-Za-z0-9]+", sanitized) if w.upper() not in PACKAGING_BOILERPLATE and not w.isdigit()]
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
                LIMIT 25
            """, (fts_query,))
            rows = cur.fetchall()
            for row in rows:
                rec = dict(row)
                med_id = rec["medicine_id"]
                # Convert bm25 negative rank to positive [0.65, 0.95]
                base_score = 0.88 if not is_variant else 0.82

                # Verify token similarity with title, generic, or brand at word level
                def _word_sim(target_text: Optional[str]) -> float:
                    if not target_text:
                        return 0.0
                    target_words = re.findall(r"[A-Za-z0-9]+", target_text.upper())
                    if not target_words:
                        return 0.0
                    tok_u = sanitized.upper()
                    if tok_u in target_words:
                        return 1.0
                    if len(tok_u) >= 4 and any(tok_u in tw or tw in tok_u for tw in target_words if len(tw) >= 4):
                        return 0.95
                    return max(difflib.SequenceMatcher(None, tok_u, tw).ratio() for tw in target_words)

                sim_name = _word_sim(rec["medicine_name"])
                sim_gen = _word_sim(rec["generic_name"])
                sim_brand = _word_sim(rec["brand_name"])
                best_sim = max(sim_name, sim_gen, sim_brand)

                if best_sim < 0.45:
                    continue

                score = base_score * best_sim

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


SALT_WORDS = {
    "besylate", "hydrochloride", "hcl", "maleate", "tartrate", "succinate",
    "fumarate", "potassium", "sodium", "calcium", "phosphate", "sulfate",
    "sulphate", "valerate", "dipropionate", "acetate", "hydrate", "monohydrate",
    "dihydrate", "trihydrate", "sesquihydrate", "disodium", "dipotassium", "mesylate", "camsylate"
}

CANONICAL_DRUGS = {
    "paracetamol": "acetaminophen",
    "acetaminophen": "acetaminophen",
    "hctz": "hydrochlorothiazide",
    "hydrochlorothiazide": "hydrochlorothiazide",
    "asa": "aspirin",
    "aspirin": "aspirin",
    "amox": "amoxicillin",
    "amoxicillin": "amoxicillin",
    "clavulanate": "clavulanic acid",
    "clavulanic acid": "clavulanic acid",
    "calchek-t": "amlodipine",
    "twynsta": "telmisartan",
    "rifampicin": "rifampin",
    "rifampin": "rifampin",
    "salbutamol": "albuterol",
    "albuterol": "albuterol",
}


def clean_drug_ingredient(name: str) -> str:
    if not name:
        return ""
    tokens = re.split(r"[\s\-_/]+", name.lower().strip())
    filtered = [t for t in tokens if t and t not in SALT_WORDS]
    clean = " ".join(filtered) if filtered else name.lower().strip()
    return CANONICAL_DRUGS.get(clean, DRUG_SYNONYMS.get(clean, clean))


def parse_ingredient_tokens(val: Any) -> List[str]:
    if not val:
        return []
    raw_list: List[str] = []
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                raw_list = [str(x) for x in parsed]
            else:
                raw_list = [val]
        except Exception:
            parts = re.split(r"[/+,;&]|\band\b", val)
            raw_list = [p.strip() for p in parts if p.strip()]
    elif isinstance(val, (list, tuple, set)):
        for item in val:
            if isinstance(item, str):
                parts = re.split(r"[/+,;&]|\band\b", item)
                raw_list.extend(p.strip() for p in parts if p.strip())
            elif item is not None:
                raw_list.append(str(item))

    cleaned = []
    for item in raw_list:
        c = clean_drug_ingredient(item)
        if c:
            cleaned.append(c)
    return cleaned


def check_exact_product_match(
    candidate: Any,
    extracted_ingredients: Optional[List[str]],
    extracted_strength: Optional[str],
    extracted_dosage_form: Optional[str],
    extracted_release_type: Optional[str] = None,
) -> Tuple[bool, List[str]]:
    """
    Deterministic gate that evaluates whether a candidate record satisfies the strict
    exact-match requirements for IDENTIFIED status.

    Checks:
    1. Active Ingredient Completeness: candidate must contain all extracted ingredients and NO extra unmentioned ingredients.
    2. Strength Equivalence: normalized candidate strength must match extracted packaging strength.
    3. Dosage Form Compatibility: candidate dosage form must match extracted packaging dosage form.
    4. Release Profile Compatibility: sustained release (SR/ER/CR/DR) must not be confirmed as immediate release.
    """
    from ml.data_ingestion.normalize_products import normalize_strength_str, normalize_dosage_form_str

    reasons: List[str] = []

    def _cand_val(field: str, default: Any = None) -> Any:
        if isinstance(candidate, dict):
            val = candidate.get(field, default)
        else:
            val = getattr(candidate, field, default)
        return val if val is not None else default

    cand_name = str(_cand_val("medicine_name", "") or "")
    cand_str = str(_cand_val("strength", "") or "")
    cand_df = str(_cand_val("dosage_form", "") or "")
    cand_ings = _cand_val("active_ingredients", [])

    cand_tokens = parse_ingredient_tokens(cand_ings)
    if not cand_tokens:
        cand_generic = str(_cand_val("generic_name", "") or cand_name)
        cand_tokens = parse_ingredient_tokens(cand_generic)

    cand_set = set(cand_tokens)

    # 1. Ingredient set comparison
    if extracted_ingredients:
        ext_tokens = parse_ingredient_tokens(extracted_ingredients)
        ext_set = set(ext_tokens)

        if ext_set and cand_set:
            missing = ext_set - cand_set
            extra = cand_set - ext_set

            if missing:
                reasons.append(f"Missing active ingredient(s) on candidate: {', '.join(sorted(list(missing)))}")
            if extra:
                reasons.append(f"Candidate contains unmentioned active ingredient(s): {', '.join(sorted(list(extra)))}")
        elif ext_set and not cand_set:
            reasons.append("Candidate active ingredients unknown or incomplete")

    # 2. Strength comparison
    if extracted_strength and cand_str:
        norm_ext_str = normalize_strength_str(extracted_strength).lower()
        norm_cand_str = normalize_strength_str(cand_str).lower()
        if norm_ext_str and norm_cand_str and norm_cand_str != "standard":
            if norm_ext_str != norm_cand_str:
                reasons.append(f"Strength mismatch: packaging '{extracted_strength}' vs catalog '{cand_str}'")

    # 3. Dosage form comparison
    if extracted_dosage_form and cand_df:
        norm_ext_df = normalize_dosage_form_str(extracted_dosage_form).lower()
        norm_cand_df = normalize_dosage_form_str(cand_df).lower()
        if norm_ext_df and norm_cand_df and norm_ext_df != norm_cand_df:
            reasons.append(f"Dosage form mismatch: packaging '{extracted_dosage_form}' vs catalog '{cand_df}'")

    # 4. Release profile comparison
    if extracted_release_type:
        cand_text = f" {cand_name} {cand_df} ".lower()
        is_sr = bool(re.search(r"\b(extended|sustained|delayed|controlled|sr|er|xr|cr|dr)\b", cand_text, re.IGNORECASE))
        if extracted_release_type in ["SR", "ER", "XR", "CR", "DR"] and not is_sr:
            reasons.append(f"Release profile mismatch: packaging '{extracted_release_type}' vs immediate-release candidate")
        elif extracted_release_type == "IR" and is_sr:
            reasons.append("Release profile mismatch: packaging immediate-release vs extended-release candidate")

    is_exact = len(reasons) == 0
    return is_exact, reasons


_retriever_instance: Optional[KnowledgeBaseRetriever] = None


def get_retriever() -> KnowledgeBaseRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = KnowledgeBaseRetriever()
    return _retriever_instance
