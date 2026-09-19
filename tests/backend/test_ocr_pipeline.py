import io
from pathlib import Path
from PIL import Image
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.medicine import Medicine
from app.ocr.extractor import get_ocr_extractor
from app.ocr.fusion import compute_cv_ocr_fusion, normalize_strength, normalize_dosage_form
from app.ocr.parser import (
    extract_batch_lot,
    extract_dosage_form,
    extract_expiry_date,
    extract_manufacturing_date,
    extract_strength,
    match_medicine_catalog,
    parse_structured_fields,
)
from app.ocr.preprocess import assess_image_quality
from app.ocr.schemas import OCRTextLine, StructuredFields, ExtractedField, CandidateMatch

client = TestClient(app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# 1. Date Extraction & Normalization Tests
# ---------------------------------------------------------------------------

def test_expiry_date_formats_month_year():
    test_cases = [
        ("EXP 08/2027", "2027-08"),
        ("EXP: 08-2027", "2027-08"),
        ("EXP 2027-08", "2027-08"),
        ("EXP DATE 08/27", "2027-08"),
        ("EXPIRY 08/2027", "2027-08"),
        ("08/2027", "2027-08"),
        ("2027/08", "2027-08"),
        ("08-2027", "2027-08"),
        ("08/27", "2027-08"),
        ("USE BEFORE 08/2027", "2027-08"),
        ("BEST BEFORE 08/2027", "2027-08"),
    ]
    for text, expected in test_cases:
        lines = [OCRTextLine(text=text, confidence=0.95)]
        val, raw, ocr_conf, parser_conf = extract_expiry_date(lines)
        assert val == expected, f"Failed for text '{text}': got {val}, expected {expected}"
        assert "-" in val
        # CRITICAL ETHICAL RULE: Never infer an exact day when only month/year is present
        assert len(val.split("-")) == 2, f"Exact day must not be hallucinated: {val}"


def test_expiry_date_format_day_month_year():
    lines = [OCRTextLine(text="EXP 15/08/2027", confidence=0.95)]
    val, raw, ocr_conf, parser_conf = extract_expiry_date(lines)
    assert val == "2027-08-15"


def test_expiry_date_undetected_returns_none():
    lines = [OCRTextLine(text="Store in a cool dry place", confidence=0.90)]
    val, raw, ocr_conf, parser_conf = extract_expiry_date(lines)
    assert val is None
    assert raw is None


def test_manufacturing_date_extraction():
    lines = [OCRTextLine(text="MFG 03/2024", confidence=0.92)]
    val, raw, ocr_conf, parser_conf = extract_manufacturing_date(lines)
    assert val == "2024-03"


# ---------------------------------------------------------------------------
# 2. Batch / Lot Extraction Tests
# ---------------------------------------------------------------------------

def test_batch_lot_formats():
    test_cases = [
        ("LOT ABC123", "ABC123"),
        ("LOT: ABC123", "ABC123"),
        ("BATCH ABC123", "ABC123"),
        ("BATCH NO: ABC123", "ABC123"),
        ("BATCH NO ABC123", "ABC123"),
        ("B/N ABC123", "ABC123"),
        ("BN: ABC123", "ABC123"),
        ("BN: 9942", "9942"),
        ("LOT/BATCH: KL998", "KL998"),
    ]
    for text, expected in test_cases:
        lines = [OCRTextLine(text=text, confidence=0.90)]
        val, raw, ocr_conf, parser_conf = extract_batch_lot(lines)
        assert val == expected, f"Failed for '{text}': got {val}, expected {expected}"


def test_batch_lot_rejects_common_words():
    lines = [OCRTextLine(text="LOT EXP DATE", confidence=0.85)]
    val, raw, ocr_conf, parser_conf = extract_batch_lot(lines)
    # Should not take 'EXP' or 'DATE' as lot number
    assert val is None or val not in {"EXP", "DATE"}


# ---------------------------------------------------------------------------
# 3. Strength / Dosage Extraction Tests
# ---------------------------------------------------------------------------

def test_strength_extraction_patterns():
    test_cases = [
        ("Each tablet contains Paracetamol 500mg", "500 mg"),
        ("Paracetamol 500 mg tablets", "500 mg"),
        ("Atorvastatin 20 mg", "20 mg"),
        ("Levothyroxine 50 mcg", "50 mcg"),
        ("ProAir HFA 90 mcg", "90 mcg"),
        ("Humulin R 100 U/mL", "100 U/mL"),
        ("Acetaminophen 160 mg/5 mL", "160 mg/5 mL"),
        ("Augmentin 875 mg / 125 mg", "875 mg / 125 mg"),
    ]
    for text, expected in test_cases:
        lines = [OCRTextLine(text=text, confidence=0.92)]
        val, raw, ocr_conf, parser_conf = extract_strength(lines)
        assert val is not None, f"Failed to match strength for: '{text}'"
        assert val.lower() == expected.lower(), f"For '{text}': got '{val}', expected '{expected}'"


# ---------------------------------------------------------------------------
# 4. Medicine Name & Database Matching Tests
# ---------------------------------------------------------------------------

def test_medicine_catalog_matching_exact_and_fuzzy():
    db = SessionLocal()
    try:
        # Case 1: Exact generic uppercase
        lines1 = [OCRTextLine(text="PARACETAMOL 500MG", confidence=0.95)]
        name1, gen1, _, _, score1, _ = match_medicine_catalog(lines1, db)
        assert name1 is not None
        assert "Paracetamol" in name1
        assert score1 >= 0.85

        # Case 2: Mixed case Paracetamol
        lines_case = [OCRTextLine(text="Paracetamol 500mg", confidence=0.95)]
        name_case, _, _, _, score_case, _ = match_medicine_catalog(lines_case, db)
        assert name_case is not None
        assert "Paracetamol" in name_case

        # Case 3: Brand name lookup
        lines2 = [OCRTextLine(text="Lipitor 20mg", confidence=0.90)]
        name2, gen2, _, _, score2, _ = match_medicine_catalog(lines2, db)
        assert name2 is not None
        assert "Atorvastatin" in name2
        assert score2 >= 0.85

        # Case 4: AMOXICILLIN uppercase
        lines_amox = [OCRTextLine(text="AMOXICILLIN 500mg", confidence=0.92)]
        name_amox, _, _, _, score_amox, _ = match_medicine_catalog(lines_amox, db)
        assert name_amox is not None
        assert "Amoxicillin" in name_amox

        # Case 5: Fuzzy OCR character corruption
        lines3 = [OCRTextLine(text="AM0XICILLIN 500mg", confidence=0.88)]
        name3, gen3, _, _, score3, _ = match_medicine_catalog(lines3, db)
        assert name3 is not None
        assert "Amoxicillin" in name3
        assert score3 >= 0.70
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 5. Image Quality Preprocessing Tests
# ---------------------------------------------------------------------------

def test_image_quality_acceptable_on_sharp_image():
    # Crisp image with synthetic gradient/text
    arr = np.zeros((300, 300, 3), dtype=np.uint8)
    arr[50:250, 50:250] = 200
    arr[100:150, 100:150] = 50
    im = Image.fromarray(arr)
    quality = assess_image_quality(im)
    assert quality.is_acceptable is True
    assert quality.blur_score > 45.0
    assert len(quality.issues) == 0


def test_image_quality_detects_severe_blur():
    # Completely uniform/blurred image
    arr = np.full((200, 200, 3), 128, dtype=np.uint8)
    im = Image.fromarray(arr)
    quality = assess_image_quality(im)
    assert quality.is_acceptable is False
    assert any("blur" in iss.lower() for iss in quality.issues)


def test_image_quality_detects_excessive_darkness():
    arr = np.full((100, 100, 3), 10, dtype=np.uint8)
    im = Image.fromarray(arr)
    quality = assess_image_quality(im)
    assert quality.is_acceptable is False
    assert any("underexposed" in iss.lower() or "dark" in iss.lower() for iss in quality.issues)


def test_image_quality_detects_tiny_dimensions():
    arr = np.full((32, 32, 3), 128, dtype=np.uint8)
    im = Image.fromarray(arr)
    quality = assess_image_quality(im)
    assert quality.is_acceptable is False
    assert any("resolution" in iss.lower() for iss in quality.issues)


# ---------------------------------------------------------------------------
# 6. Multi-Modal Decision Fusion Tests
# ---------------------------------------------------------------------------

def test_fusion_confirmed_status():
    db = SessionLocal()
    try:
        med = db.query(Medicine).filter(Medicine.image_class == "paracetamol_500mg_tablet").first()
        assert med is not None

        fields = StructuredFields(
            medicine_name=ExtractedField(value=med.medicine_name),
            generic_name=ExtractedField(value=med.generic_name),
            strength=ExtractedField(value=med.strength),
        )
        candidates = [
            CandidateMatch(
                medicine_id=med.medicine_id,
                medicine_name=med.medicine_name,
                generic_name=med.generic_name,
                strength=med.strength,
                dosage_form=med.dosage_form,
                similarity_score=0.95,
                matched_token="Paracetamol",
            )
        ]

        fusion = compute_cv_ocr_fusion(
            cv_class=med.image_class,
            cv_confidence=0.75,
            cv_threshold=0.60,
            ocr_fields=fields,
            candidate_matches=candidates,
            matched_medicine=med,
        )
        assert fusion.identification_status == "CONFIRMED"
        assert fusion.agreement_score >= 0.80
        assert any("Identification evidence is consistent" in r or "corroborate" in r for r in fusion.reasons)
    finally:
        db.close()


def test_fusion_partial_status():
    db = SessionLocal()
    try:
        med = db.query(Medicine).filter(Medicine.image_class == "paracetamol_500mg_tablet").first()
        assert med is not None

        # Moderate CV confidence without matching OCR medicine title
        fields = StructuredFields(
            strength=ExtractedField(value="500 mg"),
        )
        candidates = []

        fusion = compute_cv_ocr_fusion(
            cv_class=med.image_class,
            cv_confidence=0.55,
            cv_threshold=0.60,
            ocr_fields=fields,
            candidate_matches=candidates,
            matched_medicine=med,
        )
        assert fusion.identification_status == "PARTIAL"
        assert len(fusion.reasons) > 0
    finally:
        db.close()


def test_fusion_divergent_status():
    db = SessionLocal()
    try:
        med1 = db.query(Medicine).filter(Medicine.image_class == "paracetamol_500mg_tablet").first()
        med2 = db.query(Medicine).filter(Medicine.image_class == "ibuprofen_400mg_tablet").first()

        fields = StructuredFields(
            medicine_name=ExtractedField(value=med2.medicine_name),
            generic_name=ExtractedField(value=med2.generic_name),
            strength=ExtractedField(value=med2.strength),
        )
        candidates = [
            CandidateMatch(
                medicine_id=med2.medicine_id,
                medicine_name=med2.medicine_name,
                generic_name=med2.generic_name,
                strength=med2.strength,
                dosage_form=med2.dosage_form,
                similarity_score=0.92,
                matched_token="Ibuprofen",
            )
        ]

        fusion = compute_cv_ocr_fusion(
            cv_class=med1.image_class,
            cv_confidence=0.75,
            cv_threshold=0.60,
            ocr_fields=fields,
            candidate_matches=candidates,
            matched_medicine=med1,
        )
        assert fusion.identification_status == "DIVERGENT"
        assert any("Divergence detected" in r for r in fusion.reasons)
    finally:
        db.close()


def test_fusion_unconfirmed_status():
    fields = StructuredFields()
    candidates = []

    fusion = compute_cv_ocr_fusion(
        cv_class="unknown",
        cv_confidence=0.20,
        cv_threshold=0.60,
        ocr_fields=fields,
        candidate_matches=candidates,
        matched_medicine=None,
    )
    assert fusion.identification_status == "UNCONFIRMED"
    assert any("Neither computer vision nor OCR" in r for r in fusion.reasons)


# ---------------------------------------------------------------------------
# 6b. Regression Tests: Fusion Semantics, Strength & Dosage Form Normalization
# ---------------------------------------------------------------------------

def test_strength_normalization_contract():
    """
    Ensures equivalent representations normalize identically (500mg vs 500 mg),
    while distinct strengths (500mg vs 160mg) or formulations (100mg/5mL vs 100mg)
    are strictly NOT equal.
    """
    assert normalize_strength("500 mg") == "500 mg"
    assert normalize_strength("500mg") == "500 mg"
    assert normalize_strength("500 MG") == "500 mg"
    assert normalize_strength("500 mg") == normalize_strength("500mg") == normalize_strength("500 MG")

    # Distinct strengths must never be equal
    assert normalize_strength("500 mg") != normalize_strength("160 mg")
    assert normalize_strength("20 mg") != normalize_strength("40 mg")

    # Concentrations must never equal single unit strengths
    assert normalize_strength("100 mg/5 mL") != normalize_strength("100 mg")
    assert normalize_strength("160 mg/5 mL") != normalize_strength("160 mg")

    # Combination strengths
    assert normalize_strength("875 mg / 125 mg") == normalize_strength("875mg/125mg")


def test_dosage_form_normalization_contract():
    """
    Ensures equivalent dosage forms normalize consistently (tablet/tablets/tab),
    while mutually incompatible dosage forms (tablet vs suspension/injection) never match.
    """
    # Tablet forms
    assert normalize_dosage_form("tablet") == "tablet"
    assert normalize_dosage_form("tablets") == "tablet"
    assert normalize_dosage_form("tab") == "tablet"
    assert normalize_dosage_form("Film-Coated Tablet") == "tablet"

    # Capsule forms
    assert normalize_dosage_form("capsule") == "capsule"
    assert normalize_dosage_form("capsules") == "capsule"
    assert normalize_dosage_form("cap") == "capsule"
    assert normalize_dosage_form("Delayed-Release Capsule") == "capsule"

    # Mutual incompatibility
    assert normalize_dosage_form("tablet") != normalize_dosage_form("oral suspension")
    assert normalize_dosage_form("tablet") != normalize_dosage_form("injection")
    assert normalize_dosage_form("tablet") != normalize_dosage_form("vial")
    assert normalize_dosage_form("capsule") != normalize_dosage_form("oral suspension")


def test_dosage_form_extraction_from_ocr_lines():
    test_cases = [
        ("Paracetamol 500mg tablets", "Tablet"),
        ("Each film-coated tablet contains", "Tablet"),
        ("Omeprazole 20mg delayed-release capsules", "Capsule"),
        ("Amoxicillin 500mg cap", "Capsule"),
        ("Acetaminophen 160mg/5mL oral suspension", "Oral Suspension"),
        ("Humulin R 100 U/mL subcutaneous injection", "Subcutaneous Injection"),
        ("ProAir HFA inhalation aerosol", "Inhalation Aerosol"),
        ("Flonase nasal spray suspension", "Nasal Spray Suspension"),
    ]
    for text, expected in test_cases:
        lines = [OCRTextLine(text=text, confidence=0.92)]
        val, raw, ocr_conf, parser_conf = extract_dosage_form(lines)
        assert val is not None, f"Failed to extract dosage form from: '{text}'"
        assert val == expected, f"For '{text}': got '{val}', expected '{expected}'"


def test_fusion_case1_exact_agreement():
    """Case 1 — Exact agreement: CV=Paracetamol 500mg tablet, OCR=Paracetamol 500mg tablet -> CONFIRMED"""
    db = SessionLocal()
    try:
        med = db.query(Medicine).filter(Medicine.image_class == "paracetamol_500mg_tablet").first()
        assert med is not None

        fields = StructuredFields(
            medicine_name=ExtractedField(value="Paracetamol"),
            generic_name=ExtractedField(value="Acetaminophen"),
            strength=ExtractedField(value="500 mg"),
            dosage_form=ExtractedField(value="Tablet"),
        )
        candidates = [
            CandidateMatch(
                medicine_id=med.medicine_id,
                medicine_name=med.medicine_name,
                generic_name=med.generic_name,
                strength=med.strength,
                dosage_form=med.dosage_form,
                similarity_score=0.95,
                matched_token="Paracetamol 500mg Tablet",
            )
        ]

        fusion = compute_cv_ocr_fusion(
            cv_class=med.image_class,
            cv_confidence=0.82,
            cv_threshold=0.60,
            ocr_fields=fields,
            candidate_matches=candidates,
            matched_medicine=med,
        )
        assert fusion.identification_status == "CONFIRMED"
        assert fusion.strength_match is True
        assert fusion.dosage_form_match is True
        assert fusion.agreement_score >= 0.85
        assert any("Identification evidence is consistent" in r for r in fusion.reasons)
    finally:
        db.close()


def test_fusion_case2_strength_mismatch_yields_partial():
    """Case 2 — Generic agreement but strength mismatch: CV=Paracetamol 500mg tablet, OCR=Acetaminophen 160mg -> PARTIAL"""
    db = SessionLocal()
    try:
        med = db.query(Medicine).filter(Medicine.image_class == "paracetamol_500mg_tablet").first()
        assert med is not None

        fields = StructuredFields(
            medicine_name=ExtractedField(value="Acetaminophen"),
            generic_name=ExtractedField(value="Acetaminophen"),
            strength=ExtractedField(value="160 mg"),  # Mismatch: 160 mg vs 500 mg
            dosage_form=ExtractedField(value="Tablet"),
        )
        candidates = [
            CandidateMatch(
                medicine_id=med.medicine_id,
                medicine_name=med.medicine_name,
                generic_name=med.generic_name,
                strength="160 mg",
                dosage_form="Tablet",
                similarity_score=0.88,
                matched_token="Acetaminophen 160mg",
            )
        ]

        fusion = compute_cv_ocr_fusion(
            cv_class=med.image_class,
            cv_confidence=0.80,
            cv_threshold=0.60,
            ocr_fields=fields,
            candidate_matches=candidates,
            matched_medicine=med,
        )
        # CRUCIAL: Must NOT be CONFIRMED! Must be PARTIAL due to strength mismatch.
        assert fusion.identification_status == "PARTIAL"
        assert fusion.strength_match is False
        assert any("differs from catalog specification" in r for r in fusion.reasons)
    finally:
        db.close()


def test_fusion_case3_dosage_form_mismatch_yields_partial():
    """Case 3 — Generic agreement but dosage-form mismatch: CV=Paracetamol 500mg tablet, OCR=Acetaminophen 500mg oral suspension -> PARTIAL"""
    db = SessionLocal()
    try:
        med = db.query(Medicine).filter(Medicine.image_class == "paracetamol_500mg_tablet").first()
        assert med is not None

        fields = StructuredFields(
            medicine_name=ExtractedField(value="Acetaminophen"),
            generic_name=ExtractedField(value="Acetaminophen"),
            strength=ExtractedField(value="500 mg"),
            dosage_form=ExtractedField(value="Oral Suspension"),  # Mismatch: Oral Suspension vs Tablet
        )
        candidates = [
            CandidateMatch(
                medicine_id=med.medicine_id,
                medicine_name=med.medicine_name,
                generic_name=med.generic_name,
                strength="500 mg",
                dosage_form="Oral Suspension",
                similarity_score=0.88,
                matched_token="Acetaminophen 500mg Oral Suspension",
            )
        ]

        fusion = compute_cv_ocr_fusion(
            cv_class=med.image_class,
            cv_confidence=0.80,
            cv_threshold=0.60,
            ocr_fields=fields,
            candidate_matches=candidates,
            matched_medicine=med,
        )
        # CRUCIAL: Must NOT be CONFIRMED! Must be PARTIAL due to dosage form mismatch.
        assert fusion.identification_status == "PARTIAL"
        assert fusion.dosage_form_match is False
        assert any("dosage form" in r.lower() and "differs" in r.lower() for r in fusion.reasons)
    finally:
        db.close()


def test_fusion_case4_divergent_different_medicine():
    """Case 4 — Different medicine: CV=Paracetamol 500mg tablet, OCR=Ibuprofen 400mg tablet -> DIVERGENT"""
    db = SessionLocal()
    try:
        med_para = db.query(Medicine).filter(Medicine.image_class == "paracetamol_500mg_tablet").first()
        med_ibup = db.query(Medicine).filter(Medicine.image_class == "ibuprofen_400mg_tablet").first()
        assert med_para is not None and med_ibup is not None

        fields = StructuredFields(
            medicine_name=ExtractedField(value=med_ibup.medicine_name),
            generic_name=ExtractedField(value=med_ibup.generic_name),
            strength=ExtractedField(value=med_ibup.strength),
            dosage_form=ExtractedField(value=med_ibup.dosage_form),
        )
        candidates = [
            CandidateMatch(
                medicine_id=med_ibup.medicine_id,
                medicine_name=med_ibup.medicine_name,
                generic_name=med_ibup.generic_name,
                strength=med_ibup.strength,
                dosage_form=med_ibup.dosage_form,
                similarity_score=0.94,
                matched_token="Ibuprofen 400mg Tablets",
            )
        ]

        fusion = compute_cv_ocr_fusion(
            cv_class=med_para.image_class,
            cv_confidence=0.78,
            cv_threshold=0.60,
            ocr_fields=fields,
            candidate_matches=candidates,
            matched_medicine=med_para,
        )
        assert fusion.identification_status == "DIVERGENT"
        assert fusion.ocr_match == med_ibup.medicine_name
        assert any("disagree" in r.lower() or "divergence" in r.lower() for r in fusion.reasons)
    finally:
        db.close()


def test_fusion_case5_insufficient_evidence_unconfirmed():
    """Case 5 — Insufficient evidence: Low CV confidence, no OCR text -> UNCONFIRMED"""
    fields = StructuredFields()
    candidates = []

    fusion = compute_cv_ocr_fusion(
        cv_class="unknown",
        cv_confidence=0.25,
        cv_threshold=0.60,
        ocr_fields=fields,
        candidate_matches=candidates,
        matched_medicine=None,
    )
    assert fusion.identification_status == "UNCONFIRMED"
    assert any("inconclusive" in r.lower() or "neither computer vision nor ocr" in r.lower() for r in fusion.reasons)


# ---------------------------------------------------------------------------
# 7. REST Endpoints Tests: POST /api/ocr & POST /api/scan
# ---------------------------------------------------------------------------

def test_api_ocr_with_real_packaging_sample():
    sample_path = PROJECT_ROOT / "frontend" / "public" / "samples" / "paracetamol_sample.jpg"
    assert sample_path.exists()

    with open(sample_path, "rb") as f:
        response = client.post(
            "/api/ocr",
            files={"file": ("sample.jpg", f, "image/jpeg")}
        )

    assert response.status_code == 200
    data = response.json()
    assert "quality" in data
    assert "raw_text" in data
    assert "lines" in data
    assert "fields" in data
    assert "candidate_matches" in data
    assert data["engine"] == "EasyOCR 1.7.2"
    assert len(data["lines"]) > 0


def test_api_scan_returns_composite_phase4_payload():
    sample_path = PROJECT_ROOT / "frontend" / "public" / "samples" / "paracetamol_sample.jpg"
    assert sample_path.exists()

    with open(sample_path, "rb") as f:
        response = client.post(
            "/api/scan?threshold=0.50",
            files={"file": ("sample.jpg", f, "image/jpeg")}
        )

    assert response.status_code == 200
    data = response.json()
    assert "recognition" in data
    assert "ocr" in data
    assert "fusion" in data
    assert "quality" in data
    assert data["ocr_status"] == "completed_phase_4"
    assert data["ocr"]["engine"] == "EasyOCR 1.7.2"
    assert data["fusion"]["identification_status"] in {"CONFIRMED", "PARTIAL"}
    assert data["storage_requirements"] is not None
    assert data["storage_requirements"]["min_temperature"] == 20.0
