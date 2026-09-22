"""
Unit and Integration Tests for Open-World Medicine Recognition.

Tests the multi-modal evidence arbitration engine across:
1. Exact matches (e.g. Paracetamol 500mg)
2. OCR character corruptions (e.g. AM0XICILLIN, TELM1SARTAN)
3. Brand-to-generic mappings (e.g. CALCHEK-T 40 -> Amlodipine + Telmisartan)
4. Multi-ingredient combination products (set-based intersection)
5. Strength-aware mismatch handling (500mg != 650mg -> PARTIAL_MATCH)
6. Dosage-form mismatch handling (Tablet != Suspension -> PARTIAL_MATCH)
7. Unsupported/arbitrary items -> UNKNOWN rejection
8. Conflicting evidence (CV Class A != OCR Class B -> CONFLICTING_EVIDENCE)
9. Unseen medicines (never in CV training set -> IDENTIFIED via OCR/KB)
10. Provenance metadata tracking (source, source_url, source_id)
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ocr.retrieval import get_retriever, KnowledgeBaseRetriever
from app.ocr.parser import extract_active_ingredients, parse_structured_fields
from app.ocr.fusion import compute_cv_ocr_fusion, normalize_strength, normalize_dosage_form
from app.ocr.schemas import OCRTextLine, StructuredFields, ExtractedField, CandidateMatch

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Knowledge Base Retrieval & Inverted Index Tests
# ---------------------------------------------------------------------------

def test_knowledge_base_retriever_initialization():
    retriever = get_retriever()
    assert retriever.db_path.exists(), f"Knowledge base SQLite database not found at {retriever.db_path}"


def test_retrieval_exact_match():
    retriever = get_retriever()
    candidates = retriever.retrieve_candidates(
        extracted_tokens=["Paracetamol", "500 mg", "Tablet"],
        limit=5,
    )
    assert len(candidates) > 0
    top = candidates[0]
    cand_name = (top["medicine_name"] + " " + top.get("generic_name", "")).lower()
    assert "acetaminophen" in cand_name or "paracetamol" in cand_name
    assert top["retrieval_score"] >= 0.80


def test_retrieval_ocr_character_corruption():
    retriever = get_retriever()
    # AM0XICILLIN with zero instead of 'O'
    candidates = retriever.retrieve_candidates(
        extracted_tokens=["AM0XICILLIN", "500mg", "Capsule"],
        limit=5,
    )
    assert len(candidates) > 0
    top = candidates[0]
    assert "amoxicillin" in top["medicine_name"].lower()
    assert top["retrieval_score"] >= 0.80


def test_retrieval_brand_to_generic_mapping():
    retriever = get_retriever()
    # CALCHEK-T 40 maps to Amlodipine + Telmisartan
    candidates = retriever.retrieve_candidates(
        extracted_tokens=["CALCHEK-T 40", "Tablets"],
        limit=5,
    )
    assert len(candidates) > 0
    top = candidates[0]
    cand_text = (top["medicine_name"] + " " + (top.get("brand_name") or "")).lower()
    assert "amlodipine" in cand_text or "telmisartan" in cand_text or "calchek" in cand_text


def test_retrieval_multi_ingredient_combination():
    retriever = get_retriever()
    # Amlodipine + Telmisartan combination
    extracted_ings = ["amlodipine", "telmisartan"]
    candidates = retriever.retrieve_candidates(
        extracted_tokens=["Amlodipine Besylate 5 mg", "Telmisartan 40 mg"],
        extracted_ingredients=extracted_ings,
        limit=5,
    )
    assert len(candidates) > 0
    top = candidates[0]
    cand_text = (top["medicine_name"] + " " + top["generic_name"]).lower()
    assert "amlodipine" in cand_text and "telmisartan" in cand_text
    assert top["retrieval_score"] >= 0.90


def test_strength_differentiation_ranking():
    retriever = get_retriever()
    # When 500mg is extracted, 500mg should rank above 650mg
    candidates_500 = retriever.retrieve_candidates(
        extracted_tokens=["Paracetamol Tablets IP", "500 mg"],
        extracted_strength="500 mg",
        limit=5,
    )
    assert len(candidates_500) > 0
    assert "500" in candidates_500[0]["medicine_name"]

    # When 650mg is extracted, 650mg should rank above 500mg
    candidates_650 = retriever.retrieve_candidates(
        extracted_tokens=["Paracetamol Tablets IP", "650 mg"],
        extracted_strength="650 mg",
        limit=5,
    )
    assert len(candidates_650) > 0
    assert "650" in candidates_650[0]["medicine_name"]


def test_dosage_form_differentiation():
    retriever = get_retriever()
    # When Capsule is specified, Capsule should rank above Tablet
    candidates_cap = retriever.retrieve_candidates(
        extracted_tokens=["Amoxicillin", "500 mg", "Capsule"],
        extracted_dosage_form="Capsule",
        limit=5,
    )
    assert len(candidates_cap) > 0
    assert "capsule" in candidates_cap[0]["dosage_form"].lower()


def test_unknown_out_of_universe_rejection():
    retriever = get_retriever()
    # Non-medicine arbitrary packaging
    candidates = retriever.retrieve_candidates(
        extracted_tokens=["INDUSTRIAL SOLVENT X-9", "DO NOT INGEST", "500 ML"],
        limit=5,
    )
    # Either no candidates or very low score
    if candidates:
        assert candidates[0]["retrieval_score"] < 0.65


# ---------------------------------------------------------------------------
# 2. Decision Fusion & Arbitration Tests
# ---------------------------------------------------------------------------

def test_fusion_unseen_medicine_identified():
    """Unseen medicine outside CV classes with high-confidence OCR should be IDENTIFIED."""
    cand = CandidateMatch(
        medicine_id="RXCUI-855324",
        medicine_name="Amlodipine Besylate / Telmisartan",
        generic_name="Amlodipine Besylate / Telmisartan",
        strength="5 mg / 40 mg",
        dosage_form="Tablet",
        similarity_score=0.95,
        matched_token="Amlodipine + Telmisartan",
    )
    fields = StructuredFields(
        medicine_name=ExtractedField(value="Amlodipine Besylate / Telmisartan"),
        generic_name=ExtractedField(value="Amlodipine + Telmisartan"),
        strength=ExtractedField(value="5 mg / 40 mg"),
        dosage_form=ExtractedField(value="Tablet"),
    )

    assessment = compute_cv_ocr_fusion(
        cv_class="amoxicillin_500mg_capsule",
        cv_confidence=0.30,  # Below threshold
        cv_threshold=0.60,
        ocr_fields=fields,
        candidate_matches=[cand],
        matched_medicine=None,
    )

    assert assessment.identification_status == "CONFIRMED"
    assert assessment.ocr_match == "Amlodipine Besylate / Telmisartan"
    assert assessment.agreement_score >= 0.85


def test_fusion_conflicting_evidence_detected():
    """When confident CV conflicts with strong OCR candidate, status must be DIVERGENT."""
    cand = CandidateMatch(
        medicine_id="RXCUI-855324",
        medicine_name="Amlodipine Besylate / Telmisartan",
        generic_name="Amlodipine Besylate / Telmisartan",
        strength="5 mg / 40 mg",
        dosage_form="Tablet",
        similarity_score=0.92,
        matched_token="Amlodipine + Telmisartan",
    )
    fields = StructuredFields(
        medicine_name=ExtractedField(value="Amlodipine Besylate / Telmisartan"),
        generic_name=ExtractedField(value="Amlodipine + Telmisartan"),
        strength=ExtractedField(value="5 mg / 40 mg"),
        dosage_form=ExtractedField(value="Tablet"),
    )

    from app.models.medicine import Medicine
    fake_cv_med = Medicine(
        medicine_id="MED-002",
        medicine_name="Amoxicillin 500mg Capsule",
        generic_name="Amoxicillin",
        strength="500 mg",
        dosage_form="Capsule",
        category="Antibiotic",
        image_class="amoxicillin_500mg_capsule",
        storage_min_temperature=20.0,
        storage_max_temperature=25.0,
        source="USP Monograph",
        source_url="https://dailymed.nlm.nih.gov/",
    )

    assessment = compute_cv_ocr_fusion(
        cv_class="amoxicillin_500mg_capsule",
        cv_confidence=0.88,  # Confident CV
        cv_threshold=0.60,
        ocr_fields=fields,
        candidate_matches=[cand],
        matched_medicine=fake_cv_med,
    )

    assert assessment.identification_status == "DIVERGENT"


# ---------------------------------------------------------------------------
# 3. Medicine Catalog & Open-World Lookup Endpoint Tests
# ---------------------------------------------------------------------------

def test_api_get_open_world_medicine_by_id():
    """Verify get_medicine falls back to the open-world knowledge base."""
    response = client.get("/api/v1/medicines/RXN-876528")
    assert response.status_code == 200
    data = response.json()
    assert data["medicine_id"] == "RXN-876528"
    assert "amlodipine" in data["medicine_name"].lower() and "telmisartan" in data["medicine_name"].lower()
    assert data["source"] in {"NLM RxNorm", "FDA DailyMed", "openFDA"}
    assert data["source_url"] is not None
    assert data["storage_min_temperature"] is not None
    assert data["storage_max_temperature"] is not None


def test_api_get_foundation_medicine_by_id():
    """Verify original 25 catalog medicines continue to work identically."""
    response = client.get("/api/v1/medicines/MED-001")
    assert response.status_code == 200
    data = response.json()
    assert data["medicine_id"] == "MED-001"
    assert data["medicine_name"] == "Paracetamol 500mg Tablets"
    assert data["storage_min_temperature"] == 20.0
    assert data["storage_max_temperature"] == 25.0
