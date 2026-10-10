import json
import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.medicine import Medicine
from app.schemas.medicine import MedicineResponse, MedicineListResponse, CategoryCount

router = APIRouter(prefix="/medicines", tags=["Medicines"])


@router.get(
    "",
    response_model=MedicineListResponse,
    summary="List and filter medicines",
    description="Retrieve paginated medicine records with optional text search and therapeutic category filter.",
)
def list_medicines(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=10, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(default=None, description="Filter by exact category name"),
    search: Optional[str] = Query(default=None, description="Fuzzy search across name, generic name, and brand name"),
    db: Session = Depends(get_db),
) -> MedicineListResponse:
    query = db.query(Medicine)

    if category and category.strip():
        query = query.filter(Medicine.category == category.strip())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Medicine.medicine_name.ilike(term),
                Medicine.generic_name.ilike(term),
                Medicine.brand_name.ilike(term),
                Medicine.medicine_id.ilike(term),
                Medicine.image_class.ilike(term),
            )
        )

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1
    offset = (page - 1) * page_size
    items = query.order_by(Medicine.medicine_name.asc()).offset(offset).limit(page_size).all()

    return MedicineListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


from app.services.medicine_service import medicine_resolution_service


@router.get(
    "/search",
    response_model=List[MedicineResponse],
    summary="Quick search autocomplete",
    description="Prefix and substring lookup matching medicine names, generic composition, brand names, and open-world knowledge base.",
)
def search_medicines(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = Query(default=10, ge=1, le=50, description="Maximum results to return"),
    db: Session = Depends(get_db),
) -> List[MedicineResponse]:
    return medicine_resolution_service.search_medicines(query=q, limit=limit, db=db)


@router.get(
    "/categories",
    response_model=List[CategoryCount],
    summary="List therapeutic categories",
    description="Returns all distinct medicine categories along with the count of medicines in each category.",
)
def list_categories(db: Session = Depends(get_db)) -> List[CategoryCount]:
    rows = (
        db.query(Medicine.category, func.count(Medicine.id).label("count"))
        .group_by(Medicine.category)
        .order_by(Medicine.category.asc())
        .all()
    )
    return [CategoryCount(category=row[0], count=row[1]) for row in rows]


@router.get(
    "/{medicine_id}",
    response_model=MedicineResponse,
    summary="Retrieve single medicine by ID",
    description="Fetch comprehensive medicine storage specification and provenance metadata by medicine_id (e.g. MED-001 or FDA-e0af7498-0dc).",
)
def get_medicine(
    medicine_id: str,
    db: Session = Depends(get_db),
) -> MedicineResponse:
    med = medicine_resolution_service.resolve_medicine(identifier=medicine_id, db=db)
    if med:
        return med

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Medicine with identifier '{medicine_id}' not found in catalog or open-world knowledge base.",
    )
