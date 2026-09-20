from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="System and Database Health Check",
    description="Returns backend service operational status, database connectivity, environment info, and compliance disclaimer.",
)
def check_health(db: Session = Depends(get_db)) -> HealthResponse:
    db_status = "connected"
    db_details = None
    overall_status = "healthy"

    try:
        # Verify DB connectivity with lightweight query
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = "error"
        db_details = str(exc)
        overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        version=settings.VERSION,
        project_name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        database=db_status,
        timestamp=datetime.now(timezone.utc),
        details={"db_error": db_details} if db_details else None,
    )
