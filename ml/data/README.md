# MediShelf AI — Phase 5 Storage Risk Dataset

## Overview & Transparency Notice

> **IMPORTANT REGULATORY & SCIENTIFIC NOTICE**:
> The Phase 5 training data is **simulation-derived** from documented medicine storage requirements and is intended to demonstrate an ML-based storage-risk estimation pipeline. It is **not a clinically validated dataset** and the resulting model must not be interpreted as a clinical prediction model.

In the pharmaceutical domain, empirical stability excursion test results linked to specific degraded batches are proprietary trade secrets protected under regulatory filings (FDA NDA/ANDA). No open-access clinical excursion outcome dataset exists for retail drug packages.

Accordingly, MediShelf AI constructs a transparent, deterministic simulation generator grounded strictly in the **25 verified USP/FDA monographs** present in `data/medicines/medicines.csv`.

---

## Dataset Characteristics

- **Total Samples**: 6,000 scenarios
- **Random Seed**: 42 (fixed for 100% reproducibility)
- **Target Variable**: `risk_level`
- **Target Taxonomy**:
  - `LOW`: Ambient conditions strictly within or marginally adjacent to documented monograph range; negligible kinetic degradation.
  - `MODERATE`: Minor temperature excursion beyond allowable range for short duration, or near-expiry medicine experiencing mild environmental stress.
  - `HIGH`: Severe temperature excursion (e.g. cold-chain insulin exposed to room/elevated temperatures, freezing liquid suspensions, or prolonged heat exposure exceeding stability margins).
- **Class Balance**: Stratified across environmental regimes (Normal, Mild Excursion, Severe Excursion, Boundary Cold, Boundary Hot) to ensure balanced representation (~2,000 samples per class).

---

## Feature Schema

| Feature Name               | Type  | Description                                                                   | Zero-Leakage Guarantee      |
| :------------------------- | :---- | :---------------------------------------------------------------------------- | :-------------------------- |
| `temperature`              | Float | Ambient observed temperature (°C)                                             | Raw environmental reading   |
| `humidity`                 | Float | Ambient relative humidity (% RH)                                              | Raw environmental reading   |
| `storage_min_temp`         | Float | Monograph permissible minimum temperature (°C)                                | Official catalog fact       |
| `storage_max_temp`         | Float | Monograph permissible maximum temperature (°C)                                | Official catalog fact       |
| `temp_deviation_below`     | Float | `max(0, storage_min_temp - temperature)`                                      | Derived deviation           |
| `temp_deviation_above`     | Float | `max(0, temperature - storage_max_temp)`                                      | Derived deviation           |
| `temp_deviation_magnitude` | Float | Absolute temperature deviation outside valid window                           | Derived deviation           |
| `excursion_duration_hours` | Float | Duration of environmental deviation in hours                                  | Raw exposure measurement    |
| `excursion_severity_index` | Float | `temp_deviation_magnitude * excursion_duration_hours`                         | Kinetic exposure index      |
| `requires_cold_chain`      | Int   | Binary indicator (`1` if max_temp <= 8°C e.g. Insulins, `0` otherwise)        | Catalog classification      |
| `is_liquid_or_injection`   | Int   | Binary indicator (`1` for Injections, Suspensions, Aerosols; `0` for tablets) | Physical form vulnerability |
| `has_humidity_requirement` | Int   | Binary indicator (`1` if monograph quantifies humidity; currently `0`)        | Documented limitation       |
| `humidity_deviation`       | Float | Deviation from quantified humidity threshold (`0.0` if not quantified)        | Documented limitation       |
| `days_to_expiry`           | Int   | Shelf-life remaining until packaging expiration date                          | Product temporal state      |
| `near_expiry`              | Int   | Binary indicator (`1` if days_to_expiry <= expiry_warning_days)               | Expiry threshold state      |

_Note: No synthetic target probability or risk score is included in the feature vector. The model learns risk classification purely from raw and kinetic environmental/product features._

---

## Generation & Verification

To regenerate the dataset identically at any time:

```bash
python ml/data/generate_storage_risk_dataset.py
```
