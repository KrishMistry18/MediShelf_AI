from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.medicine import Medicine
from app.schemas.medicine import MedicineResponse
from app.schemas.scan import (
    OCRSummary,
    PredictionItem,
    RecognitionSummary,
    ScanResponse,
    StorageRequirementsSummary,
)
from app.ocr.extractor import get_ocr_extractor
from app.ocr.fusion import compute_cv_ocr_fusion
from app.ocr.parser import parse_structured_fields
from ml.inference.classifier import get_classifier

router = APIRouter(prefix="/scan", tags=["Computer Vision & OCR Scan"])

MAX_UPLOAD_SIZE = 15 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


@router.post(
    "",
    response_model=ScanResponse,
    summary="Recognize medicine packaging and extract OCR label text",
    description=(
        "Full multi-modal scanning pipeline: evaluates image quality, executes transfer-learning CV inference "
        "(MobileNetV3-Small), runs deep learning OCR (EasyOCR), parses structured fields (expiry, batch, dosage, manufacturer), "
        "synthesizes a transparent decision fusion assessment, and retrieves verified storage tolerances from the database."
    ),
)
async def scan_medicine(
    file: UploadFile = File(..., description="Medicine package photo"),
    threshold: Optional[float] = Query(default=None, ge=0.0, le=1.0, description="Optional override for confidence threshold"),
    db: Session = Depends(get_db),
) -> ScanResponse:
    # 1. Validate MIME type
    if file.content_type and file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file format '{file.content_type}'. Please upload a JPEG, PNG, or WebP image.",
        )

    # 2. Read bytes and check size
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(image_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size ({len(image_bytes)} bytes) exceeds the 15 MB limit.",
        )

    # 3. Perform Computer Vision inference
    try:
        classifier = get_classifier()
        cv_result = classifier.predict(
            image_input=image_bytes,
            top_k=3,
            threshold=threshold,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image validation failed: {str(val_err)}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(exc)}",
        )

    # 4. Perform Genuine OCR extraction & structured parsing
    try:
        extractor = get_ocr_extractor()
        raw_text, lines, quality, ocr_latency_ms = extractor.extract_text(image_bytes)
        structured_fields, candidate_matches = parse_structured_fields(lines, db)
    except Exception as ocr_err:
        # If OCR encounters an unexpected error, log and fallback gracefully
        raw_text = ""
        lines = []
        from app.ocr.schemas import ImageQualityAssessment, StructuredFields
        quality = ImageQualityAssessment(
            is_acceptable=False,
            blur_score=0.0,
            mean_brightness=0.0,
            width=0,
            height=0,
            issues=[f"OCR processing exception: {str(ocr_err)}"],
            recommendations=["Retry scan or adjust image lighting."]
        )
        structured_fields = StructuredFields()
        candidate_matches = []
        ocr_latency_ms = 0.0

    # 5. Format top-k predictions with database lookup
    predictions = []
    for item in cv_result["predictions"]:
        cls_name = item["class_name"]
        conf = item["confidence"]
        med_row = db.query(Medicine).filter(Medicine.image_class == cls_name).first()
        predictions.append(
            PredictionItem(
                class_name=cls_name,
                confidence=conf,
                medicine_id=med_row.medicine_id if med_row else None,
                medicine_name=med_row.medicine_name if med_row else cls_name.replace("_", " ").title(),
            )
        )

    top_pred = cv_result["top_prediction"]
    top_class = top_pred["class_name"] if top_pred else "unknown"
    top_conf = top_pred["confidence"] if top_pred else 0.0
    is_confident = cv_result["is_confident"]
    applied_threshold = cv_result["confidence_threshold"]

    # 6. Database matching and storage spec retrieval
    matched_medicine_row = db.query(Medicine).filter(Medicine.image_class == top_class).first()
    matched_medicine: Optional[MedicineResponse] = None
    storage_summary: Optional[StorageRequirementsSummary] = None

    if matched_medicine_row and is_confident:
        matched_medicine = MedicineResponse.model_validate(matched_medicine_row)
        storage_summary = StorageRequirementsSummary(
            min_temperature=matched_medicine_row.storage_min_temperature,
            max_temperature=matched_medicine_row.storage_max_temperature,
            min_humidity=matched_medicine_row.storage_min_humidity,
            max_humidity=matched_medicine_row.storage_max_humidity,
            temperature_unit="C",
            regulatory_source=matched_medicine_row.source,
        )

    # 7. Compute Multi-Modal Decision Fusion
    fusion_assessment = compute_cv_ocr_fusion(
        cv_class=top_class,
        cv_confidence=top_conf,
        cv_threshold=applied_threshold,
        ocr_fields=structured_fields,
        candidate_matches=candidate_matches,
        matched_medicine=matched_medicine_row,
    )

    # 8. Human-readable summary message
    if not quality.is_acceptable:
        message = "Image quality is insufficient. Please move closer, improve lighting, or hold the package steady."
    elif is_confident and matched_medicine:
        if fusion_assessment.identification_status == "CONFIRMED":
            message = (
                f"Successfully identified '{matched_medicine.medicine_name}' with {top_conf * 100:.1f}% CV confidence "
                f"and matching OCR packaging text. Official storage parameters retrieved from {matched_medicine.source}."
            )
        elif fusion_assessment.identification_status == "DIVERGENT":
            message = (
                f"Attention: Visual model suggested '{matched_medicine.medicine_name}', "
                f"but packaging text indicates '{fusion_assessment.ocr_match}'. Please verify packaging."
            )
        else:
            message = (
                f"Recognized '{matched_medicine.medicine_name}' with {top_conf * 100:.1f}% visual confidence. "
                f"Storage parameters retrieved from {matched_medicine.source}."
            )
    else:
        message = (
            f"Low confidence ({top_conf * 100:.1f}% < threshold {applied_threshold * 100:.0f}%). "
            f"Best visual match was '{top_class.replace('_', ' ').title()}'. "
            "Please reposition packaging, adjust lighting, or search medicine manually."
        )

    total_latency_ms = round(cv_result["inference_time_ms"] + ocr_latency_ms, 2)

    return ScanResponse(
        recognized=is_confident and (matched_medicine is not None),
        is_confident=is_confident,
        confidence=top_conf,
        confidence_threshold=applied_threshold,
        predicted_class=top_class,
        top_predictions=predictions,
        recognition=RecognitionSummary(
            predicted_class=top_class,
            confidence=top_conf,
            confidence_threshold=applied_threshold,
            is_confident=is_confident,
            top_predictions=predictions,
        ),
        ocr=OCRSummary(
            raw_text=raw_text,
            fields=structured_fields,
            engine="EasyOCR 1.7.2",
            candidate_matches=candidate_matches[:5],
        ),
        fusion=fusion_assessment,
        quality=quality,
        medicine=matched_medicine,
        storage_requirements=storage_summary,
        ocr_status="completed_phase_4",
        inference_time_ms=total_latency_ms,
        message=message,
    )
