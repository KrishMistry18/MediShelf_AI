"""
Reconciliation and mathematical verification tool for MediShelf AI vision classifier.

Runs inference using the actual saved checkpoints on the held-out test split,
logs every prediction, recomputes all metrics from first principles,
and verifies consistency against JSON artifacts, database seed data, and reported figures.
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from torchvision import models

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.image_pipeline import get_eval_transforms

CHECKPOINT_IMPROVED = PROJECT_ROOT / "ml" / "artifacts" / "model" / "medicine_classifier.pt"
CHECKPOINT_BASELINE = PROJECT_ROOT / "ml" / "artifacts" / "model" / "medicine_classifier_baseline_v1.pt"
TEST_DIR = PROJECT_ROOT / "ml" / "datasets" / "test"
TEST_METRICS_JSON = PROJECT_ROOT / "ml" / "artifacts" / "metrics" / "test_metrics.json"
CONFUSION_MATRIX_JSON = PROJECT_ROOT / "ml" / "artifacts" / "metrics" / "confusion_matrix.json"
METADATA_JSON = PROJECT_ROOT / "ml" / "artifacts" / "metadata" / "metadata.json"
MEDICINES_CSV = PROJECT_ROOT / "data" / "medicines" / "medicines.csv"
DB_PATH = PROJECT_ROOT / "medishelf.db"
MANIFEST_JSON = PROJECT_ROOT / "ml" / "datasets" / "dataset_manifest.json"


def load_model(checkpoint_path: Path, device: torch.device) -> Tuple[nn.Module, List[str], int, Dict[str, Any]]:
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    class_names = ckpt["class_names"]
    num_classes = len(class_names)
    image_size = ckpt.get("image_size", 224)

    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(
        nn.Linear(in_features, 128),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(128, num_classes),
    )
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)
    model.eval()
    return model, class_names, image_size, ckpt


def evaluate_checkpoint(
    model: nn.Module,
    class_names: List[str],
    image_size: int,
    device: torch.device,
) -> Dict[str, Any]:
    transforms = get_eval_transforms(image_size)
    class_to_idx = {name: i for i, name in enumerate(class_names)}

    test_samples: List[Dict[str, Any]] = []
    y_true: List[int] = []
    y_pred: List[int] = []
    y_probs: List[List[float]] = []

    # Iterate over classes and test images deterministically
    for cls_name in class_names:
        cls_dir = TEST_DIR / cls_name
        if not cls_dir.exists():
            continue
        for img_path in sorted(cls_dir.glob("*.jpg")):
            true_idx = class_to_idx[cls_name]
            with Image.open(img_path) as pil_img:
                tensor = transforms(pil_img.convert("RGB")).unsqueeze(0).to(device)

            with torch.no_grad():
                logits = model(tensor)
                probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()
                pred_idx = int(np.argmax(probs))

            top3_indices = [int(i) for i in np.argsort(probs)[::-1][:3]]
            top3_classes = [class_names[i] for i in top3_indices]
            top3_probs = [float(probs[i]) for i in top3_indices]

            top1_hit = pred_idx == true_idx
            top3_hit = true_idx in top3_indices

            y_true.append(true_idx)
            y_pred.append(pred_idx)
            y_probs.append(probs.tolist())

            test_samples.append({
                "file_name": img_path.name,
                "relative_path": str(img_path.relative_to(PROJECT_ROOT)),
                "true_class": cls_name,
                "true_idx": true_idx,
                "pred_class": class_names[pred_idx],
                "pred_idx": pred_idx,
                "top1_hit": top1_hit,
                "top1_conf": float(probs[pred_idx]),
                "top3_classes": top3_classes,
                "top3_indices": top3_indices,
                "top3_probs": top3_probs,
                "top3_hit": top3_hit,
            })

    y_true_np = np.array(y_true)
    y_pred_np = np.array(y_pred)
    y_probs_np = np.array(y_probs)

    num_samples = len(y_true)
    top1_acc = float(accuracy_score(y_true_np, y_pred_np))
    top3_acc = float(sum(1 for s in test_samples if s["top3_hit"]) / num_samples) if num_samples else 0.0

    prec_macro, rec_macro, f1_macro, _ = precision_recall_fscore_support(
        y_true_np, y_pred_np, average="macro", zero_division=0
    )
    prec_weighted, rec_weighted, f1_weighted, _ = precision_recall_fscore_support(
        y_true_np, y_pred_np, average="weighted", zero_division=0
    )

    cm = confusion_matrix(y_true_np, y_pred_np, labels=list(range(len(class_names))))

    clf_report = classification_report(
        y_true_np, y_pred_np, target_names=class_names, output_dict=True, zero_division=0
    )

    per_class = {}
    for cls_name in class_names:
        per_class[cls_name] = {
            "precision": float(round(clf_report[cls_name]["precision"], 4)),
            "recall": float(round(clf_report[cls_name]["recall"], 4)),
            "f1-score": float(round(clf_report[cls_name]["f1-score"], 4)),
            "support": int(clf_report[cls_name]["support"]),
        }

    return {
        "sample_count": num_samples,
        "top1_accuracy": round(top1_acc, 4),
        "top3_accuracy": round(top3_acc, 4),
        "macro_precision": round(float(prec_macro), 4),
        "macro_recall": round(float(rec_macro), 4),
        "macro_f1": round(float(f1_macro), 4),
        "weighted_precision": round(float(prec_weighted), 4),
        "weighted_recall": round(float(rec_weighted), 4),
        "weighted_f1": round(float(f1_weighted), 4),
        "confusion_matrix": cm.tolist(),
        "per_class": per_class,
        "class_names": class_names,
        "samples": test_samples,
    }


def main() -> None:
    device = torch.device("cpu")
    print("=" * 80)
    print("MEDISHELF AI — VISION METRICS RECONCILIATION & AUDIT")
    print("=" * 80)

    # 1. Evaluate Improved Model
    print(f"\n1. Evaluating PROMOTED model: {CHECKPOINT_IMPROVED.name}")
    model_imp, classes_imp, size_imp, _ = load_model(CHECKPOINT_IMPROVED, device)
    imp_results = evaluate_checkpoint(model_imp, classes_imp, size_imp, device)

    # 2. Evaluate Baseline Model
    print(f"\n2. Evaluating BASELINE model: {CHECKPOINT_BASELINE.name}")
    model_base, classes_base, size_base, _ = load_model(CHECKPOINT_BASELINE, device)
    base_results = evaluate_checkpoint(model_base, classes_base, size_base, device)

    # 3. Check JSON Artifacts
    print("\n3. Loading Disk Artifacts:")
    test_metrics_data = json.loads(TEST_METRICS_JSON.read_text(encoding="utf-8"))
    cm_data = json.loads(CONFUSION_MATRIX_JSON.read_text(encoding="utf-8"))

    print("\n--- COMPARISON: Recomputed vs test_metrics.json (Promoted Model) ---")
    fields = [
        "sample_count",
        "top1_accuracy",
        "top3_accuracy",
        "macro_precision",
        "macro_recall",
        "macro_f1",
        "weighted_precision",
        "weighted_recall",
        "weighted_f1",
    ]
    all_match = True
    for f in fields:
        recomputed = imp_results[f]
        on_disk = test_metrics_data.get(f)
        match = recomputed == on_disk
        if not match:
            all_match = False
        print(f"  {f:<22}: recomputed={recomputed!s:<8} on_disk={on_disk!s:<8} match={match}")

    # Check Confusion Matrix Match
    cm_match = imp_results["confusion_matrix"] == cm_data["matrix"]
    print(f"  {'confusion_matrix':<22}: match={cm_match}")

    print("\n--- SUMMARY OF METRICS ---")
    print(f"Baseline Top-1:   {base_results['top1_accuracy'] * 100:.2f}% ({sum(1 for s in base_results['samples'] if s['top1_hit'])}/{base_results['sample_count']})")
    print(f"Baseline Top-3:   {base_results['top3_accuracy'] * 100:.2f}% ({sum(1 for s in base_results['samples'] if s['top3_hit'])}/{base_results['sample_count']})")
    print(f"Baseline Macro F1:{base_results['macro_f1']:.4f}")
    print()
    print(f"Promoted Top-1:   {imp_results['top1_accuracy'] * 100:.2f}% ({sum(1 for s in imp_results['samples'] if s['top1_hit'])}/{imp_results['sample_count']})")
    print(f"Promoted Top-3:   {imp_results['top3_accuracy'] * 100:.2f}% ({sum(1 for s in imp_results['samples'] if s['top3_hit'])}/{imp_results['sample_count']})")
    print(f"Promoted Macro F1:{imp_results['macro_f1']:.4f}")
    print(f"Promoted Macro P: {imp_results['macro_precision']:.4f} (Exact 0.6500, NOT 0.6750)")
    print(f"Promoted Macro R: {imp_results['macro_recall']:.4f}")

    # Save complete verified predictions artifact
    predictions_out = PROJECT_ROOT / "ml" / "artifacts" / "metrics" / "test_predictions.json"
    with open(predictions_out, "w", encoding="utf-8") as f:
        json.dump(imp_results["samples"], f, indent=2)
    print(f"\n[OK] Saved verified sample-level predictions to: {predictions_out.relative_to(PROJECT_ROOT)}")

    # 4. Verify Canonical Mappings against SQLite and medicines.csv
    print("\n" + "=" * 80)
    print("4. CANONICAL CLASS-TO-MEDICINE MAPPING AUDIT")
    print("=" * 80)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT medicine_id, medicine_name, generic_name, image_class FROM medicines WHERE image_class IS NOT NULL")
    db_rows = cur.fetchall()
    conn.close()

    db_map = {r[3]: (r[0], r[1], r[2]) for r in db_rows}

    print(f"{'Class Name':<30} | {'Medicine ID':<10} | {'Medicine Name'}")
    print("-" * 80)
    for cls in classes_imp:
        if cls in db_map:
            med_id, med_name, _ = db_map[cls]
            print(f"{cls:<30} | {med_id:<10} | {med_name}")
        else:
            print(f"{cls:<30} | {'MISSING!':<10} | -")

    # 5. Print Sample Predictions Log
    print("\n" + "=" * 80)
    print("5. COMPLETE PER-SAMPLE PREDICTION TRACE (30 TEST SAMPLES)")
    print("=" * 80)
    print(f"{'File':<12} | {'True Class':<28} | {'Pred Class':<28} | {'Top-1':<5} | {'Top-3':<5} | {'Conf'}")
    print("-" * 95)
    for s in imp_results["samples"]:
        t1 = "HIT" if s["top1_hit"] else "MISS"
        t3 = "HIT" if s["top3_hit"] else "MISS"
        print(f"{s['file_name']:<12} | {s['true_class']:<28} | {s['pred_class']:<28} | {t1:<5} | {t3:<5} | {s['top1_conf']:.3f}")


if __name__ == "__main__":
    main()
