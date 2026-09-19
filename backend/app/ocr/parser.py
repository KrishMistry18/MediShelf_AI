import re
import difflib
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session

from app.models.medicine import Medicine
from app.ocr.schemas import (
    CandidateMatch,
    ConfidenceBreakdown,
    ExtractedField,
    OCRTextLine,
    StructuredFields,
)

# ---------------------------------------------------------------------------
# Regex Patterns
# ---------------------------------------------------------------------------

# Expiry date patterns
EXPIRY_PATTERNS = [
    # 0: Day / Month / Year (3 components: e.g. 15/08/2027)
    re.compile(r"(?:EXP(?:IRY)?|EXP\s*DATE|USE\s*(?:BY|BEFORE)|BEST\s*BEFORE)[\s.:/–-]*([0-9]{1,2})[/\-–.]([0-9]{1,2})[/\-–.]([0-9]{2,4})", re.IGNORECASE),
    # 1: MM/YYYY or MM-YYYY with keyword (e.g. 08/2027)
    re.compile(r"(?:EXP(?:IRY)?|EXP\s*DATE|USE\s*(?:BY|BEFORE)|BEST\s*BEFORE)[\s.:/–-]*([0-9]{1,2})[/\-–.]([0-9]{4})\b", re.IGNORECASE),
    # 2: YYYY/MM with keyword (e.g. 2027-08)
    re.compile(r"(?:EXP(?:IRY)?|EXP\s*DATE|USE\s*(?:BY|BEFORE)|BEST\s*BEFORE)[\s.:/–-]*([0-9]{4})[/\-–.]([0-9]{1,2})\b", re.IGNORECASE),
    # 3: MM/YY with keyword (e.g. 08/27) - ensure not followed by another slash/dash + digits
    re.compile(r"(?:EXP(?:IRY)?|EXP\s*DATE|USE\s*(?:BY|BEFORE))[\s.:/–-]*([0-9]{1,2})[/\-–.]([0-9]{2})(?![/\-–.]\d)\b", re.IGNORECASE),
    # 4: Standalone MM/YYYY
    re.compile(r"\b(0[1-9]|1[0-2])[/\-–.](20[2-3][0-9])\b"),
    # 5: Standalone YYYY/MM
    re.compile(r"\b(20[2-3][0-9])[/\-–.](0[1-9]|1[0-2])\b"),
    # 6: Standalone MM/YY (e.g. 08/27, 08-27)
    re.compile(r"\b(0[1-9]|1[0-2])[/\-–.](2[5-9]|3[0-9])(?![/\-–.]\d)\b"),
]

# Manufacturing date patterns
MFG_PATTERNS = [
    re.compile(r"(?:MFG(?:DATE)?|MFR|PROD(?:UCTION)?|DOM)[\s.:/–-]*([0-9]{1,2})[/\-–.]([0-9]{4})", re.IGNORECASE),
    re.compile(r"(?:MFG(?:DATE)?|MFR|PROD(?:UCTION)?|DOM)[\s.:/–-]*([0-9]{4})[/\-–.]([0-9]{1,2})", re.IGNORECASE),
    re.compile(r"(?:MFG(?:DATE)?|MFR|PROD(?:UCTION)?|DOM)[\s.:/–-]*([0-9]{1,2})[/\-–.]([0-9]{2})\b", re.IGNORECASE),
]

# Batch / Lot patterns
BATCH_PATTERNS = [
    re.compile(r"\b(?:LOT\s*/\s*BATCH|BATCH\s*(?:NO|NUMBER|\.?)|LOT\s*(?:NO|NUMBER|\.?)|B\s*/\s*N|B\.N\.|BN|LOT|BATCH)[\s.:/–-]+([A-Z0-9\-_]{3,16})\b", re.IGNORECASE),
]


