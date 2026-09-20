import io
import json
from pathlib import Path
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ocr.extractor import get_ocr_extractor
from ml.inference.classifier import MedicineClassifier, get_classifier
from ml.preprocessing.image_pipeline import validate_image, get_eval_transforms

client = TestClient(app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# 1. Dataset & Partition Tests
# ---------------------------------------------------------------------------

def test_dataset_splits_exist_and_balanced():
    raw_dir = PROJECT_ROOT / "ml" / "datasets" / "raw"
    train_dir = PROJECT_ROOT / "ml" / "datasets" / "train"
    val_dir = PROJECT_ROOT / "ml" / "datasets" / "val"
    test_dir = PROJECT_ROOT / "ml" / "datasets" / "test"

    assert raw_dir.exists(), "Raw dataset directory must exist"
    assert train_dir.exists(), "Train split must exist"
    assert val_dir.exists(), "Val split must exist"
    assert test_dir.exists(), "Test split must exist"

    # Core classes count
    classes = [d.name for d in raw_dir.iterdir() if d.is_dir()]
    assert len(classes) == 10, f"Expected 10 core packaging classes, found {len(classes)}"

    # Check partition distribution
    train_count = sum(len(list(d.glob("*.*"))) for d in train_dir.iterdir() if d.is_dir())
    val_count = sum(len(list(d.glob("*.*"))) for d in val_dir.iterdir() if d.is_dir())
    test_count = sum(len(list(d.glob("*.*"))) for d in test_dir.iterdir() if d.is_dir())

    assert train_count == 70, f"Expected 70 train images, got {train_count}"
    assert val_count == 20, f"Expected 20 validation images, got {val_count}"
    assert test_count == 10, f"Expected 10 test images, got {test_count}"


# ---------------------------------------------------------------------------
# 2. Image Preprocessing & Validation Tests
# ---------------------------------------------------------------------------

def test_image_validation_valid():
    im = Image.new("RGB", (224, 224), color="blue")
    validated = validate_image(im)
    assert validated.size == (224, 224)
    assert validated.mode == "RGB"


def test_image_validation_converts_rgba():
    im = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
    validated = validate_image(im)
    assert validated.mode == "RGB"


def test_image_validation_rejects_tiny_images():
    im = Image.new("RGB", (16, 16), color="black")
    with pytest.raises(ValueError, match="resolution too small"):
        validate_image(im)


def test_image_validation_rejects_corrupted_bytes():
    corrupt_data = b"NOT_AN_IMAGE_FILE_DATA_CORRUPT"
    with pytest.raises(ValueError, match="Corrupted or unsupported"):
        validate_image(corrupt_data)


def test_eval_transforms_output_shape():
    im = Image.new("RGB", (300, 400), color="white")
    transform = get_eval_transforms(image_size=224)
    tensor = transform(im)
    assert tensor.shape == (3, 224, 224)


# ---------------------------------------------------------------------------
# 3. Model Checkpoint & Inference Service Tests
# ---------------------------------------------------------------------------

def test_model_checkpoint_integrity():
    checkpoint_path = PROJECT_ROOT / "ml" / "artifacts" / "model" / "medicine_classifier.pt"
    assert checkpoint_path.exists(), "Model checkpoint must exist"

    classifier = get_classifier()
    assert len(classifier.class_names) == 10
    assert "paracetamol_500mg_tablet" in classifier.class_names
    assert "amoxicillin_500mg_capsule" in classifier.class_names


def test_classifier_predict_returns_ranked_predictions():
    classifier = get_classifier()
    test_img = PROJECT_ROOT / "ml" / "datasets" / "test" / "paracetamol_500mg_tablet" / "pkg_006.jpg"
    assert test_img.exists()

    result = classifier.predict(test_img, top_k=3, threshold=0.50)

    assert "top_prediction" in result
    assert "predictions" in result
    assert "is_confident" in result
    assert "inference_time_ms" in result
    assert len(result["predictions"]) <= 3

    # Ensure probabilities are sorted descending
    confs = [p["confidence"] for p in result["predictions"]]
    assert confs == sorted(confs, reverse=True)
    assert 0.0 <= result["top_prediction"]["confidence"] <= 1.0


# ---------------------------------------------------------------------------
# 4. FastAPI POST /api/scan Endpoint Tests
# ---------------------------------------------------------------------------

def test_api_scan_success_high_confidence():
    test_img = PROJECT_ROOT / "ml" / "datasets" / "test" / "paracetamol_500mg_tablet" / "pkg_006.jpg"
    with open(test_img, "rb") as f:
        response = client.post(
            "/api/scan?threshold=0.10",
            files={"file": ("paracetamol.jpg", f, "image/jpeg")}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_confident"] is True
    assert data["predicted_class"] == "paracetamol_500mg_tablet"
    assert data["recognized"] is True
    assert data["medicine"] is not None
    assert data["medicine"]["medicine_id"] == "MED-001"
    assert data["storage_requirements"] is not None
    assert data["storage_requirements"]["min_temperature"] == 20.0
    assert data["storage_requirements"]["max_temperature"] == 25.0
    # ocr_status reports the real outcome of the OCR stage. "unavailable" is a legitimate
    # value on machines without the EasyOCR weights, and must not be conflated with a
    # low-quality capture.
    assert data["ocr_status"] in {"completed", "skipped_low_quality", "unavailable"}



def test_api_scan_handles_low_confidence_gracefully():
    test_img = PROJECT_ROOT / "ml" / "datasets" / "test" / "paracetamol_500mg_tablet" / "pkg_006.jpg"
    with open(test_img, "rb") as f:
        # Pass artificially high threshold to trigger low-confidence workflow
        response = client.post(
            "/api/scan?threshold=0.999",
            files={"file": ("test.jpg", f, "image/jpeg")}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_confident"] is False
    assert data["recognized"] is False
    assert data["medicine"] is None
    assert data["storage_requirements"] is None
    assert "Low confidence" in data["message"]
    assert len(data["top_predictions"]) > 0


def test_api_scan_rejects_unsupported_media_type():
    txt_content = io.BytesIO(b"Hello this is a text file")
    response = client.post(
        "/api/scan",
        files={"file": ("notes.txt", txt_content, "text/plain")}
    )
    assert response.status_code == 415


def test_api_scan_rejects_empty_file():
    empty_content = io.BytesIO(b"")
    response = client.post(
        "/api/scan",
        files={"file": ("empty.jpg", empty_content, "image/jpeg")}
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 5. Metrics & Provenance Artifacts Tests
# ---------------------------------------------------------------------------

def test_evaluation_metrics_artifact_exists():
    metrics_file = PROJECT_ROOT / "ml" / "artifacts" / "metrics" / "test_metrics.json"
    assert metrics_file.exists(), "Evaluation metrics JSON must exist"

    with open(metrics_file, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    assert "top1_accuracy" in metrics
    assert "top3_accuracy" in metrics
    assert "macro_f1" in metrics
    assert "confusion_matrix" in metrics
    assert metrics["sample_count"] == 10
    assert len(metrics["class_names"]) == 10


# ---------------------------------------------------------------------------
# 6. OCR Non-Fabrication Test
# ---------------------------------------------------------------------------

def test_ocr_stub_does_not_fake_predictions():
    im = Image.new("RGB", (200, 200), color="white")
    extractor = get_ocr_extractor()
    raw_text, lines, quality, _ = extractor.extract(im)
    assert raw_text == ""
    assert len(lines) == 0  # Real OCR finds no text on blank white image, never fabricates


