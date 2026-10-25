"""
MediShelf AI — Multi-Modal Evaluation Benchmark
Evaluates separately:
1. Vision-Only classification (MobileNetV3 on locked test split, n=50)
2. OCR text extraction & RxNorm/DailyMed candidate retrieval
3. Combined Decision Fusion (/api/scan multi-modal pipeline)
"""

from __future__ import annotations

import io
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.database.session import SessionLocal
from app.models.medicine import Medicine
from app.ocr.extractor import get_ocr_extractor
from app.ocr.fusion import compute_cv_ocr_fusion
from app.ocr.parser import parse_structured_fields
from app.ocr.preprocess import assess_image_quality
from app.ocr.retrieval import get_retriever
from app.services.medicine_service import medicine_resolution_service
from ml.inference.classifier import get_classifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("medishelf.multimodal_eval")

TEST_DIR = PROJECT_ROOT / "ml" / "datasets" / "test"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts"

# Mapping from 10 image classes to canonical drug active ingredients / generic names
CLASS_CANONICAL = {
    "amoxicillin_500mg_capsule": "amoxicillin",
    "atorvastatin_20mg_tablet": "atorvastatin",
    "cetirizine_10mg_tablet": "cetirizine",
    "ciprofloxacin_500mg_tablet": "ciprofloxacin",
    "humulin_r_100u_vial": "insulin",
    "ibuprofen_400mg_tablet": "ibuprofen",
    "losartan_50mg_tablet": "losartan",
    "metformin_500mg_tablet": "metformin",
    "omeprazole_20mg_capsule": "omeprazole",
    "paracetamol_500mg_tablet": "acetaminophen",  # or paracetamol
}


def matches_ground_truth(predicted_identifier_or_name: str, true_class: str) -> bool:
    target = CLASS_CANONICAL.get(true_class, "").lower()
    val = (predicted_identifier_or_name or "").lower()
    if target in val:
        return True
    if target == "acetaminophen" and "paracetamol" in val:
        return True
    if target == "paracetamol" and "acetaminophen" in val:
        return True
    return False


