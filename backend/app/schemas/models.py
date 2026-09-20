"""
Schemas for GET /api/models — the model transparency endpoint.

Everything served here is read straight off the training artifacts in ml/artifacts/ so
the UI can never drift from the figures the checkpoints actually produced. The nested
metric bags stay loosely typed on purpose: they mirror whatever the training scripts
wrote, and pinning their shape here would mean editing two places every time a metric
is added.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class VisionModelInfo(BaseModel):
    available: bool = Field(..., description="False when the checkpoint or metrics are missing from disk")
    model_name: Optional[str] = None
    architecture: Optional[str] = None
    framework_version: Optional[str] = None
    dataset_version: Optional[str] = None
    class_count: Optional[int] = None
    class_names: List[str] = Field(default_factory=list)
    image_size: Optional[int] = None
    confidence_threshold: Optional[float] = Field(
        None, description="Softmax score a top-1 prediction must reach to be treated as identified"
    )
    checkpoint_size_bytes: Optional[int] = None
    training_date: Optional[str] = None
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    best_val_accuracy: Optional[float] = None
    training_history: List[Dict[str, Any]] = Field(
        default_factory=list, description="Per-epoch train/val loss and accuracy"
    )
    test_metrics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Held-out split results: top1/top3 accuracy, macro scores, per-class table, confusion matrix",
    )


class StorageRiskModelInfo(BaseModel):
    available: bool = Field(..., description="False when the joblib artifact or metadata are missing from disk")
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    algorithm: Optional[str] = None
    dataset_type: Optional[str] = None
    trained_at: Optional[str] = None
    dataset_samples: Optional[int] = None
    splits: Dict[str, Any] = Field(default_factory=dict)
    random_seed: Optional[int] = None
    features: List[str] = Field(default_factory=list)
    feature_importances: Dict[str, float] = Field(
        default_factory=dict, description="Global importance per feature, descending"
    )
    target_classes: List[str] = Field(default_factory=list)
    model_parameters: Dict[str, Any] = Field(default_factory=dict)
    validation_comparison: Dict[str, Any] = Field(
        default_factory=dict, description="Candidate algorithms scored on the validation split before selection"
    )
    test_metrics: Dict[str, Any] = Field(default_factory=dict)
    confusion_matrix: Dict[str, Any] = Field(default_factory=dict)
    per_class_metrics: Dict[str, Any] = Field(default_factory=dict)


class ModelsOverviewResponse(BaseModel):
    vision: VisionModelInfo
    storage_risk: StorageRiskModelInfo
    independent_verification: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "Output of tools/verify_models.py if it has been run: metrics recomputed from the "
            "saved checkpoints rather than copied from the training logs"
        ),
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Plain-language caveats the UI is expected to surface alongside the numbers",
    )
    disclaimer: str
