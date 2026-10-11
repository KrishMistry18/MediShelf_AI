# MediShelf AI — Model Governance, Capabilities & Known Limitations

> [!WARNING]
> **Responsible AI & Clinical Disclaimer**  
> MediShelf AI is an educational prototype and engineering demonstration. It is **not certified by the FDA, EMA, or any healthcare regulatory authority** for medical diagnosis, drug administration, or pharmaceutical safety assessment. It does not interface with physical temperature/humidity data loggers and must not be used to decide whether an expired or temperature-exposed medicine should be consumed or discarded. Always inspect physical packaging and consult a licensed pharmacist.

---

## 1. Overview of System Machine Learning Architecture

MediShelf AI utilizes a hybrid architecture that separates **closed-set computer vision**, **open-world OCR candidate retrieval**, **transparent multimodal decision fusion**, and **bifurcated storage risk assessment**:

```text
               +-----------------------------------+
               |     Input Packaging Photograph    |
               +-----------------------------------+
                                 |
                 +---------------+---------------+
                 |                               |
                 v                               v
    +------------------------+      +------------------------+
    |  MobileNetV3-Small     |      |  EasyOCR (CRAFT+CRNN)  |
    |  (10 Packaging Classes)|      |  + Regex Field Parser  |
    +------------------------+      +------------------------+
                 |                               |
                 |                               v
                 |                  +------------------------+
                 |                  |  Open-World Retriever  |
                 |                  |  (27,326 Medicine DB)  |
                 |                  +------------------------+
                 |                               |
                 +---------------+---------------+
                                 |
                                 v
                 +-------------------------------+
                 |  Multimodal Decision Fusion   |
                 |  (CONFIRMED/PARTIAL/DIVERGENT)|
                 +-------------------------------+
                                 |
                 +---------------+---------------+
                 |                               |
                 v                               v
    +------------------------+      +------------------------+
    |  Deterministic Rules   |      |  GradientBoosting ML   |
    |  (Monograph Boundaries)|      |  (15 Feature Schema)   |
    +------------------------+      +------------------------+
```

---

## 2. Model 1: Computer Vision Packaging Classifier

### Technical Architecture
- **Backbone**: MobileNetV3-Small (Transfer Learning on PyTorch)
- **Trained Classes**: Exactly **10 packaging classes**:
  1. `amoxicillin_500mg`
  2. `aspirin_81mg`
  3. `atorvastatin_20mg`
  4. `cetirizine_10mg`
  5. `ibuprofen_200mg`
  6. `lisinopril_10mg`
  7. `metformin_500mg`
  8. `omeprazole_20mg`
  9. `paracetamol_500mg`
  10. `sertraline_50mg`
- **Input Dimensions**: $224 \times 224$ pixels, RGB normalized to ImageNet statistics.
- **Checkpoint Location**: [`ml/checkpoints/best_model.pth`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/ml/checkpoints/best_model.pth) (6.4 MB).

### Documented Limitations
1. **Closed-Set Constraint**:
   The visual classifier knows only 10 visual packaging classes. When shown any of the other 27,316 medicines in the catalogue, its softmax output will still distribute probabilities across these 10 classes.
   *Mitigation*: The system pairs CV with OCR and candidate retrieval. If visual prediction conflicts with extracted packaging text, fusion marks the verdict as `DIVERGENT` or defers to OCR candidate matching.
2. **Small Evaluation Dataset**:
   The held-out evaluation set contains **10 images** (1 per class). On this small split:
   - **Top-1 Accuracy**: **50.0%**
   - **Top-3 Accuracy**: **80.0%**
   Because 1 test image corresponds to 10 percentage points, metrics must be interpreted as qualitative indicators rather than high-precision statistical guarantees.
3. **Data-Starved Training Regime**:
   Training accuracy reached 74% against a validation accuracy of 50%. The model exhibits symptoms of a data-constrained regime common in small packaging datasets.

---

## 3. Model 2: Optical Character Recognition (OCR) Engine

