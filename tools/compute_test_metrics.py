"""
Compute exact, verifiable metrics for the trained model on ml/datasets/test.
Generates ml/artifacts/metrics/test_metrics.json and updates verification artifacts.
"""

import json
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score, precision_score, recall_score

from ml.inference.classifier import MedicineClassifier

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEST_DIR = PROJECT_ROOT / "ml" / "datasets" / "test"
VAL_DIR = PROJECT_ROOT / "ml" / "datasets" / "val"
TRAIN_DIR = PROJECT_ROOT / "ml" / "datasets" / "train"
METRICS_PATH = PROJECT_ROOT / "ml" / "artifacts" / "metrics" / "test_metrics.json"

clf = MedicineClassifier()
class_names = sorted(clf.class_names)
n_classes = len(class_names)

y_true = []
y_pred = []
top3_hits = 0

for class_dir in sorted(p for p in TEST_DIR.iterdir() if p.is_dir()):
    true_cls = class_dir.name
    for img_p in sorted(class_dir.glob("*.jpg")):
        res = clf.predict(img_p, top_k=3)
        pred_cls = res["top_prediction"]["class_name"]
        preds_top3 = [p["class_name"] for p in res["predictions"]]
        
        y_true.append(true_cls)
        y_pred.append(pred_cls)
        if true_cls in preds_top3:
            top3_hits += 1

n = len(y_true)
top1_acc = accuracy_score(y_true, y_pred)
top3_acc = top3_hits / n

report_dict = classification_report(
    y_true,
    y_pred,
    labels=class_names,
    target_names=class_names,
    output_dict=True,
    zero_division=0,
)

cm = confusion_matrix(y_true, y_pred, labels=class_names).tolist()

per_class = {}
for name in class_names:
    stats = report_dict.get(name, {})
    per_class[name] = {
        "precision": round(float(stats.get("precision", 0.0)), 4),
        "recall": round(float(stats.get("recall", 0.0)), 4),
        "f1-score": round(float(stats.get("f1-score", 0.0)), 4),
        "support": int(stats.get("support", 0)),
    }

metrics = {
    "evaluation_dataset": "Isolated Test Split (15%)",
    "sample_count": n,
    "class_names": class_names,
    "top1_accuracy": round(float(top1_acc), 4),
    "top3_accuracy": round(float(top3_acc), 4),
    "macro_precision": round(float(report_dict["macro avg"]["precision"]), 4),
    "macro_recall": round(float(report_dict["macro avg"]["recall"]), 4),
    "macro_f1": round(float(report_dict["macro avg"]["f1-score"]), 4),
    "weighted_precision": round(float(report_dict["weighted avg"]["precision"]), 4),
    "weighted_recall": round(float(report_dict["weighted avg"]["recall"]), 4),
    "weighted_f1": round(float(report_dict["weighted avg"]["f1-score"]), 4),
    "per_class": per_class,
    "confusion_matrix": cm,
}

with open(METRICS_PATH, "w", encoding="utf-8") as f:
    json.dump(metrics, f, indent=2)

print(f"Successfully computed test metrics on {n} samples:")
print(f"  Top-1 Accuracy: {top1_acc:.4f} ({int(round(top1_acc * n))}/{n})")
print(f"  Top-3 Accuracy: {top3_acc:.4f} ({top3_hits}/{n})")
print(f"  Macro F1:       {report_dict['macro avg']['f1-score']:.4f}")
print(f"Saved to: {METRICS_PATH}")
