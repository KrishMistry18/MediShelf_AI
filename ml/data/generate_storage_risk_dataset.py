"""
MediShelf AI — Phase 5: Storage Risk Dataset Generator

Generates a transparent, reproducible, simulation-derived dataset of medicine storage
excursion scenarios based on the verified pharmaceutical monographs in data/medicines/medicines.csv.

SCIENTIFIC & REGULATORY NOTE:
This training data is simulation-derived from documented medicine storage requirements and
is intended to demonstrate an ML-based storage-risk estimation pipeline. It is not a clinically
validated dataset and the resulting model must not be interpreted as a clinical prediction model.
"""

import os
import csv
import json
import random
from pathlib import Path
from typing import List, Dict, Any

RANDOM_SEED = 42
NUM_SAMPLES = 6000

# Base paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MEDICINES_CSV_PATH = PROJECT_ROOT / "data" / "medicines" / "medicines.csv"
OUTPUT_DIR = PROJECT_ROOT / "ml" / "data"
OUTPUT_CSV_PATH = OUTPUT_DIR / "storage_risk_dataset.csv"
OUTPUT_METADATA_PATH = OUTPUT_DIR / "dataset_metadata.json"


def load_verified_medicines() -> List[Dict[str, Any]]:
    """Loads the 25 verified medicines from the catalog CSV."""
    medicines = []
    with open(MEDICINES_CSV_PATH, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            medicines.append({
                "medicine_id": row["medicine_id"],
                "medicine_name": row["medicine_name"],
                "dosage_form": row["dosage_form"],
                "category": row["category"],
                "storage_min_temp": float(row["storage_min_temperature"]),
                "storage_max_temp": float(row["storage_max_temperature"]),
                "storage_min_humidity": float(row["storage_min_humidity"]) if row["storage_min_humidity"] else None,
                "storage_max_humidity": float(row["storage_max_humidity"]) if row["storage_max_humidity"] else None,
                "expiry_warning_days": int(row["expiry_warning_days"]),
            })
    return medicines


def determine_risk_label(
    requires_cold_chain: int,
    is_liquid_or_injection: int,
    temp: float,
    min_temp: float,
    max_temp: float,
    duration_hours: float,
    days_to_expiry: int,
    expiry_warning_days: int,
) -> str:
    """
    Applies transparent, simulation-based pharmaceutical stability rules
    to generate the project-defined ground truth target (LOW, MODERATE, HIGH).
    
    This function is used solely for synthetic dataset generation.
    The ML model will subsequently learn patterns across the feature space.
    """
    # 1. Cold chain medicine (2°C - 8°C, e.g. Insulins)
    if requires_cold_chain == 1:
        # Freezing risk: physical denaturation / crystallization of proteins
        if temp <= 0.0:
            return "HIGH"
        # Severe heat excursion
        if temp >= 25.0 and duration_hours >= 4.0:
            return "HIGH"
        if temp >= 15.0 and duration_hours >= 18.0:
            return "HIGH"
        
        # Deviation above limit
        if temp > max_temp:
            deviation = temp - max_temp
            severity = deviation * duration_hours
            if severity >= 60.0 or deviation >= 15.0:
                return "HIGH"
            elif severity >= 12.0 or deviation >= 4.0:
                return "MODERATE"
            else:
                return "LOW"  # Very brief excursion (e.g. ambient injection prep)
        
        # Deviation below limit (chill without freeze)
        if temp < min_temp:
            return "MODERATE"
            
        # Within documented range (2°C - 8°C)
        if days_to_expiry <= 0:
            return "HIGH"
        elif days_to_expiry <= 10:
            return "MODERATE"
        return "LOW"

    # 2. Controlled Room Temperature / Ambient Medicines (e.g. 15-25°C, 20-25°C, 15-30°C)
    dev_above = max(0.0, temp - max_temp)
    dev_below = max(0.0, min_temp - temp)
    temp_dev = max(dev_above, dev_below)
    severity = temp_dev * duration_hours

    # Expired medicine
    if days_to_expiry <= 0:
        return "HIGH"

    # Normal compliant conditions (zero temperature deviation)
    if temp_dev == 0.0:
        if days_to_expiry < 15:
            return "MODERATE"
        return "LOW"

    # Environmental Excursions
    # Severe thermal stress: >40°C car trunk, prolonged oven-like heat, freezing liquid tablets
    if temp_dev >= 15.0 or severity >= 120.0:
        return "HIGH"
    if is_liquid_or_injection == 1 and temp <= 0.0:
        return "HIGH"  # Aerosols / nasal suspensions freeze
    if days_to_expiry <= expiry_warning_days and severity >= 35.0:
        return "HIGH"

    # Moderate thermal stress: 30°C room for 6-24 hrs, mild unconditioned warehouse
    if severity >= 20.0 or temp_dev >= 5.0 or (days_to_expiry <= expiry_warning_days and severity >= 10.0):
        return "MODERATE"

    # Minor brief excursion (e.g. 26°C for 1-2 hours)
    return "LOW"


def generate_dataset(num_samples: int = NUM_SAMPLES, seed: int = RANDOM_SEED) -> None:
    """Generates balanced synthetic storage excursion records."""
    random.seed(seed)
    medicines = load_verified_medicines()
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    rows = []
    # Target approximately equal distribution across regimes
    regimes = ["normal", "mild_excursion", "severe_excursion", "boundary_cold", "boundary_hot"]
    samples_per_regime = num_samples // len(regimes)
    
    for regime in regimes:
        for _ in range(samples_per_regime):
            med = random.choice(medicines)
            min_temp = med["storage_min_temp"]
            max_temp = med["storage_max_temp"]
            dosage_form = med["dosage_form"]
            category = med["category"]
            expiry_warning = med["expiry_warning_days"]
            
            requires_cold_chain = 1 if max_temp <= 8.0 else 0
            is_liquid_or_injection = 1 if dosage_form in [
                "Subcutaneous Injection", "Inhalation Aerosol", "Nasal Spray Suspension"
            ] else 0
            has_humidity_req = 1 if (med["storage_min_humidity"] or med["storage_max_humidity"]) else 0
            
            # Days to expiry: random between 5 and 730 days
            if regime == "normal":
                days_to_expiry = random.randint(30, 730)
                temp = round(random.uniform(min_temp, max_temp), 1)
                duration_hours = round(random.uniform(0.0, 4.0), 1)
            elif regime == "mild_excursion":
                days_to_expiry = random.randint(15, 500)
                if requires_cold_chain:
                    temp = round(random.uniform(8.5, 15.0), 1)
                    duration_hours = round(random.uniform(1.0, 8.0), 1)
                else:
                    # Mild room temp overshoot
                    temp = round(random.uniform(max_temp + 0.5, max_temp + 6.0), 1)
                    duration_hours = round(random.uniform(2.0, 18.0), 1)
            elif regime == "severe_excursion":
                days_to_expiry = random.randint(5, 365)
                if requires_cold_chain:
                    if random.random() < 0.3:
                        temp = round(random.uniform(-5.0, 0.0), 1)  # Freezing
                    else:
                        temp = round(random.uniform(18.0, 38.0), 1)  # High ambient
                    duration_hours = round(random.uniform(4.0, 48.0), 1)
                else:
                    if random.random() < 0.15:
                        temp = round(random.uniform(-5.0, 5.0), 1)  # Sub-freezing / winter shipping
                    else:
                        temp = round(random.uniform(max_temp + 8.0, 48.0), 1)  # Hot storage
                    duration_hours = round(random.uniform(8.0, 72.0), 1)
            elif regime == "boundary_cold":
                # Around the minimum permissible temperature
                days_to_expiry = random.randint(10, 600)
                temp = round(random.uniform(min_temp - 5.0, min_temp + 2.0), 1)
                duration_hours = round(random.uniform(1.0, 24.0), 1)
            else:  # boundary_hot
                # Around the maximum permissible temperature
                days_to_expiry = random.randint(10, 600)
                temp = round(random.uniform(max_temp - 2.0, max_temp + 8.0), 1)
                duration_hours = round(random.uniform(1.0, 36.0), 1)
            
            # Ambient relative humidity (realistic room/storage RH: 20% to 85%)
            humidity = round(random.uniform(20.0, 85.0), 1)
            humidity_dev = 0.0  # Currently unquantified in monographs
            
            # Derived deviations
            temp_dev_below = round(max(0.0, min_temp - temp), 2)
            temp_dev_above = round(max(0.0, temp - max_temp), 2)
            temp_dev_mag = round(max(temp_dev_below, temp_dev_above), 2)
            severity_index = round(temp_dev_mag * duration_hours, 2)
            near_expiry = 1 if days_to_expiry <= expiry_warning else 0
            
            # Determine ground truth label
            risk_label = determine_risk_label(
                requires_cold_chain=requires_cold_chain,
                is_liquid_or_injection=is_liquid_or_injection,
                temp=temp,
                min_temp=min_temp,
                max_temp=max_temp,
                duration_hours=duration_hours,
                days_to_expiry=days_to_expiry,
                expiry_warning_days=expiry_warning,
            )
            
            rows.append({
                "medicine_id": med["medicine_id"],
                "dosage_form": dosage_form,
                "category": category,
                "temperature": temp,
                "humidity": humidity,
                "storage_min_temp": min_temp,
                "storage_max_temp": max_temp,
                "temp_deviation_below": temp_dev_below,
                "temp_deviation_above": temp_dev_above,
                "temp_deviation_magnitude": temp_dev_mag,
                "excursion_duration_hours": duration_hours,
                "excursion_severity_index": severity_index,
                "requires_cold_chain": requires_cold_chain,
                "is_liquid_or_injection": is_liquid_or_injection,
                "has_humidity_requirement": has_humidity_req,
                "humidity_deviation": humidity_dev,
                "days_to_expiry": days_to_expiry,
                "near_expiry": near_expiry,
                "risk_level": risk_label,
            })

    # Shuffle dataset with fixed seed
    random.shuffle(rows)
    
    # Calculate class distribution
    class_counts = {"LOW": 0, "MODERATE": 0, "HIGH": 0}
    for r in rows:
        class_counts[r["risk_level"]] += 1

    fieldnames = list(rows[0].keys())
    with open(OUTPUT_CSV_PATH, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    metadata = {
        "dataset_name": "MediShelf AI Storage Risk Simulation Dataset",
        "description": "Simulation-derived storage excursion dataset mapped against 25 USP/FDA monographs.",
        "random_seed": seed,
        "total_samples": len(rows),
        "class_distribution": class_counts,
        "features": [f for f in fieldnames if f not in ["medicine_id", "risk_level"]],
        "target": "risk_level",
        "target_classes": ["LOW", "MODERATE", "HIGH"],
        "source_catalog_size": len(medicines),
        "notice": (
            "The Phase 5 training data is simulation-derived from documented medicine storage "
            "requirements and is intended to demonstrate an ML-based storage-risk estimation pipeline. "
            "It is not a clinically validated dataset and the resulting model must not be interpreted "
            "as a clinical prediction model."
        ),
    }

    with open(OUTPUT_METADATA_PATH, mode="w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"Generated {len(rows)} samples in {OUTPUT_CSV_PATH}")
    print(f"Class distribution: {class_counts}")


if __name__ == "__main__":
    generate_dataset()
