import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.health import router as health_router
from app.api.v1.medicines import router as medicines_router
from app.api.v1.models import router as models_router
from app.api.v1.scan import router as scan_router
from app.api.v1.ocr import router as ocr_router
from app.api.v1.storage_risk import router as storage_risk_router
from app.database.session import engine, SessionLocal
from app.database.base import Base
from app.models.medicine import Medicine
from app.database.seed import seed_medicines

logger = logging.getLogger("medishelf.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    Base.metadata.create_all(bind=engine)
    
    # Auto-seed medicines if database is unpopulated
    db = SessionLocal()
    try:
        if db.query(Medicine).count() == 0:
            seed_medicines(db=db)
    except Exception as exc:
        logger.warning(f"Startup auto-seed skipped or encountered error: {exc}")
    finally:
        db.close()
        
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="MediShelf AI — Intelligent Medicine Storage & Safety Assessment API",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(health_router, prefix="")
app.include_router(health_router, prefix="/api")

# Mount medicines under both /api and /api/v1 for client flexibility
app.include_router(medicines_router, prefix="/api")
app.include_router(medicines_router, prefix="/api/v1")

# Mount scan endpoint under both /api and /api/v1
app.include_router(scan_router, prefix="/api")
app.include_router(scan_router, prefix="/api/v1")

# Mount OCR endpoint under both /api and /api/v1
app.include_router(ocr_router, prefix="/api")
app.include_router(ocr_router, prefix="/api/v1")

# Mount Storage Risk Assessment endpoint under both /api and /api/v1 (Phase 5)
app.include_router(storage_risk_router, prefix="/api")
app.include_router(storage_risk_router, prefix="/api/v1")

# Mount model transparency endpoint under both /api and /api/v1
app.include_router(models_router, prefix="/api")
app.include_router(models_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/api/health",
        "medicines_url": "/api/medicines",
    }
