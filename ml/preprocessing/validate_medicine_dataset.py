import csv
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional

REQUIRED_FIELDS = [
    "medicine_id",
    "medicine_name",
    "generic_name",
    "strength",
    "dosage_form",
    "category",
    "storage_min_temperature",
    "storage_max_temperature",
    "expiry_warning_days",
    "image_class",
    "source",
    "source_url",
]


def validate_dataset(csv_path: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
    """
    Validates the curated medicine dataset CSV file against strict data quality rules.
    Returns (is_valid, report_dict).
    """
    if csv_path is None:
        # Default relative to repository root or script location
        base_dir = Path(__file__).resolve().parent.parent.parent
        csv_path = str(base_dir / "data" / "medicines" / "medicines.csv")

    if not os.path.exists(csv_path):
        return False, {
            "errors": [f"File not found: {csv_path}"],
            "warnings": [],
            "total_records": 0,
            "valid_records": 0,
        }

    errors: List[str] = []
    warnings: List[str] = []
    seen_ids: set = set()
    seen_image_classes: set = set()
    valid_count = 0
    total_count = 0

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        # Validate header columns
        if not reader.fieldnames:
            errors.append("CSV file has no header row.")
            return False, {"errors": errors, "warnings": warnings, "total_records": 0, "valid_records": 0}

        missing_cols = [col for col in REQUIRED_FIELDS if col not in reader.fieldnames]
        if missing_cols:
            errors.append(f"Missing required CSV columns: {missing_cols}")
            return False, {"errors": errors, "warnings": warnings, "total_records": 0, "valid_records": 0}

        for row_idx, row in enumerate(reader, start=2):
            total_count += 1
            row_errors: List[str] = []

            # 1. Required non-empty fields
            for field in REQUIRED_FIELDS:
                val = row.get(field, "").strip()
                if not val:
                    row_errors.append(f"Row {row_idx}: Missing required field '{field}'.")

            med_id = row.get("medicine_id", "").strip()
            med_name = row.get("medicine_name", "").strip()
            image_class = row.get("image_class", "").strip()

            # 2. Duplicate detection
            if med_id:
                if med_id in seen_ids:
                    row_errors.append(f"Row {row_idx}: Duplicate medicine_id '{med_id}'.")
                seen_ids.add(med_id)

            if image_class:
                if image_class in seen_image_classes:
                    row_errors.append(f"Row {row_idx}: Duplicate image_class '{image_class}'.")
                seen_image_classes.add(image_class)

            # 3. Temperature validation
            min_temp_raw = row.get("storage_min_temperature", "").strip()
            max_temp_raw = row.get("storage_max_temperature", "").strip()

            try:
                min_temp = float(min_temp_raw)
                max_temp = float(max_temp_raw)
                if min_temp > max_temp:
                    row_errors.append(
                        f"Row {row_idx} ({med_id}): Inverted temperature range ({min_temp}°C > {max_temp}°C)."
                    )
                if min_temp < -40 or max_temp > 60:
                    warnings.append(
                        f"Row {row_idx} ({med_id}): Extreme temperature range [{min_temp}°C, {max_temp}°C]."
                    )
            except ValueError:
                row_errors.append(
                    f"Row {row_idx} ({med_id}): Invalid numeric temperature values ('{min_temp_raw}', '{max_temp_raw}')."
                )

            # 4. Humidity validation (optional / nullable)
            min_hum_raw = row.get("storage_min_humidity", "").strip()
            max_hum_raw = row.get("storage_max_humidity", "").strip()
            if min_hum_raw or max_hum_raw:
                try:
                    if min_hum_raw and max_hum_raw:
                        min_hum = float(min_hum_raw)
                        max_hum = float(max_hum_raw)
                        if min_hum < 0 or max_hum > 100:
                            row_errors.append(f"Row {row_idx} ({med_id}): Humidity out of bounds 0-100% RH.")
                        if min_hum > max_hum:
                            row_errors.append(f"Row {row_idx} ({med_id}): Inverted humidity range ({min_hum}% > {max_hum}%).")
                except ValueError:
                    row_errors.append(f"Row {row_idx} ({med_id}): Invalid numeric humidity values.")

            # 5. Expiry warning days validation
            expiry_days_raw = row.get("expiry_warning_days", "").strip()
            try:
                expiry_days = int(expiry_days_raw)
                if expiry_days <= 0 or expiry_days > 365:
                    row_errors.append(
                        f"Row {row_idx} ({med_id}): expiry_warning_days must be between 1 and 365 (got {expiry_days})."
                    )
            except ValueError:
                row_errors.append(
                    f"Row {row_idx} ({med_id}): Invalid integer for expiry_warning_days ('{expiry_days_raw}')."
                )

            # 6. Source URL format validation
            source_url = row.get("source_url", "").strip()
            if source_url and not (source_url.startswith("http://") or source_url.startswith("https://")):
                row_errors.append(f"Row {row_idx} ({med_id}): source_url must be an HTTP(S) URL.")

            if row_errors:
                errors.extend(row_errors)
            else:
                valid_count += 1

    is_valid = len(errors) == 0 and total_count >= 20
    if total_count < 20:
        errors.append(f"Dataset has {total_count} records; expected at least 20 records.")

    report = {
        "is_valid": is_valid,
        "total_records": total_count,
        "valid_records": valid_count,
        "errors": errors,
        "warnings": warnings,
        "unique_medicine_ids": len(seen_ids),
        "unique_image_classes": len(seen_image_classes),
    }

    return is_valid, report


def print_report(report: Dict[str, Any]) -> None:
    print("=" * 65)
    print("      MEDISHELF AI — MEDICINE DATASET VALIDATION REPORT")
    print("=" * 65)
    print(f"Status:             {'PASSED' if report['is_valid'] else 'FAILED'}")
    print(f"Total Records:      {report['total_records']}")
    print(f"Valid Records:      {report['valid_records']}")
    print(f"Unique Med IDs:     {report['unique_medicine_ids']}")
    print(f"Unique Image Class: {report['unique_image_classes']}")
    print(f"Total Errors:       {len(report['errors'])}")
    print(f"Total Warnings:     {len(report['warnings'])}")
    print("-" * 65)

    if report["errors"]:
        print("ERRORS ENCOUNTERED:")
        for err in report["errors"]:
            print(f"  [!] {err}")
        print("-" * 65)

    if report["warnings"]:
        print("WARNINGS:")
        for warn in report["warnings"]:
            print(f"  [*] {warn}")
        print("-" * 65)

    if report["is_valid"]:
        print(">>> DATASET QUALITY ASSURANCE SUCCESSFUL. READY FOR DATABASE SEED.")
    else:
        print(">>> DATASET VALIDATION FAILED. PLEASE CORRECT RECORD DEFECTS.")
    print("=" * 65)


if __name__ == "__main__":
    csv_file = sys.argv[1] if len(sys.argv) > 1 else None
    passed, rep = validate_dataset(csv_file)
    print_report(rep)
    sys.exit(0 if passed else 1)
