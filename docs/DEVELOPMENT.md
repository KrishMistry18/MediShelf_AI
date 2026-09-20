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

## 2. Repository Layout

The frontend and the Python service live in one repository and run as two processes.

```text
src/              TanStack Start frontend (routes, components, API client)
public/samples/   Benchmark packaging photos used by the Scan page
backend/app/      FastAPI application (api, schemas, services, ocr, models)
ml/               Training scripts, inference wrappers, datasets, artifacts
data/medicines/   25-row monograph CSV that seeds the database
tests/backend/    pytest suite (70 tests)
tools/            serve_api.py, verify_models.py, smoke_api.py
```

Two import roots are in play: `app.*` is rooted at `backend/`, `ml.*` at the repository root.
`pyproject.toml` declares both for pytest and `tools/serve_api.py` sets them for uvicorn, so no
manual `PYTHONPATH` export is required.

---

## 3. Local Environment Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ (or Bun)

### Backend

```powershell
# 1. Create and activate a virtual environment. On Windows, place it outside any
#    OneDrive-synced folder — a torch install is well over 1 GB.
python -m venv $env:LOCALAPPDATA\medishelf-venv
& "$env:LOCALAPPDATA\medishelf-venv\Scripts\Activate.ps1"

# 2. Install the CPU build of PyTorch first, or pip pulls the multi-GB CUDA wheels.
pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements.txt

# 3. Download the EasyOCR weights once (~100 MB). The extractor runs with
#    download_enabled=False, so they must already be on disk. Skipping this is fine:
#    scans then return CV-only results with ocr_status="unavailable".
python -c "import easyocr; easyocr.Reader(['en'], gpu=False, download_enabled=True)"

# 4. Optional configuration — the defaults already run a working dev server.
copy backend\.env.example backend\.env
```

> **scikit-learn must stay on 1.9.x.** `ml/artifacts/storage_risk/model.joblib` was fitted with
> 1.9.0; loading it under an older release raises `InconsistentVersionWarning` and can change
> predictions. `pyproject.toml` promotes that warning to a test failure so a downgrade is caught.

### Starting the backend

```powershell
python tools/serve_api.py              # 127.0.0.1:8000, autoreload on
python tools/serve_api.py --no-reload  # quieter, for smoke tests
```

The SQLite database is created and seeded from `data/medicines/medicines.csv` on first startup.

Interactive API documentation:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### Frontend

```bash
npm install          # or: bun install
npm run dev          # or: bun run dev
```

The dev server prints its port (8080 in this workspace, 5173 for a plain Vite setup). The
frontend calls the API cross-origin at `VITE_API_BASE_URL`, so **the dev server origin must
appear in `ALLOWED_ORIGINS`** in `backend/.env`. The committed defaults cover ports 3000, 5173,
and 8080 on both `localhost` and `127.0.0.1`.

There is deliberately no Vite `/api` proxy: the hosted sandbox strips `server.proxy` from the
Vite config, so a proxy would work locally and silently break in preview.

### Verification commands

```powershell
python -m pytest tests/backend -q   # 70 backend tests
python tools/verify_models.py       # recompute every model metric from the checkpoints
python tools/smoke_api.py           # exercise every endpoint against a running server
npm run typecheck                   # tsc --noEmit, strict
npm run lint                        # eslint + prettier
npm run build                       # production bundle
```

`tools/verify_models.py` exists because the committed metric JSON files are training output. It
reloads the saved checkpoints, re-runs them over the datasets in the repo, and writes
`ml/artifacts/verification_report.json`, which `GET /api/models` then surfaces in the UI.

---

## 4. Phase-by-Phase Roadmap

| Phase       | Description                   | Key Deliverables                                                                                                                                                                               | Status        |
| :---------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ |
| **Phase 1** | Foundation & Architecture     | Repository scaffold, FastAPI backend, SQLite/SQLAlchemy setup, health check API, React + TypeScript + Tailwind dashboard shell, unit tests.                                                    | **COMPLETED** |
| **Phase 2** | Medicine Dataset & Schema     | 25 curated medicine classes, storage criteria (USP/WHO/FDA DailyMed standard), SQLAlchemy ORM models, idempotent seed script, REST APIs, and interactive frontend integration.                 | **COMPLETED** |
| **Phase 3** | CV Recognition Pipeline       | MobileNetV3-Small transfer learning, NIH DailyMed SPL dataset (70/20/10 split), 0.60 confidence thresholding, test benchmark metrics, scan endpoint.                                           | **COMPLETED** |
| **Phase 4** | OCR Label Extraction & Fusion | EasyOCR 1.7.2, Image Quality Gate, CLAHE enhancement, YYYY-MM expiry normalization, batch/strength regex parsing, fuzzy DB matching, decision fusion, manual edit UI.                          | **COMPLETED** |
| **Phase 5** | Storage-Risk AI/ML Model      | GradientBoostingClassifier (6,000 simulation-derived scenarios, 15 kinetic/product features, 99.56% test accuracy, 0.9958 Macro F1), prediction REST APIs, explainability, and interactive UI. | **COMPLETED** |

---

## 5. Phase 4 OCR Pipeline Guidelines & Known Limitations

### Supported Patterns

- **Expiry Formats**: `EXP 08/2027`, `EXP: 08-2027`, `EXP 2027-08`, `EXP DATE 08/27`, `EXPIRY 08/2027`, `08/2027`, `2027/08`, `08-2027`, `08/27`.
  - Normalization rule: Formats without an explicit day normalize strictly to `YYYY-MM`. The pipeline never fabricates an exact day (such as 01 or 31). If unconfident, `expiry_date` is `null`.
- **Batch/Lot Formats**: `LOT ABC123`, `LOT: ABC123`, `BATCH ABC123`, `BATCH NO: ABC123`, `B/N ABC123`, `BN: ABC123`.
- **Strength Formats**: `500 mg`, `500mg`, `20 mg`, `100 mg/5 mL`, `100 IU/mL`, `90 mcg`, `875 mg / 125 mg`.
- **Medicine Matching**: Fuzzy similarity against SQLite catalog with `difflib.SequenceMatcher`, handling uppercase/mixed-case differences and common OCR noise (e.g. `AM0XICILLIN` -> `Amoxicillin`).

### Multi-Modal Decision Fusion

- Synthesizes visual predictions with OCR packaging text into 4 evidence statuses:
  - `CONFIRMED`: Active ingredient identity agrees + strength agrees when provided on both sides + dosage form agrees when provided on both sides.
  - `PARTIAL`: Active ingredient identity corroborated, but important product specifications differ (e.g. strength mismatch such as 500mg vs 160mg, or dosage form mismatch such as tablet vs oral suspension) or are incomplete.
  - `DIVERGENT`: Conflicting evidence between visual class and extracted packaging text (genuinely different active medicines).
  - `UNCONFIRMED`: Neither modality produces sufficient evidence.
- **Important Terminology**: Fusion reflects evidence consistency across modalities; it does not claim certified medical diagnosis, product genuineness, or chemical safety.

### Known Limitations

1. **OCR Is Not Guaranteed**: Physical reflections on blister foils, motion blur, and low-contrast typography can cause characters to be misread.
2. **Pre-OCR Quality Gate**: Blurry (Laplacian variance < 45.0) or severely underexposed (brightness < 38.0) images are flagged as degraded before running OCR.
3. **Manual Verification**: Users should always review and can manually edit extracted fields directly in the UI. User-corrected fields are explicitly badged with "User corrected".
