# MediShelf AI — Computer Vision Medicine Packaging Dataset

This directory maintains the medicine packaging image dataset used for training, validating, and evaluating the MediShelf AI computer vision classification pipeline.

---

## 1. Dataset Provenance & Attribution

* **Primary Source**: **U.S. National Library of Medicine (NLM) / National Institutes of Health (NIH)** via the official [DailyMed SPL Media Archive](https://dailymed.nlm.nih.gov/dailymed/).
* **Content Nature**: Authentic packaging carton photos, unit dose blister packs, bottles, and injection vials submitted under FDA Structured Product Labeling (SPL) regulations.
* **License**: **U.S. Public Domain / National Library of Medicine Terms of Service**. Works of the U.S. Federal Government and official SPL submissions are not subject to copyright in the United States.
* **Ethics & Anti-Fabrication Rule**: In strict compliance with research guidelines, **no fake or synthetic images are generated**. Classes without sufficient high-resolution packaging scans are transparently documented as coverage gaps rather than fabricated.

---

## 2. Directory Layout & Anti-Leakage Partitioning

```text
ml/datasets/
├── raw/                # Unaltered source packaging images by class
│   ├── paracetamol_500mg_tablet/
│   ├── amoxicillin_500mg_capsule/
│   ├── ibuprofen_400mg_tablet/
│   ├── metformin_500mg_tablet/
│   ├── atorvastatin_20mg_tablet/
│   ├── omeprazole_20mg_capsule/
│   ├── ciprofloxacin_500mg_tablet/
│   ├── cetirizine_10mg_tablet/
│   ├── losartan_50mg_tablet/
│   └── humulin_r_100u_vial/
├── train/              # 70% Training split with realistic data augmentation
├── val/                # 15% Validation split (checkpoint selection)
└── test/               # 15% Isolated Test split (held out for final evaluation)
```

### Partitioning Methodology
- **Anti-Leakage Grouping**: Multiple angle scans and resolutions of the exact same packaging unit from a single SPL submission are assigned atomically to the same partition.
- The **Test set (`test/`)** is kept completely unobserved during training and hyperparameter tuning.

---

## 3. Class Coverage & Documented Gaps

### Active Core CV Training Classes (Initial Phase 3 Target)
1. `paracetamol_500mg_tablet` (Acetaminophen, e.g. Tylenol / Panadol)
2. `amoxicillin_500mg_capsule` (Amoxicillin, e.g. Amoxil)
3. `augmentin_875_125mg_tablet` (Amoxicillin & Clavulanate Potassium)
4. `metformin_500mg_tablet` (Metformin HCl, e.g. Glucophage)
5. `atorvastatin_20mg_tablet` (Atorvastatin Calcium, e.g. Lipitor)
6. `omeprazole_20mg_capsule` (Omeprazole, e.g. Prilosec)
7. `ciprofloxacin_500mg_tablet` (Ciprofloxacin HCl, e.g. Cipro)
8. `ibuprofen_400mg_tablet` (Ibuprofen, e.g. Motrin / Advil)
9. `cetirizine_10mg_tablet` (Cetirizine HCl, e.g. Zyrtec)
10. `losartan_50mg_tablet` (Losartan Potassium, e.g. Cozaar)
11. `humulin_r_100u_vial` (Regular Insulin, e.g. Humulin R)
12. `hydrochlorothiazide_25mg_tablet` (Hydrochlorothiazide, e.g. Microzide)

### Documented Coverage Gap
The remaining SKUs in the 25-medicine catalog (`MED-012`, `MED-013`, `MED-015`, `MED-016`, `MED-017`, `MED-018`, `MED-019`, `MED-020`, `MED-021`, `MED-022`, `MED-023`, `MED-024`) currently possess full database metadata and storage specifications, but their packaging image sets are awaiting physical multi-angle digitization. The classification pipeline transparently flags unrepresented classes and returns low-confidence manual search fallbacks.
