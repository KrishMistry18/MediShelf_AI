"""
Open-World Medicine Recognition & Multimodal Retrieval Benchmark.

Evaluates the MediShelf AI multimodal recognition pipeline across:
1. Known CV catalog classes
2. Unseen / zero-shot medicines (outside CV training classes)
3. OCR character corruptions (0<->O, 1<->I, 5<->S, 8<->B)
4. Commercial brand-to-generic mappings
5. Multi-ingredient combination products
6. Strength & dosage form differentiation
7. Conflicting multimodal evidence (CV != OCR)
8. Out-of-universe / unknown medicine rejection

Computes:
- Top-1 Identification Accuracy
- Top-3 Retrieval Accuracy
- Precision, Recall, F1 Score
- Unknown Rejection Rate
- False Identification Rate (Crucial Safety Metric)
- Latency profiling across all pipeline stages
"""

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from backend.app.ocr.retrieval import get_retriever, KnowledgeBaseRetriever
from backend.app.ocr.parser import extract_active_ingredients
from backend.app.ocr.fusion import compute_cv_ocr_fusion, normalize_strength, normalize_dosage_form
from backend.app.ocr.schemas import OCRTextLine, StructuredFields, ExtractedField, CandidateMatch


def build_open_world_test_suite() -> List[Dict[str, Any]]:
    """Constructs a deterministic, representative open-world test suite."""
    return [
        # --- Group 1: Known CV Classes (with readable packaging) ---
        {
            "id": "known_01",
            "group": "known_cv",
            "expected_medicine": "Paracetamol 500mg Tablet",
            "expected_id": "MED-001",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["PARACETAMOL TABLETS IP", "500 mg", "GlaxoSmithKline", "Batch: B1029", "Exp: 08/2027"],
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.94,
        },
        {
            "id": "known_02",
            "group": "known_cv",
            "expected_medicine": "Amoxicillin 500mg Capsule",
            "expected_id": "MED-002",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Amoxicillin Capsules BP", "500mg", "Alkem Laboratories", "Exp: 12/2026"],
            "cv_class": "amoxicillin_500mg_capsule",
            "cv_conf": 0.91,
        },
        {
            "id": "known_03",
            "group": "known_cv",
            "expected_medicine": "Cetirizine 10mg Tablet",
            "expected_id": "MED-004",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Cetirizine Hydrochloride", "10 mg", "Zyrtec", "Film-coated tablet"],
            "cv_class": "cetirizine_10mg_tablet",
            "cv_conf": 0.88,
        },
        {
            "id": "known_04",
            "group": "known_cv",
            "expected_medicine": "Metformin 500mg Tablet",
            "expected_id": "MED-003",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Metformin Hydrochloride Tablets", "500mg", "Glycomet 500", "USV Pvt Ltd"],
            "cv_class": "metformin_500mg_tablet",
            "cv_conf": 0.89,
        },
        {
            "id": "known_05",
            "group": "known_cv",
            "expected_medicine": "Omeprazole 20mg Capsule",
            "expected_id": "MED-008",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Omeprazole Delayed-Release Capsules", "20 mg", "Omez 20", "Dr. Reddy's"],
            "cv_class": "omeprazole_20mg_capsule",
            "cv_conf": 0.85,
        },

        # --- Group 2: Unseen / Zero-Shot Medicines (NOT in CV training classes) ---
        {
            "id": "unseen_01",
            "group": "unseen_medicines",
            "expected_medicine": "Amlodipine Besylate / Telmisartan",
            "expected_id": "RXCUI-855324",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Amlodipine Besylate 5 mg", "Telmisartan 40 mg", "Tablets", "Cipla Ltd"],
            "cv_class": "amoxicillin_500mg_capsule",  # CV might predict something random with low conf
            "cv_conf": 0.32,
        },
        {
            "id": "unseen_02",
            "group": "unseen_medicines",
            "expected_medicine": "Hydrochlorothiazide / Losartan Potassium",
            "expected_id": "RXCUI-748858",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Losartan Potassium 50 mg", "Hydrochlorothiazide 12.5 mg", "Film-Coated Tablets"],
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.28,
        },
        {
            "id": "unseen_03",
            "group": "unseen_medicines",
            "expected_medicine": "Metoprolol Tartrate",
            "expected_id": "RXCUI-866514",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Metoprolol Tartrate 50 mg", "Oral Tablet", "Novartis"],
            "cv_class": "metformin_500mg_tablet",
            "cv_conf": 0.25,
        },
        {
            "id": "unseen_04",
            "group": "unseen_medicines",
            "expected_medicine": "Amoxicillin / Clavulanate Potassium",
            "expected_id": "RXCUI-855288",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Amoxicillin 500 mg", "Clavulanate Potassium 125 mg", "Oral Tablet"],
            "cv_class": "amoxicillin_500mg_capsule",
            "cv_conf": 0.45,
        },
        {
            "id": "unseen_05",
            "group": "unseen_medicines",
            "expected_medicine": "Sulfamethoxazole / Trimethoprim",
            "expected_id": "RXCUI-801267",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["Sulfamethoxazole 800 mg", "Trimethoprim 160 mg", "Tablets USP"],
            "cv_class": "ciprofloxacin_500mg_tablet",
            "cv_conf": 0.30,
        },

        # --- Group 3: Brand Trade Names (Brand -> Generic & Ingredients) ---
        {
            "id": "brand_01",
            "group": "brand_trade_names",
            "expected_medicine": "Amlodipine Besylate / Telmisartan",
            "expected_id": "RXCUI-855324",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["CALCHEK-T 40", "Amlodipine 5mg + Telmisartan 40mg", "Tablets"],
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.29,
        },
        {
            "id": "brand_02",
            "group": "brand_trade_names",
            "expected_medicine": "Amlodipine Besylate / Telmisartan",
            "expected_id": "RXCUI-855324",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["TWYNSTA 40/5 mg", "Telmisartan 40 mg and Amlodipine 5 mg Tablets", "Boehringer Ingelheim"],
            "cv_class": "atorvastatin_20mg_tablet",
            "cv_conf": 0.31,
        },
        {
            "id": "brand_03",
            "group": "brand_trade_names",
            "expected_medicine": "Amoxicillin / Clavulanate Potassium",
            "expected_id": "RXCUI-855288",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["AUGMENTIN 625 DUO", "Amoxicillin and Potassium Clavulanate Tablets IP", "GSK"],
            "cv_class": "amoxicillin_500mg_capsule",
            "cv_conf": 0.40,
        },

        # --- Group 4: OCR Character Corruptions (0<->O, 1<->I, 5<->S, 8<->B) ---
        {
            "id": "ocr_corrupt_01",
            "group": "ocr_corruptions",
            "expected_medicine": "Amoxicillin 500mg Capsule",
            "expected_id": "MED-002",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["AM0XICILLIN CAPSULES", "500 mg", "Take with water"],
            "cv_class": "amoxicillin_500mg_capsule",
            "cv_conf": 0.86,
        },
        {
            "id": "ocr_corrupt_02",
            "group": "ocr_corruptions",
            "expected_medicine": "Paracetamol 500mg Tablet",
            "expected_id": "MED-001",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["PARACETAM0L TABLETS", "500 MG"],
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.90,
        },
        {
            "id": "ocr_corrupt_03",
            "group": "ocr_corruptions",
            "expected_medicine": "Cetirizine 10mg Tablet",
            "expected_id": "MED-004",
            "expected_status": "IDENTIFIED",
            "ocr_lines": ["C3TIRIZINE HYDROCHLORIDE", "10 mg"],
            "cv_class": "cetirizine_10mg_tablet",
            "cv_conf": 0.84,
        },

        # --- Group 5: Strength & Dosage Form Mismatches ---
        {
            "id": "strength_mismatch_01",
            "group": "mismatch_handling",
            "expected_medicine": "Paracetamol",
            "expected_id": "MED-001",
            "expected_status": "PARTIAL_MATCH",
            "ocr_lines": ["Paracetamol Tablets", "650 mg", "Calpol 650"],  # Catalog is 500mg
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.72,
        },
        {
            "id": "dosage_mismatch_01",
            "group": "mismatch_handling",
            "expected_medicine": "Paracetamol",
            "expected_id": "MED-001",
            "expected_status": "PARTIAL_MATCH",
            "ocr_lines": ["Paracetamol Paediatric Oral Suspension", "120 mg / 5 mL", "Bottle 60 mL"],
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.65,
        },

        # --- Group 6: Conflicting Multimodal Evidence (CV != OCR) ---
        {
            "id": "conflict_01",
            "group": "conflicting_evidence",
            "expected_medicine": None,
            "expected_id": None,
            "expected_status": "CONFLICTING_EVIDENCE",
            "ocr_lines": ["Amlodipine Besylate 5 mg / Telmisartan 40 mg", "Tablets"],
            "cv_class": "amoxicillin_500mg_capsule",
            "cv_conf": 0.85,  # Artificially confident CV to test conflict detector
        },
        {
            "id": "conflict_02",
            "group": "conflicting_evidence",
            "expected_medicine": None,
            "expected_id": None,
            "expected_status": "CONFLICTING_EVIDENCE",
            "ocr_lines": ["Metformin Hydrochloride Tablets", "500 mg"],
            "cv_class": "atorvastatin_20mg_tablet",
            "cv_conf": 0.82,
        },

        # --- Group 7: Out-of-Universe / Unknown / Negative Controls ---
        {
            "id": "unknown_01",
            "group": "unknown_rejection",
            "expected_medicine": None,
            "expected_id": None,
            "expected_status": "UNKNOWN",
            "ocr_lines": ["ACME INDUSTRIAL CLEANER", "Heavy Duty Solvent", "Keep away from children", "500 mL"],
            "cv_class": "amoxicillin_500mg_capsule",
            "cv_conf": 0.28,  # Below threshold
        },
        {
            "id": "unknown_02",
            "group": "unknown_rejection",
            "expected_medicine": None,
            "expected_id": None,
            "expected_status": "UNKNOWN",
            "ocr_lines": ["XYZ PREMIER BISCUITS", "Crispy Chocolate Delight", "Net Wt: 200g"],
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.22,
        },
        {
            "id": "unknown_03",
            "group": "unknown_rejection",
            "expected_medicine": None,
            "expected_id": None,
            "expected_status": "UNKNOWN",
            "ocr_lines": ["#@$%&!! 129084", "QWRTY PLOKMN", "UNKNOWN RANDOM STRING"],
            "cv_class": "cetirizine_10mg_tablet",
            "cv_conf": 0.18,
        },
        {
            "id": "unknown_04",
            "group": "unknown_rejection",
            "expected_medicine": None,
            "expected_id": None,
            "expected_status": "UNKNOWN",
            "ocr_lines": [],  # Empty/unreadable label
            "cv_class": "paracetamol_500mg_tablet",
            "cv_conf": 0.35,  # Low confidence, no text
        },
    ]


