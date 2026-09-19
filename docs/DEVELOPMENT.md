# MediShelf AI — Developer Guide

This document outlines local environment setup, architecture principles, testing guidelines, and phase execution workflows.

---

## 1. Development Principles

1. **Software-Only Paradigm**: No hardware, IoT microcontrollers (ESP32/Arduino), or physical sensors are required. All image acquisition occurs through HTML5 browser camera APIs or file uploads.
2. **Explicit Separation of Concerns**:
   - **Computer Vision (CV)** predicts visual identity classes only.
   - **Optical Character Recognition (OCR)** extracts textual fields from packaging.
   - **Machine Learning (ML) Risk Engine** estimates environmental risk probabilities.
   - **Deterministic Rules Engine** validates binary hard limits (e.g. `today > expiry_date`, `temp > max_temp`).
   - Results from ML and deterministic rules are **never conflated** in the UI or API response.
3. **No Synthetic Clinical Claims**: Synthetic or simulated training sets are explicitly labeled and documented. The project does not claim medical certification.
4. **No Code Sprawl / Monolithic Files**: Code is divided into domain modules under `backend/app/` and component layers under `frontend/src/`.

---

## 2. Local Environment Setup

### Prerequisites
- Python 3.10+ (Current test environment: Python 3.14)
- Node.js 18+ (Current test environment: Node.js 24)

### Backend Setup
```bash
# 1. (Optional) Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate   # Windows PowerShell

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Copy environment configuration
copy backend\.env.example backend\.env

# 4. Run Dataset Validation
python ml/preprocessing/validate_medicine_dataset.py

# 5. Seed Database
$env:PYTHONPATH = ".;backend"
python -m app.database.seed
```

### Running Backend Tests
```bash
$env:PYTHONPATH = ".;backend"
python -m pytest tests/backend/ -v
```

### Starting the Backend
```bash
$env:PYTHONPATH = ".;backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive API documentation will be available at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

---

## 3. Frontend Setup

```bash
cd frontend

# Install node dependencies
npm install

# Start Vite dev server with Hot Module Replacement (HMR)
npm run dev
```

The frontend will run on `http://localhost:5173/` and automatically proxies `/api` calls to the FastAPI backend at `http://127.0.0.1:8000`.

### Building for Production
```bash
npm run build
```
This executes `tsc -b` (strict TypeScript validation) followed by Vite production bundling.

---

## 4. Phase-by-Phase Roadmap

| Phase | Description | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation & Architecture | Repository scaffold, FastAPI backend, SQLite/SQLAlchemy setup, health check API, React + TypeScript + Tailwind dashboard shell, unit tests. | **COMPLETED** |
| **Phase 2** | Medicine Dataset & Schema | 25 curated medicine classes, storage criteria (USP/WHO/FDA DailyMed standard), SQLAlchemy ORM models, idempotent seed script, REST APIs, and interactive frontend integration. | **COMPLETED** |
| **Phase 3** | CV Recognition Pipeline | MobileNetV3-Small transfer learning, NIH DailyMed SPL dataset (70/20/10 split), 0.60 confidence thresholding, test benchmark metrics, scan endpoint. | **COMPLETED** |
| **Phase 4** | OCR Label Extraction & Fusion | EasyOCR 1.7.2, Image Quality Gate, CLAHE enhancement, YYYY-MM expiry normalization, batch/strength regex parsing, fuzzy DB matching, decision fusion, manual edit UI. | **COMPLETED** |
| **Phase 5** | Environmental Feature Engineering | Deviation metrics, time-to-expiry features, ambient telemetry processing. | Upcoming |
| **Phase 6** | ML Storage Risk Model | Gradient Boosting / Random Forest classifier with training/val/test splits, ROC-AUC, confusion matrices. | Upcoming |
| **Phase 7** | Explainable Combined Engine | Merging ML probabilities with deterministic rule validation; explainability factor tree. | Upcoming |
| **Phase 8** | Interactive Dashboard & Alerts | Real-time telemetry monitoring charts, warning and deviation notifications. | Upcoming |
| **Phase 9** | Mobile Camera Optimization | In-browser camera UX, file size compression, mobile orientation handling. | Upcoming |
| **Phase 10** | Testing, Academic Benchmarks & Docs | Comprehensive test coverage, model cards, deployment packaging. | Upcoming |

---

## 5. Phase 4 OCR Pipeline Guidelines & Known Limitations

### Supported Patterns
* **Expiry Formats**: `EXP 08/2027`, `EXP: 08-2027`, `EXP 2027-08`, `EXP DATE 08/27`, `EXPIRY 08/2027`, `08/2027`, `2027/08`, `08-2027`, `08/27`.
  - Normalization rule: Formats without an explicit day normalize strictly to `YYYY-MM`. The pipeline never fabricates an exact day (such as 01 or 31). If unconfident, `expiry_date` is `null`.
* **Batch/Lot Formats**: `LOT ABC123`, `LOT: ABC123`, `BATCH ABC123`, `BATCH NO: ABC123`, `B/N ABC123`, `BN: ABC123`.
* **Strength Formats**: `500 mg`, `500mg`, `20 mg`, `100 mg/5 mL`, `100 IU/mL`, `90 mcg`, `875 mg / 125 mg`.
* **Medicine Matching**: Fuzzy similarity against SQLite catalog with `difflib.SequenceMatcher`, handling uppercase/mixed-case differences and common OCR noise (e.g. `AM0XICILLIN` -> `Amoxicillin`).

### Multi-Modal Decision Fusion
* Synthesizes visual predictions with OCR packaging text into 4 statuses:
  - `CONFIRMED`: High CV confidence corroborating OCR active ingredient/medicine title.
  - `PARTIAL`: Moderate CV confidence or OCR catalog match with incomplete agreement.
  - `DIVERGENT`: Conflicting evidence between visual class and extracted packaging text.
  - `UNCONFIRMED`: Neither modality produces sufficient evidence.
* **Important Terminology**: Fusion reflects evidence consistency across modalities; it does not claim certified medical diagnosis or chemical authenticity.

### Known Limitations
1. **OCR Is Not Guaranteed**: Physical reflections on blister foils, motion blur, and low-contrast typography can cause characters to be misread.
2. **Pre-OCR Quality Gate**: Blurry (Laplacian variance < 45.0) or severely underexposed (brightness < 38.0) images are flagged as degraded before running OCR.
3. **Manual Verification**: Users should always review and can manually edit extracted fields directly in the UI. User-corrected fields are explicitly badged with "User corrected".
