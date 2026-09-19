"""
MediShelf AI — Phase 5: Storage Risk ML Inference & Assessment Service
"""

import json
import joblib
from datetime import datetime, date, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.medicine import Medicine
from app.schemas.medicine import MedicineResponse
from app.schemas.storage_risk import (
    StorageRiskRequest,
    StorageRiskResponse,
    StorageRequirementsInfo,
    DeterministicCompliance,
    MLRiskPrediction,
    MLFactorImportance,
    ModelMetadataResponse,
)

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts" / "storage_risk"
MODEL_PATH = ARTIFACTS_DIR / "model.joblib"
METADATA_PATH = ARTIFACTS_DIR / "feature_metadata.json"

FEATURE_LABELS = {
    "excursion_severity_index": "Cumulative Thermal Severity (Deviation × Hours)",
    "temperature": "Observed Ambient Temperature (°C)",
    "temp_deviation_magnitude": "Temperature Deviation Outside Permissible Window",
    "temp_deviation_above": "Heat Excursion Above Upper Limit (°C)",
    "temp_deviation_below": "Cold Excursion Below Lower Limit (°C)",
    "excursion_duration_hours": "Continuous Exposure Duration (Hours)",
    "requires_cold_chain": "Cold-Chain Storage Mandate (2°C – 8°C)",
    "is_liquid_or_injection": "Dosage Form Freeze / Denaturation Vulnerability",
    "days_to_expiry": "Packaging Shelf-Life Remaining (Days)",
    "near_expiry": "Proximity to Expiration Warning Threshold",
    "humidity": "Ambient Relative Humidity (% RH)",
    "has_humidity_requirement": "Monograph Humidity Specification",
    "humidity_deviation": "Humidity Deviation Beyond Limit",
    "storage_min_temp": "Official Minimum Storage Temperature",
    "storage_max_temp": "Official Maximum Storage Temperature",
}

DISCLAIMER_TEXT = (
    "AI-assisted storage-risk estimation for informational and demonstration purposes only. "
    "The underlying model is trained on simulation-derived scenarios grounded in USP/FDA monographs "
    "and is not clinically validated. It does not replace manufacturer stability data, package insert "
    "mandates, or pharmacist clinical assessment."
)


