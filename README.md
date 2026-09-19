# MediShelf AI — Intelligent Medicine Storage & Safety Assessment

> **An academic research demonstration and software-only engineering platform.**  
> Integrates transfer-learning computer vision, deep OCR text parsing, authoritative pharmaceutical storage monographs, and trained machine-learning degradation risk models to assist medicine identification and monitor storage compliance without physical IoT hardware.

---

## ⚠️ Academic & Healthcare Disclaimer

**MediShelf AI is an AI-assisted medicine identification and storage-risk assessment system. It is a software research and academic engineering platform and does not provide clinical certification or guarantee medicine safety.**
- Predictions, computer vision detections, OCR extractions, and storage-risk estimations are **AI-assisted estimations** designed for demonstration and educational study.
- This platform does **not** provide clinical validation, chemical degradation guarantees, or certified pharmaceutical testing.
- Do not rely on this software as a replacement for licensed pharmacists, medical practitioners, official manufacturer packaging inserts, or accredited stability testing laboratories.
- All identified medicines and storage parameters require human user verification.

---

## 🔬 Problem Statement

Improper storage of pharmaceutical products—particularly exposure to adverse temperatures and humidity—causes chemical degradation, loss of therapeutic potency, and the formation of toxic degradation byproducts. Sensitive pharmaceuticals such as biologics, insulins, antibiotics, and cardiovascular tablets require strict adherence to standard storage boundaries (e.g. USP Controlled Room Temperature: 15°C–25°C; Cold Chain: 2°C–8°C).

**MediShelf AI** addresses this challenge through a **software-only pipeline** that combines:
1. **Computer vision** to recognize medicine packaging trade dress.
2. **Optical Character Recognition (OCR)** to parse printed text (expiration dates, batch/lot numbers, dosage strengths).
3. **Curated pharmaceutical database monographs** sourced from official NIH DailyMed and USP records.
4. **Deterministic boundary validation** to verify compliance against safe temperature and shelf-life thresholds.
5. **Machine learning degradation risk estimation (Phase 5)** to predict probabilistic storage risk (`LOW`, `MODERATE`, `HIGH`) with feature explainability.

---

## 🏛️ System Architecture & Multi-Modal Separation

The system maintains strict architectural separation between **statistical AI/ML predictions**, **database monograph facts**, **deterministic validation rules**, and **environmental risk estimation**:

```text
               User Input (Mobile Camera / Desktop File Upload)
                                      │
                                      ▼
                      Pre-OCR Image Quality Gate
                 (Laplacian Sharpness, Exposure, Resolution)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        Computer Vision Model                    Deep OCR Pipeline
      (MobileNetV3-Small Transfer)             (EasyOCR 1.7.2 CRAFT+CRNN)
     Visual Trade Dress Prediction             Printed Text & RegEx Parsing
      [Top-3 Ranked Probabilities]             [Expiry YYYY-MM, Batch, API]
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                                      ▼
                        Multi-Modal Decision Fusion
             (Consensus Scoring: CONFIRMED, PARTIAL, DIVERGENT)
                                      │
                                      ▼
                       Official Monograph Lookup
                 (FDA DailyMed & USP Database Records)
              [Safe Temperature Bounds, Humidity, Category]
                                      │
                                      ▼
                        Environmental Storage Inputs
            (Ambient Temperature, Humidity, Excursion Duration, Expiry)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        Deterministic Compliance                ML Storage-Risk Model
       (Exact Monograph Rule Check)            (GradientBoostingClassifier)
        [Within Bounds / Excursion]          [LOW / MODERATE / HIGH + Probs]
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                                      ▼
                       Explainable Multi-Pillar Result
              (Monograph Facts + Compliance Status + ML Risk Factors)
```

