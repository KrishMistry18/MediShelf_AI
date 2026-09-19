# MediShelf AI — Intelligent Medicine Storage & Safety Assessment

> **A software-only AI/ML healthcare engineering and research platform.**
> Combines transfer-learning computer vision, OCR label extraction, and machine learning risk estimation to assess pharmaceutical storage safety without mandatory physical hardware.

---

## ⚠️ Academic Healthcare Disclaimer

**MediShelf AI is an academic research demonstration and engineering project.**
* Machine-learning predictions and computer-vision outputs are supplementary estimations.
* The system does **not** provide certified clinical diagnoses, chemical degradation guarantees, or formal pharmaceutical compliance certifications.
* Do not rely on this software as a replacement for licensed medical practitioners, manufacturer guidelines, or accredited pharmaceutical testing laboratories.

---

## 🌟 Core System Architecture & User Flow

The application enforces a strict separation between **AI/ML predictions**, **deterministic rules**, and **curated pharmaceutical metadata**:

```
User opens MediShelf AI
        ↓
Scan medicine package (Mobile Camera API / Desktop Upload)
        ↓
Image Preprocessing & Normalization
        ↓
Medicine Recognition Model (Transfer Learning: MobileNetV3 / EfficientNet)
        ↓
OCR Engine (Label, Strength, Batch & Expiration Extraction)
        ↓
Medicine Identity Confirmation & Pharmaceutical Metadata Retrieval
        ↓
Environmental Input (Temperature & Relative Humidity)
        ↓
AI/ML Storage Risk Engine (Gradient Boosting / Random Forest)
        ↓
Deterministic Expiry & Storage Validation Rules
        ↓
Combined Assessment & Explainable Risk Factor Report
```

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Recharts, Lucide React |
| **Backend** | Python 3.14, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn |
| **AI / ML** | PyTorch, torchvision, scikit-learn, OpenCV, NumPy, Pandas |
| **Database** | SQLite (development) / PostgreSQL (production-ready via SQLAlchemy) |
| **Inference Hardware** | Software-only (desktop & mobile browser camera via HTML5 Media APIs) |

---

## 📂 Repository Structure

```text
MediShelf_AI/
├── backend/
│   ├── app/
│   │   ├── api/             # REST endpoints (health, v1 routers)
│   │   ├── config.py        # Environment & pydantic-settings
│   │   ├── database/        # SQLAlchemy engine, session & declarative base
│   │   ├── models/          # ORM data models (Phase 2)
│   │   ├── ocr/             # OCR pipeline & text parsers (Phase 4)
│   │   ├── risk_engine/     # ML feature preprocessing & inference (Phase 6)
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic & repository layer
│   │   └── main.py          # FastAPI application entrypoint
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (Header, Sidebar, AppLayout)
│   │   ├── pages/           # Views: Overview, Monitoring, Medicines, Scan, Alerts, Models
│   │   ├── services/        # API client & backend health check
│   │   ├── types/           # TypeScript data contracts
│   │   ├── App.tsx          # Main view controller & live polling
│   │   └── index.css        # Tailwind v4 theme & base typography
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── ml/
│   ├── datasets/            # Training/Val/Test splits (Phase 3 & 6)
│   ├── preprocessing/       # Computer vision & tabular feature transformations
│   ├── training/            # Model training routines (isolated from runtime)
│   ├── evaluation/          # Confusion matrices, ROC-AUC, F1 metrics
│   ├── inference/           # Production model wrappers
│   └── artifacts/           # Serialized models (.pt, .joblib)
│
├── data/
│   ├── medicines/           # Structured metadata & storage range definitions
│   └── README.md
│
├── tests/
│   ├── backend/             # Pytest test suite (health, API endpoints)
│   └── frontend/            # Frontend unit/component tests
│
├── docs/
│   ├── ARCHITECTURE.md      # Architectural design specification
│   └── DEVELOPMENT.md       # Developer setup and roadmap
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **Python**: 3.10+ (tested on Python 3.14)

### 1. Backend Setup & Run

```bash
# From workspace root
# Install dependencies
python -m pip install -r backend/requirements.txt

# Run automated tests
$env:PYTHONPATH = ".;backend"
python -m pytest tests/backend/ -v

# Start FastAPI server (runs on http://127.0.0.1:8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Run evaluation on isolated test split
python ml/evaluation/evaluate_classifier.py
```

* Swagger API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* Health endpoint: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* Scan endpoint: `POST /api/scan` (accepts multipart image file)

### 2. Frontend Setup & Run

```bash
# In another terminal
cd frontend

# Install packages
npm install

# Start Vite development server (runs on http://localhost:5173)
npm run dev

# Build production bundle
npm run build
```

---

## 📅 Development Roadmap

- [x] **Phase 1: Project Foundation** — Clean architecture, FastAPI health check, SQLite/SQLAlchemy layer, React/TypeScript/Tailwind dashboard shell, verified live with browser subagent.
- [x] **Phase 2: Medicine Dataset & Database Integration** — 25 curated medicine classes with official FDA DailyMed / USP monographs, dataset validation script, SQLAlchemy Medicine model, idempotent seed script, REST APIs, and interactive frontend table with detailed provenance modal.
- [x] **Phase 3: Medicine Image Preprocessing & CV Recognition Pipeline** — Transfer learning (MobileNetV3-Small) trained on authentic NIH DailyMed SPL packaging archive (10 core classes, 70/20/10 train/val/test split), isolated test benchmark evaluation (50.0% Top-1, 80.0% Top-3, 0.4333 Macro F1), confidence thresholding (0.60 gate), `POST /api/scan` endpoint, desktop upload + mobile camera capture, 1-click test packages in UI, and OCR stub interface.
- [x] **Phase 4: OCR Label Extraction & Structured Medicine Information Pipeline** — Genuine EasyOCR 1.7.2 integration (CRAFT + CRNN), Pre-OCR Image Quality Gate (Laplacian blur, exposure check, minimum 64x64 resolution), CLAHE contrast enhancement, structured parser for expiry dates (strictly normalized to YYYY-MM without day hallucination), batch/lot numbers, dosage strengths, and manufacturers, fuzzy medicine catalog matching, explainable multi-modal decision fusion (`CONFIRMED`, `PARTIAL`, `DIVERGENT`, `UNCONFIRMED`), unified `POST /api/scan` and `POST /api/ocr` endpoints, and inline manual corrections with "User corrected" tags.
- [ ] **Phase 5: Environmental Storage Feature Processing** — Normalization & stability window calculation.
- [ ] **Phase 6: AI/ML Storage Risk Prediction Model** — Gradient Boosting / Random Forest multi-class risk classifier.
- [ ] **Phase 7: Explainable Combined Assessment Engine** — Merging ML risk predictions with deterministic boundary checks.
- [ ] **Phase 8: Real-Time Dashboard & Alerts** — Live charting and alert dispatches.
- [ ] **Phase 9: Mobile Camera Field Testing** — Mobile browser `<input capture="environment">` UX optimization.
- [ ] **Phase 10: Academic Documentation, Evaluation Benchmarks & Packaging**.
