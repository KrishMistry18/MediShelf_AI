import csv
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from app.database.session import SessionLocal, engine
from app.database.base import Base
from app.models.medicine import Medicine
from ml.preprocessing.validate_medicine_dataset import validate_dataset


def seed_medicines(
    db: Optional[Session] = None,
    csv_path: Optional[str] = None
) -> Dict[str, int]:
    """
    Deterministically and idempotently seeds medicines from data/medicines/medicines.csv into the database.
    Returns counts: {'added': count, 'updated': count, 'skipped': count, 'total': count}.
    """
    if csv_path is None:
        # Default path relative to workspace
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        csv_path = str(base_dir / "data" / "medicines" / "medicines.csv")

    # Step 1: Pre-validate dataset
    is_valid, validation_report = validate_dataset(csv_path)
    if not is_valid:
        raise ValueError(
            f"Dataset validation failed with {len(validation_report['errors'])} errors. Cannot seed database."
        )

    # Step 2: Ensure database tables exist
    Base.metadata.create_all(bind=engine)

    owns_session = False
    if db is None:
        db = SessionLocal()
        owns_session = True

    stats = {"added": 0, "updated": 0, "skipped": 0, "total": 0}

    try:
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                stats["total"] += 1
                med_id = row["medicine_id"].strip()

                # Parse numeric & nullable fields safely
                min_temp = float(row["storage_min_temperature"])
                max_temp = float(row["storage_max_temperature"])
                min_hum = float(row["storage_min_humidity"]) if row.get("storage_min_humidity", "").strip() else None
                max_hum = float(row["storage_max_humidity"]) if row.get("storage_max_humidity", "").strip() else None
                expiry_days = int(row.get("expiry_warning_days", "60"))

                existing_med = db.query(Medicine).filter(Medicine.medicine_id == med_id).first()

                if existing_med is None:
                    # New record insertion
                    new_med = Medicine(
                        medicine_id=med_id,
                        medicine_name=row["medicine_name"].strip(),
                        generic_name=row["generic_name"].strip(),
                        brand_name=row.get("brand_name", "").strip() or None,
                        strength=row["strength"].strip(),
                        dosage_form=row["dosage_form"].strip(),
                        category=row["category"].strip(),
                        manufacturer=row.get("manufacturer", "").strip() or None,
                        storage_min_temperature=min_temp,
                        storage_max_temperature=max_temp,
                        storage_min_humidity=min_hum,
                        storage_max_humidity=max_hum,
                        expiry_warning_days=expiry_days,
                        image_class=row["image_class"].strip(),
                        source=row["source"].strip(),
                        source_url=row["source_url"].strip(),
                    )
                    db.add(new_med)
                    stats["added"] += 1
                else:
                    # Check for modifications to maintain idempotency
                    has_changes = False
                    fields_to_check = {
                        "medicine_name": row["medicine_name"].strip(),
                        "generic_name": row["generic_name"].strip(),
                        "brand_name": row.get("brand_name", "").strip() or None,
                        "strength": row["strength"].strip(),
                        "dosage_form": row["dosage_form"].strip(),
                        "category": row["category"].strip(),
                        "manufacturer": row.get("manufacturer", "").strip() or None,
                        "storage_min_temperature": min_temp,
                        "storage_max_temperature": max_temp,
                        "storage_min_humidity": min_hum,
                        "storage_max_humidity": max_hum,
                        "expiry_warning_days": expiry_days,
                        "image_class": row["image_class"].strip(),
                        "source": row["source"].strip(),
                        "source_url": row["source_url"].strip(),
                    }

                    for attr, new_val in fields_to_check.items():
                        current_val = getattr(existing_med, attr)
                        if current_val != new_val:
                            setattr(existing_med, attr, new_val)
                            has_changes = True

                    if has_changes:
                        stats["updated"] += 1
                    else:
                        stats["skipped"] += 1

            db.commit()
            return stats

    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    print("Initiating MediShelf AI database seeding...")
    csv_file = sys.argv[1] if len(sys.argv) > 1 else None
    result = seed_medicines(csv_path=csv_file)
    print("Seeding Complete!")
    print(f"  Total Processed: {result['total']}")
    print(f"  Added:           {result['added']}")
    print(f"  Updated:         {result['updated']}")
    print(f"  Skipped:         {result['skipped']}")
