from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.ocr.extractor import get_ocr_extractor
from app.ocr.parser import parse_structured_fields
from app.ocr.schemas import OCRResponse

router = APIRouter(prefix="/ocr", tags=["OCR Label Extraction"])

MAX_UPLOAD_SIZE = 15 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


@router.post(
    "",
    response_model=OCRResponse,
    summary="Extract text and structured packaging fields",
    description=(
        "Performs pre-OCR image quality inspection, CLAHE contrast enhancement, deep-learning text recognition "
        "via EasyOCR (CRAFT + CRNN), and regex-based structured field extraction for expiry date, batch/lot, "
        "strength, and manufacturer."
    ),
)
async def extract_ocr(
    file: UploadFile = File(..., description="Medicine packaging photo"),
    db: Session = Depends(get_db),
) -> OCRResponse:
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

    # 3. Extract text lines and quality assessment
    try:
        extractor = get_ocr_extractor()
        raw_text, lines, quality, latency_ms = extractor.extract_text(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction engine error: {str(exc)}",
        )

    # 4. Parse structured fields and candidate matches
    fields, candidates = parse_structured_fields(lines, db)

    return OCRResponse(
        quality=quality,
        raw_text=raw_text,
        lines=lines,
        fields=fields,
        candidate_matches=candidates[:5],
        inference_time_ms=latency_ms,
        engine="EasyOCR 1.7.2",
    )
