# MediShelf AI

Medicine package identification and storage-risk assessment. A TanStack Start frontend on top of
a FastAPI service that runs two real models: a fine-tuned MobileNetV3-Small classifier for
packaging photos, and a gradient-boosting classifier for storage degradation risk.

> **Educational and engineering-research prototype.** Neither model is clinically validated. Do
> not use it to decide whether a medicine is safe to take or should be discarded. Verify the
> physical packaging and consult a licensed pharmacist.

---

## Quick start

### Option A: Start both API and frontend together (Recommended)

```powershell
# One-time setup
pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements.txt
npm install

# Run backend API + Vite web UI concurrently
npm start
```

### Option B: Run in separate terminals

```powershell
# --- API (terminal 1) ---
python tools/serve_api.py

# --- frontend (terminal 2) ---
npm run dev
```

The API listens on `http://127.0.0.1:8000` (`/docs` for Swagger). The database is created and
seeded from `data/medicines/medicines.csv` on first startup. The frontend prints its own port and
calls the API cross-origin, so that origin must be listed in `ALLOWED_ORIGINS` — the shipped
defaults already cover ports 3000, 5173, and 8080.

On Windows, keep the virtualenv outside OneDrive-synced folders. A PyTorch install is well over
1 GB and syncing it is painful.

Full setup notes, including the two Python import roots and the scikit-learn version constraint,
are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

---

## Measured model performance

Run `python tools/verify_models.py` to reproduce everything below. It reloads the saved
checkpoints and recomputes each metric from the datasets in this repository rather than reading
the training logs, then writes `ml/artifacts/verification_report.json`. `GET /api/models` serves
that report to the Model Insights page.

### Package classifier — MobileNetV3-Small, 10 classes, 224 px, confidence gate 0.60

| Split                       |   n | Top-1  | Top-3  | Macro F1 | Below gate |
| --------------------------- | --: | ------ | ------ | -------- | ---------- |
| Held-out test (1 per class) |  10 | 0.5000 | 0.8000 | 0.4333   | 3 / 10     |
| Validation                  |  20 | 0.5000 | 0.6500 | 0.4919   | 10 / 20    |
| Train (seen while fitting)  |  70 | 0.6571 | 0.9571 | 0.6555   | 25 / 70    |
| All 100 raw images          | 100 | 0.6100 | 0.8800 | 0.6173   | 38 / 100   |

This matches the committed `test_metrics.json` exactly, and the live `POST /api/scan` endpoint
reproduces the same 5/10 on the held-out split.

What the numbers mean in practice:

- **The first guess is wrong about half the time.** Top-3 accuracy of 0.80 against top-1 of 0.50
  says the right medicine is usually among the candidates but rarely alone at the top. The UI
  therefore renders the full ranked candidate list, not just the winner.
- **It is underfitted, not overfitted.** Train accuracy (0.657) sits barely above validation
  (0.500). Six epochs over seven images per class is not enough data; more images will help, more
  epochs will not.
- **Per-class quality is very uneven.** Ibuprofen (F1 0.90), paracetamol (0.89), and Humulin R
  (0.82) are reliable. Ciprofloxacin collapses to F1 0.26 and acts as a sink — it was predicted 13
  times across 100 images against a true support of 10, absorbing amoxicillin, losartan, and
  omeprazole.
- **The confidence gate does real work.** 38 of 100 images fall below 0.60 and are surfaced as
  "not identified" rather than as a wrong answer.
- CPU inference is ~25 ms. Adding the OCR pass takes a full scan to roughly 5–15 s.

### Storage-risk classifier — GradientBoostingClassifier, 15 features, LOW / MODERATE / HIGH

Recomputed on the held-out split: **accuracy 0.9956, macro F1 0.9958** — identical to the
committed `evaluation_results.json`. Train 1.0000 / validation 0.9978 / test 0.9956.

That number is far less impressive than it looks, and the UI says so:

- The 6,000 training scenarios are **simulation-derived**. Labels come from deterministic rules
  over USP/FDA storage constraints, not from laboratory stability studies. The score measures how
  well the model learned those rules, not real shelf-life outcomes.
- One feature dominates: `excursion_severity_index` (temperature deviation × exposure hours)
  carries 85% of total importance.
- All three humidity features have **exactly zero** importance. The simulation never varied
  degradation by humidity, so the model cannot use it.

The consequence matters for interpretation. Measured behaviour:

| Scenario                              | Compliance | ML risk          |
| ------------------------------------- | ---------- | ---------------- |
| Paracetamol 22 °C, in range           | pass       | LOW (1.000)      |
| Paracetamol 27 °C for 3 h             | **fail**   | **LOW (1.000)**  |
| Humulin R 9.2 °C for 3 h (cold chain) | **fail**   | **LOW (1.000)**  |
| Humulin R 35 °C for 24 h              | fail       | HIGH (1.000)     |
| Humulin R −5 °C for 12 h (frozen)     | fail       | HIGH (1.000)     |
| In range, 10 days to expiry           | pass       | MODERATE (0.550) |

