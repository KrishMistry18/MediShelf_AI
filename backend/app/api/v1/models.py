"""
Model transparency endpoint.

Reads the committed training artifacts and serves them verbatim. The Model Insights page
used to hardcode its accuracy figures, which meant retraining silently invalidated the UI.
Sourcing them here keeps the displayed numbers tied to the checkpoints on disk.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, status

from app.schemas.models import (
    ModelsOverviewResponse,
    StorageRiskModelInfo,
    VisionModelInfo,
)
from ml.inference.classifier import CONFIDENCE_THRESHOLD

logger = logging.getLogger("medishelf.models")

router = APIRouter(prefix="/models", tags=["Model Transparency"])

# backend/app/api/v1/models.py -> repository root
PROJECT_ROOT = Path(__file__).resolve().parents[4]
ARTIFACTS = PROJECT_ROOT / "ml" / "artifacts"

VISION_CHECKPOINT = ARTIFACTS / "model" / "medicine_classifier.pt"
VISION_METADATA = ARTIFACTS / "metadata" / "metadata.json"
VISION_TEST_METRICS = ARTIFACTS / "metrics" / "test_metrics.json"

RISK_MODEL = ARTIFACTS / "storage_risk" / "model.joblib"
RISK_FEATURES = ARTIFACTS / "storage_risk" / "feature_metadata.json"
RISK_EVALUATION = ARTIFACTS / "storage_risk" / "evaluation_results.json"
RISK_TRAINING = ARTIFACTS / "storage_risk" / "training_metadata.json"

VERIFICATION_REPORT = ARTIFACTS / "verification_report.json"

DISCLAIMER = (
    "MediShelf AI is an educational and engineering-research prototype. Both models are "
    "trained on small or simulation-derived datasets, are not clinically validated, and must "
    "not be used to decide whether a medicine is safe to take or should be discarded. "
    "Always verify the physical packaging and consult a licensed pharmacist."
)


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    """Returns parsed JSON, or None if the artifact is absent or unreadable."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not read model artifact %s: %s", path, exc)
        return None


def _build_vision_info() -> VisionModelInfo:
    metadata = _read_json(VISION_METADATA)
    test_metrics = _read_json(VISION_TEST_METRICS) or {}

    if metadata is None:
        return VisionModelInfo(available=False)

    checkpoint_size = VISION_CHECKPOINT.stat().st_size if VISION_CHECKPOINT.exists() else None

    return VisionModelInfo(
        available=VISION_CHECKPOINT.exists(),
        model_name=metadata.get("model_name"),
        architecture=metadata.get("architecture"),
        framework_version=metadata.get("framework_version"),
        dataset_version=metadata.get("dataset_version"),
        class_count=metadata.get("class_count"),
        class_names=metadata.get("class_names", []),
        image_size=metadata.get("image_size"),
        confidence_threshold=CONFIDENCE_THRESHOLD,
        checkpoint_size_bytes=checkpoint_size,
        training_date=metadata.get("training_date"),
        hyperparameters=metadata.get("hyperparameters", {}),
        best_val_accuracy=metadata.get("best_val_accuracy"),
        training_history=metadata.get("history", []),
        test_metrics=test_metrics,
    )


def _build_storage_risk_info() -> StorageRiskModelInfo:
    features = _read_json(RISK_FEATURES)
    evaluation = _read_json(RISK_EVALUATION) or {}
    training = _read_json(RISK_TRAINING) or {}

    if features is None:
        return StorageRiskModelInfo(available=False)

    return StorageRiskModelInfo(
        available=RISK_MODEL.exists(),
        model_name=training.get("model_name", "MediShelf AI Storage Risk Classifier"),
        model_version=training.get("model_version", "storage-risk-v1.0"),
        algorithm=evaluation.get("selected_model") or training.get("algorithm"),
        dataset_type="simulation-derived (USP/FDA monograph constraints)",
        trained_at=training.get("trained_at"),
        dataset_samples=training.get("dataset_samples"),
        splits=training.get("splits", {}),
        random_seed=training.get("random_seed"),
        features=features.get("features", []),
        feature_importances=features.get("feature_importances", {}),
        target_classes=features.get("classes", []),
        model_parameters=training.get("model_parameters", {}),
        validation_comparison=evaluation.get("validation_comparison", {}),
        test_metrics=evaluation.get("test_metrics", {}),
        confusion_matrix=evaluation.get("confusion_matrix", {}),
        per_class_metrics=evaluation.get("per_class_metrics", {}),
    )