### Key Engineering Guarantees
- **No Expiration Day Hallucination**: When packaging specifies only month and year (e.g., `EXP 08/2027`), dates are normalized strictly to `YYYY-MM` without inventing a fictional day.
- **Explainable Fusion**: Disagreements between visual appearance and printed text are tagged as `DIVERGENT` and presented transparently to the user.
- **Audit Trails**: Manual inline corrections to extracted fields are flagged with a permanent `User corrected` indicator.
- **Verified Facts vs AI Predictions**: Monograph storage tolerances are loaded from verified database records and never generated by an AI language model or heuristic estimator.
- **Independent Compliance vs ML Risk**: Rule-based boundary compliance ("Is 28°C within 15°C–25°C?") is strictly decoupled from probabilistic ML degradation modeling ("Given a 3°C excursion for 12 hours on near-expiry tablets, what is the estimated risk?").

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Recharts, Lucide React |
| **Backend** | Python 3.14, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn |
| **Computer Vision** | PyTorch, torchvision (MobileNetV3-Small), OpenCV, PIL |
| **OCR Engine** | EasyOCR 1.7.2 (CRAFT text detection + CRNN recognition), CLAHE contrast enhancement |
| **Machine Learning** | scikit-learn 1.9, pandas 3.0, numpy 2.4, joblib 1.5 (GradientBoostingClassifier v1.0) |
| **Database** | SQLite (development) / PostgreSQL-ready via SQLAlchemy ORM |
| **Testing** | pytest, pytest-cov, httpx, oxlint, TypeScript compiler (`tsc -b`) |
| **Hardware** | None required (operates on standard browser camera APIs, file uploads, and software inputs) |

---

## 📅 Development Phases Status

- [x] **Phase 1 — Foundation**: FastAPI clean architecture, SQLAlchemy session management, system health diagnostics, React 19 / TypeScript / Tailwind CSS dashboard shell.
- [x] **Phase 2 — Medicine Dataset & Database Integration**: 25 curated pharmaceutical classes with official FDA DailyMed & USP monographs, SQLite database schema, idempotent database seeder, REST API query layer (`/api/medicines`), and interactive catalog with monograph modal.
- [x] **Phase 3 — Computer Vision Recognition**: Transfer learning (MobileNetV3-Small) trained on 10 core packaging classes from NIH DailyMed SPL archive, stratified 70/20/10 dataset split, confidence threshold gate (0.60 default), and `POST /api/scan` endpoint.
- [x] **Phase 4 — OCR Label Extraction & Structured Pipeline**: Genuine EasyOCR 1.7.2 CRAFT + CRNN integration, pre-OCR image quality gate (blur score, exposure, minimum resolution), regex field parser (strictly YYYY-MM expiry, lot/batch, dosage strength), multi-modal decision fusion (`CONFIRMED`, `PARTIAL`, `DIVERGENT`, `UNCONFIRMED`), and inline field correction with `User corrected` status.
- [x] **Phase 5 — Storage-Risk AI/ML Model**: Genuine trained ML model (`GradientBoostingClassifier`) evaluated on 6,000 simulation-derived scenarios, 15 kinetic/product features, zero data leakage, 99.56% test accuracy, 0.9958 Macro F1, top feature importances, REST APIs (`POST /api/v1/storage-risk/predict`), and interactive UI components in Scan & Monitoring pages.

---

## 🌡️ Phase 5: Storage-Risk AI/ML Model & Evaluation

### Transparency & Scientific Notice
> **IMPORTANT DATASET PROVENANCE**:
> Empirical pharmaceutical stability excursion outcomes are proprietary manufacturer trade secrets. In accordance with rigorous scientific standards, the Phase 5 training dataset was generated via a **transparent, deterministic simulation generator** grounded strictly in the **25 verified USP/FDA monographs** present in `data/medicines/medicines.csv`.
> 
> The resulting model learns a **project-defined storage-risk taxonomy** (`LOW`, `MODERATE`, `HIGH`) and is **not clinically validated**. It must not be interpreted as a certified medical determination or guarantee of drug potency.

### Dataset Characteristics
- **Total Samples**: 6,000 scenarios (`ml/data/storage_risk_dataset.csv`)
- **Random Seed**: 42 (100% reproducible via `python ml/data/generate_storage_risk_dataset.py`)
- **Splits**: 70% Train (4,199) / 15% Validation (901) / 15% Isolated Test (900), stratified by target class.
- **Target Distribution**: `LOW`: 2,646 (44.1%), `MODERATE`: 1,741 (29.0%), `HIGH`: 1,613 (26.9%).

