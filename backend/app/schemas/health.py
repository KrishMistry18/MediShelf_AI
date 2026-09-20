from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="High-level service operational status")
    version: str = Field(..., description="Backend release version")
    project_name: str = Field(..., description="System identifier")
    environment: str = Field(..., description="Deployment environment")
    database: str = Field(..., description="Database connectivity status")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="UTC timestamp of the health check")
    disclaimer: str = Field(
        default="MediShelf AI is an academic research platform. Predictions are AI-assisted estimations and not certified medical or storage safety guarantees.",
        description="Mandatory healthcare AI compliance disclaimer"
    )
    details: Optional[dict] = Field(default=None, description="Optional diagnostic details")
