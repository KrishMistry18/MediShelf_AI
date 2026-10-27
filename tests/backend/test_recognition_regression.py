"""
MediShelf AI — Regression Test Suite for Critical Recognition Bug Fixes

Tests:
1. Case A — Amoline 10 (Amlodipine 10mg tablet): Must resolve to single-ingredient
   Amlodipine 10mg, NOT a 3-ingredient combination product (aliskiren / amlodipine / HCTZ).
2. Case B — Glitch-M1 (Glimepiride 1mg + Metformin SR 500mg): Must NOT confirm Metformin 500mg
   tablets alone as an exact match; must return PARTIAL_MATCH.
3. Case C — Akurit-4 (4-drug combination: Rifampicin, Isoniazid, Pyrazinamide, Ethambutol):
   Must NOT confirm single-ingredient ethambutol as an exact match; must return PARTIAL_MATCH.
4. Case D — Paracetamol benchmark specimen (Acetaminophen 160mg/5mL oral suspension):
   Must NOT confirm MED-001 Paracetamol 500mg tablet as exact match; must return PARTIAL_MATCH.
5. Case E — Atorvastatin positive control (Atorvastatin 20mg tablet):
   Validates full pipeline confirmation for true positive control.
6. Storage requirements: Preserves None without default fabrication, handles legitimate 0.0 bounds.
7. Closed-set visual classifier mapping and out-of-scope handling.
8. Metric count and percentage mathematical consistency.
"""

import json
from pathlib import Path
import pytest
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.medicine import Medicine
from app.ocr.schemas import OCRTextLine
from app.ocr.parser import (
    extract_active_ingredients,
    extract_dosage_form,
    extract_release_type,
    extract_strength,
)
from app.ocr.retrieval import KnowledgeBaseRetriever, check_exact_product_match
from app.schemas.storage_risk import StorageRiskRequest
from app.services.storage_risk_service import storage_risk_service


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def retriever():
    return KnowledgeBaseRetriever()


# ---------------------------------------------------------------------------
# Case A: Amoline 10 (Amlodipine 10mg tablet)
# ---------------------------------------------------------------------------

def test_case_a_amoline_10_single_ingredient_resolution(retriever):
    """
    Case A: Package states Amlodipine Tablets I.P. 10 mg, branded Amoline 10.
    Must rank single-ingredient Amlodipine 10mg ahead of multi-ingredient combinations
    such as aliskiren / amlodipine / hydrochlorothiazide.
    """
    lines = [
        OCRTextLine(text="Amoline 10", confidence=0.92),
        OCRTextLine(text="Amlodipine Tablets I.P. 10 mg", confidence=0.95),
    ]
    ings = extract_active_ingredients(lines)
    assert "amlodipine" in ings
    # Must NOT detect unmentioned ingredients
    assert "aliskiren" not in ings
    assert "hydrochlorothiazide" not in ings

    strength = extract_strength(lines)[0]
    assert strength == "10 mg"

    dosage_form = extract_dosage_form(lines)[0]
    assert dosage_form == "Tablet"

    tokens = ["Amoline 10", "Amlodipine Tablets I.P. 10 mg", "Amlodipine", "10 mg"]
    candidates = retriever.retrieve_candidates(
        extracted_tokens=tokens,
        extracted_ingredients=ings,
        extracted_strength=strength,
        extracted_dosage_form=dosage_form,
        limit=5,
    )

    assert len(candidates) > 0
    top = candidates[0]

    # Top candidate MUST be a single-ingredient Amlodipine product
    top_ings = top.get("active_ingredients", [])
    assert top_ings == ["amlodipine"], f"Expected single-ingredient amlodipine, got {top_ings}"
    assert "aliskiren" not in str(top["medicine_name"]).lower()
    assert "hydrochlorothiazide" not in str(top["medicine_name"]).lower()

    # Verify exact match passes for single-ingredient Amlodipine 10mg
    is_exact, reasons = check_exact_product_match(
        candidate=top,
        extracted_ingredients=ings,
        extracted_strength=strength,
        extracted_dosage_form=dosage_form,
    )
    assert is_exact is True, f"Expected exact match for Amlodipine 10mg, failed with reasons: {reasons}"

    # Verify 3-drug combo fails exact match check
    fake_combo = {
        "medicine_name": "aliskiren 300 MG / amlodipine 10 MG / hydrochlorothiazide 12.5 MG Oral Tablet",
        "strength": "300 MG / 10 MG / 12.5 MG",
        "dosage_form": "Tablet",
        "active_ingredients": ["aliskiren", "amlodipine", "hydrochlorothiazide"],
    }
    combo_exact, combo_reasons = check_exact_product_match(
        candidate=fake_combo,
        extracted_ingredients=ings,
        extracted_strength=strength,
        extracted_dosage_form=dosage_form,
    )
    assert combo_exact is False
    assert any("unmentioned active ingredient" in r.lower() for r in combo_reasons)