### Feature Schema (Zero Data Leakage)
The model receives 15 explicit kinetic, physical, and temporal features without synthetic risk scores or target leakage:
1. `temperature`: Ambient observed temperature (°C)
2. `humidity`: Ambient relative humidity (% RH)
3. `storage_min_temp`: Official permissible minimum temperature (°C)
4. `storage_max_temp`: Official permissible maximum temperature (°C)
5. `temp_deviation_below`: Cold excursion magnitude below minimum limit (°C)
6. `temp_deviation_above`: Heat excursion magnitude above maximum limit (°C)
7. `temp_deviation_magnitude`: Maximum deviation outside permissible window (°C)
8. `excursion_duration_hours`: Continuous duration of environmental deviation (hours)
9. `excursion_severity_index`: Kinetic exposure index (`temp_deviation_magnitude * excursion_duration_hours`)
10. `requires_cold_chain`: Binary flag (`1` for 2°C–8°C biologics/insulins, `0` for ambient)
11. `is_liquid_or_injection`: Binary flag (`1` for Injections/Suspensions, `0` for solid tablets)
12. `has_humidity_requirement`: Binary flag (`1` if monograph specifies humidity; currently `0` for all 25 catalog medicines)
13. `humidity_deviation`: Deviation beyond quantified humidity limit (`0.0` if not quantified)
14. `days_to_expiry`: Remaining shelf life until packaging expiration date
15. `near_expiry`: Binary flag (`1` if `days_to_expiry <= expiry_warning_days`)

### Model Comparison on Validation Set (901 Samples)

| Candidate Model | Validation Accuracy | Validation Macro F1 | Validation Weighted F1 | Selection Status |
| :--- | :--- | :--- | :--- | :--- |
| **Logistic Regression** (StandardScaler) | 91.90% | 0.9171 | 0.9187 | Linear Baseline |
| **Random Forest** (100 trees, depth 12) | 99.67% | 0.9966 | 0.9967 | Competitive Ensemble |
| **Gradient Boosting** (100 trees, lr 0.1) | **99.78%** | **0.9979** | **0.9978** | **Selected Best Model** |

### Isolated Test Set Evaluation (900 Samples)

The selected `GradientBoostingClassifier` model was evaluated on the completely isolated test split:
- **Test Accuracy**: **99.56%**
- **Test Macro F1-Score**: **0.9958**
- **Test Weighted F1-Score**: **0.9956**

#### Confusion Matrix (Isolated Test Set)
```text
               Predicted LOW   Predicted MODERATE   Predicted HIGH
True LOW                 396                    1                0
True MODERATE              3                  258                0
True HIGH                  0                    0              242
```

#### Top Feature Importances
1. `excursion_severity_index` (85.19%): Primary driver representing thermal kinetic dose (deviation × hours).
2. `days_to_expiry` (5.81%): Product proximity to expiry date.
3. `temperature` (4.57%): Raw ambient temperature reading.
4. `near_expiry` (1.22%): Flag triggered when shelf life breaches warning window.
5. `temp_deviation_above` (1.14%): Pure heat excursion magnitude.

---

## 📊 Computer Vision Model & Benchmark

The computer vision subsystem utilizes **MobileNetV3-Small** fine-tuned on packaging images from the National Library of Medicine DailyMed Structured Product Labeling (SPL) repository.

### Dataset Partitions
- **Total Images**: 100 authentic pharmaceutical packaging images across 10 core classes.
- **Train Split (70%)**: 70 images (7 per class) with random horizontal flip, affine rotation (±10°), color jitter, and ImageNet normalization.
- **Validation Split (20%)**: 20 images (2 per class).
- **Isolated Test Split (10%)**: 10 images (1 per class), unobserved during training.

### Test Set Empirical Evaluation
Evaluated strictly against the isolated 10-sample test split (`ml/artifacts/metrics/test_metrics.json`):

