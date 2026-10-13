"""
Independent and rigorous verification of test split predictions and classification metrics.
Recomputes all figures from the exact same set of ground-truth labels and model predictions.
"""

import json
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from ml.inference.classifier import MedicineClassifier

clf = MedicineClassifier()
test_dir = PROJECT_ROOT / "ml" / "datasets" / "test"
classes = sorted(clf.class_names)

print("Canonical class names (10):")
for i, c in enumerate(classes):
    print(f"  [{i}] {c}")

y_true = []
y_pred = []
top3_hits = 0
samples = []

for c in classes:
    c_dir = test_dir / c
    imgs = sorted(c_dir.glob("*.jpg"))
    for img in imgs:
        res = clf.predict(img, top_k=3)
        top = res["top_prediction"]
        top3_preds = [p["class_name"] for p in res["predictions"]]
        is_top1 = (top["class_name"] == c)
        is_top3 = (c in top3_preds)
        if is_top3:
            top3_hits += 1
        y_true.append(c)
        y_pred.append(top["class_name"])
        samples.append({
            "file": f"{c}/{img.name}",
            "true": c,
            "pred": top["class_name"],
            "conf": top["confidence"],
            "top3": top3_preds,
            "correct_top1": is_top1,
            "correct_top3": is_top3,
        })

print("\nDetailed test sample predictions:")
for r in samples:
    status = "CORRECT" if r["correct_top1"] else "MISS   "
    print(f"{status} | {r['file']:<45} -> {r['pred']:<28} conf={r['conf']:.2f} top3={r['correct_top3']}")

n = len(y_true)
top1_acc = accuracy_score(y_true, y_pred)
top3_acc = top3_hits / n
macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
macro_prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
macro_rec = recall_score(y_true, y_pred, average="macro", zero_division=0)

weighted_f1 = f1_score(y_true, y_pred, average="weighted", zero_division=0)
weighted_prec = precision_score(y_true, y_pred, average="weighted", zero_division=0)
weighted_rec = recall_score(y_true, y_pred, average="weighted", zero_division=0)

print(f"\nSummary (n={n}):")
print(f"  Top-1 Accuracy:  {top1_acc:.4f} ({sum(r['correct_top1'] for r in samples)}/{n})")
print(f"  Top-3 Accuracy:  {top3_acc:.4f} ({top3_hits}/{n})")
print(f"  Macro Precision: {macro_prec:.4f}")
print(f"  Macro Recall:    {macro_rec:.4f}")
print(f"  Macro F1:        {macro_f1:.4f}")
print(f"  Weighted Prec:   {weighted_prec:.4f}")
print(f"  Weighted Recall: {weighted_rec:.4f}")
print(f"  Weighted F1:     {weighted_f1:.4f}")

report_dict = classification_report(
    y_true,
    y_pred,
    labels=classes,
    target_names=classes,
    output_dict=True,
    zero_division=0,
)

print("\nClassification Report:")
print(classification_report(y_true, y_pred, labels=classes, target_names=classes, digits=4, zero_division=0))

cm = confusion_matrix(y_true, y_pred, labels=classes)
print("\nConfusion Matrix (rows=ground truth, cols=predicted):")
header = "             " + " ".join(f"[{i}]" for i in range(len(classes)))
print(header)
for i, row in enumerate(cm):
    print(f"[{i}] {classes[i][:9]:<9} " + "  ".join(f"{val:>2}" for val in row))

# Verify column sums vs prediction distribution
col_sums = cm.sum(axis=0)
pred_dist = Counter(y_pred)
print("\nVerification: Column sums equal predicted class counts:")
for i, c in enumerate(classes):
    print(f"  [{i}] {c:<30} col_sum={col_sums[i]:2d} pred_count={pred_dist.get(c, 0):2d}")
    assert col_sums[i] == pred_dist.get(c, 0)