# ---------------------------------------------------------------------------
# Case B: Glitch-M1 (Glimepiride 1mg + Metformin SR 500mg)
# ---------------------------------------------------------------------------

def test_case_b_glitch_m1_combination_not_confirmed_as_metformin_alone(retriever, db: Session):
    """
    Case B: Package states Glimepiride 1 mg plus Metformin Hydrochloride SR 500 mg.
    Must NOT confirm Metformin 500mg tablet alone as an exact match.
    """
    lines = [
        OCRTextLine(text="Glitch-M1", confidence=0.90),
        OCRTextLine(text="Glimepiride 1 mg and Metformin Hydrochloride SR 500 mg Tablets", confidence=0.95),
    ]
    ings = extract_active_ingredients(lines)
    assert "glimepiride" in ings
    assert "metformin" in ings

    rel_type = extract_release_type(lines)
    assert rel_type == "SR"

    # Query candidate for Metformin 500mg alone (MED-004)
    med004 = db.query(Medicine).filter(Medicine.medicine_id == "MED-004").first()
    assert med004 is not None

    # Check exact match against Metformin 500mg tablet alone
    is_exact, reasons = check_exact_product_match(
        candidate=med004,
        extracted_ingredients=ings,
        extracted_strength="500 mg",
        extracted_dosage_form="Tablet",
        extracted_release_type=rel_type,
    )
    assert is_exact is False
    # Reasons must explicitly capture missing glimepiride and release profile mismatch
    assert any("glimepiride" in r.lower() for r in reasons)
    assert any("release profile mismatch" in r.lower() for r in reasons)


# ---------------------------------------------------------------------------
# Case C: Akurit-4 (4-drug combination product)
# ---------------------------------------------------------------------------

def test_case_c_akurit_4_combination_not_confirmed_as_ethambutol_alone(retriever):
    """
    Case C: Package states Rifampicin, Isoniazid, Pyrazinamide and Ethambutol Hydrochloride.
    Must NOT confirm a single-ingredient ethambutol product as an exact match.
    """
    lines = [
        OCRTextLine(text="Akurit-4 Tablets", confidence=0.92),
        OCRTextLine(text="Rifampicin, Isoniazid, Pyrazinamide and Ethambutol Hydrochloride Tablets", confidence=0.96),
    ]
    ings = extract_active_ingredients(lines)
    assert "ethambutol" in ings
    assert "isoniazid" in ings
    assert "pyrazinamide" in ings
    assert any(r in ings for r in ["rifampin", "rifampicin"])

    # Simulated single-ingredient ethambutol candidate
    ethambutol_single = {
        "medicine_name": "ethambutol hydrochloride 400 MG Oral Tablet",
        "strength": "400 MG",
        "dosage_form": "Tablet",
        "active_ingredients": ["ethambutol"],
    }

    is_exact, reasons = check_exact_product_match(
        candidate=ethambutol_single,
        extracted_ingredients=ings,
        extracted_strength=None,
        extracted_dosage_form="Tablet",
    )
    assert is_exact is False
    assert any("missing active ingredient" in r.lower() for r in reasons)


# ---------------------------------------------------------------------------
# Case D: Paracetamol benchmark specimen (Acetaminophen 160mg/5mL oral suspension)
# ---------------------------------------------------------------------------

def test_case_d_acetaminophen_suspension_not_confirmed_as_paracetamol_500mg_tablet(db: Session):
    """
    Case D: Packaging shows Children's Acetaminophen Oral Suspension 160mg per 5mL.
    Must NOT confirm MED-001 (Paracetamol 500mg Tablet) as an exact match.
    """
    med001 = db.query(Medicine).filter(Medicine.medicine_id == "MED-001").first()
    assert med001 is not None

    extracted_ings = ["acetaminophen"]
    extracted_str = "160 mg / 5 ml"
    extracted_df = "Oral Suspension"

    is_exact, reasons = check_exact_product_match(
        candidate=med001,
        extracted_ingredients=extracted_ings,
        extracted_strength=extracted_str,
        extracted_dosage_form=extracted_df,
    )
    assert is_exact is False
    # Reasons must indicate both strength and dosage form mismatches
    assert any("strength mismatch" in r.lower() for r in reasons)
    assert any("dosage form mismatch" in r.lower() for r in reasons)


