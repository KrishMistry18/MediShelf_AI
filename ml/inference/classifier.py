import io
import time
from pathlib import Path
from typing import Dict, List, Optional, Union, Any

import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision import models

from ml.preprocessing.image_pipeline import get_eval_transforms, validate_image

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_CHECKPOINT = PROJECT_ROOT / "ml" / "artifacts" / "model" / "medicine_classifier.pt"
CONFIDENCE_THRESHOLD = 0.60


class MedicineClassifier:
    """
    Production-grade inference service for medicine packaging classification.
    Loads the fine-tuned MobileNetV3-Small checkpoint once and provides
    fast, deterministic CPU/CUDA evaluation with confidence thresholding.
    """

    def __init__(self, checkpoint_path: Union[str, Path] = DEFAULT_CHECKPOINT, threshold: float = CONFIDENCE_THRESHOLD):
        self.checkpoint_path = Path(checkpoint_path)
        self.threshold = threshold
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: Optional[nn.Module] = None
        self.class_names: List[str] = []
        self.image_size: int = 224
        self.transforms = None
        self._load_checkpoint()

    def _load_checkpoint(self) -> None:
        if not self.checkpoint_path.exists():
            raise FileNotFoundError(
                f"Model checkpoint not found at {self.checkpoint_path}. "
                "Ensure training has completed before running inference."
            )

        checkpoint = torch.load(self.checkpoint_path, map_location=self.device, weights_only=False)
        self.class_names = checkpoint.get("class_names", [])
        self.image_size = checkpoint.get("image_size", 224)
        num_classes = len(self.class_names)

        # Recreate exact architecture: MobileNetV3-Small with custom classification head
        model = models.mobilenet_v3_small(weights=None)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(128, num_classes)
        )

        model.load_state_dict(checkpoint["model_state_dict"])
        model.to(self.device)
        model.eval()

        self.model = model
        self.transforms = get_eval_transforms(image_size=self.image_size)

    def predict(
        self,
        image_input: Union[str, Path, bytes, Image.Image],
        top_k: int = 3,
        threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Runs inference on an image input (file path, raw bytes, or PIL Image).
        Returns top-k predictions with confidence scores and confidence flag.
        """
        active_threshold = threshold if threshold is not None else self.threshold
        start_time = time.perf_counter()

        # Validate image format, dimensions, integrity and ensure RGB
        pil_image = validate_image(image_input)

        # Preprocess
        tensor = self.transforms(pil_image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1).squeeze(0)

        # Retrieve top-k
        k = min(top_k, len(self.class_names))
        top_probs, top_indices = torch.topk(probs, k=k)

        top_probs = top_probs.cpu().numpy().tolist()
        top_indices = top_indices.cpu().numpy().tolist()

        predictions: List[Dict[str, Any]] = []
        for prob, idx in zip(top_probs, top_indices):
            predictions.append({
                "class_name": self.class_names[idx],
                "confidence": round(float(prob), 4),
            })

        top_pred = predictions[0] if predictions else None
        top_confidence = top_pred["confidence"] if top_pred else 0.0
        is_confident = top_confidence >= active_threshold

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "top_prediction": top_pred,
            "predictions": predictions,
            "is_confident": is_confident,
            "confidence_threshold": active_threshold,
            "inference_time_ms": elapsed_ms,
            "total_classes": len(self.class_names),
        }


# Global singleton instance for high-throughput reuse
_classifier_instance: Optional[MedicineClassifier] = None


def get_classifier() -> MedicineClassifier:
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = MedicineClassifier()
    return _classifier_instance