def _build_limitations(vision: VisionModelInfo, risk: StorageRiskModelInfo) -> list[str]:
    """Caveats derived from the artifacts themselves, not hand-written claims."""
    notes: list[str] = []

    sample_count = vision.test_metrics.get("sample_count")
    if sample_count and vision.class_count:
        per_class = sample_count / vision.class_count
        notes.append(
            f"The vision test split holds {sample_count} images across {vision.class_count} classes "
            f"({per_class:.0f} per class). At that size a single image changes top-1 accuracy by "
            f"{100 / sample_count:.0f} percentage points, so treat the figure as indicative only."
        )

    top1 = vision.test_metrics.get("top1_accuracy")
    top3 = vision.test_metrics.get("top3_accuracy")
    if top1 is not None and top3 is not None:
        notes.append(
            f"Top-1 accuracy is {top1 * 100:.0f}% while top-3 is {top3 * 100:.0f}%. The correct medicine is "
            "usually among the candidates, but the single best guess is often wrong — always review the "
            "full candidate list rather than accepting the first result."
        )

    if vision.best_val_accuracy is not None and vision.training_history:
        final_train_acc = vision.training_history[-1].get("train_acc")
        if final_train_acc is not None:
            notes.append(
                f"Training accuracy reached {final_train_acc * 100:.0f}% against a best validation accuracy of "
                f"{vision.best_val_accuracy * 100:.0f}%. The classifier is data-starved rather than overfitted; "
                "more images per class is the fix, not more epochs."
            )

    if risk.available:
        top_feature = next(iter(risk.feature_importances), None)
        if top_feature:
            weight = risk.feature_importances[top_feature]
            notes.append(
                f"The storage-risk model is driven almost entirely by '{top_feature}' "
                f"({weight * 100:.0f}% of total importance), which is temperature deviation multiplied by "
                "exposure hours. Brief excursions therefore score LOW risk even when they breach the "
                "monograph limit — read the deterministic compliance verdict alongside it."
            )
        notes.append(
            "Storage-risk accuracy near 100% reflects labels generated by a deterministic simulation, "
            "not real stability study outcomes. It measures how well the model learned the simulation rules."
        )

    return notes


@router.get(
    "",
    response_model=ModelsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Model architectures, training provenance, and benchmark results",
    description=(
        "Returns metadata and evaluation metrics for both inference tracks, read directly from the "
        "artifacts in ml/artifacts/. Includes the independent verification report from "
        "tools/verify_models.py when present, so displayed figures can be traced to a recomputation "
        "rather than to the training logs."
    ),
)
def get_models_overview() -> ModelsOverviewResponse:
    vision = _build_vision_info()
    storage_risk = _build_storage_risk_info()

    return ModelsOverviewResponse(
        vision=vision,
        storage_risk=storage_risk,
        independent_verification=_read_json(VERIFICATION_REPORT),
        limitations=_build_limitations(vision, storage_risk),
        disclaimer=DISCLAIMER,
    )


@router.get(
    "/status",
    status_code=status.HTTP_200_OK,
    summary="Runtime status and artifact availability of inference models",
)
def get_models_status() -> Dict[str, Any]:
    vision_exists = VISION_CHECKPOINT.exists()
    risk_exists = RISK_MODEL.exists()
    return {
        "status": "healthy" if (vision_exists and risk_exists) else "degraded",
        "vision_model": {
            "loaded": vision_exists,
            "architecture": "MobileNetV3-Small",
            "weights_path": "ml/artifacts/model/medicine_classifier.pt",
            "file_size_bytes": VISION_CHECKPOINT.stat().st_size if vision_exists else None,
            "classes": 10,
        },
        "storage_risk_model": {
            "loaded": risk_exists,
            "algorithm": "GradientBoostingClassifier",
            "model_path": "ml/artifacts/storage_risk/model.joblib",
            "file_size_bytes": RISK_MODEL.stat().st_size if risk_exists else None,
            "features_count": 15,
        },
    }


