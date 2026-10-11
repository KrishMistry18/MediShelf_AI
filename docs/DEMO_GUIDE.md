# MediShelf AI — Five-Minute Live Demonstration & Viva Guide

This presentation script provides a structured, repeatable 5-minute demonstration of **MediShelf AI** for evaluators, portfolio reviewers, and technical vivas.

---

## Demonstration Overview Timeline

```text
  0:00 - 0:30  |  1. Problem Statement & Architecture Introduction
  0:30 - 1:30  |  2. Large-Scale Authentic Medicine Catalogue (27,326 SKUs)
  1:30 - 2:45  |  3. Multimodal Scanner: Computer Vision + OCR + Fusion
  2:45 - 3:45  |  4. Bifurcated Storage Risk Engine & Invariant Checking
  3:45 - 4:15  |  5. Responsible AI: INSUFFICIENT_DATA Handling
  4:15 - 5:00  |  6. Live Model Insights, Provenance & Viva Defense
```

---

## 1. Problem Statement & Architecture (0:00 – 0:30)

**Presenter Script:**
> *"Every year, billions of dollars worth of medicines lose potency or degrade into harmful byproducts because of improper storage conditions — particularly heat excursions and cold-chain breaks in insulin and biologics. Patients and pharmacists struggle to interpret dense, non-standardized packaging labels.*
> 
> *MediShelf AI is an intelligent medicine safety platform. It integrates a 27,326-record authentic medicine database, computer vision, deep-learning OCR, an evidence-based fusion engine, and bifurcated storage risk assessment."*

**Action:**
- Display the application home dashboard (`/`).
- Point out the active service health badge (`System Online`, `27,326 medicines indexed`).

---

## 2. Large-Scale Medicine Catalogue (0:30 – 1:30)

**Presenter Script:**
> *"Unlike demo projects with mock data, MediShelf AI is backed by an authentic knowledge base of 27,326 medicines ingested from NLM RxNorm and FDA DailyMed. The architecture pairs 25 curated foundation monographs with 27,301 clinical and branded drug concepts."*

**Action:**
1. Navigate to **Medicines** (`/medicines`).
2. Demonstrate instant search:
   - Type `"amoxicillin"` $\rightarrow$ Observe immediate sub-millisecond FTS5 results.
   - Type `"insulin"` $\rightarrow$ View refrigerated cold-chain items.
3. Demonstrate pagination across 27,326 items (jump from Page 1 to Page 20).
4. Filter by category (e.g., `"Analgesic & Antipyretic"` or `"Cardiovascular"`).
5. Open a medicine details card:
   - Point out verified active ingredients, strength, dosage form, and clickable NLM RxNav / FDA DailyMed provenance source URLs.

---

## 3. Multimodal Packaging Scanner (1:30 – 2:45)

**Presenter Script:**
> *"A primary challenge in medical image recognition is that visual models alone can be fooled by generic white boxes or similar blisters. MediShelf AI solves this using multimodal decision fusion.*
> 
> *When an image is uploaded, three parallel engines activate:*
> *1. Image Quality Assessor: Verifies blur and brightness.*
> *2. MobileNetV3-Small: Generates closed-set visual hypotheses.*
> *3. EasyOCR (CRAFT + CRNN): Extracts text lines and parses structured fields (expiry, lot, strength).*
> 
> *The Fusion Engine compares visual and textual evidence to produce a verified consensus."*

**Action:**
1. Navigate to **Scan Packaging** (`/scan`).
2. Upload a sample packaging photo (e.g. from `public/samples/` or test packaging).
3. Walk through the results dashboard:
   - **Quality Check**: Blur score and resolution confirmation.
   - **Computer Vision Output**: Ranked candidate classes with confidence percentages.
   - **OCR Extraction**: Extracted raw text, recognized expiry date, batch number, and strength.
   - **Multimodal Fusion Verdict**: Status badge (`CONFIRMED` or `PARTIAL`), agreement score, and transparent explainability reasons.

---

## 4. Bifurcated Storage Risk Engine (2:45 – 3:45)

**Presenter Script:**
> *"MediShelf AI strictly separates deterministic regulatory compliance from machine learning risk estimation. Deterministic rules verify official monograph thresholds. The ML model predicts degradation risk severity based on excursion degree-hours."*

**Action:**
1. Navigate to **Storage Assessment** (`/assessment`).
2. Select **Paracetamol 500mg Tablets** (`MED-001`):
   - Monograph storage range: $20.0^\circ\text{C} - 25.0^\circ\text{C}$.
   - Enter $22^\circ\text{C}$ for 0 hours $\rightarrow$ Click **Assess Storage Risk**.
   - **Result**: Deterministic status = `COMPLIANT`; ML Risk = `LOW` (Confidence 1.00).
3. Now simulate a severe cold-chain excursion:
   - Select **Humulin R Insulin** (`MED-009`, requires $2.0^\circ\text{C} - 8.0^\circ\text{C}$).
   - Enter $35^\circ\text{C}$ for 24 hours (left in a hot car).
   - Click **Assess Storage Risk**.
   - **Result**: Deterministic status = `OUTSIDE_DOCUMENTED_RANGE`; ML Risk = `HIGH` (Confidence 1.00).
   - Show the explainability breakdown: `excursion_severity_index` ($85\%$ importance) flagged $648$ degree-hours.

---

## 5. Responsible AI: INSUFFICIENT_DATA Handling (3:45 – 4:15)

**Presenter Script:**
> *"In safety-critical healthcare software, what a model refuses to predict is just as important as what it predicts. NLM RxNorm provides clinical naming, not physical storage parameters. If a user selects an external concept without authoritative storage limits, the system does not hallucinate a fake temperature range."*

**Action:**
1. Select an external pure RxNorm concept (e.g. search and select `Atorvastatin 20mg Oral Tablet`).
2. Submit storage assessment.
3. **Result**: Shows clear **`INSUFFICIENT_DATA`** status with message:
   *"Quantitative storage temperature unavailable. The source provides qualitative instructions, so deterministic compliance cannot be calculated."*
   And ML risk shows `Unavailable: Model requires structured temperature metadata`.

---

## 6. Live Model Insights & Viva Defense (4:15 – 5:00)

**Presenter Script:**
> *"The Model Insights page is powered directly by physical checkpoints on disk, not hardcoded strings. If a model is retrained, the UI reflects the true metrics immediately.*
> 
> *Notice our transparent limitations: the MobileNetV3 model is a 10-class classifier with 80% Top-3 accuracy on held-out samples. The 99.56% storage risk accuracy is explicitly documented as simulation-derived kinetics, not clinical trials. This scientific honesty ensures clinical evaluators can trust the system boundaries."*

**Action:**
1. Navigate to **Model Insights** (`/models`).
2. Point out:
   - Real checkpoint size ($6.4\text{ MB}$ PyTorch, scikit-learn joblib).
   - Training history curve and confusion matrix.
   - Feature importance bar chart.
   - Prominent scientific disclaimer banner.

---

## 7. Emergency Fallback & Troubleshooting

If network connectivity drops during the live demo:
- **Backend Down**: The frontend displays an informative offline state with retry button:
  `pip install -r backend/requirements.txt && python tools/serve_api.py`
- **Restarting**:
  ```bash
  python tools/serve_api.py --no-reload
  ```
