from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class ImageQualityAssessment(BaseModel):
    """Quality metrics evaluated prior to OCR execution."""
    is_acceptable: bool = Field(..., description="Whether image meets minimal clarity thresholds")
    blur_score: float = Field(..., description="Laplacian variance sharpness metric (higher = sharper)")
    mean_brightness: float = Field(..., description="Average grayscale pixel intensity [0, 255]")
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    resolution: str = Field(default="", description="Image resolution formatted as WxH")
    issues: List[str] = Field(default_factory=list, description="Detected visual defects (e.g., blurry, too dark)")
    recommendations: List[str] = Field(default_factory=list, description="User guidance to improve capture quality")


class OCRTextLine(BaseModel):
    """Individual text line detected by OCR engine with spatial coordinates."""
    text: str = Field(..., description="Recognized text string")
    confidence: float = Field(..., description="OCR engine character recognition confidence [0.0, 1.0]")
    bounding_box: List[List[int]] = Field(default_factory=list, description="Polygon corners [[x1,y1], [x2,y2], ...]")


class ConfidenceBreakdown(BaseModel):
    """Decomposed confidence metrics across different pipeline stages."""
    ocr_engine_confidence: Optional[float] = Field(None, description="Raw OCR character recognition confidence")
    parser_confidence: Optional[float] = Field(None, description="Confidence in structural/regex pattern match")
    db_match_confidence: Optional[float] = Field(None, description="Similarity score matching pharmaceutical catalog")


class ExtractedField(BaseModel):
    """Structured container for a single extracted pharmaceutical packaging field."""
    field_name: Optional[str] = Field(None, description="Canonical name of extracted field")
    value: Optional[str] = Field(None, description="Normalized field value (null if not detected)")
    raw_text: Optional[str] = Field(None, description="Exact raw text snippet from packaging")
    original_text: Optional[str] = Field(None, description="Exact raw text snippet from packaging (alias)")
    ocr_engine_confidence: Optional[float] = Field(None, description="Raw OCR character recognition confidence")
    parser_confidence: Optional[float] = Field(None, description="Confidence in structural/regex pattern match")
    db_match_confidence: Optional[float] = Field(None, description="Similarity score matching pharmaceutical catalog")
    confidence: ConfidenceBreakdown = Field(default_factory=ConfidenceBreakdown)
    is_user_corrected: bool = Field(default=False, description="Flag indicating whether field was manually edited by user")


class CandidateMatch(BaseModel):
    """Database catalog match candidate for recognized packaging text."""
    medicine_id: str
    medicine_name: str
    generic_name: str
    strength: str
    dosage_form: str
    similarity_score: float = Field(..., description="String similarity score [0.0, 1.0]")
    matched_token: str = Field(..., description="OCR token that triggered the match")


class StructuredFields(BaseModel):
    """Container for all structured medicine packaging fields extracted via OCR."""
    medicine_name: ExtractedField = Field(default_factory=ExtractedField)
    generic_name: ExtractedField = Field(default_factory=ExtractedField)
    strength: ExtractedField = Field(default_factory=ExtractedField)
    batch_number: ExtractedField = Field(default_factory=ExtractedField)
    expiry_date: ExtractedField = Field(default_factory=ExtractedField)
    manufacturing_date: ExtractedField = Field(default_factory=ExtractedField)
    manufacturer: ExtractedField = Field(default_factory=ExtractedField)


class FusionAssessment(BaseModel):
    """Multi-modal synthesis combining Computer Vision and OCR textual evidence."""
    identification_status: str = Field(..., description="CONFIRMED, PARTIAL, DIVERGENT, or UNCONFIRMED")
    agreement_score: float = Field(..., description="Multi-modal consistency score [0.0, 1.0]")
    cv_prediction: Optional[str] = Field(None, description="Class predicted by CV classifier")
    ocr_match: Optional[str] = Field(None, description="Best medicine title matched by OCR")
    strength_match: bool = Field(default=False, description="True if extracted strength agrees with catalog record")
    reasons: List[str] = Field(default_factory=list, description="Human-readable decision justifications")


class OCRResponse(BaseModel):
    """Complete response payload for POST /api/ocr."""
    quality: ImageQualityAssessment
    raw_text: str = Field(..., description="Concatenated raw OCR text")
    lines: List[OCRTextLine] = Field(default_factory=list, description="Detected text lines with confidences")
    fields: StructuredFields
    candidate_matches: List[CandidateMatch] = Field(default_factory=list, description="Ranked medicine catalog matches")
    inference_time_ms: float = Field(..., description="OCR processing latency in milliseconds")
    engine: str = Field(default="EasyOCR 1.7.2", description="Underlying OCR engine")