class StorageRiskService:
    def __init__(self):
        self._model = None
        self._feature_meta = None

    def _ensure_loaded(self):
        if self._model is None:
            if not MODEL_PATH.exists() or not METADATA_PATH.exists():
                raise RuntimeError(f"Storage risk model artifacts missing at {ARTIFACTS_DIR}")
            self._model = joblib.load(MODEL_PATH)
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                self._feature_meta = json.load(f)

    def get_metadata(self) -> ModelMetadataResponse:
        self._ensure_loaded()
        return ModelMetadataResponse(
            model_name="MediShelf AI Storage Risk Classifier",
            model_version="storage-risk-v1.0",
            algorithm="GradientBoostingClassifier",
            dataset_type="simulation-derived (USP/FDA monograph constraints)",
            features=self._feature_meta["features"],
            target_classes=self._feature_meta["classes"],
            disclaimer=DISCLAIMER_TEXT,
        )

    def _calculate_days_to_expiry(
        self, days_param: Optional[int], expiry_date_str: Optional[str]
    ) -> int:
        if days_param is not None:
            return days_param
        if expiry_date_str:
            try:
                parts = expiry_date_str.strip().split("-")
                today = date.today()
                if len(parts) == 2:
                    # YYYY-MM -> assume end of month (approx 28th)
                    year, month = int(parts[0]), int(parts[1])
                    exp = date(year, month, 28)
                elif len(parts) == 3:
                    # YYYY-MM-DD
                    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                    exp = date(year, month, day)
                else:
                    return 365
                delta = (exp - today).days
                return max(-365, min(3650, delta))
            except Exception:
                return 365
        return 365

    def evaluate_storage_risk(
        self, db: Session, request: StorageRiskRequest
    ) -> StorageRiskResponse:
        self._ensure_loaded()

        # 1. Retrieve Medicine Record
        medicine = (
            db.query(Medicine)
            .filter(Medicine.medicine_id == request.medicine_id.strip().upper())
            .first()
        )
        if not medicine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Medicine SKU '{request.medicine_id}' not found in verified database.",
            )

        min_temp = float(medicine.storage_min_temperature)
        max_temp = float(medicine.storage_max_temperature)
        min_hum = float(medicine.storage_min_humidity) if medicine.storage_min_humidity is not None else None
        max_hum = float(medicine.storage_max_humidity) if medicine.storage_max_humidity is not None else None
        has_quant_hum = (min_hum is not None or max_hum is not None)

        hum_notice = (
            f"Allowed humidity: {min_hum or 0}% - {max_hum}% RH"
            if has_quant_hum
            else "Humidity requirement not quantified in the available official FDA/USP source monograph."
        )

        storage_reqs = StorageRequirementsInfo(
            min_temperature=min_temp,
            max_temperature=max_temp,
            min_humidity=min_hum,
            max_humidity=max_hum,
            temperature_unit="C",
            regulatory_source=medicine.source,
            source_url=medicine.source_url,
            has_quantified_humidity=has_quant_hum,
            humidity_monograph_notice=hum_notice,
        )

        # 2. Deterministic Compliance Check (Rule-based)
        temp = float(request.current_temperature)
        temp_compliant = (min_temp <= temp <= max_temp)
        temp_deviation_below = max(0.0, round(min_temp - temp, 2))
        temp_deviation_above = max(0.0, round(temp - max_temp, 2))
        temp_deviation_mag = max(temp_deviation_below, temp_deviation_above)

        if has_quant_hum and request.current_humidity is not None:
            hum = float(request.current_humidity)
            lower_ok = (min_hum is None or hum >= min_hum)
            upper_ok = (max_hum is None or hum <= max_hum)
            humidity_compliant = bool(lower_ok and upper_ok)
            humidity_status = (
                "Within documented humidity limits"
                if humidity_compliant
                else f"Exceeds documented humidity window ({min_hum or 0}% - {max_hum}% RH)"
            )
        else:
            humidity_compliant = None
            humidity_status = "Humidity requirement not quantified in monograph; compliance not evaluated."

        is_overall_compliant = temp_compliant and (humidity_compliant is not False)
        summary_text = (
            f"Ambient temperature ({temp:.1f}°C) is within permissible monograph limits ({min_temp}°C – {max_temp}°C)."
            if temp_compliant
            else f"Temperature excursion detected: {temp_deviation_mag:.1f}°C outside permissible range ({min_temp}°C – {max_temp}°C)."
        )

        deterministic = DeterministicCompliance(
            is_compliant=is_overall_compliant,
            temp_compliant=temp_compliant,
            temp_deviation=temp_deviation_mag,
            humidity_compliant=humidity_compliant,
            humidity_status_text=humidity_status,
            summary=summary_text,
        )

        # 3. Feature Preparation for ML Inference
        days_to_exp = self._calculate_days_to_expiry(request.days_to_expiry, request.expiry_date)
        duration_hrs = max(0.0, float(request.excursion_duration_hours))
        severity_index = round(temp_deviation_mag * duration_hrs, 2)
        requires_cold_chain = 1 if max_temp <= 8.0 else 0
        is_liquid = 1 if medicine.dosage_form in [
            "Subcutaneous Injection", "Inhalation Aerosol", "Nasal Spray Suspension"
        ] else 0
        has_hum_req = 1 if has_quant_hum else 0
        hum_val = float(request.current_humidity) if request.current_humidity is not None else 50.0
        hum_dev = 0.0
        near_expiry = 1 if days_to_exp <= medicine.expiry_warning_days else 0

        feature_dict = {
            "temperature": temp,
            "humidity": hum_val,
            "storage_min_temp": min_temp,
            "storage_max_temp": max_temp,
            "temp_deviation_below": temp_deviation_below,
            "temp_deviation_above": temp_deviation_above,
            "temp_deviation_magnitude": temp_deviation_mag,
            "excursion_duration_hours": duration_hrs,
            "excursion_severity_index": severity_index,
            "requires_cold_chain": requires_cold_chain,
            "is_liquid_or_injection": is_liquid,
            "has_humidity_requirement": has_hum_req,
            "humidity_deviation": hum_dev,
            "days_to_expiry": days_to_exp,
            "near_expiry": near_expiry,
        }

        # Align with model's expected features
        feature_order = self._feature_meta["features"]
        df_features = pd.DataFrame([[feature_dict[col] for col in feature_order]], columns=feature_order)

        # 4. Execute ML Prediction
        probs = self._model.predict_proba(df_features)[0]
        pred_idx = int(np.argmax(probs))
        classes = self._feature_meta["classes"]
        pred_label = classes[pred_idx]
        confidence = round(float(probs[pred_idx]), 4)

        prob_dict = {
            cls_name: round(float(probs[idx]), 4)
            for idx, cls_name in enumerate(classes)
        }

        # 5. Explainability (Feature Contribution Analysis)
        importances = self._feature_meta.get("feature_importances", {})
        top_factors: List[MLFactorImportance] = []
        for feat_name, weight in list(importances.items())[:5]:
            obs_val = feature_dict.get(feat_name, None)
            label = FEATURE_LABELS.get(feat_name, feat_name)
            
            # Contextual interpretation
            if feat_name == "excursion_severity_index":
                interp = (
                    f"Cumulative severity score: {obs_val} (hours × °C excursion)"
                    if obs_val > 0
                    else "Zero thermal excursion accumulated"
                )
            elif feat_name == "temperature":
                interp = f"Observed temperature {obs_val}°C relative to range [{min_temp}°C – {max_temp}°C]"
            elif feat_name == "temp_deviation_magnitude":
                interp = f"{obs_val}°C outside monograph threshold" if obs_val > 0 else "Within monograph threshold"
            elif feat_name in ["days_to_expiry", "near_expiry"]:
                interp = f"{obs_val} days remaining until packaging expiry date"
            elif feat_name == "requires_cold_chain":
                interp = "Cold-chain product (2°C – 8°C strict limit)" if obs_val == 1 else "Standard room temperature product"
            else:
                interp = f"Observed value: {obs_val}"

            top_factors.append(
                MLFactorImportance(
                    feature=feat_name,
                    feature_label=label,
                    importance_weight=float(weight),
                    observed_value=obs_val,
                    interpretation=interp,
                )
            )

        ml_risk = MLRiskPrediction(
            level=pred_label,
            confidence=confidence,
            probabilities=prob_dict,
            top_factors=top_factors,
            model_name="GradientBoostingClassifier",
            model_version="storage-risk-v1.0",
            training_dataset_type="simulation-derived",
        )

        return StorageRiskResponse(
            medicine=MedicineResponse.model_validate(medicine),
            storage_requirements=storage_reqs,
            deterministic_compliance=deterministic,
            ml_risk=ml_risk,
            disclaimer=DISCLAIMER_TEXT,
            evaluated_at=datetime.now(timezone.utc).isoformat(),
        )


# Global singleton instance
storage_risk_service = StorageRiskService()
