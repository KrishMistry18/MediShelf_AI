import json
import sqlite3
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.ocr.retrieval import get_retriever

client = TestClient(app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def test_catalogue_total_records_count():
    """Verify master database contains the full authentic catalogue (>= 27,000 records)."""
    db_path = PROJECT_ROOT / "data" / "medicines" / "medicine_knowledge.db"
    assert db_path.exists(), "medicine_knowledge.db must exist"

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM medicines_master")
    master_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM medicines_fts")
    fts_count = cur.fetchone()[0]

    conn.close()

    assert master_count >= 27000, f"Expected >= 27,000 records, got {master_count}"
    assert master_count == fts_count, "FTS index count must match master table count"


def test_catalogue_provenance_and_manifest():
    """Verify ingestion manifest contains valid source provenance and record breakdowns."""
    manifest_file = PROJECT_ROOT / "data" / "medicines" / "ingestion_manifest.json"
    assert manifest_file.exists(), "ingestion_manifest.json must exist"

    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    assert "accepted_records_total" in manifest
    assert manifest["accepted_records_total"] >= 27000
    assert "breakdown" in manifest
    assert "rxnorm_clinical_concepts_scd" in manifest["breakdown"]
    assert "rxnorm_branded_drugs_sbd" in manifest["breakdown"]
    assert "curated_foundation_monographs" in manifest["breakdown"]


def test_api_medicines_pagination_large_scale():
    """Verify GET /api/v1/medicines reports total >= 27,000 and paginates accurately."""
    response = client.get("/api/v1/medicines?page=1&page_size=20")
    assert response.status_code == 200
    data = response.json()

    assert data["total"] >= 27000
    assert data["page"] == 1
    assert data["page_size"] == 20
    assert len(data["items"]) == 20
    assert data["total_pages"] >= 1350


def test_api_medicines_categories():
    """Verify GET /api/v1/medicines/categories returns multi-category distribution."""
    response = client.get("/api/v1/medicines/categories")
    assert response.status_code == 200
    categories = response.json()

    assert len(categories) >= 30
    cat_names = [c["category"] for c in categories]
    assert "Analgesic & Antipyretic" in cat_names or "General Pharmaceutical" in cat_names


def test_model_insights_status_endpoint():
    """Verify GET /api/v1/models/status returns 200 with CV and Storage Risk model info."""
    response = client.get("/api/v1/models/status")
    assert response.status_code == 200
    data = response.json()

    assert "vision_model" in data
    assert "storage_risk_model" in data
    assert data["vision_model"]["loaded"] is True
    assert data["storage_risk_model"]["loaded"] is True


def test_model_insights_metrics_endpoints():
    """Verify GET metrics endpoints return authentic artifact metrics."""
    # Vision metrics
    cv_res = client.get("/api/v1/models/vision/metrics")
    assert cv_res.status_code == 200
    cv_data = cv_res.json()
    assert "top1_accuracy" in cv_data
    assert "top3_accuracy" in cv_data
    assert "classes" in cv_data

    # Storage risk metrics
    sr_res = client.get("/api/v1/models/storage-risk/metrics")
    assert sr_res.status_code == 200
    sr_data = sr_res.json()
    assert "test_metrics" in sr_data
    assert "accuracy" in sr_data["test_metrics"]
    assert "feature_importances" in sr_data
    assert "algorithm" in sr_data


def test_storage_risk_insufficient_data_for_unquantified_concept():
    """Verify pure RxNorm concept returns INSUFFICIENT_DATA and ML unavailable."""
    response = client.post(
        "/api/v1/storage-risk/predict",
        json={
            "medicine_id": "RXN-1810997",
            "current_temperature": 28.0,
            "current_humidity": 60.0,
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["deterministic_compliance"]["status"] == "INSUFFICIENT_DATA"
    assert data["ml_risk"]["is_available"] is False
    assert "does not have enough structured storage metadata" in data["ml_risk"]["unavailable_reason"].lower()