Sweeping insulin held 6 h at rising temperature: 4–8 °C → LOW, 10 °C → MODERATE, 20 °C and above
→ HIGH.

**A failed compliance check alongside LOW estimated risk is normal, not a bug.** Compliance is a
hard comparison against the monograph; the model weighs accumulated thermal stress, and a brief
excursion accumulates very little. The assessment page detects this combination and states
explicitly that the deterministic verdict is the binding one.

---

## Architecture

```text
src/              TanStack Start frontend — routes, components, typed API client
public/samples/   Benchmark packaging photos used by the Scan page
backend/app/      FastAPI service — api, schemas, services, ocr
ml/               Training scripts, inference wrappers, datasets, artifacts
data/medicines/   25-row monograph CSV that seeds the database
tests/backend/    pytest suite (70 tests)
tools/            serve_api.py, verify_models.py, smoke_api.py
```

Four stages stay deliberately separate, and the API never merges their outputs:

1. **Computer vision** predicts a package class and nothing else.
2. **OCR** reads label text independently, without seeing the CV prediction.
3. **Deterministic rules** compare conditions against the monograph. Reproducible and auditable.
4. **The ML risk model** estimates degradation probability.

Cross-checking (`CONFIRMED` / `PARTIAL` / `DIVERGENT` / `UNCONFIRMED`) reports whether the two
independent readings agree. It is not a claim about authenticity, potency, or safety.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the data contracts.

### API endpoints

All routers are mounted under both `/api` and `/api/v1`.

| Endpoint                            | Purpose                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `GET /api/health`                   | Service and database status                                 |
| `GET /api/medicines`                | Paginated catalog with search and category filters          |
| `GET /api/medicines/search`         | Autocomplete across name, generic, brand, SKU, vision class |
| `GET /api/medicines/categories`     | Distinct categories with counts                             |
| `GET /api/medicines/{id}`           | Single monograph                                            |
| `POST /api/scan`                    | Quality gate → CV → OCR → parsing → DB match → cross-check  |
| `POST /api/ocr`                     | Label text extraction only                                  |
| `POST /api/v1/storage-risk/predict` | Deterministic compliance and ML risk, reported separately   |
| `GET /api/v1/storage-risk/metadata` | Risk model provenance                                       |
| `GET /api/models`                   | Architecture, benchmarks, and derived limitations           |

---

## Notes on this build

Changes made while merging the ML service into this frontend:

- **The UI no longer fabricates results.** Scanning, storage assessment, the medicine library, the
  alert list, and every accuracy figure now come from the API. Previously the scan page returned a
  hardcoded result after a 1.3 s timer, and the model page hardcoded its metrics. Scan and
  assessment history is kept in `sessionStorage`, so an untouched session shows an empty state
  rather than sample data.
- **`GET /api/models` is new.** Serving metrics from `ml/artifacts/**` at request time means
  retraining cannot leave stale numbers on screen. It also derives the plain-language limitations
  shown in the UI from the artifacts themselves.
- **OCR unavailability is no longer reported as bad image quality.** `POST /api/scan` used to
  fabricate a failed quality assessment when the EasyOCR engine could not load, telling the user
  to retake a perfectly good photo. Quality is now measured independently and `ocr_status`
  distinguishes `completed`, `skipped_low_quality`, and `unavailable`.
- **`humidity_deviation` is computed rather than hardcoded to 0.0.** Predictions are unaffected
  (the feature has zero importance) but the explainability panel no longer misreports a real
  humidity breach.
- **`backend/requirements.txt` was incomplete** — it omitted torch, torchvision, scikit-learn,
  joblib, pandas, numpy, opencv, and easyocr. Versions are now pinned, with scikit-learn held at
  1.9.x to match the fitted artifact.
- **Dark mode was the stock slate palette**, which turned `--accent` into a near-neutral grey and
  drained the meaning out of every status badge and confidence bar. It now mirrors the light
  theme's green family at dark-surface lightness.
- Catalog counts were inconsistent: the UI claimed 25 monographs while the bundled list held 12.
  It reads the real 25 from the database now.

### Current state

- 70/70 backend tests pass.
- `tools/smoke_api.py` passes every check against a live server.
- TypeScript (strict), ESLint, and the production build are clean.
- All six routes server-render without errors; CORS is verified to allow the dev origin and
  reject others.

### Known limitations

- Only 10 of the 25 catalogued medicines have a trained vision class. The rest are
  reference-only — the library marks them "Manual only", and their storage limits and risk
  assessment work normally.
- Storage conditions are entered by hand. There is no sensor integration, so nothing in the app
  is live telemetry.
- A full scan takes 5–15 s because OCR runs on CPU.
- Image quality gating rejects small or low-contrast photos before OCR. Several images in the
  bundled test set trip it, which is the intended behaviour — reading a blurred label produces
  plausible but wrong characters.