def run_evaluation():
    db = SessionLocal()
    classifier = get_classifier()
    extractor = get_ocr_extractor()
    retriever = get_retriever()

    test_images = []
    for cdir in sorted(TEST_DIR.iterdir()):
        if not cdir.is_dir(): continue
        for img in sorted(cdir.glob("*.jpg")):
            test_images.append((img, cdir.name))

    print("=" * 80)
    print(f"   MEDISHELF AI — MULTI-MODAL EVALUATION BENCHMARK (n={len(test_images)})")
    print("=" * 80)

    # 1. Vision Only
    v_correct = 0
    v_top3 = 0
    v_confidences = []
    v_latencies = []

    # 2. OCR Retrieval
    ocr_correct = 0
    ocr_attempts = 0
    ocr_empty = 0

    # 3. Combined Fusion
    fusion_correct = 0
    fusion_confident = 0
    fusion_abstained = 0  # correctly marked uncertain / low confidence
    fusion_wrong = 0

    results_detail = []

    for idx, (img_path, true_class) in enumerate(test_images, 1):
        with Image.open(img_path) as im:
            rgb_im = im.convert("RGB")
        raw_bytes = img_path.read_bytes()

        # Track 1: Vision-Only
        t0 = time.perf_counter()
        cv_res = classifier.predict(rgb_im, top_k=3)
        v_lat = (time.perf_counter() - t0) * 1000
        v_latencies.append(v_lat)

        top_pred = cv_res["top_prediction"]["class_name"]
        top_conf = cv_res["top_prediction"]["confidence"]
        top3_classes = [p["class_name"] for p in cv_res["predictions"]]

        is_v_correct = (top_pred == true_class)
        is_v_top3 = (true_class in top3_classes)
        if is_v_correct: v_correct += 1
        if is_v_top3: v_top3 += 1
        v_confidences.append(top_conf)

        # Track 2: OCR Extraction & Retrieval
        raw_text, ocr_lines, quality, ocr_time = extractor.extract(rgb_im)
        has_text = len(raw_text.strip()) > 0
        candidate_matches = []
        if has_text:
            ocr_attempts += 1
            structured_fields, candidate_matches = parse_structured_fields(ocr_lines, db)
            top_cand = candidate_matches[0] if candidate_matches else None
            is_ocr_correct = False
            if top_cand:
                cand_name = top_cand.medicine_name or top_cand.generic_name or ""
                is_ocr_correct = matches_ground_truth(cand_name, true_class)
            if is_ocr_correct:
                ocr_correct += 1
        else:
            ocr_empty += 1
            is_ocr_correct = False

        # Track 3: Full Fusion Pipeline (/api/scan logic)
        top_cand = candidate_matches[0] if candidate_matches else None
        cand_score = top_cand.similarity_score if top_cand else 0.0

        # Fusion Decision Logic from scan.py
        applied_threshold = 0.60
        matched_cv_row = db.query(Medicine).filter_by(image_class=top_pred).first()

        if top_cand and cand_score >= 0.80:
            resolved = medicine_resolution_service.resolve_medicine(top_cand.medicine_id, db=db)
            res_name = resolved.generic_name if resolved else top_cand.medicine_name
            is_f_correct = matches_ground_truth(res_name, true_class)
            fusion_confident += 1
            if is_f_correct:
                fusion_correct += 1
            else:
                fusion_wrong += 1
        elif top_conf >= applied_threshold and matched_cv_row:
            is_f_correct = (top_pred == true_class)
            fusion_confident += 1
            if is_f_correct:
                fusion_correct += 1
            else:
                fusion_wrong += 1
        else:
            # Low confidence / uncertain gate
            fusion_abstained += 1
            is_f_correct = False

        results_detail.append({
            "file": img_path.name,
            "true_class": true_class,
            "vision_top1": top_pred,
            "vision_conf": top_conf,
            "vision_correct": is_v_correct,
            "ocr_text_len": len(raw_text),
            "ocr_correct": is_ocr_correct,
            "fusion_correct": is_f_correct,
        })

    n = len(test_images)
    print("\n" + "=" * 80)
    print("                     INDEPENDENT EVALUATION TRACKS SUMMARY")
    print("=" * 80)
    print(f"1. Vision-Only Classifier (n={n})")
    print(f"   Top-1 Accuracy       : {v_correct / n * 100:.2f}% ({v_correct}/{n})")
    print(f"   Top-3 Accuracy       : {v_top3 / n * 100:.2f}% ({v_top3}/{n})")
    print(f"   Mean Top-1 Confidence: {np.mean(v_confidences):.4f}")
    print(f"   Mean Latency         : {np.mean(v_latencies):.1f} ms")
    print()
    print(f"2. OCR-Assisted Text Retrieval (n={n})")
    print(f"   Images with Detected Text: {ocr_attempts}/{n} ({ocr_attempts/n*100:.1f}%)")
    print(f"   Correct from Text Match  : {ocr_correct}/{ocr_attempts if ocr_attempts else 1} ({ocr_correct/max(1,ocr_attempts)*100:.1f}% of text images)")
    print(f"   Overall OCR Top-1 Recall : {ocr_correct / n * 100:.2f}% ({ocr_correct}/{n})")
    print()
    print(f"3. Combined Multi-Modal Fusion (/api/scan, n={n})")
    print(f"   High-Confidence Identifications: {fusion_confident}/{n} ({fusion_confident/n*100:.1f}%)")
    print(f"   Correct Identification Rate    : {fusion_correct}/{n} ({fusion_correct/n*100:.1f}%)")
    print(f"   Uncertain / Abstained Flagged  : {fusion_abstained}/{n} ({fusion_abstained/n*100:.1f}%)")
    print(f"   Precision on Confident Matches : {fusion_correct / max(1, fusion_confident) * 100:.2f}% ({fusion_correct}/{fusion_confident})")
    print("=" * 80)

    # Save summary artifact
    out_file = ARTIFACTS_DIR / "multimodal_evaluation_report.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "sample_count": n,
            "vision_only": {
                "top1_accuracy": round(v_correct / n, 4),
                "top3_accuracy": round(v_top3 / n, 4),
                "mean_confidence": round(float(np.mean(v_confidences)), 4),
                "mean_latency_ms": round(float(np.mean(v_latencies)), 2),
            },
            "ocr_assisted": {
                "detected_text_count": ocr_attempts,
                "correct_matches": ocr_correct,
                "recall": round(ocr_correct / n, 4),
            },
            "multimodal_fusion": {
                "confident_count": fusion_confident,
                "correct_count": fusion_correct,
                "abstained_count": fusion_abstained,
                "precision_on_confident": round(fusion_correct / max(1, fusion_confident), 4),
                "overall_correct_rate": round(fusion_correct / n, 4),
            },
        }, f, indent=2)
    print(f"\n[OK] Multi-modal evaluation saved to: {out_file}")


if __name__ == "__main__":
    run_evaluation()
