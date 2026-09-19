"""
API & Service Tests for MediShelf AI Phase 5 Storage Risk Assessment
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_storage_risk_metadata_endpoint():
    """Verify metadata endpoint returns valid model details and disclaimer."""
    response = client.get("/api/v1/storage-risk/metadata")
    assert response.status_code == 200
    data = response.json()
    assert data["model_name"] == "MediShelf AI Storage Risk Classifier"
    assert data["algorithm"] == "GradientBoostingClassifier"
    assert len(data["features"]) == 15
    assert "simulation-derived" in data["dataset_type"].lower()
    assert "disclaimer" in data


def test_storage_risk_predict_nominal_room_temperature():
    """Verify compliant ambient conditions yield LOW risk and compliant status."""
    payload = {
        "medicine_id": "MED-001",  # Paracetamol 500mg: 20-25°C
        "current_temperature": 22.5,
        "current_humidity": 45.0,
        "excursion_duration_hours": 0.0,
        "days_to_expiry": 365,
    }
    response = client.post("/api/v1/storage-risk/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Verify medicine and monograph facts
    assert data["medicine"]["medicine_id"] == "MED-001"
    assert data["storage_requirements"]["min_temperature"] == 20.0
    assert data["storage_requirements"]["max_temperature"] == 25.0
    assert data["storage_requirements"]["has_quantified_humidity"] is False
    
    # Verify deterministic compliance
    assert data["deterministic_compliance"]["is_compliant"] is True
    assert data["deterministic_compliance"]["temp_compliant"] is True
    assert data["deterministic_compliance"]["temp_deviation"] == 0.0
    assert data["deterministic_compliance"]["humidity_compliant"] is None
    
    # Verify ML output
    assert data["ml_risk"]["level"] == "LOW"
    assert data["ml_risk"]["confidence"] > 0.8
    assert set(data["ml_risk"]["probabilities"].keys()) == {"LOW", "MODERATE", "HIGH"}
    assert len(data["ml_risk"]["top_factors"]) > 0
    assert "disclaimer" in data


def test_storage_risk_predict_cold_chain_severe_excursion():
    """Verify cold-chain insulin exposed to room/warm temp yields HIGH risk."""
    payload = {
        "medicine_id": "MED-014",  # Humulin R: 2-8°C cold chain
        "current_temperature": 28.0,
        "current_humidity": 50.0,
        "excursion_duration_hours": 24.0,
        "days_to_expiry": 180,
    }
    response = client.post("/api/v1/storage-risk/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["deterministic_compliance"]["is_compliant"] is False
    assert data["deterministic_compliance"]["temp_compliant"] is False
    assert data["deterministic_compliance"]["temp_deviation"] == 20.0  # 28 - 8
    
    # ML risk prediction should be HIGH
    assert data["ml_risk"]["level"] == "HIGH"
    assert data["ml_risk"]["confidence"] > 0.8


def test_storage_risk_predict_handles_missing_humidity_input():
    """Verify omitting humidity input is safely handled without error."""
    payload = {
        "medicine_id": "MED-005",  # Atorvastatin 20mg
        "current_temperature": 22.0,
        # current_humidity is omitted (None)
        "excursion_duration_hours": 2.0,
        "days_to_expiry": 200,
    }
    response = client.post("/api/v1/storage-risk/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["deterministic_compliance"]["humidity_compliant"] is None
    assert "not quantified" in data["deterministic_compliance"]["humidity_status_text"].lower()


def test_storage_risk_predict_expiry_date_string_parsing():
    """Verify YYYY-MM expiry date string is accepted and parsed."""
    payload = {
        "medicine_id": "MED-002",
        "current_temperature": 22.0,
        "expiry_date": "2027-06",
    }
    response = client.post("/api/v1/storage-risk/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ml_risk"]["level"] == "LOW"


def test_storage_risk_predict_expired_product():
    """Verify expired medicine receives HIGH risk."""
    payload = {
        "medicine_id": "MED-001",
        "current_temperature": 22.0,
        "days_to_expiry": -10,  # Expired 10 days ago
    }
    response = client.post("/api/v1/storage-risk/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ml_risk"]["level"] == "HIGH"


def test_storage_risk_unknown_medicine_returns_404():
    """Verify querying non-existent medicine returns 404."""
    payload = {
        "medicine_id": "MED-999",
        "current_temperature": 22.0,
    }
    response = client.post("/api/v1/storage-risk/predict", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_storage_risk_invalid_temperature_validation():
    """Verify out-of-range temperature returns 422."""
    payload = {
        "medicine_id": "MED-001",
        "current_temperature": 250.0,  # Unrealistic > 100°C
    }
    response = client.post("/api/v1/storage-risk/predict", json=payload)
    assert response.status_code == 422


def test_storage_risk_route_alias():
    """Verify /api/storage-risk/predict works as well as /api/v1/storage-risk/predict."""
    payload = {
        "medicine_id": "MED-004",
        "current_temperature": 21.0,
    }
    response = client.post("/api/storage-risk/predict", json=payload)
    assert response.status_code == 200
    assert response.json()["medicine"]["medicine_id"] == "MED-004"
