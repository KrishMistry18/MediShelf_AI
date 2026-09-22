from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MedicineBase(BaseModel):
    medicine_id: str = Field(..., description="Unique pharmaceutical SKU identifier, e.g. MED-001")
    medicine_name: str = Field(..., description="Commercial package product title")
    generic_name: str = Field(..., description="Active pharmaceutical ingredient (API)")
    brand_name: Optional[str] = Field(None, description="Primary brand trade name")
    strength: str = Field(..., description="Dosage strength unit, e.g. 500 mg")
    dosage_form: str = Field(..., description="Formulation: Tablet, Capsule, Injection, etc.")
    category: str = Field(..., description="Therapeutic pharmaceutical category")
    manufacturer: Optional[str] = Field(None, description="Reference manufacturer or marketing authorization holder")
    storage_min_temperature: float = Field(..., description="Minimum storage temperature in Celsius")
    storage_max_temperature: float = Field(..., description="Maximum storage temperature in Celsius")
    storage_min_humidity: Optional[float] = Field(None, description="Minimum relative humidity (% RH) if officially specified")
    storage_max_humidity: Optional[float] = Field(None, description="Maximum relative humidity (% RH) if officially specified")
    image_class: Optional[str] = Field(None, description="Machine learning computer-vision classification label (nullable for open-world medicines)")
    canonical_name: Optional[str] = Field(None, description="Normalized standard title")
    active_ingredients: Optional[str] = Field(None, description="JSON array of normalized active ingredients")
    route: Optional[str] = Field(None, description="Route of administration")
    rxnorm_cui: Optional[str] = Field(None, description="RxNorm Concept Unique Identifier")
    ndc: Optional[str] = Field(None, description="National Drug Code")
    source: str = Field(..., description="Regulatory citation or pharmacopeial source")
    source_id: Optional[str] = Field(None, description="Source-specific identifier (RxCUI or SPL set ID)")
    source_url: str = Field(..., description="Direct verifiable URL to official drug monograph or package insert")
    source_version: Optional[str] = Field(None, description="Monograph or dataset version")
    retrieved_at: Optional[datetime] = Field(None, description="Timestamp of monograph retrieval")


class MedicineResponse(MedicineBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MedicineListResponse(BaseModel):
    items: List[MedicineResponse] = Field(..., description="List of medicine records for the current page")
    total: int = Field(..., description="Total number of matching medicines")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total pages available")


class CategoryCount(BaseModel):
    category: str
    count: int