# Strength / Dosage patterns
STRENGTH_PATTERNS = [
    # Combination e.g. 875 mg / 125 mg
    re.compile(r"\b(\d+(?:\.\d+)?)\s*(mg|mcg|g)\s*(?:/|\+)\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b", re.IGNORECASE),
    # Concentration e.g. 100 U/mL, 100 IU/mL, 160 mg/5 mL, 100 mg / 5 mL
    re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:mg|mcg|U|IU)\s*/\s*(?:\d+(?:\.\d+)?\s*)?(?:mL|ml)\b", re.IGNORECASE),
    # Standard single strength e.g. 500 mg, 500mg, 20 mg, 90 mcg, 50 mcg
    re.compile(r"\b(\d+(?:\.\d+)?)\s*(mg|mcg|IU|U|g)\b", re.IGNORECASE),
]

# Manufacturer indicator keywords
MANUFACTURER_KEYWORDS = [
    "manufactured by", "manufactured for", "mfg by", "mfg for",
    "distributed by", "exclusively distributed by", "marketed by",
    "marketed in the us by", "pharma", "laboratories", "inc.", "llc"
]


# ---------------------------------------------------------------------------
# Date Extraction & Normalization
# ---------------------------------------------------------------------------

def normalize_date(m1: str, m2: str, is_year_first: bool = False) -> str:
    """
    Normalizes month/year tokens to standard YYYY-MM without inventing an exact day.
    """
    if is_year_first:
        year_str, month_str = m1, m2
    else:
        month_str, year_str = m1, m2

    month = int(month_str)
    # Ensure month is within 1..12
    if not (1 <= month <= 12):
        # Could be swapped (e.g. YY/MM)
        if 1 <= int(year_str) <= 12:
            month_str, year_str = year_str, month_str
            month = int(month_str)

    year = int(year_str)
    if year < 100:
        year += 2000  # e.g. 27 -> 2027

    return f"{year:04d}-{month:02d}"


def extract_expiry_date(lines: List[OCRTextLine]) -> Tuple[Optional[str], Optional[str], Optional[float], float]:
    """
    Scans OCR lines for expiration date patterns.
    Returns: (normalized_date, raw_snippet, ocr_engine_conf, parser_conf)
    """
    for line in lines:
        text = line.text

        # Pattern 0: DD/MM/YYYY with keyword (e.g. 15/08/2027)
        m = EXPIRY_PATTERNS[0].search(text)
        if m:
            d1, m1, y1 = m.group(1), m.group(2), m.group(3)
            year = int(y1) if int(y1) > 100 else int(y1) + 2000
            month = int(m1)
            day = int(d1)
            norm = f"{year:04d}-{month:02d}-{day:02d}"
            return norm, m.group(0), line.confidence, 0.96

        # Pattern 1: MM/YYYY or MM-YYYY with keyword
        m = EXPIRY_PATTERNS[1].search(text)
        if m:
            m1, y1 = m.group(1), m.group(2)
            norm = normalize_date(m1, y1, is_year_first=False)
            return norm, m.group(0), line.confidence, 0.95

        # Pattern 2: YYYY/MM with keyword
        m = EXPIRY_PATTERNS[2].search(text)
        if m:
            y1, m1 = m.group(1), m.group(2)
            norm = normalize_date(y1, m1, is_year_first=True)
            return norm, m.group(0), line.confidence, 0.95

        # Pattern 3: MM/YY with keyword
        m = EXPIRY_PATTERNS[3].search(text)
        if m:
            m1, y1 = m.group(1), m.group(2)
            norm = normalize_date(m1, y1, is_year_first=False)
            return norm, m.group(0), line.confidence, 0.90

    # Secondary scan: standalone dates
    for line in lines:
        text = line.text
        m = EXPIRY_PATTERNS[4].search(text)
        if m:
            norm = normalize_date(m.group(1), m.group(2))
            return norm, m.group(0), line.confidence, 0.80

        m = EXPIRY_PATTERNS[5].search(text)
        if m:
            norm = normalize_date(m.group(1), m.group(2), is_year_first=True)
            return norm, m.group(0), line.confidence, 0.80

        m = EXPIRY_PATTERNS[6].search(text)
        if m:
            norm = normalize_date(m.group(1), m.group(2))
            return norm, m.group(0), line.confidence, 0.75

    return None, None, None, 0.0


