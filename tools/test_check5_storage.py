import sys
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "backend"))
sys.path.insert(0, str(root))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("=== CHECK 5: STORAGE ASSESSMENT INTEGRITY & INSUFFICIENT_DATA ===")

# 1. Curated Monograph: MED-001 (Paracetamol 500mg Tablets, 20-25 C)
res_med001 = client.post(
    "/api/v1/storage-risk/predict",
    json={"medicine_id": "MED-001", "current_temperature": 22.0, "current_humidity": 50.0},
)
assert res_med001.status_code == 200, f"MED-001 failed: {res_med001.text}"
data_001 = res_med001.json()
print("\n1. Curated Monograph (MED-001) nominal 22 C:")
print(f"   Deterministic: {data_001['deterministic_compliance']['status']}, is_compliant={data_001['deterministic_compliance']['is_compliant']}")
print(f"   ML Risk: {data_001['ml_risk']['level']} (conf={data_001['ml_risk']['confidence']:.2f}, available={data_001['ml_risk']['is_available']})")
assert data_001["deterministic_compliance"]["status"] == "COMPLIANT"
assert data_001["ml_risk"]["is_available"] is True

# 2. Curated Cold-Chain Monograph: MED-009 (Humulin R, 2-8 C) at 15 C (Excursion)
res_med009 = client.post(
    "/api/v1/storage-risk/predict",
    json={"medicine_id": "MED-009", "current_temperature": 15.0, "current_humidity": 50.0, "excursion_duration_hours": 4.0},
)
assert res_med009.status_code == 200
data_009 = res_med009.json()
print("\n2. Curated Cold Chain (MED-009) excursion at 15 C:")
print(f"   Deterministic: {data_009['deterministic_compliance']['status']}, is_compliant={data_009['deterministic_compliance']['is_compliant']}")
print(f"   ML Risk: {data_009['ml_risk']['level']} (available={data_009['ml_risk']['is_available']})")
assert data_009["deterministic_compliance"]["status"] == "OUTSIDE_DOCUMENTED_RANGE"

# 3. External Pure RxNorm Concept without quantified limits (RXN-1810997)
res_rxn = client.post(
    "/api/v1/storage-risk/predict",
    json={"medicine_id": "RXN-1810997", "current_temperature": 28.0, "current_humidity": 60.0},
)
assert res_rxn.status_code == 200
data_rxn = res_rxn.json()
print("\n3. External Pure RxNorm Concept (RXN-1810997) without SPL limits:")
print(f"   Deterministic: {data_rxn['deterministic_compliance']['status']}")
print(f"   Summary text: {data_rxn['deterministic_compliance']['temp_status_text']}")
print(f"   ML Risk available: {data_rxn['ml_risk']['is_available']}")
print(f"   Unavailable reason: {data_rxn['ml_risk']['unavailable_reason']}")
assert data_rxn["deterministic_compliance"]["status"] == "INSUFFICIENT_DATA", "Must return INSUFFICIENT_DATA"
assert data_rxn["deterministic_compliance"]["is_compliant"] is False
assert data_rxn["ml_risk"]["is_available"] is False
assert data_rxn["storage_requirements"]["min_temperature"] is None, "Must not fabricate min_temperature"
assert data_rxn["storage_requirements"]["max_temperature"] is None, "Must not fabricate max_temperature"

# 4. Unknown Medicine ID
res_404 = client.post(
    "/api/v1/storage-risk/predict",
    json={"medicine_id": "NONEXISTENT-9999", "current_temperature": 25.0},
)
print(f"\n4. Nonexistent medicine ID response code: {res_404.status_code}")
assert res_404.status_code == 404

print("\n>>> ALL CHECK 5 TESTS PASSED! <<<")
