import sys
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "backend"))
sys.path.insert(0, str(root))

from fastapi.testclient import TestClient
from app.main import app
from app.ocr.retrieval import get_retriever
from app.ocr.fusion import compute_cv_ocr_fusion
from app.ocr.schemas import OCRTextLine, StructuredFields, CandidateMatch
from app.database.session import SessionLocal
from app.models.medicine import Medicine

client = TestClient(app)
retriever = get_retriever()
db = SessionLocal()

print("=== CHECK 4: SEARCH, RETRIEVAL, RANKING & FUSION INTEGRITY ===")

# 1. Spelling error / OCR corruption
cands_corrupt = retriever.retrieve_candidates(["AM0XICILLIN", "500mg", "Capsule"], limit=3)
print(f"\n1. Spelling corruption ['AM0XICILLIN', '500mg', 'Capsule']:")
for c in cands_corrupt:
    print(f"   [{c['retrieval_score']:.4f}] {c['medicine_id']}: {c['medicine_name']} (match: {c.get('match_reason')})")
assert len(cands_corrupt) > 0 and "amoxicillin" in cands_corrupt[0]["medicine_name"].lower(), "Failed corruption match"

# 2. Strength differentiation (500mg vs 650mg / 1000mg)
cands_500 = retriever.retrieve_candidates(["Paracetamol", "500 mg"], extracted_strength="500 mg", limit=3)
print(f"\n2. Strength differentiation for 500 mg:")
for c in cands_500:
    print(f"   [{c['retrieval_score']:.4f}] {c['medicine_id']}: {c['medicine_name']} (strength={c.get('strength')})")
assert "500" in cands_500[0]["medicine_name"] or "500" in cands_500[0].get("strength", ""), "Top candidate must be 500mg"

# 3. Dosage form differentiation (Tablet vs Suspension)
cands_tab = retriever.retrieve_candidates(["Paracetamol", "500 mg", "Tablet"], extracted_dosage_form="Tablet", limit=3)
cands_susp = retriever.retrieve_candidates(["Paracetamol", "120 mg", "Suspension"], extracted_dosage_form="Suspension", limit=3)
print(f"\n3. Dosage form differentiation:")
print(f"   Tablet request top match: {cands_tab[0]['medicine_name']} (form={cands_tab[0].get('dosage_form')})")
print(f"   Suspension request top match: {cands_susp[0]['medicine_name']} (form={cands_susp[0].get('dosage_form')})")

# 4. Combination drug vs single ingredient (Amlodipine + Telmisartan)
cands_combo = retriever.retrieve_candidates(["Amlodipine", "Telmisartan", "Tablet"], extracted_ingredients=["amlodipine", "telmisartan"], limit=3)
print(f"\n4. Multi-ingredient combination [Amlodipine + Telmisartan]:")
for c in cands_combo:
    print(f"   [{c['retrieval_score']:.4f}] {c['medicine_id']}: {c['medicine_name']}")
assert "amlodipine" in cands_combo[0]["medicine_name"].lower() and "telmisartan" in cands_combo[0]["medicine_name"].lower()

# 5. Conflicting visual vs OCR evidence fusion
matched_cv = db.query(Medicine).filter(Medicine.image_class == "amoxicillin_500mg_capsule").first()
cand_matches = [
    CandidateMatch(
        medicine_id="RXN-876528",
        medicine_name="amlodipine 5 MG / telmisartan 40 MG Oral Tablet [Twynsta]",
        generic_name="Amlodipine / Telmisartan",
        strength="5 MG / 40 MG",
        dosage_form="Tablet",
        similarity_score=0.92,
        matched_token="Amlodipine",
        active_ingredients=["amlodipine", "telmisartan"],
    )
]
fusion = compute_cv_ocr_fusion(
    cv_class="amoxicillin_500mg_capsule",
    cv_confidence=0.88,
    cv_threshold=0.60,
    ocr_fields=StructuredFields(),
    candidate_matches=cand_matches,
    matched_medicine=matched_cv,
)
print(f"\n5. Conflicting evidence fusion (CV Amoxicillin vs OCR Amlodipine/Telmisartan):")
print(f"   Identification status: {fusion.identification_status}")
print(f"   Agreement score: {fusion.agreement_score}")
print(f"   Reasons: {fusion.reasons}")
assert fusion.identification_status == "DIVERGENT", "Conflict must yield DIVERGENT"

# 6. Pagination & Filtering
p1 = client.get("/api/v1/medicines?page=1&page_size=10").json()
p50 = client.get("/api/v1/medicines?page=50&page_size=10").json()
p_cat = client.get("/api/v1/medicines?category=Analgesic+%26+Antipyretic&page=1&page_size=5").json()
print(f"\n6. API Pagination & Filtering:")
print(f"   Page 1 total={p1['total']}, items={len(p1['items'])}, first_id={p1['items'][0]['medicine_id']}")
print(f"   Page 50 total={p50['total']}, items={len(p50['items'])}, first_id={p50['items'][0]['medicine_id']}")
print(f"   Category 'Analgesic & Antipyretic' total={p_cat['total']}, returned={len(p_cat['items'])}")
assert p1["items"][0]["medicine_id"] != p50["items"][0]["medicine_id"], "Pagination must return different items"

# 7. Autocomplete Search
search_res = client.get("/api/v1/medicines/search?q=atorva&limit=5").json()
print(f"\n7. Autocomplete Search 'atorva':")
for s in search_res:
    print(f"   - {s['medicine_id']}: {s['medicine_name']} ({s['generic_name']})")
assert len(search_res) > 0 and any("atorvastatin" in s["generic_name"].lower() for s in search_res)

db.close()
print("\n>>> ALL CHECK 4 TESTS PASSED! <<<")
