# MediShelf AI — Real Medicine Knowledge Sources & Data Provenance

This directory documents the public, verifiable pharmaceutical regulatory sources used to construct the open-world medicine knowledge index. Every record in the database retains explicit provenance to its originating monograph, ensuring complete scientific integrity, ethical adherence, and traceability.

---

## 1. Primary Sources & Regulatory Authorities

### A. U.S. National Library of Medicine (NLM) — RxNorm
- **Authority**: National Library of Medicine (NLM), National Institutes of Health (NIH).
- **Purpose in MediShelf AI**: Normalized clinical drug naming (Semantic Clinical Drug / SCD and Semantic Branded Drug / SBD), Concept Unique Identifiers (RxCUI), multi-ingredient composition mapping, and cross-terminology standardization.
- **Access Protocol**: Official NLM RxNav REST API (`https://rxnav.nlm.nih.gov/REST/`).
- **Licensing & Terms**: The RxNav API and core RxNorm drug naming datasets produced by the NLM are in the public domain and available free of charge. Proprietary vocabulary inclusions (such as SNOMED CT) are not required for clinical drug component retrieval.
- **Attribution**: *"RxNorm dataset and RxNav APIs courtesy of the National Library of Medicine (NLM), National Institutes of Health."*
- **Update Frequency**: Monthly releases with weekly interim updates.

### B. FDA DailyMed
- **Authority**: National Library of Medicine (NLM) in collaboration with the U.S. Food and Drug Administration (FDA).
- **Purpose in MediShelf AI**: Official Structured Product Labeling (SPL) monographs submitted by manufacturers, containing exact regulatory storage statements, package inserts, and NDC product links.
- **Access Protocol**: DailyMed Web API & Download Services (`https://dailymed.nlm.nih.gov/dailymed/`).
- **Licensing & Terms**: As a work of the United States Government (17 U.S.C. § 105), SPL data is in the public domain and free of copyright restrictions.
- **Attribution**: *"DailyMed drug label information is provided by the National Library of Medicine."*
- **Update Frequency**: Daily as new and revised SPL submissions are processed.

### C. openFDA (Drug Product & Labeling APIs)
- **Authority**: U.S. Food and Drug Administration (FDA).
- **Purpose in MediShelf AI**: Verifiable national drug code (NDC) packaging details, authorized manufacturer names, dosage routes, and verbatim storage and handling sections.
- **Access Protocol**: openFDA Public API (`https://api.fda.gov/drug/`).
- **Licensing & Terms**: Creative Commons CC0 1.0 Universal Public Domain Dedication.
- **Disclaimer**: Data from openFDA is provided for informational and educational purposes. Do not rely on openFDA to make clinical decisions regarding patient medical care without pharmacist or physician consultation.
- **Update Frequency**: Weekly sync from official FDA databases.

---

## 2. Ingestion & Provenance Schema

For every imported medicine product record, the following metadata fields are preserved:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `source_name` | String | Regulatory authority (`RxNorm`, `DailyMed`, `openFDA`, `USP`) |
| `source_identifier` | String | Official primary key (e.g. RxCUI `105267`, SPL Set ID, NDC `0069-3150`) |
| `source_url` | String | Direct verifiable URL to the public monograph |
| `source_version` | String | Dataset or API release version (e.g. `2026-09`) |
| `retrieved_at` | DateTime | Timestamp when record was ingested into local index |

---

## 3. Storage Criteria Ethics Policy

1. **No Hallucinated Parameters**: Minimum and maximum storage temperatures originate directly from approved package labels.
2. **Handling Humidity (% RH)**: When official labels state *"Protect from moisture"* without specifying a numerical relative humidity percentage, humidity fields remain strictly `null`. Numerical percentages are never invented.
3. **Combination Products**: Active ingredients and individual strengths are normalized as structured sets rather than flattened into a single arbitrary string.
