# MediShelf AI — Data Guidelines & Specifications

This directory contains metadata catalogs, reference storage criteria, and versioned datasets used across the MediShelf AI platform.

---

## 1. Curated Medicine Dataset (`data/medicines/`)

The repository includes a curated, traceable foundation of **25 authentic medicine classes**:

- File: [`data/medicines/medicines.csv`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/data/medicines/medicines.csv)
- Source Citations: [`data/medicines/sources.md`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/data/medicines/sources.md)

### Dataset Fields & Types

| Column                    | Type    | Description                                      | Nullable |
| :------------------------ | :------ | :----------------------------------------------- | :------- |
| `medicine_id`             | String  | Unique identifier (e.g. `MED-001`)               | No       |
| `medicine_name`           | String  | Commercial product name                          | No       |
| `generic_name`            | String  | Active pharmaceutical ingredient (API)           | No       |
| `brand_name`              | String  | Common brand trade name                          | Yes      |
| `strength`                | String  | Dosage strength (e.g. `500 mg`, `100 U/mL`)      | No       |
| `dosage_form`             | String  | Pharmaceutical form (Tablet, Capsule, Injection) | No       |
| `category`                | String  | Therapeutic class                                | No       |
| `manufacturer`            | String  | Reference manufacturer                           | Yes      |
| `storage_min_temperature` | Float   | Minimum temperature (°C)                         | No       |
| `storage_max_temperature` | Float   | Maximum temperature (°C)                         | No       |
| `storage_min_humidity`    | Float   | Minimum relative humidity (% RH)                 | Yes      |
| `storage_max_humidity`    | Float   | Maximum relative humidity (% RH)                 | Yes      |
| `expiry_warning_days`     | Integer | Warning threshold before expiration              | No       |
| `image_class`             | String  | Machine-learning classification label            | No       |
| `source`                  | String  | Regulatory monograph citation                    | No       |
| `source_url`              | String  | Verifiable FDA DailyMed / USP URL                | No       |

---

## 2. Integrity & Ethical Provenance Rules

1. **Ground Truth Separation**: Storage requirements originate from official regulatory package inserts. The AI/ML system does not invent or hallucinate pharmaceutical requirements.
2. **Handling Humidity (% RH)**: Most solid oral dosage labels state _"Protect from moisture"_ without quoting numerical RH percentages. In accordance with medical data ethics, **we do NOT invent arbitrary numbers**. Where unquantified, humidity fields are stored as `null`.
3. **Dataset Validation Script**:
   ```bash
   python ml/preprocessing/validate_medicine_dataset.py
   ```
   Validates required non-empty fields, temperature bounds (`min <= max`), duplicate detection, and source URL syntax.
4. **Deterministic Seeding**:
   ```bash
   $env:PYTHONPATH = ".;backend"
   python -m app.database.seed
   ```
   Completely idempotent; running multiple times prevents duplicate records.