### Technical Architecture
- **Engine**: EasyOCR 1.7.2 (CRAFT text detection + CRNN text recognition).
- **Preprocessing**: Grayscale conversion, CLAHE (Contrast Limited Adaptive Histogram Equalization), bilateral filtering, and image quality assessment (Laplacian blur score, brightness).
- **Post-Processing**: Regex-based token extractors for expiry dates (`EXP`, `EXPIRY`, `MM/YYYY`, `DD/MM/YYYY`), batch/lot numbers (`LOT`, `BATCH`, `B.NO`), dosage strengths (`500mg`, `20mg/ml`), and dosage forms.

### Documented Limitations
1. **Optical Distortion on Cylindrical Packaging**:
   Text on curved medicine bottles, ampoules, and blisters suffers from radial distortion, leading to missed tokens.
2. **Character Confusions**:
   Common OCR confusions (`0` $\leftrightarrow$ `O`, `1` $\leftrightarrow$ `I`, `5` $\leftrightarrow$ `S`, `8` $\leftrightarrow$ `B`) can corrupt active ingredient spelling and batch codes.
   *Mitigation*: The candidate retrieval engine generates spelling permutations and computes normalized Levenshtein similarity against indexed generic names.
3. **Multilingual Limitations**:
   The bundled model is configured for English text (`en`). Non-Latin packaging (e.g. Hindi, Arabic, Cyrillic) is not currently supported.

---

## 4. Model 3: Storage Risk ML Classifier

### Technical Architecture
- **Algorithm**: `GradientBoostingClassifier` (scikit-learn) with 100 estimators.
- **Feature Vector**: 15 features including:
  - `temp_excursion_c`: Degrees Celsius deviation outside permissible range.
  - `duration_hours`: Cumulative excursion duration.
  - `excursion_severity_index`: Degree-hours ($|\Delta T| \times t$).
  - `humidity_excursion_pct`: Relative humidity deviation.
  - `dosage_form_encoded`: Sensitivity tier of dosage form (e.g. liquid vs solid oral).
  - `is_cold_chain`: Indicator for refrigerated products (2–8°C).
- **Target Classes**: `LOW`, `MODERATE`, `HIGH`.
- **Checkpoint Location**: [`ml/checkpoints/storage_risk_pipeline.joblib`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/ml/checkpoints/storage_risk_pipeline.joblib).

### Documented Limitations & Scientific Caveats
1. **Simulation-Derived Ground Truth (NOT Clinical Trials)**:
   The training dataset comprises **6,000 synthetic excursion scenarios** generated via Arrhenius-derived degradation simulations and accelerated stability study heuristics.
   *Critical Caveat*: The **99.56% reported accuracy** measures how faithfully the GradientBoosting model learned the synthetic simulation rules. It **does NOT indicate 99.56% real-world chemical degradation accuracy** across commercial pharmaceuticals.
2. **Dominant Feature Bias**:
   Feature importance analysis reveals that `excursion_severity_index` accounts for **85.19%** of the model's total predictive weight. While physically intuitive, this means the model behaves largely as a nonlinear threshold function on degree-hours.
3. **Absence of Real Humidity Interaction Data**:
   Humidity degradation kinetics vary widely depending on blister foil permeability (PVC vs Alu-Alu) and desiccants. In the absence of real packaging barrier data, humidity estimates are approximations.

---

## 5. Storage Assessment: Rules vs. ML Bifurcation

To prevent AI hallucination and protect user safety:
1. **Strict Monograph Segregation**:
   - Curated foundation monographs (25 SKUs) have quantified temperature boundaries (e.g., 20–25°C or 2–8°C).
   - Ingested RxNorm clinical concepts (27,301 SKUs) have `NULL` temperature limits because NLM RxNorm provides terminology concepts, not storage tolerances.
2. **Deterministic Precedence**:
   - If an environmental excursion occurs, the deterministic engine flags `OUTSIDE_DOCUMENTED_RANGE` regardless of the ML risk level.
   - If a medicine lacks quantified storage limits, the system strictly outputs **`INSUFFICIENT_DATA`** and sets `ml_risk.is_available = false`. It never fabricates an allowable range.