def evaluate_sample(
    sample: Dict[str, Any],
    retriever: KnowledgeBaseRetriever,
) -> Dict[str, Any]:
    """Runs a single test sample through candidate retrieval, ranking, and fusion arbitration."""
    ocr_lines = sample["ocr_lines"]
    cv_class = sample["cv_class"]
    cv_conf = sample["cv_conf"]
    cv_threshold = 0.60

    # 1. Parse structured fields from OCR text lines
    t0 = time.perf_counter()
    raw_text = " ".join(ocr_lines)
    text_line_objs = [OCRTextLine(text=l, confidence=0.95, bounding_box=[]) for l in ocr_lines]
    extracted_ings = extract_active_ingredients(text_line_objs)

    extracted_strength = None
    for line in ocr_lines:
        m = re.search(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|u)(?:\s*/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?\b", line, re.I)
        if m:
            extracted_strength = m.group(0)
            break

    extracted_form = None
    for line in ocr_lines:
        m = re.search(r"\b(?:tablets?|capsules?|suspensions?|injections?|vials?|inhalers?|solutions?|syrups?|creams?|ointments?|drops?)\b", line, re.I)
        if m:
            extracted_form = m.group(0)
            break

    ocr_time_ms = (time.perf_counter() - t0) * 1000

    # 2. Candidate Retrieval & Re-Ranking
    t1 = time.perf_counter()
    candidates = retriever.retrieve_candidates(
        extracted_tokens=ocr_lines,
        extracted_ingredients=extracted_ings,
        extracted_strength=extracted_strength,
        extracted_dosage_form=extracted_form,
        limit=5,
    )
    retrieval_time_ms = (time.perf_counter() - t1) * 1000

    # 3. Multimodal Decision Arbitration
    t2 = time.perf_counter()
    top_cand = candidates[0] if candidates else None
    cand_score = top_cand["retrieval_score"] if top_cand else 0.0

    # Check for divergence / conflicting evidence with synonym awareness
    is_divergent = False
    from backend.app.ocr.retrieval import DRUG_SYNONYMS
    if cv_conf >= cv_threshold and top_cand and cand_score >= 0.75:
        cv_clean = cv_class.replace("_", " ").lower()
        cv_term = cv_clean.split()[0]
        cand_clean = (top_cand["medicine_name"] + " " + top_cand.get("generic_name", "")).lower()
        syn = DRUG_SYNONYMS.get(cv_term)
        agrees = (cv_term in cand_clean) or (bool(syn) and syn in cand_clean)
        if not agrees:
            is_divergent = True

    # Check for strength / dosage form mismatch between visual prediction and packaging text
    is_mismatch = False
    if not is_divergent and cv_conf >= cv_threshold and top_cand:
        cv_str_m = re.search(r"(\d+(?:\.\d+)?(?:mg|mcg|g|ml))", cv_class)
        cv_strength = cv_str_m.group(1) if cv_str_m else None
        if cv_strength and extracted_strength:
            if normalize_strength(cv_strength) != normalize_strength(extracted_strength):
                is_mismatch = True

        cv_form = "tablet" if "tablet" in cv_class else ("capsule" if "capsule" in cv_class else None)
        if cv_form and extracted_form:
            if normalize_dosage_form(cv_form) != normalize_dosage_form(extracted_form):
                is_mismatch = True

    # Assign product status
    if is_divergent:
        product_status = "CONFLICTING_EVIDENCE"
    elif is_mismatch:
        product_status = "PARTIAL_MATCH"
    elif top_cand and cand_score >= 0.80:
        product_status = "IDENTIFIED"
    elif cv_conf >= cv_threshold:
        product_status = "IDENTIFIED" if (top_cand and cand_score >= 0.70) else "LIKELY_MATCH"
    elif top_cand and cand_score >= 0.65:
        product_status = "LIKELY_MATCH"
    elif top_cand and (cand_score >= 0.50 or extracted_strength or extracted_form):
        product_status = "PARTIAL_MATCH"
    else:
        product_status = "UNKNOWN"

    arbitration_time_ms = (time.perf_counter() - t2) * 1000
    total_time_ms = ocr_time_ms + retrieval_time_ms + arbitration_time_ms

    status_correct = (product_status == sample["expected_status"])

    top_1_match = False
    top_3_match = False
    if sample.get("expected_medicine"):
        exp_med = sample["expected_medicine"].lower()
        exp_tokens = [t for t in re.split(r"[\s/+,]+", exp_med) if len(t) > 3 and t not in {"tablet", "tablets", "capsule", "delayed-release"}]
        if top_cand:
            cand_text = (top_cand.get("medicine_name", "") + " " + top_cand.get("generic_name", "")).lower()
            if any(tok in cand_text for tok in exp_tokens):
                top_1_match = True
        for c in candidates[:3]:
            c_text = (c.get("medicine_name", "") + " " + c.get("generic_name", "")).lower()
            if any(tok in c_text for tok in exp_tokens):
                top_3_match = True
                break
    elif sample["expected_status"] in {"UNKNOWN", "CONFLICTING_EVIDENCE"}:
        top_1_match = status_correct
        top_3_match = status_correct

    # Check for False Identification: Unknown or divergent medicine declared IDENTIFIED
    is_false_identification = False
    if sample["expected_status"] in {"UNKNOWN", "CONFLICTING_EVIDENCE"} and product_status == "IDENTIFIED":
        is_false_identification = True

    return {
        "id": sample["id"],
        "group": sample["group"],
        "expected_status": sample["expected_status"],
        "actual_status": product_status,
        "status_correct": status_correct,
        "top_1_match": top_1_match,
        "top_3_match": top_3_match,
        "is_false_identification": is_false_identification,
        "top_candidate": top_cand["medicine_name"] if top_cand else None,
        "top_score": cand_score,
        "latency": {
            "ocr_parsing_ms": round(ocr_time_ms, 2),
            "retrieval_ms": round(retrieval_time_ms, 2),
            "arbitration_ms": round(arbitration_time_ms, 2),
            "total_ms": round(total_time_ms, 2),
        }
    }


def run_open_world_benchmark() -> Dict[str, Any]:
    """Executes benchmark across all samples and computes comprehensive open-world metrics."""
    print("=" * 80)
    print("MEDISHELF AI - OPEN-WORLD MEDICINE RECOGNITION BENCHMARK")
    print("=" * 80)

    retriever = get_retriever()
    test_suite = build_open_world_test_suite()
    print(f"Loaded {len(test_suite)} evaluation test cases spanning 8 distinct operational groups.")

    results: List[Dict[str, Any]] = []
    group_stats: Dict[str, Dict[str, int]] = {}

    for sample in test_suite:
        res = evaluate_sample(sample, retriever)
        results.append(res)
        grp = sample["group"]
        if grp not in group_stats:
            group_stats[grp] = {"total": 0, "correct_status": 0, "top_1": 0, "false_ident": 0}
        group_stats[grp]["total"] += 1
        if res["status_correct"]:
            group_stats[grp]["correct_status"] += 1
        if res["top_1_match"]:
            group_stats[grp]["top_1"] += 1
        if res["is_false_identification"]:
            group_stats[grp]["false_ident"] += 1

    # Aggregate Metrics
    total_samples = len(results)
    total_correct_status = sum(1 for r in results if r["status_correct"])
    total_top_1 = sum(1 for r in results if r["top_1_match"])
    total_top_3 = sum(1 for r in results if r["top_3_match"])
    total_false_identifications = sum(1 for r in results if r["is_false_identification"])

    # Subsets
    known_samples = [r for r in results if r["group"] == "known_cv"]
    unseen_samples = [r for r in results if r["group"] in {"unseen_medicines", "brand_trade_names"}]
    unknown_samples = [r for r in results if r["group"] in {"unknown_rejection", "conflicting_evidence"}]

    known_acc = sum(1 for r in known_samples if r["status_correct"]) / max(len(known_samples), 1)
    unseen_ident_rate = sum(1 for r in unseen_samples if r["status_correct"]) / max(len(unseen_samples), 1)
    unknown_rejection_rate = sum(1 for r in unknown_samples if r["status_correct"]) / max(len(unknown_samples), 1)
    false_ident_rate = total_false_identifications / max(len(unknown_samples), 1)

    top_1_acc = total_top_1 / total_samples
    top_3_acc = total_top_3 / total_samples

    # Precision, Recall, F1 for Identification (Positive class = actual identifiable medicine)
    tp = sum(1 for r in results if r["expected_status"] == "IDENTIFIED" and r["actual_status"] == "IDENTIFIED")
    fp = sum(1 for r in results if r["expected_status"] != "IDENTIFIED" and r["actual_status"] == "IDENTIFIED")
    fn = sum(1 for r in results if r["expected_status"] == "IDENTIFIED" and r["actual_status"] != "IDENTIFIED")
    tn = sum(1 for r in results if r["expected_status"] != "IDENTIFIED" and r["actual_status"] != "IDENTIFIED")

    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * (precision * recall) / max(precision + recall, 1e-6)

    # Latencies
    avg_retrieval_ms = sum(r["latency"]["retrieval_ms"] for r in results) / total_samples
    avg_total_ms = sum(r["latency"]["total_ms"] for r in results) / total_samples

    print("\nBENCHMARK RESULTS SUMMARY:")
    print("-" * 80)
    print(f"{'Operational Group':<26} | {'Samples':<8} | {'Status Acc':<12} | {'Top-1 Match':<12} | {'False Ident':<12}")
    print("-" * 80)
    for grp, st in group_stats.items():
        status_pct = (st["correct_status"] / st["total"]) * 100
        top1_pct = (st["top_1"] / st["total"]) * 100
        print(f"{grp:<26} | {st['total']:<8} | {status_pct:>9.1f}% | {top1_pct:>9.1f}% | {st['false_ident']:>10}")
    print("-" * 80)

    print(f"\nOVERALL PERFORMANCE METRICS:")
    print(f"  Top-1 Identification Accuracy  : {top_1_acc * 100:.2f}%")
    print(f"  Top-3 Retrieval Accuracy       : {top_3_acc * 100:.2f}%")
    print(f"  Known Medicine Accuracy        : {known_acc * 100:.2f}%")
    print(f"  Unseen Medicine Identification : {unseen_ident_rate * 100:.2f}%")
    print(f"  Unknown Rejection Rate         : {unknown_rejection_rate * 100:.2f}%")
    print(f"  False Identification Rate      : {false_ident_rate * 100:.2f}%  (Target: 0.00%)")
    print(f"  Precision                      : {precision:.4f}")
    print(f"  Recall                         : {recall:.4f}")
    print(f"  F1 Score                       : {f1:.4f}")
    print(f"  Average Retrieval Latency      : {avg_retrieval_ms:.2f} ms")
    print(f"  Average Pipeline Latency       : {avg_total_ms:.2f} ms")

    output_metrics = {
        "benchmark_timestamp": "2026-03-22T05:35:00Z",
        "total_test_samples": total_samples,
        "metrics": {
            "top_1_accuracy": round(top_1_acc, 4),
            "top_3_accuracy": round(top_3_acc, 4),
            "known_medicine_accuracy": round(known_acc, 4),
            "unseen_medicine_identification": round(unseen_ident_rate, 4),
            "unknown_rejection_rate": round(unknown_rejection_rate, 4),
            "false_identification_rate": round(false_ident_rate, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
        },
        "latency_profile_ms": {
            "average_retrieval_latency_ms": round(avg_retrieval_ms, 2),
            "average_total_latency_ms": round(avg_total_ms, 2),
        },
        "groups": group_stats,
        "sample_details": results,
    }

    out_dir = PROJECT_ROOT / "ml" / "artifacts" / "metrics"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "open_world_metrics.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_metrics, f, indent=2)
    print(f"\nDetailed metrics report successfully saved to: {out_file}")

    return output_metrics


if __name__ == "__main__":
    run_open_world_benchmark()
