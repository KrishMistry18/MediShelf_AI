"""
MediShelf AI — Phase 5: Storage Risk Assessment API Endpoints
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.storage_risk import (
    StorageRiskRequest,
    StorageRiskResponse,
    ModelMetadataResponse,
)
from app.services.storage_risk_service import storage_risk_service

router = APIRouter(prefix="/storage-risk", tags=["Storage Risk Assessment"])


@router.post(
    "/predict",
    response_model=StorageRiskResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate Medicine Storage Degradation Risk",
    description=(
        "Evaluates observed ambient environmental conditions against verified monograph limits "
        "to estimate storage degradation risk via a trained Machine Learning model. "
        "Deterministic compliance and ML risk predictions are returned separately."
    ),
)
def predict_storage_risk(
    request: StorageRiskRequest,
    db: Session = Depends(get_db),
) -> StorageRiskResponse:
    return storage_risk_service.evaluate_storage_risk(db=db, request=request)


@router.get(
    "/metadata",
    response_model=ModelMetadataResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Storage Risk Model Information",
    description="Returns active machine learning model metadata, features, and regulatory disclaimers.",
)
def get_model_metadata() -> ModelMetadataResponse:
    return storage_risk_service.get_metadata()
