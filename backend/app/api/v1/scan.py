import io
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from PIL import Image
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
from app.ocr.preprocess import assess_image_quality
from app.ocr.schemas import CandidateMatch, OCRTextLine, StructuredFields
from ml.inference.classifier import get_classifier

logger = logging.getLogger("medishelf.scan")

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

    # 4. Assess capture quality.
    #
    # Quality is measured here rather than inside the OCR call so that an unavailable
    # OCR engine is never reported to the user as a bad photo. The two failures need
    # different remedies: reshoot the image vs. install the EasyOCR weights.
    try:
        quality = assess_image_quality(Image.open(io.BytesIO(image_bytes)))
    except Exception as quality_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read image for quality assessment: {quality_err}",
        )

    # 5. Genuine OCR extraction & structured parsing.
    #
    # OCR is optional infrastructure: the EasyOCR weights are a separate ~100 MB
    # download. When they are missing the scan still returns CV recognition and
    # monograph data, and ocr_status tells the client why the text evidence is empty.
    raw_text = ""
    lines: List[OCRTextLine] = []
    structured_fields = StructuredFields()
    candidate_matches: List[CandidateMatch] = []
    ocr_latency_ms = 0.0
    ocr_status = "completed"
    ocr_error: Optional[str] = None

    if not quality.is_acceptable:
        # Skip the expensive CPU OCR pass on an image we already know is unusable.
        ocr_status = "skipped_low_quality"
    else:
        try:
            extractor = get_ocr_extractor()
            raw_text, lines, _ocr_quality, ocr_latency_ms = extractor.extract_text(image_bytes)
            structured_fields, candidate_matches = parse_structured_fields(lines, db)
        except Exception as ocr_err:
            ocr_status = "unavailable"
            ocr_error = str(ocr_err)
            logger.warning("OCR stage unavailable, continuing with CV-only evidence: %s", ocr_err)

    # 6. Format top-k predictions with database lookup
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

    # 7. Database matching and storage spec retrieval
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

    # 8. Compute Multi-Modal Decision Fusion
    fusion_assessment = compute_cv_ocr_fusion(
        cv_class=top_class,
        cv_confidence=top_conf,
        cv_threshold=applied_threshold,
        ocr_fields=structured_fields,
        candidate_matches=candidate_matches,
        matched_medicine=matched_medicine_row,
    )

    # 9. Human-readable summary message
    if not quality.is_acceptable:
        detail = " ".join(quality.recommendations) or "Move closer, improve lighting, or hold the package steady."
        message = f"Image quality is insufficient for reliable text extraction. {detail}"
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

    # Be explicit when the label-text half of the pipeline did not run, so the client
    # never presents a CV-only result as if both evidence streams agreed.
    if ocr_status == "unavailable":
        message += (
            " Label-text evidence is unavailable in this environment (OCR engine not loaded), "
            "so this result rests on the visual model alone."
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
            engine="EasyOCR 1.7.2" if ocr_status == "completed" else "unavailable",
            candidate_matches=candidate_matches[:5],
            status=ocr_status,
            error=ocr_error,
        ),
        fusion=fusion_assessment,
        quality=quality,
        medicine=matched_medicine,
        storage_requirements=storage_summary,
        ocr_status=ocr_status,
        inference_time_ms=total_latency_ms,
        message=message,
    )