def extract_manufacturing_date(lines: List[OCRTextLine]) -> Tuple[Optional[str], Optional[str], Optional[float], float]:
    """
    Scans OCR lines for manufacturing date patterns.
    """
    for line in lines:
        text = line.text
        m = MFG_PATTERNS[0].search(text)
        if m:
            norm = normalize_date(m.group(1), m.group(2))
            return norm, m.group(0), line.confidence, 0.95

        m = MFG_PATTERNS[1].search(text)
        if m:
            norm = normalize_date(m.group(1), m.group(2), is_year_first=True)
            return norm, m.group(0), line.confidence, 0.95

        m = MFG_PATTERNS[2].search(text)
        if m:
            norm = normalize_date(m.group(1), m.group(2))
            return norm, m.group(0), line.confidence, 0.90

    return None, None, None, 0.0


# ---------------------------------------------------------------------------
# Batch / Lot Extraction
# ---------------------------------------------------------------------------

def extract_batch_lot(lines: List[OCRTextLine]) -> Tuple[Optional[str], Optional[str], Optional[float], float]:
    """
    Scans OCR lines for batch or lot number patterns.
    """
    for line in lines:
        text = line.text
        for pattern in BATCH_PATTERNS:
            m = pattern.search(text)
            if m:
                raw_token = m.group(1).strip()
                # Exclude obvious non-lot words
                if raw_token.upper() in {"EXP", "DATE", "SIZE", "PACK", "MG", "ML", "TAB", "CAP", "BATCH", "LOT", "NO", "NUMBER"}:
                    continue
                # Reject if purely punctuation
                clean_val = re.sub(r"[^A-Za-z0-9]", "", raw_token)
                if len(clean_val) < 3:
                    continue
                return raw_token.upper(), m.group(0), line.confidence, 0.92

    return None, None, None, 0.0


# ---------------------------------------------------------------------------
# Strength / Dosage Extraction
# ---------------------------------------------------------------------------

def extract_strength(lines: List[OCRTextLine]) -> Tuple[Optional[str], Optional[str], Optional[float], float]:
    """
    Scans OCR lines for pharmaceutical strength and dosage specifications.
    Normalizes spacing (e.g. '500mg' -> '500 mg') while preserving original text.
    """
    for line in lines:
        text = line.text

        # 1. Dual combination e.g. 875 mg / 125 mg
        m = STRENGTH_PATTERNS[0].search(text)
        if m:
            val = f"{m.group(1)} {m.group(2).lower()} / {m.group(3)} {m.group(4).lower()}"
            return val, m.group(0), line.confidence, 0.96

        # 2. Concentration e.g. 100 U/mL, 160 mg/5 mL
        m = STRENGTH_PATTERNS[1].search(text)
        if m:
            raw = m.group(0).strip()
            norm = re.sub(r"\s+", " ", raw)
            return norm, raw, line.confidence, 0.94

        # 3. Standard single strength e.g. 500 mg, 20 mg
        m = STRENGTH_PATTERNS[2].search(text)
        if m:
            amount, unit = m.group(1), m.group(2)
            val = f"{amount} {unit}" if unit in {"U", "IU"} else f"{amount} {unit.lower()}"
            return val, m.group(0), line.confidence, 0.90

    return None, None, None, 0.0


# ---------------------------------------------------------------------------
# Manufacturer Extraction
# ---------------------------------------------------------------------------

def extract_manufacturer(lines: List[OCRTextLine]) -> Tuple[Optional[str], Optional[str], Optional[float], float]:
    """
    Scans OCR lines for manufacturer attribution or branding signatures.
    """
    for i, line in enumerate(lines):
        text_lower = line.text.lower()
        for kw in MANUFACTURER_KEYWORDS:
            if kw in text_lower:
                # Often the manufacturer name follows the keyword on the same line or next line
                cleaned = re.sub(r"^(?:manufactured|mfg|distributed|exclusively|marketed)\s*(?:by|for|in)?[\s.:]*", "", line.text, flags=re.IGNORECASE).strip()
                if cleaned and len(cleaned) > 2:
                    return cleaned, line.text, line.confidence, 0.88
                # Check next line
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if len(next_line.text.strip()) > 2:
                        return next_line.text.strip(), f"{line.text} {next_line.text}", next_line.confidence, 0.85

    return None, None, None, 0.0


