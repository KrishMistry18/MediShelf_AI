"""
MediShelf AI — Phase 5: Storage Risk ML Model Training Pipeline

Trains, compares, and evaluates multiple machine learning classifiers
for estimating medicine storage degradation risk from environmental conditions.

Models Evaluated:
1. Logistic Regression (Linear baseline with StandardScaler)
2. Random Forest Classifier (Ensemble bagging trees)
3. Gradient Boosting Classifier (Sequential boosting)

Saves all trained artifacts, metrics, feature importances, and metadata
to ml/artifacts/storage_risk/.
"""

import os
import sys
import json
import joblib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

# Configuration & Paths
RANDOM_SEED = 42
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATASET_PATH = PROJECT_ROOT / "ml" / "data" / "storage_risk_dataset.csv"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts" / "storage_risk"

FEATURE_COLUMNS = [
    "temperature",
    "humidity",
    "storage_min_temp",
    "storage_max_temp",
    "temp_deviation_below",
    "temp_deviation_above",
    "temp_deviation_magnitude",
    "excursion_duration_hours",
    "excursion_severity_index",
    "requires_cold_chain",
    "is_liquid_or_injection",
    "has_humidity_requirement",
    "humidity_deviation",
    "days_to_expiry",
    "near_expiry",
]

TARGET_COLUMN = "risk_level"
CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]
CLASS_TO_IDX = {"LOW": 0, "MODERATE": 1, "HIGH": 2}
IDX_TO_CLASS = {0: "LOW", 1: "MODERATE", 2: "HIGH"}


def evaluate_model(model, X, y, average="macro") -> Dict[str, Any]:
    """Computes comprehensive evaluation metrics."""
    preds = model.predict(X)
    return {
        "accuracy": round(float(accuracy_score(y, preds)), 4),
        "macro_precision": round(float(precision_score(y, preds, average="macro", zero_division=0)), 4),
        "macro_recall": round(float(recall_score(y, preds, average="macro", zero_division=0)), 4),
        "macro_f1": round(float(f1_score(y, preds, average="macro", zero_division=0)), 4),
        "weighted_f1": round(float(f1_score(y, preds, average="weighted", zero_division=0)), 4),
    }


