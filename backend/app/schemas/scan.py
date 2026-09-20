from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from app.schemas.medicine import MedicineResponse
from app.ocr.schemas import (
    CandidateMatch,
    FusionAssessment,
    ImageQualityAssessment,
    StructuredFields,
)


class PredictionItem(BaseModel):
    class_name: str = Field(..., description="Target model classification label")
    confidence: float = Field(..., description="Softmax probability score between 0.0 and 1.0")
    medicine_id: Optional[str] = Field(None, description="Catalog SKU if matched")
    medicine_name: Optional[str] = Field(None, description="Commercial title if matched")


class RecognitionSummary(BaseModel):
    predicted_class: str
    confidence: float
    confidence_threshold: float
    is_confident: bool
    top_predictions: List[PredictionItem]


class OCRSummary(BaseModel):
    raw_text: str
    fields: StructuredFields
    engine: str = "EasyOCR 1.7.2"
    candidate_matches: List[CandidateMatch] = Field(default_factory=list)
    status: str = Field(
        default="completed",
        description=(
            "completed = text extracted; skipped_low_quality = image failed the quality gate "
            "so OCR was not attempted; unavailable = the OCR engine could not be loaded"
        ),
    )
    error: Optional[str] = Field(None, description="Engine error detail when status is 'unavailable'")


class StorageRequirementsSummary(BaseModel):
    min_temperature: float = Field(..., description="Minimum storage temp in Celsius")
    max_temperature: float = Field(..., description="Maximum storage temp in Celsius")
    min_humidity: Optional[float] = Field(None, description="Minimum humidity in % RH")
    max_humidity: Optional[float] = Field(None, description="Maximum humidity in % RH")
    temperature_unit: str = Field(default="C", description="Temperature unit (Celsius)")
    regulatory_source: str = Field(..., description="Source monograph for the storage parameters")


class ScanResponse(BaseModel):
    """
    Composite Phase 4 response combining Computer Vision classification,
    EasyOCR structured packaging extraction, multi-modal decision fusion,
    and verified database monograph retrieval.
    """
    recognized: bool = Field(..., description="True if inference succeeded and confidence threshold was satisfied")
    is_confident: bool = Field(..., description="Whether the top prediction meets or exceeds the confidence threshold")
    confidence: float = Field(..., description="Confidence of the top visual prediction")
    confidence_threshold: float = Field(..., description="System confidence threshold applied")
    predicted_class: str = Field(..., description="Class name predicted with highest probability")
    top_predictions: List[PredictionItem] = Field(..., description="Ranked top-k predictions with probabilities")
    
    # Phase 4 Structured Subsections
    recognition: Optional[RecognitionSummary] = None
    ocr: Optional[OCRSummary] = None
    fusion: Optional[FusionAssessment] = None
    quality: Optional[ImageQualityAssessment] = None

    medicine: Optional[MedicineResponse] = Field(None, description="Full verified medicine details from database")
    storage_requirements: Optional[StorageRequirementsSummary] = Field(None, description="Formal storage specs from DB record")
    ocr_status: str = Field(
        default="completed",
        description="OCR stage outcome: completed | skipped_low_quality | unavailable",
    )
    inference_time_ms: float = Field(..., description="Total combined inference latency in milliseconds")
    message: str = Field(..., description="Human-readable decision explanation or guidance")