| Metric | Score | Note |
| :--- | :--- | :--- |
| **Top-1 Accuracy** | **50.0%** | Primary candidate match (5 of 10) |
| **Top-3 Accuracy** | **80.0%** | True class in top-3 candidates (8 of 10) |
| **Macro Precision** | **0.4000** | Unweighted mean across 10 classes |
| **Macro Recall** | **0.5000** | Unweighted class sensitivity |
| **Macro F1-Score** | **0.4333** | Harmonic mean of macro precision and recall |
| **Weighted F1-Score**| **0.4333** | Balanced across test samples |

> [!NOTE]
> **Academic Benchmark Transparency**: The isolated test set contains exactly one image per class. These metrics serve as an initial academic research baseline and demonstrate the critical necessity of combining visual classification with OCR label reading (decision fusion) rather than relying on computer vision alone.

---

## 🔍 OCR Pipeline & Decision Fusion

### Pre-OCR Image Quality Gate
Before OCR text recognition runs, images are evaluated to prevent garbage-in garbage-out failures:
- **Sharpness**: Laplacian variance score (threshold: ≥ 100.0 for optimal recognition).
- **Brightness**: Mean pixel luminance (acceptable: 40 to 220).
- **Resolution**: Minimum 64 × 64 pixels required.
- Images with low contrast automatically pass through **Contrast Limited Adaptive Histogram Equalization (CLAHE)**.

### Structured Field Parser
Regex rules extract key regulatory metadata:
- **Expiration Date**: Recognizes formats such as `EXP 08/2027`, `EXP: 08-2027`, `EXP 15/08/2027`. Formats lacking a day are strictly normalized to `YYYY-MM`.
- **Batch / Lot Number**: Matches tokens following `LOT`, `BATCH`, `B/N`, or `BN:`.
- **Dosage Strength**: Identifies strength quantities (e.g., `500mg`, `20 mg`, `100U/mL`).
- **Active Ingredient**: Cross-references detected tokens against active database generic names.

### Multi-Modal Fusion States
- `CONFIRMED`: Active ingredient identity agrees + packaging strength agrees (when provided) + dosage form agrees (when provided).
- `PARTIAL`: Active ingredient identity corroborated, but important product specifications differ (e.g. strength mismatch such as 500mg vs 160mg, or dosage form mismatch such as tablet vs oral suspension) or are incomplete (e.g. missing strength on label).
- `DIVERGENT`: Visual prediction and packaging text identify genuinely different active medicines (divergence alert generated).
- `UNCONFIRMED`: Insufficient evidence from both modalities to confirm identity; manual catalog verification required.

---

## 🌐 API Reference

All endpoints are available under both `/api` and `/api/v1` prefixes.

### Health
- `GET /api/health`: Operational status, database connectivity (`connected` / `disconnected`), version, and academic disclaimer.

### Medicines Catalog
- `GET /api/medicines`: Paginated list with `page`, `page_size`, `category`, and `search` query parameters.
- `GET /api/medicines/search?q={query}&limit=10`: Fast substring and token autocomplete matching name, generic API, brand, and SKU.
- `GET /api/medicines/categories`: List of distinct therapeutic categories with SKU counts.
- `GET /api/medicines/{medicine_id}`: Detailed pharmaceutical monograph by SKU (`MED-001`) or primary key.

### Multi-Modal Scan & OCR
- `POST /api/scan`: Accepts multipart image file (`image/jpeg`, `image/png`, `image/webp`, max 15MB) and optional `threshold` query parameter. Returns composite payload with CV predictions, EasyOCR parsed fields, quality metrics, decision fusion assessment, and verified monograph storage specifications.
- `POST /api/ocr`: Standalone OCR endpoint returning extracted text lines, quality assessment, and structured fields.

### Storage Risk Assessment (Phase 5)
- `POST /api/v1/storage-risk/predict`: Accepts JSON payload (`medicine_id`, `current_temperature`, optional `current_humidity`, `excursion_duration_hours`, optional `expiry_date` / `days_to_expiry`). Returns 3-pillar response: official monograph facts, deterministic compliance status, and ML degradation risk estimate (`LOW`, `MODERATE`, `HIGH`) with confidence score and feature explainability factors.
- `GET /api/v1/storage-risk/metadata`: Model metadata, algorithm (`GradientBoostingClassifier`), training dataset provenance, feature list, and regulatory disclaimers.