def train_and_evaluate():
    print("=" * 70)
    print("MediShelf AI — Phase 5: Storage Risk Model Training Pipeline")
    print("=" * 70)

    # 1. Load Dataset
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}. Run generator first.")
    
    df = pd.read_csv(DATASET_PATH)
    print(f"Loaded dataset: {len(df)} records from {DATASET_PATH}")
    print(f"Target distribution:\n{df[TARGET_COLUMN].value_counts().to_dict()}\n")

    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].map(CLASS_TO_IDX).values

    # 2. Train / Val / Test Split (70% / 15% / 15%)
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.15, random_state=RANDOM_SEED, stratify=y
    )
    # Val size out of remaining 85%: 0.15 / 0.85 approx 0.1765
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=(0.15 / 0.85), random_state=RANDOM_SEED, stratify=y_train_val
    )

    print(f"Dataset splits: Train={len(X_train)} (70%), Val={len(X_val)} (15%), Test={len(X_test)} (15%)\n")

    # 3. Model Candidates
    candidates = {
        "LogisticRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=1000, random_state=RANDOM_SEED)),
        ]),
        "RandomForestClassifier": RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            min_samples_split=4,
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        "GradientBoostingClassifier": GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=4,
            random_state=RANDOM_SEED,
        ),
    }

    val_results = {}
    print("Evaluating Candidate Models on Validation Set:")
    print("-" * 70)
    best_model_name = None
    best_val_macro_f1 = -1.0

    for name, model in candidates.items():
        model.fit(X_train, y_train)
        metrics = evaluate_model(model, X_val, y_val)
        val_results[name] = metrics
        print(f"[{name}]")
        print(f"  Accuracy:    {metrics['accuracy']:.4f}")
        print(f"  Macro F1:    {metrics['macro_f1']:.4f}")
        print(f"  Weighted F1: {metrics['weighted_f1']:.4f}")

        if metrics["macro_f1"] > best_val_macro_f1:
            best_val_macro_f1 = metrics["macro_f1"]
            best_model_name = name

    print("-" * 70)
    print(f"Selected Best Model: {best_model_name} (Val Macro F1: {best_val_macro_f1:.4f})\n")

    # 4. Final Evaluation on Isolated Test Set
    best_model = candidates[best_model_name]
    test_preds = best_model.predict(X_test)
    test_probs = best_model.predict_proba(X_test)

    test_metrics = {
        "accuracy": round(float(accuracy_score(y_test, test_preds)), 4),
        "macro_precision": round(float(precision_score(y_test, test_preds, average="macro", zero_division=0)), 4),
        "macro_recall": round(float(recall_score(y_test, test_preds, average="macro", zero_division=0)), 4),
        "macro_f1": round(float(f1_score(y_test, test_preds, average="macro", zero_division=0)), 4),
        "weighted_f1": round(float(f1_score(y_test, test_preds, average="weighted", zero_division=0)), 4),
    }

    cm = confusion_matrix(y_test, test_preds).tolist()
    cls_report = classification_report(
        y_test, test_preds, target_names=CLASS_NAMES, output_dict=True, zero_division=0
    )

    print("Isolated Test Set Evaluation:")
    print("-" * 70)
    print(f"  Test Accuracy:    {test_metrics['accuracy']:.4f}")
    print(f"  Test Macro F1:    {test_metrics['macro_f1']:.4f}")
    print(f"  Test Weighted F1: {test_metrics['weighted_f1']:.4f}")
    print("\nConfusion Matrix (Rows=True, Cols=Pred):")
    print("          LOW  MODERATE  HIGH")
    for idx, row in enumerate(cm):
        print(f"{CLASS_NAMES[idx]:<8} {row[0]:>5} {row[1]:>9} {row[2]:>5}")

    # 5. Extract Feature Importances
    feature_importances = {}
    if hasattr(best_model, "feature_importances_"):
        raw_importances = best_model.feature_importances_
        for feat, imp in sorted(zip(FEATURE_COLUMNS, raw_importances), key=lambda x: x[1], reverse=True):
            feature_importances[feat] = round(float(imp), 4)
    elif hasattr(best_model, "named_steps") and hasattr(best_model.named_steps["classifier"], "coef_"):
        coefs = np.mean(np.abs(best_model.named_steps["classifier"].coef_), axis=0)
        norm_coefs = coefs / np.sum(coefs)
        for feat, imp in sorted(zip(FEATURE_COLUMNS, norm_coefs), key=lambda x: x[1], reverse=True):
            feature_importances[feat] = round(float(imp), 4)

    print("\nTop 5 Feature Importances:")
    for feat, imp in list(feature_importances.items())[:5]:
        print(f"  - {feat}: {imp:.4f}")

    # 6. Save Artifacts
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACTS_DIR / "model.joblib"
    joblib.dump(best_model, model_path)
    print(f"\nSaved trained model to {model_path}")

    # Save feature metadata
    feature_meta = {
        "features": FEATURE_COLUMNS,
        "feature_count": len(FEATURE_COLUMNS),
        "class_mapping": CLASS_TO_IDX,
        "classes": CLASS_NAMES,
        "feature_importances": feature_importances,
    }
    with open(ARTIFACTS_DIR / "feature_metadata.json", "w", encoding="utf-8") as f:
        json.dump(feature_meta, f, indent=2)

    # Save evaluation results
    eval_results = {
        "selected_model": best_model_name,
        "validation_comparison": val_results,
        "test_metrics": test_metrics,
        "confusion_matrix": {
            "matrix": cm,
            "labels": CLASS_NAMES,
        },
        "per_class_metrics": {
            cls_name: {
                "precision": round(float(cls_report[cls_name]["precision"]), 4),
                "recall": round(float(cls_report[cls_name]["recall"]), 4),
                "f1_score": round(float(cls_report[cls_name]["f1-score"]), 4),
                "support": int(cls_report[cls_name]["support"]),
            }
            for cls_name in CLASS_NAMES
        },
    }
    with open(ARTIFACTS_DIR / "evaluation_results.json", "w", encoding="utf-8") as f:
        json.dump(eval_results, f, indent=2)

    # Save training metadata
    training_meta = {
        "model_name": "MediShelf AI Storage Risk Classifier",
        "model_version": "1.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version,
        "algorithm": best_model_name,
        "random_seed": RANDOM_SEED,
        "dataset_samples": len(df),
        "splits": {
            "train_samples": len(X_train),
            "val_samples": len(X_val),
            "test_samples": len(X_test),
        },
        "model_parameters": best_model.get_params(),
        "notice": (
            "The Phase 5 training data is simulation-derived from documented medicine storage "
            "requirements and is intended to demonstrate an ML-based storage-risk estimation pipeline. "
            "It is not a clinically validated dataset and the resulting model must not be interpreted "
            "as a clinical prediction model."
        ),
    }
    with open(ARTIFACTS_DIR / "training_metadata.json", "w", encoding="utf-8") as f:
        json.dump(training_meta, f, indent=2, default=str)

    print("Pipeline finished successfully! All artifacts generated.\n")
    return eval_results


if __name__ == "__main__":
    train_and_evaluate()
