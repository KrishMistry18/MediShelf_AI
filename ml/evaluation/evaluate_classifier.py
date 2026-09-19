import json
import sys
from pathlib import Path
from typing import Dict, Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report
)
from torch.utils.data import DataLoader
from torchvision import datasets, models
from torchvision.models import MobileNet_V3_Small_Weights

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.image_pipeline import get_eval_transforms


def evaluate_test_set(
    checkpoint_path: str = str(PROJECT_ROOT / "ml" / "artifacts" / "model" / "medicine_classifier.pt"),
    test_dir: str = str(PROJECT_ROOT / "ml" / "datasets" / "test"),
    output_dir: str = str(PROJECT_ROOT / "ml" / "artifacts" / "metrics"),
) -> Dict[str, Any]:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    if not Path(checkpoint_path).exists():
        raise FileNotFoundError(f"Model checkpoint not found at: {checkpoint_path}")

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    class_names = checkpoint["class_names"]
    num_classes = len(class_names)
    image_size = checkpoint.get("image_size", 224)

    # Rebuild model architecture
    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[3].in_features
    import torch.nn as nn
    model.classifier[3] = nn.Sequential(
        nn.Linear(in_features, 128),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(128, num_classes)
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()

    test_dataset = datasets.ImageFolder(test_dir, transform=get_eval_transforms(image_size))
    test_loader = DataLoader(test_dataset, batch_size=4, shuffle=False, num_workers=0)

    y_true = []
    y_pred = []
    y_probs = []

    print("=" * 65)
    print("      MEDISHELF AI — ISOLATED TEST SET BENCHMARK EVALUATION")
    print("=" * 65)
    print(f"Device:             {device}")
    print(f"Test Directory:     {test_dir}")
    print(f"Total Test Samples: {len(test_dataset)}")
    print(f"Target Classes:     {num_classes}")
    print("-" * 65)

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            probs = F.softmax(outputs, dim=1)
            _, preds = torch.max(outputs, 1)

            y_true.extend(labels.cpu().numpy().tolist())
            y_pred.extend(preds.cpu().numpy().tolist())
            y_probs.extend(probs.cpu().numpy().tolist())

    y_true_np = np.array(y_true)
    y_pred_np = np.array(y_pred)
    y_probs_np = np.array(y_probs)

    # Top-1 and Top-3 accuracy
    top1_acc = accuracy_score(y_true_np, y_pred_np)
    
    # Top-3 Accuracy calculation
    top3_correct = 0
    for i, target in enumerate(y_true):
        top3_indices = np.argsort(y_probs_np[i])[::-1][:3]
        if target in top3_indices:
            top3_correct += 1
    top3_acc = top3_correct / len(y_true) if len(y_true) > 0 else 0.0

    # Precision, Recall, F1
    prec_macro, rec_macro, f1_macro, _ = precision_recall_fscore_support(
        y_true_np, y_pred_np, average="macro", zero_division=0
    )
    prec_weighted, rec_weighted, f1_weighted, _ = precision_recall_fscore_support(
        y_true_np, y_pred_np, average="weighted", zero_division=0
    )

    # Confusion matrix
    cm = confusion_matrix(y_true_np, y_pred_np, labels=list(range(num_classes)))
    cm_list = cm.tolist()

    # Per-class metrics
    per_class = {}
    clf_report = classification_report(
        y_true_np, y_pred_np, target_names=class_names, output_dict=True, zero_division=0
    )
    for cls_name in class_names:
        if cls_name in clf_report:
            per_class[cls_name] = {
                "precision": round(clf_report[cls_name]["precision"], 4),
                "recall": round(clf_report[cls_name]["recall"], 4),
                "f1-score": round(clf_report[cls_name]["f1-score"], 4),
                "support": int(clf_report[cls_name]["support"]),
            }

    metrics_payload = {
        "evaluation_dataset": "Isolated Test Split (15%)",
        "sample_count": len(test_dataset),
        "top1_accuracy": round(top1_acc, 4),
        "top3_accuracy": round(top3_acc, 4),
        "macro_precision": round(prec_macro, 4),
        "macro_recall": round(rec_macro, 4),
        "macro_f1": round(f1_macro, 4),
        "weighted_precision": round(prec_weighted, 4),
        "weighted_recall": round(rec_weighted, 4),
        "weighted_f1": round(f1_weighted, 4),
        "per_class": per_class,
        "confusion_matrix": cm_list,
        "class_names": class_names,
    }

    # Save JSON metrics
    metrics_file = out_path / "test_metrics.json"
    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    # Save Confusion Matrix JSON
    cm_json_file = out_path / "confusion_matrix.json"
    with open(cm_json_file, "w", encoding="utf-8") as f:
        json.dump({"matrix": cm_list, "classes": class_names}, f, indent=2)

    # Render and save Confusion Matrix Plot
    fig, ax = plt.subplots(figsize=(10, 8))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=[c[:14] for c in class_names],
        yticklabels=[c[:14] for c in class_names],
        title="MediShelf AI — Confusion Matrix (Test Split)",
        ylabel="True Class",
        xlabel="Predicted Class",
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

    # Annotate cells
    thresh = cm.max() / 2.0 if cm.max() > 0 else 1.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j, i, format(cm[i, j], "d"),
                ha="center", va="center",
                color="white" if cm[i, j] > thresh else "black",
                fontsize=9
            )
    fig.tight_layout()
    cm_png_file = out_path / "confusion_matrix.png"
    fig.savefig(cm_png_file, dpi=200)
    plt.close(fig)

    print(f"Top-1 Accuracy:     {top1_acc * 100:.1f}%")
    print(f"Top-3 Accuracy:     {top3_acc * 100:.1f}%")
    print(f"Macro F1 Score:     {f1_macro:.4f}")
    print(f"Weighted F1 Score:  {f1_weighted:.4f}")
    print("-" * 65)
    print(f"[OK] Test metrics saved to:         {metrics_file}")
    print(f"[OK] Confusion matrix saved to:     {cm_png_file}")
    print("=" * 65)

    return metrics_payload


if __name__ == "__main__":
    evaluate_test_set()
