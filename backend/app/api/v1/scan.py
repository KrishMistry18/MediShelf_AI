import io
import json
import logging
from datetime import datetime, timezone
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
from app.ocr.parser import extract_active_ingredients, extract_release_type, parse_structured_fields
from app.ocr.preprocess import assess_image_quality
from app.ocr.retrieval import check_exact_product_match, get_retriever
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
    extracted_ings: List[str] = []
    rel_type: Optional[str] = None

    if not quality.is_acceptable:
        # Skip the expensive CPU OCR pass on an image we already know is unusable.
        ocr_status = "skipped_low_quality"
    else:
        try:
            extractor = get_ocr_extractor()
            raw_text, lines, _ocr_quality, ocr_latency_ms = extractor.extract_text(image_bytes)
            structured_fields, candidate_matches = parse_structured_fields(lines, db)
            extracted_ings = extract_active_ingredients(lines)
            rel_type = extract_release_type(lines)
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

    # 7. Multi-Modal Decision Fusion
    matched_cv_row = db.query(Medicine).filter(Medicine.image_class == top_class).first()
    fusion_assessment = compute_cv_ocr_fusion(
        cv_class=top_class,
        cv_confidence=top_conf,
        cv_threshold=applied_threshold,
        ocr_fields=structured_fields,
        candidate_matches=candidate_matches,
        matched_medicine=matched_cv_row,
    )

    # 8. Open-World Evidence Arbitration & Candidate Resolution
    # Sourced from: OCR candidate matches (NLM RxNorm / FDA DailyMed / openFDA) and CV visual evidence.
    top_cand = candidate_matches[0] if candidate_matches else None
    cand_score = float(top_cand.similarity_score) if top_cand else 0.0

    matched_medicine: Optional[MedicineResponse] = None
    storage_summary: Optional[StorageRequirementsSummary] = None
    product_status = "UNKNOWN"
    final_recognized = False
    final_is_confident = False
    message = ""

    # Unified resolution via medicine_resolution_service
    from app.services.medicine_service import medicine_resolution_service

    def _resolve_medicine(med_id: str) -> Optional[MedicineResponse]:
        return medicine_resolution_service.resolve_medicine(identifier=med_id, db=db)

    # Case A: Quality Gate Failed
    if not quality.is_acceptable:
        product_status = "UNKNOWN"
        final_recognized = False
        final_is_confident = False
        detail = " ".join(quality.recommendations) or "Move closer, improve lighting, or hold the package steady."
        message = f"Image quality is insufficient for reliable text extraction. {detail}"

    # Case B: High-Confidence Open-World Text & Knowledge Base Match
    # OCR extracted active ingredients/brand from packaging matching real NLM RxNorm or DailyMed monograph.
    # A verified medicine match MUST NOT be overridden by a closed-set CV softmax prediction!
    # Caller-specified threshold must be strictly respected: candidate_threshold = max(0.80, applied_threshold)
    elif top_cand and cand_score >= max(0.80, applied_threshold):
        # Corroborate CV with candidate matches only if exact product formulation matches
        corroborated_cv = None
        if is_confident and matched_cv_row:
            cv_exact, _ = check_exact_product_match(
                matched_cv_row,
                extracted_ingredients=extracted_ings,
                extracted_strength=structured_fields.strength.value,
                extracted_dosage_form=structured_fields.dosage_form.value,
                extracted_release_type=rel_type,
            )
            if cv_exact:
                for c in candidate_matches:
                    if c.similarity_score >= 0.70:
                        if c.medicine_id == matched_cv_row.medicine_id:
                            corroborated_cv = _resolve_medicine(matched_cv_row.medicine_id)
                            break
                        cand_exact, _ = check_exact_product_match(
                            candidate=matched_cv_row,
                            extracted_ingredients=c.active_ingredients or ([c.generic_name] if c.generic_name else []),
                            extracted_strength=c.strength,
                            extracted_dosage_form=c.dosage_form,
                        )
                        if cand_exact:
                            corroborated_cv = _resolve_medicine(matched_cv_row.medicine_id)
                            break

        resolved = corroborated_cv or _resolve_medicine(top_cand.medicine_id)
        if resolved:
            matched_medicine = resolved
            storage_summary = StorageRequirementsSummary(
                min_temperature=resolved.storage_min_temperature,
                max_temperature=resolved.storage_max_temperature,
                min_humidity=resolved.storage_min_humidity,
                max_humidity=resolved.storage_max_humidity,
                temperature_unit="C",
                regulatory_source=resolved.source,
            )

            # Strict Exact-Match Verification Gate
            is_exact, exact_reasons = check_exact_product_match(
                candidate=resolved,
                extracted_ingredients=extracted_ings,
                extracted_strength=structured_fields.strength.value,
                extracted_dosage_form=structured_fields.dosage_form.value,
                extracted_release_type=rel_type,
            )

            if is_exact:
                product_status = "IDENTIFIED"
                final_recognized = True
                final_is_confident = True

                # Corroborating CV signal
                if is_confident and matched_cv_row and matched_cv_row.medicine_id == resolved.medicine_id:
                    message = (
                        f"Successfully identified '{resolved.medicine_name}' with matching visual model score "
                        f"({top_conf * 100:.1f}%) and OCR packaging text ({cand_score * 100:.1f}%). Official storage parameters retrieved from {resolved.source}."
                    )
                # Closed-set visual model disagreement / outside scope
                elif is_confident and matched_cv_row:
                    message = (
                        f"Medicine identified: '{resolved.medicine_name}' based on packaging text and verified database monograph "
                        f"({cand_score * 100:.1f}% match). Visual classifier suggested nearest trained class '{matched_cv_row.medicine_name}' ({top_conf * 100:.1f}%), "
                        f"but the 10-class closed-set visual model cannot reliably classify medicines outside its trained scope. "
                        f"Official storage parameters retrieved from {resolved.source}."
                    )
                else:
                    message = (
                        f"Successfully identified '{resolved.medicine_name}' based on packaging text and verified database monograph "
                        f"({cand_score * 100:.1f}% match). Official storage parameters retrieved from {resolved.source}."
                    )
            else:
                # Incomplete candidate match (e.g. combination mismatch, single ingredient vs multi, strength or release mismatch)
                product_status = "PARTIAL_MATCH"
                final_recognized = False
                final_is_confident = False
                message = (
                    f"Partial identification: Product candidate '{resolved.medicine_name}' matched general active principles, "
                    f"but does not satisfy exact formulation criteria ({'; '.join(exact_reasons)}). Manual verification required."
                )

    # Case C: Genuine Conflicting Evidence Between Classes with Indecisive Text (< 0.80)
    elif (
        is_confident
        and matched_cv_row
        and top_cand
        and cand_score >= 0.60
        and matched_cv_row.medicine_id != top_cand.medicine_id
    ):
        product_status = "CONFLICTING_EVIDENCE"
        final_recognized = False
        final_is_confident = False
        message = (
            f"Identification conflict: Visual model suggested '{matched_cv_row.medicine_name}' ({top_conf * 100:.1f}%), "
            f"while packaging text suggests '{top_cand.medicine_name}' ({cand_score * 100:.1f}%). Neither is decisive. Please verify packaging manually."
        )

    # Case D: High-Confidence CV Match Corroborated or Visual Only (Known Catalog)
    elif is_confident and matched_cv_row:
        matched_medicine = MedicineResponse.model_validate(matched_cv_row)
        storage_summary = StorageRequirementsSummary(
            min_temperature=matched_cv_row.storage_min_temperature,
            max_temperature=matched_cv_row.storage_max_temperature,
            min_humidity=matched_cv_row.storage_min_humidity,
            max_humidity=matched_cv_row.storage_max_humidity,
            temperature_unit="C",
            regulatory_source=matched_cv_row.source,
        )
        is_exact, exact_reasons = check_exact_product_match(
            candidate=matched_cv_row,
            extracted_ingredients=extracted_ings,
            extracted_strength=structured_fields.strength.value,
            extracted_dosage_form=structured_fields.dosage_form.value,
            extracted_release_type=rel_type,
        )
        if fusion_assessment.identification_status == "CONFIRMED" and is_exact:
            product_status = "IDENTIFIED"
            final_recognized = True
            final_is_confident = True
            message = (
                f"Successfully identified '{matched_medicine.medicine_name}' with {top_conf * 100:.1f}% visual model score "
                f"and matching OCR packaging text. Official storage parameters retrieved from {matched_medicine.source}."
            )
        else:
            product_status = "PARTIAL_MATCH"
            final_recognized = False
            final_is_confident = False
            detail = f" ({'; '.join(exact_reasons)})" if exact_reasons else ""
            message = (
                f"Partial identification: Recognized '{matched_medicine.medicine_name}' with {top_conf * 100:.1f}% visual model score. "
                f"Packaging text could not independently corroborate exact identity{detail}. Storage parameters retrieved from {matched_medicine.source}."
            )

    # Case E: Moderate / Likely Match (cand_score >= 0.65)
    elif top_cand and cand_score >= max(0.65, applied_threshold):
        resolved = _resolve_medicine(top_cand.medicine_id)
        if resolved:
            matched_medicine = resolved
            storage_summary = StorageRequirementsSummary(
                min_temperature=resolved.storage_min_temperature,
                max_temperature=resolved.storage_max_temperature,
                min_humidity=resolved.storage_min_humidity,
                max_humidity=resolved.storage_max_humidity,
                temperature_unit="C",
                regulatory_source=resolved.source,
            )
            product_status = "LIKELY_MATCH"
            final_recognized = True
            final_is_confident = False
            message = (
                f"Likely medicine match: '{resolved.medicine_name}' ({cand_score * 100:.1f}% evidence). "
                "Manual packaging verification recommended."
            )

    # Case F: Partial Evidence Extracted (0.50 <= cand_score < 0.65 or candidate with partial specs)
    elif top_cand and (cand_score >= 0.50 or structured_fields.strength.value or structured_fields.dosage_form.value):
        product_status = "PARTIAL_MATCH"
        final_recognized = False
        final_is_confident = False
        prefix = f"Low confidence ({top_conf * 100:.1f}% < threshold {applied_threshold * 100:.0f}%). " if not is_confident else ""
        message = f"{prefix}Some packaging information was extracted, but there is not enough evidence to verify the exact product."

    # Case G: Unknown / Not Enough Evidence (Never force a prediction!)
    else:
        product_status = "UNKNOWN"
        final_recognized = False
        final_is_confident = False
        message = (
            f"Low confidence ({top_conf * 100:.1f}% < threshold {applied_threshold * 100:.0f}%). "
            f"Medicine could not be identified with sufficient evidence. Please ensure the label is well-lit and clearly visible."
        )

    # Note if OCR engine was unavailable
    if ocr_status == "unavailable":
        message += (
            " Label-text evidence is unavailable in this environment (OCR engine not loaded), "
            "so this result rests on the visual model alone."
        )

    # 9. Provenance & Multi-Modal Evidence Checklist
    provenance = None
    if matched_medicine:
        provenance = {
            "source_name": matched_medicine.source,
            "source_identifier": matched_medicine.source_id or matched_medicine.medicine_id,
            "source_url": matched_medicine.source_url,
            "retrieved_at": matched_medicine.retrieved_at.isoformat() if matched_medicine.retrieved_at else None,
            "source_version": matched_medicine.source_version or "2026-03",
        }

    evidence_checklist = {
        "label_text": bool(raw_text and len(raw_text.strip()) > 3),
        "active_ingredients": bool(structured_fields.generic_name.value or (top_cand and top_cand.active_ingredients) or (matched_medicine and matched_medicine.generic_name)),
        "strength": bool(structured_fields.strength.value or (matched_medicine and matched_medicine.strength)),
        "dosage_form": bool(structured_fields.dosage_form.value or (matched_medicine and matched_medicine.dosage_form)),
        "database_match": bool(top_cand and cand_score >= 0.65),
        "visual_classifier": bool(is_confident and matched_cv_row and (matched_medicine and matched_cv_row.medicine_id == matched_medicine.medicine_id)),
    }

    score_breakdown = {
        "text_identity_score": round(cand_score, 4) if top_cand else 0.0,
        "visual_score": round(top_conf, 4),
        "composite_score": round(max(cand_score, top_conf if is_confident else 0.0), 4),
    }

    total_latency_ms = round(cv_result["inference_time_ms"] + ocr_latency_ms, 2)

    # Determine general identification confidence:
    # If identified via open-world OCR retrieval, use the text similarity score;
    # If corroborated with CV, or identified solely via CV, use the relevant visual score.
    if product_status == "IDENTIFIED":
        if top_cand and cand_score >= max(0.80, applied_threshold):
            final_confidence = cand_score
        else:
            final_confidence = top_conf
    elif product_status == "LIKELY_MATCH":
        final_confidence = cand_score
    else:
        final_confidence = top_conf

    return ScanResponse(
        recognized=final_recognized,
        is_confident=final_is_confident,
        confidence=final_confidence,
        confidence_threshold=applied_threshold,
        predicted_class=top_class,
        top_predictions=predictions,
        recognition=RecognitionSummary(
            predicted_class=top_class,
            confidence=top_conf,
            confidence_threshold=applied_threshold,
            is_confident=final_is_confident,
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
        product_status=product_status,
        provenance=provenance,
        evidence_checklist=evidence_checklist,
        score_breakdown=score_breakdown,
        visual_model_score=top_conf,
        retrieval_match_score=round(cand_score, 4) if top_cand else 0.0,
        identification_status=product_status,
    )
