"""
Tests for MediShelf AI Phase 5 Storage-Risk ML Pipeline & Artifacts.
"""

import json
import joblib
import numpy as np
import pandas as pd
import pytest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATASET_PATH = PROJECT_ROOT / "ml" / "data" / "storage_risk_dataset.csv"
DATASET_META_PATH = PROJECT_ROOT / "ml" / "data" / "dataset_metadata.json"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts" / "storage_risk"


def test_storage_risk_dataset_integrity():
    """Verify generated dataset exists, has required size, columns, and target classes."""
    assert DATASET_PATH.exists(), f"Missing dataset at {DATASET_PATH}"
    df = pd.read_csv(DATASET_PATH)
    
    assert len(df) >= 1000, f"Expected >= 1000 samples, got {len(df)}"
    required_cols = [
        "temperature",
        "humidity",
        "storage_min_temp",
        "storage_max_temp",
        "temp_deviation_below",
        "temp_deviation_above",
        "temp_deviation_magnitude",
        "excursion_duration_hours",
        "excursion_severity_index",
        "requires_cold_chain",
        "is_liquid_or_injection",
        "has_humidity_requirement",
        "humidity_deviation",
        "days_to_expiry",
        "near_expiry",
        "risk_level",
    ]
    for col in required_cols:
        assert col in df.columns, f"Missing required column {col}"
        
    assert set(df["risk_level"].unique()) == {"LOW", "MODERATE", "HIGH"}
    assert df.isnull().sum().sum() == 0, "Dataset contains unexpected nulls"


def test_dataset_metadata_contains_scientific_disclaimer():
    """Verify dataset metadata clearly identifies simulation-derived nature."""
    assert DATASET_META_PATH.exists()
    with open(DATASET_META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    assert "simulation-derived" in meta["notice"].lower()
    assert meta["target_classes"] == ["LOW", "MODERATE", "HIGH"]
    assert meta["random_seed"] == 42


def test_model_artifacts_exist():
    """Verify all expected model artifacts were saved."""
    assert (ARTIFACTS_DIR / "model.joblib").exists()
    assert (ARTIFACTS_DIR / "feature_metadata.json").exists()
    assert (ARTIFACTS_DIR / "evaluation_results.json").exists()
    assert (ARTIFACTS_DIR / "training_metadata.json").exists()


def test_model_loading_and_inference_shape():
    """Verify model can be deserialized and produces valid class predictions and calibrated probabilities."""
    model = joblib.load(ARTIFACTS_DIR / "model.joblib")
    with open(ARTIFACTS_DIR / "feature_metadata.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
        
    features = meta["features"]
    assert len(features) == 15
    
    input_df = pd.DataFrame([[
        22.0,  # temperature
        50.0,  # humidity
        20.0,  # storage_min_temp
        25.0,  # storage_max_temp
        0.0,   # temp_deviation_below
        0.0,   # temp_deviation_above
        0.0,   # temp_deviation_magnitude
        0.0,   # excursion_duration_hours
        0.0,   # excursion_severity_index
        0,     # requires_cold_chain
        0,     # is_liquid_or_injection
        0,     # has_humidity_requirement
        0.0,   # humidity_deviation
        365,   # days_to_expiry
        0,     # near_expiry
    ]], columns=features)
    
    pred = model.predict(input_df)[0]
    probs = model.predict_proba(input_df)[0]
    
    assert pred == 0  # 0 corresponds to LOW
    assert len(probs) == 3
    assert np.isclose(np.sum(probs), 1.0, atol=1e-3)
    assert probs[0] > 0.8  # High probability for LOW risk


def test_model_detects_severe_cold_chain_excursion():
    """Verify cold-chain insulin exposed to 35°C for 24 hours yields HIGH risk."""
    model = joblib.load(ARTIFACTS_DIR / "model.joblib")
    with open(ARTIFACTS_DIR / "feature_metadata.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
    features = meta["features"]
    
    severe_df = pd.DataFrame([[
        35.0,   # temperature (severe heat for 2-8°C insulin)
        65.0,   # humidity
        2.0,    # storage_min_temp
        8.0,    # storage_max_temp
        0.0,    # temp_deviation_below
        27.0,   # temp_deviation_above (35 - 8 = 27°C)
        27.0,   # temp_deviation_magnitude
        24.0,   # excursion_duration_hours
        648.0,  # excursion_severity_index (27 * 24 = 648)
        1,      # requires_cold_chain
        1,      # is_liquid_or_injection (Subcutaneous Injection)
        0,      # has_humidity_requirement
        0.0,    # humidity_deviation
        90,     # days_to_expiry
        0,      # near_expiry
    ]], columns=features)
    
    pred = model.predict(severe_df)[0]
    probs = model.predict_proba(severe_df)[0]
    
    assert pred == 2  # 2 corresponds to HIGH
    assert probs[2] > 0.8  # Dominant HIGH risk probability


def test_feature_importances_valid():
    """Verify feature importances are extracted and non-zero."""
    with open(ARTIFACTS_DIR / "feature_metadata.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
    
    importances = meta["feature_importances"]
    assert len(importances) > 0
    # Top features should include excursion_severity_index or temperature
    top_feature = list(importances.keys())[0]
    assert top_feature in ["excursion_severity_index", "temp_deviation_magnitude", "temperature"]