# ---------------------------------------------------------------------------
# Medicine Name & Database Matching
# ---------------------------------------------------------------------------

def match_medicine_catalog(lines: List[OCRTextLine], db: Session) -> Tuple[Optional[str], Optional[str], Optional[float], float, float, List[CandidateMatch]]:
    """
    Scans OCR lines and matches candidate tokens against known medicines in the database.
    Uses exact substring, case-insensitive, and SequenceMatcher token similarity.
    Returns: (medicine_name, generic_name, ocr_engine_conf, parser_conf, db_match_conf, candidate_matches)
    """
    medicines = db.query(Medicine).all()
    if not medicines:
        return None, None, None, 0.0, 0.0, []

    candidates: List[CandidateMatch] = []
    seen_ids = set()

    # Pre-clean line texts
    token_candidates = []
    for line in lines:
        clean = line.text.strip()
        if len(clean) >= 3:
            token_candidates.append((clean, line.confidence))

    for ocr_token, line_conf in token_candidates:
        token_upper = ocr_token.upper()

        for med in medicines:
            score = 0.0
            med_name_upper = med.medicine_name.upper()
            generic_upper = med.generic_name.upper()
            brand_upper = med.brand_name.upper() if med.brand_name else ""

            # Check exact presence of generic, brand, or catalog medicine name in OCR token
            if med_name_upper in token_upper or token_upper in med_name_upper:
                score = max(score, 0.95)
            elif generic_upper in token_upper or token_upper in generic_upper:
                score = max(score, 0.92)
            elif brand_upper and any(b.strip() in token_upper for b in brand_upper.split("/")):
                score = max(score, 0.92)
            elif med_name_upper.split()[0] in token_upper:  # e.g. "PARACETAMOL" in "PARACETAMOL 500MG"
                score = max(score, 0.92)
            else:
                # Token-level similarity
                ratio_name = difflib.SequenceMatcher(None, token_upper, med_name_upper).ratio()
                ratio_generic = difflib.SequenceMatcher(None, token_upper, generic_upper).ratio()
                ratio_brand = difflib.SequenceMatcher(None, token_upper, brand_upper).ratio() if brand_upper else 0.0
                score = max(score, ratio_name, ratio_generic, ratio_brand)

            if score >= 0.65:
                if med.medicine_id not in seen_ids:
                    seen_ids.add(med.medicine_id)
                    candidates.append(
                        CandidateMatch(
                            medicine_id=med.medicine_id,
                            medicine_name=med.medicine_name,
                            generic_name=med.generic_name,
                            strength=med.strength,
                            dosage_form=med.dosage_form,
                            similarity_score=round(score, 4),
                            matched_token=ocr_token,
                        )
                    )

    # Sort candidate matches descending by similarity score
    candidates.sort(key=lambda c: c.similarity_score, reverse=True)

    if candidates and candidates[0].similarity_score >= 0.70:
        best = candidates[0]
        # Find matching line confidence
        best_line_conf = next((conf for token, conf in token_candidates if token == best.matched_token), 0.85)
        return best.medicine_name, best.generic_name, best_line_conf, 0.90, best.similarity_score, candidates

    return None, None, None, 0.0, 0.0, candidates


# ---------------------------------------------------------------------------
# Structured Fields Aggregator
# ---------------------------------------------------------------------------

