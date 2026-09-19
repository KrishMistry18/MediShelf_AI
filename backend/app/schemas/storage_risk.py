"""
MediShelf AI — Phase 5: Storage Risk Schemas
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from app.schemas.medicine import MedicineResponse


class StorageRiskRequest(BaseModel):
    medicine_id: str = Field(..., description="Target medicine SKU (e.g. MED-001)")
    current_temperature: float = Field(..., ge=-50.0, le=100.0, description="Ambient or container temperature in °C")
    current_humidity: Optional[float] = Field(None, ge=0.0, le=100.0, description="Ambient relative humidity in % RH")
    excursion_duration_hours: float = Field(0.0, ge=0.0, le=1000.0, description="Duration in hours of the current condition")
    days_to_expiry: Optional[int] = Field(None, ge=-3650, le=3650, description="Remaining days until product expiration")
    expiry_date: Optional[str] = Field(None, description="Optional expiration date string (YYYY-MM or YYYY-MM-DD)")


class StorageRequirementsInfo(BaseModel):
    min_temperature: float = Field(..., description="Minimum permitted storage temperature in °C")
    max_temperature: float = Field(..., description="Maximum permitted storage temperature in °C")
    min_humidity: Optional[float] = Field(None, description="Minimum permitted humidity in % RH if quantified")
    max_humidity: Optional[float] = Field(None, description="Maximum permitted humidity in % RH if quantified")
    temperature_unit: str = "C"
    regulatory_source: str = Field(..., description="Monograph reference")
    source_url: str = Field(..., description="Regulatory URL")
    has_quantified_humidity: bool = Field(False, description="Whether humidity is quantified in the official monograph")
    humidity_monograph_notice: str = Field(..., description="Explicit statement regarding humidity documentation")


class DeterministicCompliance(BaseModel):
    is_compliant: bool = Field(..., description="Overall deterministic compliance status")
    temp_compliant: bool = Field(..., description="True if temperature is within [min_temperature, max_temperature]")
    temp_deviation: float = Field(..., description="Absolute temperature deviation outside permissible range in °C")
    humidity_compliant: Optional[bool] = Field(None, description="True if within range, False if breached, None if unquantified")
    humidity_status_text: str = Field(..., description="Clear explanation of humidity compliance evaluation")
    summary: str = Field(..., description="Concise rule-based assessment summary")


class MLFactorImportance(BaseModel):
    feature: str = Field(..., description="Internal feature identifier")
    feature_label: str = Field(..., description="Human-readable factor title")
    importance_weight: float = Field(..., description="Global feature importance from trained model")
    observed_value: Any = Field(..., description="Actual observed feature value for this prediction")
    interpretation: str = Field(..., description="Impact description (e.g. Primary risk driver)")


class MLRiskPrediction(BaseModel):
    level: str = Field(..., description="Estimated storage degradation risk: LOW, MODERATE, or HIGH")
    confidence: float = Field(..., description="Model confidence score for top predicted class (0.0 - 1.0)")
    probabilities: Dict[str, float] = Field(..., description="Calibrated probability distribution across all risk classes")
    top_factors: List[MLFactorImportance] = Field(..., description="Ranked contributing factors explainability")
    model_name: str = Field("GradientBoostingClassifier", description="Algorithm name")
    model_version: str = Field("storage-risk-v1.0", description="Model version tag")
    training_dataset_type: str = Field("simulation-derived", description="Provenance of model training data")


class StorageRiskResponse(BaseModel):
    medicine: MedicineResponse = Field(..., description="Verified medicine catalog specifications")
    storage_requirements: StorageRequirementsInfo = Field(..., description="Official monograph storage limits")
    deterministic_compliance: DeterministicCompliance = Field(..., description="Rule-based boundary compliance evaluation")
    ml_risk: MLRiskPrediction = Field(..., description="Probabilistic AI/ML storage degradation risk estimate")
    disclaimer: str = Field(..., description="Scientific & regulatory non-medical disclaimer")
    evaluated_at: str = Field(..., description="ISO timestamp of assessment execution")


class ModelMetadataResponse(BaseModel):
    model_name: str
    model_version: str
    algorithm: str
    dataset_type: str
    features: List[str]
    target_classes: List[str]
    disclaimer: str