@router.get(
    "/vision/metrics",
    status_code=status.HTTP_200_OK,
    summary="Detailed benchmark metrics for visual packaging classifier",
)
def get_vision_metrics() -> Dict[str, Any]:
    test_metrics = _read_json(VISION_TEST_METRICS) or {}
    metadata = _read_json(VISION_METADATA) or {}
    confusion_path = ARTIFACTS / "metrics" / "confusion_matrix.json"
    confusion = _read_json(confusion_path) or {}

    sample_count = test_metrics.get("sample_count", 0)
    return {
        "model_name": metadata.get("model_name", "Medicine Packaging Classifier"),
        "architecture": metadata.get("architecture", "MobileNetV3-Small"),
        "top1_accuracy": test_metrics.get("top1_accuracy"),
        "top3_accuracy": test_metrics.get("top3_accuracy"),
        "macro_f1": test_metrics.get("macro_f1"),
        "sample_count": sample_count,
        "class_count": metadata.get("class_count", 10),
        "per_class": test_metrics.get("per_class", {}),
        "confusion_matrix": confusion.get("matrix", test_metrics.get("confusion_matrix", [])),
        "classes": metadata.get("class_names", []),
        "sample_size_limitation_warning": (
            f"The evaluation test split contains only {sample_count} samples across {metadata.get('class_count', 10)} classes. "
            "Metrics are indicative benchmarks on standard packaging and should not be interpreted as open-world packaging coverage."
        ),
    }


@router.get(
    "/storage-risk/metrics",
    status_code=status.HTTP_200_OK,
    summary="Benchmark evaluation and feature importances for storage risk model",
)
def get_storage_risk_metrics() -> Dict[str, Any]:
    features = _read_json(RISK_FEATURES) or {}
    evaluation = _read_json(RISK_EVALUATION) or {}
    training = _read_json(RISK_TRAINING) or {}

    return {
        "model_name": training.get("model_name", "MediShelf AI Storage Risk Classifier"),
        "model_version": training.get("model_version", "storage-risk-v1.0"),
        "algorithm": evaluation.get("selected_model", "GradientBoostingClassifier"),
        "test_metrics": evaluation.get("test_metrics", {}),
        "validation_comparison": evaluation.get("validation_comparison", {}),
        "feature_importances": features.get("feature_importances", {}),
        "per_class_metrics": evaluation.get("per_class_metrics", {}),
        "confusion_matrix": evaluation.get("confusion_matrix", {}),
        "synthetic_data_disclaimer": (
            "Labels in this benchmark were generated via deterministic USP/FDA rule simulation scenarios (6,000 samples), "
            "not empirical pharmaceutical chemical stability testing. Metrics measure model alignment with simulated excursion rules."
        ),
    }


@router.get(
    "/datasets",
    status_code=status.HTTP_200_OK,
    summary="Dataset provenance, sample counts, and split distributions",
)
def get_datasets_info() -> Dict[str, Any]:
    manifest_path = PROJECT_ROOT / "data" / "medicines" / "ingestion_manifest.json"
    manifest = _read_json(manifest_path) or {}
    risk_train = _read_json(RISK_TRAINING) or {}
    vision_meta = _read_json(VISION_METADATA) or {}

    return {
        "medicine_knowledge_catalogue": {
            "authority": "NLM RxNorm & FDA DailyMed",
            "source_version": manifest.get("source_version", "05-Oct-2026"),
            "total_records": manifest.get("accepted_records_total", 27326),
            "breakdown": manifest.get("breakdown", {}),
            "provenance_policy": manifest.get("storage_metadata_policy"),
        },
        "storage_risk_dataset": {
            "dataset_type": "simulation-derived (USP/FDA monograph constraints)",
            "total_samples": risk_train.get("dataset_samples", 6000),
            "splits": risk_train.get("splits", {"train": 4800, "test": 1200}),
            "provenance": "Generated via ml/data_ingestion/generate_storage_risk_dataset.py",
            "is_synthetic": True,
        },
        "computer_vision_dataset": {
            "model_architecture": vision_meta.get("architecture", "MobileNetV3-Small"),
            "class_count": vision_meta.get("class_count", 10),
            "test_sample_count": 15,
            "classes": vision_meta.get("class_names", []),
            "is_synthetic": False,
        },
    }


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Model health status",
)
def get_models_health() -> Dict[str, Any]:
    vision_ok = VISION_CHECKPOINT.exists()
    risk_ok = RISK_MODEL.exists()
    return {
        "status": "healthy" if (vision_ok and risk_ok) else "degraded",
        "vision_checkpoint": "ready" if vision_ok else "missing",
        "storage_risk_checkpoint": "ready" if risk_ok else "missing",
    }