Interactive OpenAPI documentation is accessible at `http://127.0.0.1:8000/docs`.

---

## 💻 Local Setup & Execution

### Prerequisites
- **Python**: 3.10 to 3.14 (Verified on Python 3.14)
- **Node.js**: 18+ (Verified on Node.js 24)
- **Git**: Installed and configured

### 1. Backend Setup
```powershell
# From the repository root
# Set PYTHONPATH to include backend and ml modules
$env:PYTHONPATH = "backend;ml;."

# Install Python dependencies
pip install -r backend/requirements.txt

# Run full backend test suite (62 tests across Phase 1-5)
python -m pytest tests/ -v

# Start FastAPI development server (runs on http://127.0.0.1:8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```powershell
# In a second terminal window
cd frontend

# Install npm dependencies
npm install

# Run linter
npm run lint

# Build production bundle (TypeScript typecheck + Vite)
npm run build

# Start Vite dev server (runs on http://localhost:5173, proxies /api to port 8000)
npm run dev
```

---

## 🧪 Testing & Verification

The test suite covers 70 comprehensive unit and integration tests across health, database, CV classifier, OCR pipeline, decision fusion, and ML storage-risk estimation:

```powershell
$env:PYTHONPATH = "backend;ml;."
python -m pytest tests/ -v
```

### Test Coverage Summary (70 Tests)
- `tests/backend/test_health.py` (3 tests): Health endpoint status, DB connectivity query, and schema validation.
- `tests/backend/test_medicines.py` (12 tests): Pagination, search filtering, category aggregation, monograph lookups, 404 responses.
- `tests/backend/test_cv_recognition.py` (14 tests): Image validation, RGBA-to-RGB conversion, minimum resolution rejection, MobileNetV3 inference, ranked predictions, threshold gating, metrics file integrity.
- `tests/backend/test_ocr_pipeline.py` (26 tests): Expiry date formats (YYYY-MM normalization), manufacturing dates, batch/lot extraction, strength patterns, catalog matching, image quality metrics, fusion semantics (`CONFIRMED`, `PARTIAL`, `DIVERGENT`, `UNCONFIRMED`), strength normalization contract (`500 mg` == `500mg` != `160 mg`), dosage form normalization contract (`tablet` == `tab` != `suspension`), and composite scan payloads.
- `tests/backend/test_storage_risk_api.py` (9 tests): Metadata endpoint, in-range ambient predictions (`LOW`), cold-chain insulin breach (`HIGH`), tablet heatwave excursion (`HIGH`), missing humidity handling, expiry date parsing, expired product handling, 404/422 validation, route aliases.
- `tests/backend/test_storage_risk_ml.py` (6 tests): Dataset reproducibility, column schema preservation, scientific disclaimer in metadata, model artifact loading, probability calibration (sums to 1.0), cold-chain freeze/heat detection, feature importance rankings.

---

## ⚠️ Known Limitations

1. **CV Dataset Scope**: The visual model is currently trained on 10 packaging classes. 15 medicines in the database rely on fuzzy OCR matching and manual catalog search.
2. **CV Evaluation Sample Size**: The isolated test set contains 1 image per class (10 images total). Benchmark numbers indicate small-sample baseline performance.
3. **Simulation-Derived Storage Risk Training**: Because proprietary real-world pharmaceutical stability excursion test data is protected under trade secrets, Phase 5 ML models are trained on simulated excursion scenarios derived strictly from USP/FDA monographs.
4. **Software-Only Environmental Inputs**: Environmental conditions are provided via manual inputs or simulation presets; no physical IoT sensor hardware is utilized.
5. **No Medical Claims**: Predictions provide AI-assisted reference estimates and do not guarantee chemical stability or clinical safety.

---

## 📄 License & Attribution
MediShelf AI is developed for academic research and engineering demonstration purposes. Packaging images and monograph metadata are referenced from the National Institutes of Health (NIH) DailyMed public domain database and United States Pharmacopeia (USP) public standards.
