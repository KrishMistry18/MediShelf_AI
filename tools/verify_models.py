"""
Independent verification harness for the two MediShelf AI models.

This script does not trust the numbers committed in ml/artifacts/**. It reloads
the saved checkpoints and recomputes metrics from the datasets in the repo so the
reported figures reflect what the artifacts actually do today.

Run from the repository root:
    python tools/verify_models.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import joblib  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split  # noqa: E402

from ml.inference.classifier import MedicineClassifier  # noqa: E402

RAW_DIR = PROJECT_ROOT / "ml" / "datasets" / "raw"
TEST_DIR = PROJECT_ROOT / "ml" / "datasets" / "test"
VAL_DIR = PROJECT_ROOT / "ml" / "datasets" / "val"
TRAIN_DIR = PROJECT_ROOT / "ml" / "datasets" / "train"
RISK_ARTIFACTS = PROJECT_ROOT / "ml" / "artifacts" / "storage_risk"
RISK_DATASET = PROJECT_ROOT / "ml" / "data" / "storage_risk_dataset.csv"

RISK_SEED = 42
RISK_CLASSES = ["LOW", "MODERATE", "HIGH"]
RISK_CLASS_TO_IDX = {name: idx for idx, name in enumerate(RISK_CLASSES)}


def rule(title: str) -> None:
    print()
    print("=" * 74)
    print(title)
    print("=" * 74)


def evaluate_split(clf: MedicineClassifier, split_dir: Path, label: str) -> dict:
    """Runs the checkpoint over every image in a class-per-folder split."""
    if not split_dir.exists():
        print(f"  [skip] {label}: {split_dir} not found")
        return {}

    y_true: list[str] = []
    y_pred: list[str] = []
    top3_hits = 0
    confidences: list[float] = []
    below_threshold = 0
    latencies: list[float] = []
    misses: list[tuple[str, str, float]] = []

    for class_dir in sorted(p for p in split_dir.iterdir() if p.is_dir()):
        true_class = class_dir.name
        for image_path in sorted(class_dir.glob("*.jpg")):
            result = clf.predict(image_path, top_k=3)
            top = result["top_prediction"]
            predicted = top["class_name"]
            confidence = top["confidence"]

            y_true.append(true_class)
            y_pred.append(predicted)
            confidences.append(confidence)
            latencies.append(result["inference_time_ms"])
            if not result["is_confident"]:
                below_threshold += 1
            if true_class in [p["class_name"] for p in result["predictions"]]:
                top3_hits += 1
            if predicted != true_class:
                misses.append((image_path.parent.name + "/" + image_path.name, predicted, confidence))

    n = len(y_true)
    if n == 0:
        print(f"  [skip] {label}: no images found")
        return {}

    top1 = accuracy_score(y_true, y_pred)
    top3 = top3_hits / n
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)

    print(f"\n  {label}  (n={n})")
    print(f"    top-1 accuracy      : {top1:.4f}  ({int(round(top1 * n))}/{n})")
    print(f"    top-3 accuracy      : {top3:.4f}  ({top3_hits}/{n})")
    print(f"    macro F1            : {macro_f1:.4f}")
    print(f"    mean top-1 conf     : {np.mean(confidences):.4f}")
    print(f"    median top-1 conf   : {np.median(confidences):.4f}")
    print(f"    below 0.60 gate     : {below_threshold}/{n}")
    print(f"    mean latency        : {np.mean(latencies):.1f} ms")

    if misses and label.startswith("test"):
        print("    misclassified:")
        for name, predicted, confidence in misses:
            print(f"      - {name} -> {predicted} ({confidence:.2f})")

    return {
        "n": n,
        "top1_accuracy": round(float(top1), 4),
        "top3_accuracy": round(float(top3), 4),
        "macro_f1": round(float(macro_f1), 4),
        "mean_confidence": round(float(np.mean(confidences)), 4),
        "below_threshold": below_threshold,
        "mean_latency_ms": round(float(np.mean(latencies)), 2),
        "predicted_distribution": dict(Counter(y_pred)),
        "y_true": y_true,
        "y_pred": y_pred,
    }


def verify_vision() -> dict:
    rule("1. Medicine package classifier  (MobileNetV3-Small, PyTorch)")
    clf = MedicineClassifier()
    print(f"  checkpoint : {clf.checkpoint_path.relative_to(PROJECT_ROOT)}")
    print(f"  device     : {clf.device}")
    print(f"  classes    : {len(clf.class_names)}")
    print(f"  image size : {clf.image_size}")
    print(f"  threshold  : {clf.threshold}")

    results = {
        "test": evaluate_split(clf, TEST_DIR, "test split (held out, 1 img/class)"),
        "val": evaluate_split(clf, VAL_DIR, "val split (2 img/class)"),
        "train": evaluate_split(clf, TRAIN_DIR, "train split (seen during fitting)"),
        "raw": evaluate_split(clf, RAW_DIR, "full raw dataset (all 100 images)"),
    }

    raw = results.get("raw") or {}
    if raw:
        print("\n  Prediction distribution over the full raw dataset")
        print("  (a healthy 10-class model should be near 10 per class)")
        for name in sorted(clf.class_names):
            count = raw["predicted_distribution"].get(name, 0)
            bar = "#" * count
            print(f"    {name:<32} {count:>3}  {bar}")

        print("\n  Per-class report over the full raw dataset")
        print(
            classification_report(
                raw["y_true"],
                raw["y_pred"],
                labels=sorted(clf.class_names),
                zero_division=0,
            )
        )

    return {k: {kk: vv for kk, vv in v.items() if kk not in ("y_true", "y_pred")} for k, v in results.items() if v}


def verify_storage_risk() -> dict:
    rule("2. Storage-risk classifier  (GradientBoosting, scikit-learn)")
    model = joblib.load(RISK_ARTIFACTS / "model.joblib")
    meta = json.loads((RISK_ARTIFACTS / "feature_metadata.json").read_text(encoding="utf-8"))
    features = meta["features"]

    print(f"  artifact   : {(RISK_ARTIFACTS / 'model.joblib').relative_to(PROJECT_ROOT)}")
    print(f"  estimator  : {type(model).__name__}")
    print(f"  features   : {len(features)}")

    df = pd.read_csv(RISK_DATASET)
    X = df[features].copy()
    y = df["risk_level"].map(RISK_CLASS_TO_IDX).values

    # Reproduce the exact split used by ml/training/train_storage_risk.py
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.15, random_state=RISK_SEED, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=(0.15 / 0.85), random_state=RISK_SEED, stratify=y_train_val
    )

    print(f"  dataset    : {len(df)} rows -> train {len(X_train)} / val {len(X_val)} / test {len(X_test)}")
    print(f"  class mix  : {df['risk_level'].value_counts().to_dict()}")

    test_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, test_pred)
    macro_f1 = f1_score(y_test, test_pred, average="macro", zero_division=0)

    print("\n  Recomputed held-out test metrics")
    print(f"    accuracy : {accuracy:.4f}")
    print(f"    macro F1 : {macro_f1:.4f}")
    print("\n  Confusion matrix (rows = truth, cols = prediction)")
    matrix = confusion_matrix(y_test, test_pred)
    print("               LOW  MODERATE   HIGH")
    for idx, row in enumerate(matrix):
        print(f"    {RISK_CLASSES[idx]:<9} {row[0]:>5} {row[1]:>9} {row[2]:>6}")

    # Leakage sanity check: train accuracy far above test accuracy would signal overfit.
    train_accuracy = accuracy_score(y_train, model.predict(X_train))
    val_accuracy = accuracy_score(y_val, model.predict(X_val))
    print(f"\n    train accuracy : {train_accuracy:.4f}")
    print(f"    val accuracy   : {val_accuracy:.4f}")
    print(f"    test accuracy  : {accuracy:.4f}")

    scenarios = [
        ("Paracetamol at 22C, in range, no excursion", dict(
            temperature=22.0, humidity=45.0, storage_min_temp=20.0, storage_max_temp=25.0,
            temp_deviation_below=0.0, temp_deviation_above=0.0, temp_deviation_magnitude=0.0,
            excursion_duration_hours=0.0, excursion_severity_index=0.0, requires_cold_chain=0,
            is_liquid_or_injection=0, has_humidity_requirement=0, humidity_deviation=0.0,
            days_to_expiry=400, near_expiry=0), "LOW"),
        ("Paracetamol at 27C for 3h (mild heat)", dict(
            temperature=27.0, humidity=55.0, storage_min_temp=20.0, storage_max_temp=25.0,
            temp_deviation_below=0.0, temp_deviation_above=2.0, temp_deviation_magnitude=2.0,
            excursion_duration_hours=3.0, excursion_severity_index=6.0, requires_cold_chain=0,
            is_liquid_or_injection=0, has_humidity_requirement=0, humidity_deviation=0.0,
            days_to_expiry=300, near_expiry=0), "MODERATE"),
        ("Insulin at 9.2C for 3h (small cold-chain excursion)", dict(
            temperature=9.2, humidity=50.0, storage_min_temp=2.0, storage_max_temp=8.0,
            temp_deviation_below=0.0, temp_deviation_above=1.2, temp_deviation_magnitude=1.2,
            excursion_duration_hours=3.0, excursion_severity_index=3.6, requires_cold_chain=1,
            is_liquid_or_injection=1, has_humidity_requirement=0, humidity_deviation=0.0,
            days_to_expiry=180, near_expiry=0), "MODERATE"),
        ("Insulin at 35C for 24h (severe heat)", dict(
            temperature=35.0, humidity=65.0, storage_min_temp=2.0, storage_max_temp=8.0,
            temp_deviation_below=0.0, temp_deviation_above=27.0, temp_deviation_magnitude=27.0,
            excursion_duration_hours=24.0, excursion_severity_index=648.0, requires_cold_chain=1,
            is_liquid_or_injection=1, has_humidity_requirement=0, humidity_deviation=0.0,
            days_to_expiry=90, near_expiry=0), "HIGH"),
        ("Insulin frozen at -5C for 12h", dict(
            temperature=-5.0, humidity=50.0, storage_min_temp=2.0, storage_max_temp=8.0,
            temp_deviation_below=7.0, temp_deviation_above=0.0, temp_deviation_magnitude=7.0,
            excursion_duration_hours=12.0, excursion_severity_index=84.0, requires_cold_chain=1,
            is_liquid_or_injection=1, has_humidity_requirement=0, humidity_deviation=0.0,
            days_to_expiry=120, near_expiry=0), "HIGH"),
        ("In range but 10 days from expiry", dict(
            temperature=23.0, humidity=45.0, storage_min_temp=20.0, storage_max_temp=25.0,
            temp_deviation_below=0.0, temp_deviation_above=0.0, temp_deviation_magnitude=0.0,
            excursion_duration_hours=0.0, excursion_severity_index=0.0, requires_cold_chain=0,
            is_liquid_or_injection=0, has_humidity_requirement=0, humidity_deviation=0.0,
            days_to_expiry=10, near_expiry=1), None),
    ]

    print("\n  Scenario probes (label -> probabilities)")
    scenario_rows = []
    for title, payload, expected in scenarios:
        frame = pd.DataFrame([[payload[c] for c in features]], columns=features)
        probs = model.predict_proba(frame)[0]
        idx = int(np.argmax(probs))
        label = RISK_CLASSES[idx]
        verdict = "" if expected is None else ("  OK" if label == expected else f"  MISMATCH (expected {expected})")
        print(f"    {title}")
        print(
            f"      -> {label:<9} LOW {probs[0]:.3f} | MODERATE {probs[1]:.3f} | HIGH {probs[2]:.3f}{verdict}"
        )
        scenario_rows.append({"scenario": title, "predicted": label, "expected": expected})

    # Sensitivity sweep: does the prediction respond to a changing input?
    print("\n  Sensitivity sweep, insulin (2-8C) held 6 hours at rising temperature")
    for temp in [4.0, 8.0, 10.0, 12.0, 15.0, 20.0, 25.0, 30.0, 40.0]:
        deviation_above = max(0.0, temp - 8.0)
        deviation_below = max(0.0, 2.0 - temp)
        magnitude = max(deviation_above, deviation_below)
        payload = dict(
            temperature=temp, humidity=50.0, storage_min_temp=2.0, storage_max_temp=8.0,
            temp_deviation_below=deviation_below, temp_deviation_above=deviation_above,
            temp_deviation_magnitude=magnitude, excursion_duration_hours=6.0,
            excursion_severity_index=round(magnitude * 6.0, 2), requires_cold_chain=1,
            is_liquid_or_injection=1, has_humidity_requirement=0, humidity_deviation=0.0,
            days_to_expiry=180, near_expiry=0,
        )
        frame = pd.DataFrame([[payload[c] for c in features]], columns=features)
        probs = model.predict_proba(frame)[0]
        label = RISK_CLASSES[int(np.argmax(probs))]
        print(
            f"    {temp:>5.1f} C  severity {payload['excursion_severity_index']:>7.2f}  "
            f"-> {label:<9} LOW {probs[0]:.3f} | MOD {probs[1]:.3f} | HIGH {probs[2]:.3f}"
        )

    return {
        "test_accuracy": round(float(accuracy), 4),
        "test_macro_f1": round(float(macro_f1), 4),
        "train_accuracy": round(float(train_accuracy), 4),
        "val_accuracy": round(float(val_accuracy), 4),
        "scenarios": scenario_rows,
    }


def main() -> int:
    vision = verify_vision()
    risk = verify_storage_risk()

    rule("Summary")
    committed_vision = json.loads(
        (PROJECT_ROOT / "ml" / "artifacts" / "metrics" / "test_metrics.json").read_text(encoding="utf-8")
    )
    committed_risk = json.loads(
        (RISK_ARTIFACTS / "evaluation_results.json").read_text(encoding="utf-8")
    )

    test = vision.get("test", {})
    print("  Vision classifier, held-out test split")
    print(
        f"    top-1  committed {committed_vision['top1_accuracy']:.4f}  |  recomputed {test.get('top1_accuracy', float('nan')):.4f}"
    )
    print(
        f"    top-3  committed {committed_vision['top3_accuracy']:.4f}  |  recomputed {test.get('top3_accuracy', float('nan')):.4f}"
    )
    raw = vision.get("raw", {})
    if raw:
        print(f"    top-1 over all 100 raw images: {raw['top1_accuracy']:.4f}")

    print("\n  Storage-risk classifier, held-out test split")
    print(
        f"    accuracy  committed {committed_risk['test_metrics']['accuracy']:.4f}  |  recomputed {risk['test_accuracy']:.4f}"
    )
    print(
        f"    macro F1  committed {committed_risk['test_metrics']['macro_f1']:.4f}  |  recomputed {risk['test_macro_f1']:.4f}"
    )

    out = PROJECT_ROOT / "ml" / "artifacts" / "verification_report.json"
    out.write_text(json.dumps({"vision": vision, "storage_risk": risk}, indent=2), encoding="utf-8")
    print(f"\n  Wrote {out.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
