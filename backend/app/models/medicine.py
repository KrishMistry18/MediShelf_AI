from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class Medicine(Base):
    __tablename__ = "medicines"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    medicine_id = Column(String(32), unique=True, index=True, nullable=False)
    medicine_name = Column(String(255), index=True, nullable=False)
    generic_name = Column(String(255), nullable=False)
    brand_name = Column(String(255), nullable=True)
    strength = Column(String(100), nullable=False)
    dosage_form = Column(String(100), nullable=False)
    category = Column(String(100), index=True, nullable=False)
    manufacturer = Column(String(255), nullable=True)
    
    # Official storage criteria (USP / FDA SmPC standards)
    storage_min_temperature = Column(Float, nullable=False)
    storage_max_temperature = Column(Float, nullable=False)
    storage_min_humidity = Column(Float, nullable=True)
    storage_max_humidity = Column(Float, nullable=True)
    expiry_warning_days = Column(Integer, default=60, nullable=False)
    
    # Machine learning / CV identifier (nullable for open-world medicines without trained CV classes)
    image_class = Column(String(100), index=True, nullable=True)
    
    # Open-world drug knowledge expansion
    canonical_name = Column(String(255), nullable=True)
    active_ingredients = Column(String(1024), nullable=True)
    route = Column(String(100), nullable=True)
    rxnorm_cui = Column(String(32), index=True, nullable=True)
    ndc = Column(String(64), index=True, nullable=True)

    # Data Provenance & Traceability
    source = Column(String(255), nullable=False)
    source_id = Column(String(128), nullable=True)
    source_url = Column(String(1024), nullable=False)
    source_version = Column(String(64), nullable=True)
    retrieved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Medicine(id={self.id}, medicine_id='{self.medicine_id}', name='{self.medicine_name}')>"
