import pytest
import tempfile
import os
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.medicine import Medicine
from app.database.seed import seed_medicines
from ml.preprocessing.validate_medicine_dataset import validate_dataset

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Dataset Quality Tests
# ---------------------------------------------------------------------------

def test_dataset_validation_passes():
    is_valid, report = validate_dataset()
    assert is_valid is True
    assert report["total_records"] >= 20
    assert report["valid_records"] == report["total_records"]
    assert len(report["errors"]) == 0
    assert report["unique_medicine_ids"] == report["total_records"]
    assert report["unique_image_classes"] == report["total_records"]


def test_dataset_validation_detects_duplicates():
    csv_content = """medicine_id,medicine_name,generic_name,brand_name,strength,dosage_form,category,manufacturer,storage_min_temperature,storage_max_temperature,storage_min_humidity,storage_max_humidity,expiry_warning_days,image_class,source,source_url
TEST-001,Test Med 1,Gen 1,Brand 1,10mg,Tablet,Cat 1,Man 1,15.0,25.0,,,60,test_med_1,Source 1,https://example.com
TEST-001,Test Med 2,Gen 2,Brand 2,20mg,Tablet,Cat 1,Man 2,15.0,25.0,,,60,test_med_2,Source 2,https://example.com
"""
    with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".csv") as tmp:
        tmp.write(csv_content)
        tmp_path = tmp.name

    try:
        is_valid, report = validate_dataset(tmp_path)
        assert is_valid is False
        assert any("Duplicate medicine_id" in err for err in report["errors"])
    finally:
        os.remove(tmp_path)


def test_dataset_validation_detects_inverted_temperature():
    csv_content = """medicine_id,medicine_name,generic_name,brand_name,strength,dosage_form,category,manufacturer,storage_min_temperature,storage_max_temperature,storage_min_humidity,storage_max_humidity,expiry_warning_days,image_class,source,source_url
TEST-001,Test Med 1,Gen 1,Brand 1,10mg,Tablet,Cat 1,Man 1,30.0,15.0,,,60,test_med_1,Source 1,https://example.com
"""
    with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".csv") as tmp:
        tmp.write(csv_content)
        tmp_path = tmp.name

    try:
        is_valid, report = validate_dataset(tmp_path)
        assert is_valid is False
        assert any("Inverted temperature range" in err for err in report["errors"])
    finally:
        os.remove(tmp_path)


def test_dataset_validation_detects_missing_fields():
    csv_content = """medicine_id,medicine_name,generic_name,brand_name,strength,dosage_form,category,manufacturer,storage_min_temperature,storage_max_temperature,storage_min_humidity,storage_max_humidity,expiry_warning_days,image_class,source,source_url
TEST-001,,Gen 1,Brand 1,10mg,Tablet,Cat 1,Man 1,15.0,25.0,,,60,test_med_1,Source 1,https://example.com
"""
    with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".csv") as tmp:
        tmp.write(csv_content)
        tmp_path = tmp.name

    try:
        is_valid, report = validate_dataset(tmp_path)
        assert is_valid is False
        assert any("Missing required field 'medicine_name'" in err for err in report["errors"])
    finally:
        os.remove(tmp_path)


# ---------------------------------------------------------------------------
# 2. Database & Idempotency Tests
# ---------------------------------------------------------------------------

def test_seed_is_idempotent():
    db = SessionLocal()
    try:
        # First execution: records may be added or already present
        res1 = seed_medicines(db=db)
        assert res1["total"] >= 20

        # Second execution: must add 0 records, skip all
        res2 = seed_medicines(db=db)
        assert res2["added"] == 0
        assert res2["skipped"] == res2["total"]

        total_db = db.query(Medicine).count()
        assert total_db == res2["total"]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 3. Medicine API Endpoint Tests
# ---------------------------------------------------------------------------

def test_api_list_medicines_default():
    response = client.get("/api/medicines")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 20
    assert len(data["items"]) <= 10
    assert data["page"] == 1


def test_api_list_medicines_pagination():
    response = client.get("/api/medicines?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
    assert data["page"] == 1
    assert data["page_size"] == 5
    assert data["total_pages"] >= 4

    response_p2 = client.get("/api/medicines?page=2&page_size=5")
    assert response_p2.status_code == 200
    data_p2 = response_p2.json()
    assert len(data_p2["items"]) == 5
    # Ensure disjoint items across pages
    ids_p1 = {item["medicine_id"] for item in data["items"]}
    ids_p2 = {item["medicine_id"] for item in data_p2["items"]}
    assert len(ids_p1.intersection(ids_p2)) == 0


def test_api_get_medicine_by_id_success():
    response = client.get("/api/medicines/MED-001")
    assert response.status_code == 200
    data = response.json()
    assert data["medicine_id"] == "MED-001"
    assert "Paracetamol" in data["medicine_name"]
    assert data["storage_min_temperature"] == 20.0
    assert data["storage_max_temperature"] == 25.0
    assert "source" in data
    assert "source_url" in data


def test_api_get_medicine_not_found():
    response = client.get("/api/medicines/NON_EXISTENT_ID_9999")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_api_search_medicines():
    response = client.get("/api/medicines/search?q=Insulin")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 2
    for item in items:
        assert (
            "insulin" in item["medicine_name"].lower()
            or "insulin" in item["generic_name"].lower()
            or "insulin" in (item["brand_name"] or "").lower()
        )


def test_api_filter_by_category():
    response = client.get("/api/medicines?category=Analgesic%20%2F%20Antipyretic")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["category"] == "Analgesic / Antipyretic"


def test_api_list_categories():
    response = client.get("/api/medicines/categories")
    assert response.status_code == 200
    categories = response.json()
    assert len(categories) > 0
    cat_names = [c["category"] for c in categories]
    assert "Analgesic / Antipyretic" in cat_names
    assert all(c["count"] > 0 for c in categories)