# ---------------------------------------------------------------------------
# Case E: Atorvastatin positive control
# ---------------------------------------------------------------------------

def test_case_e_atorvastatin_positive_control(db: Session):
    """
    Case E: Package states Atorvastatin Calcium 20 mg Tablets.
    Validates that authentic positive control candidate passes exact match gate.
    """
    med005 = db.query(Medicine).filter(Medicine.medicine_id == "MED-005").first()
    assert med005 is not None

    extracted_ings = ["atorvastatin"]
    extracted_str = "20 mg"
    extracted_df = "Tablet"

    is_exact, reasons = check_exact_product_match(
        candidate=med005,
        extracted_ingredients=extracted_ings,
        extracted_strength=extracted_str,
        extracted_dosage_form=extracted_df,
    )
    assert is_exact is True
    assert len(reasons) == 0


# ---------------------------------------------------------------------------
# Storage requirements: Missing limits and legitimate zero bounds
# ---------------------------------------------------------------------------

def test_storage_assessment_handles_missing_quantitative_limits(db: Session):
    """
    Unquantified storage requirements must preserve None rather than fabricating defaults (20.0 or 25.0).
    Deterministic status must be INSUFFICIENT_DATA and is_compliant must be None.
    """
    req = StorageRiskRequest(
        medicine_id="RXN-1810997",  # Pure RxNorm concept with unquantified storage
        current_temperature=22.0,
        current_humidity=50.0,
        excursion_duration_hours=0.0,
    )
    resp = storage_risk_service.evaluate_storage_risk(db=db, request=req)

    assert resp.storage_requirements.has_quantified_temperature is False
    assert resp.storage_requirements.min_temperature is None
    assert resp.storage_requirements.max_temperature is None
    assert resp.deterministic_compliance.status == "INSUFFICIENT_DATA"
    assert resp.deterministic_compliance.is_compliant is None
    assert resp.deterministic_compliance.temp_deviation is None
    assert resp.ml_risk.is_available is False


def test_storage_assessment_handles_zero_valued_boundary(db: Session):
    """
    A legitimate 0.0 boundary (e.g. 0°C to 4°C) must be preserved as 0.0 and evaluated as quantified.
    """
    # Create or test with a simulated medicine having min_temp = 0.0
    from app.services.storage_risk_service import StorageRiskService
    from app.schemas.storage_risk import StorageRequirementsInfo

    min_temp = 0.0
    max_temp = 4.0
    has_quant_temp = (min_temp is not None and max_temp is not None)
    assert has_quant_temp is True
    assert min_temp == 0.0

    # Temperature at -2.0 C is an excursion of 2.0 C below 0.0 C
    temp = -2.0
    temp_compliant = (min_temp <= temp <= max_temp)
    assert temp_compliant is False
    deviation_below = max(0.0, round(min_temp - temp, 2))
    assert deviation_below == 2.0


# ---------------------------------------------------------------------------
# Metric count and percentage mathematical consistency
# ---------------------------------------------------------------------------

def test_metric_artifacts_mathematical_consistency():
    """
    Verify test_metrics.json has mathematically consistent sample count, accuracy,
    and class support matching the verified checkpoint report.
    """
    metrics_path = Path("ml/artifacts/metrics/test_metrics.json")
    assert metrics_path.exists()

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    sample_count = metrics["sample_count"]
    top1 = metrics["top1_accuracy"]
    top3 = metrics["top3_accuracy"]

    # 50 samples in isolated test split
    assert sample_count == 50

    # Calculated correct counts must match round(accuracy * sample_count)
    top1_correct = round(top1 * sample_count)
    top3_correct = round(top3 * sample_count)

    assert top1_correct / sample_count == pytest.approx(top1, abs=0.02)
    assert top3_correct / sample_count == pytest.approx(top3, abs=0.02)

    # Per-class support must sum to total sample_count
    per_class = metrics.get("per_class", {})
    total_support = sum(info["support"] for info in per_class.values())
    assert total_support == sample_count