def parse_structured_fields(lines: List[OCRTextLine], db: Session) -> Tuple[StructuredFields, List[CandidateMatch]]:
    """
    Parses OCR text lines into structured pharmaceutical packaging fields.
    Guarantees that unencountered fields are strictly null rather than fabricated.
    """
    # 1. Expiry Date
    exp_val, exp_raw, exp_ocr_conf, exp_parser_conf = extract_expiry_date(lines)
    expiry_field = ExtractedField(
        field_name="expiry_date",
        value=exp_val,
        raw_text=exp_raw,
        original_text=exp_raw,
        ocr_engine_confidence=exp_ocr_conf,
        parser_confidence=exp_parser_conf if exp_val else None,
        confidence=ConfidenceBreakdown(
            ocr_engine_confidence=exp_ocr_conf,
            parser_confidence=exp_parser_conf if exp_val else None,
        ),
    )

    # 2. Manufacturing Date
    mfg_val, mfg_raw, mfg_ocr_conf, mfg_parser_conf = extract_manufacturing_date(lines)
    mfg_field = ExtractedField(
        field_name="manufacturing_date",
        value=mfg_val,
        raw_text=mfg_raw,
        original_text=mfg_raw,
        ocr_engine_confidence=mfg_ocr_conf,
        parser_confidence=mfg_parser_conf if mfg_val else None,
        confidence=ConfidenceBreakdown(
            ocr_engine_confidence=mfg_ocr_conf,
            parser_confidence=mfg_parser_conf if mfg_val else None,
        ),
    )

    # 3. Batch / Lot Number
    lot_val, lot_raw, lot_ocr_conf, lot_parser_conf = extract_batch_lot(lines)
    batch_field = ExtractedField(
        field_name="batch_number",
        value=lot_val,
        raw_text=lot_raw,
        original_text=lot_raw,
        ocr_engine_confidence=lot_ocr_conf,
        parser_confidence=lot_parser_conf if lot_val else None,
        confidence=ConfidenceBreakdown(
            ocr_engine_confidence=lot_ocr_conf,
            parser_confidence=lot_parser_conf if lot_val else None,
        ),
    )

    # 4. Strength
    str_val, str_raw, str_ocr_conf, str_parser_conf = extract_strength(lines)
    strength_field = ExtractedField(
        field_name="strength",
        value=str_val,
        raw_text=str_raw,
        original_text=str_raw,
        ocr_engine_confidence=str_ocr_conf,
        parser_confidence=str_parser_conf if str_val else None,
        confidence=ConfidenceBreakdown(
            ocr_engine_confidence=str_ocr_conf,
            parser_confidence=str_parser_conf if str_val else None,
        ),
    )

    # 5. Manufacturer
    man_val, man_raw, man_ocr_conf, man_parser_conf = extract_manufacturer(lines)
    manufacturer_field = ExtractedField(
        field_name="manufacturer",
        value=man_val,
        raw_text=man_raw,
        original_text=man_raw,
        ocr_engine_confidence=man_ocr_conf,
        parser_confidence=man_parser_conf if man_val else None,
        confidence=ConfidenceBreakdown(
            ocr_engine_confidence=man_ocr_conf,
            parser_confidence=man_parser_conf if man_val else None,
        ),
    )

    # 6. Medicine Name & Database Match
    med_val, gen_val, med_ocr_conf, med_parser_conf, db_score, candidates = match_medicine_catalog(lines, db)
    med_name_field = ExtractedField(
        field_name="medicine_name",
        value=med_val,
        raw_text=candidates[0].matched_token if candidates else None,
        original_text=candidates[0].matched_token if candidates else None,
        ocr_engine_confidence=med_ocr_conf,
        parser_confidence=med_parser_conf if med_val else None,
        db_match_confidence=db_score if med_val else None,
        confidence=ConfidenceBreakdown(
            ocr_engine_confidence=med_ocr_conf,
            parser_confidence=med_parser_conf if med_val else None,
            db_match_confidence=db_score if med_val else None,
        ),
    )
    generic_name_field = ExtractedField(
        field_name="generic_name",
        value=gen_val,
        raw_text=candidates[0].matched_token if candidates else None,
        original_text=candidates[0].matched_token if candidates else None,
        ocr_engine_confidence=med_ocr_conf,
        parser_confidence=med_parser_conf if gen_val else None,
        db_match_confidence=db_score if gen_val else None,
        confidence=ConfidenceBreakdown(
            ocr_engine_confidence=med_ocr_conf,
            parser_confidence=med_parser_conf if gen_val else None,
            db_match_confidence=db_score if gen_val else None,
        ),
    )

    fields = StructuredFields(
        medicine_name=med_name_field,
        generic_name=generic_name_field,
        strength=strength_field,
        batch_number=batch_field,
        expiry_date=expiry_field,
        manufacturing_date=mfg_field,
        manufacturer=manufacturer_field,
    )

    return fields, candidates
