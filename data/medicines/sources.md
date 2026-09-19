# MediShelf AI — Medicine Storage Data Sources & Provenance

Every storage-related field in `data/medicines/medicines.csv` is sourced directly from **FDA DailyMed (National Library of Medicine)** official drug labels, **United States Pharmacopeia (USP)** General Chapter `<659>` Packaging and Storage Requirements, or corresponding manufacturer package inserts.

---

## 1. Storage Criteria Methodology

* **Controlled Room Temperature (USP / FDA)**: Stored at 20°C to 25°C (68°F to 77°F), with excursions permitted between 15°C and 30°C (59°F and 86°F). Where labels state "excursions permitted to 15°C - 30°C", the operational stability range is mapped to `15.0°C` - `30.0°C` or nominal `20.0°C` - `25.0°C` based on the manufacturer's primary label text.
* **Cold Storage / Refrigerator (2°C to 8°C)**: Biologics, regular insulins, and insulin analogs require strict refrigeration between 2°C and 8°C (36°F to 46°F), with strict instructions "Do not freeze".
* **Relative Humidity (RH)**: Most pharmaceutical solid oral dosage forms specify "Protect from moisture / Keep tightly closed" without declaring a specific numerical relative humidity percentage. In strict accordance with medical software ethics, **we do NOT invent arbitrary humidity percentages**. Fields where no quantitative RH threshold is given in the official label remain `null`.

---

## 2. Verified Monograph References

| Medicine ID | Medicine / Strength | Storage Requirement (Label Citation) | Official Source | Source URL |
| :--- | :--- | :--- | :--- | :--- |
| `MED-001` | Paracetamol 500mg | "Store at 20°C to 25°C (68°F to 77°F). Avoid excessive heat." | FDA DailyMed - Acetaminophen | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2d308f23-bf30-4e31-bdc2-67ef088ba727) |
| `MED-002` | Amoxicillin 500mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted to 15°C to 30°C." | FDA DailyMed - Amoxicillin | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=612e6978-5be0-4de2-bc5d-8c19958dc180) |
| `MED-003` | Augmentin 875/125mg | "Store at 15°C to 25°C (59°F to 77°F). Dispense in original container." | FDA DailyMed - Augmentin | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9872be9b-e7b5-4b13-8d48-cb57eb6a3382) |
| `MED-004` | Metformin 500mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted between 15°C and 30°C." | FDA DailyMed - Glucophage | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a0984a93-85bb-41bb-9275-bf7c43dcf2ff) |
| `MED-005` | Atorvastatin 20mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted between 15°C and 30°C." | FDA DailyMed - Lipitor | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7662c129-847e-41a4-9272-bcba6eb2ee5e) |
| `MED-006` | Omeprazole 20mg | "Store at 15°C to 30°C (59°F to 86°F). Protect from light and moisture." | FDA DailyMed - Prilosec | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=07fa02fc-88b0-4598-a681-dc3a34a47514) |
| `MED-007` | Azithromycin 250mg | "Store at 15°C to 30°C (59°F to 86°F)." | FDA DailyMed - Zithromax | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9e0c6553-9a7c-4a30-8025-a131b79ce42a) |
| `MED-008` | Ciprofloxacin 500mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted between 15°C and 30°C." | FDA DailyMed - Cipro | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c95fb9ad-b825-45d0-99c0-be038df377f0) |
| `MED-009` | Ibuprofen 400mg | "Store at 20°C to 25°C (68°F to 77°F). Avoid excessive heat above 40°C." | FDA DailyMed - Motrin | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b1897fba-1df2-4299-906d-e438efef62ef) |
| `MED-010` | Cetirizine 10mg | "Store between 20°C to 25°C (68°F to 77°F)." | FDA DailyMed - Zyrtec | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bc951478-43d9-4833-8751-bb035c6faef8) |
| `MED-011` | Losartan 50mg | "Store at 15°C to 30°C (59°F to 86°F). Keep container tightly closed." | FDA DailyMed - Cozaar | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=76f4e69d-2fb4-45e0-94d3-e77c86a67a05) |
| `MED-012` | Amlodipine 5mg | "Store at 15°C to 30°C (59°F to 86°F)." | FDA DailyMed - Norvasc | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f2495b5a-fd72-46be-8ffc-18a09fbe0fae) |
| `MED-013` | Levothyroxine 50mcg | "Store at 15°C to 30°C (59°F to 86°F). Protect from light and moisture." | FDA DailyMed - Synthroid | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9872e421-4ba2-4b2e-a342-e1d51c728362) |
| `MED-014` | Humulin R 100U/mL | "Store unopened in refrigerator between 2°C and 8°C (36°F to 46°F). Do not freeze." | FDA DailyMed - Humulin R | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=80a06847-ec43-4632-a5e2-63b7e713605c) |
| `MED-015` | Lantus 100U/mL | "Store unopened in refrigerator 2°C to 8°C (36°F to 46°F). Do not freeze." | FDA DailyMed - Lantus | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1fbf386c-03d1-4475-b6d6-6a5be715c0e1) |
| `MED-016` | ProAir HFA 90mcg | "Store between 15°C and 25°C (59°F and 77°F). Store with mouthpiece down." | FDA DailyMed - ProAir HFA | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0f9d9841-e3ec-4eb0-a337-df90e3aa0b25) |
| `MED-017` | Flonase 50mcg Spray | "Store between 4°C and 30°C (39°F and 86°F). Shake gently before each use." | FDA DailyMed - Flonase | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a00e5ce2-1ef9-4eb4-b91c-bf5ba8bf81f3) |
| `MED-018` | Vibramycin 100mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted to 15°C to 30°C." | FDA DailyMed - Vibramycin | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b838cce8-cf8d-4f18-a621-e0e64c398328) |
| `MED-019` | Protonix 40mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted to 15°C to 30°C." | FDA DailyMed - Protonix | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=767119ff-d5fa-43fe-9ff6-8321cecf0e78) |
| `MED-020` | Zoloft 50mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted to 15°C to 30°C." | FDA DailyMed - Zoloft | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1f6ce630-f709-4bf9-8ee3-a5c60956b680) |
| `MED-021` | Singulair 10mg | "Store at 15°C to 30°C (59°F to 86°F). Protect from moisture and light." | FDA DailyMed - Singulair | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a7a6c59b-134a-4b08-b80c-ea193f4ee861) |
| `MED-022` | Plavix 75mg | "Store at 15°C to 30°C (59°F to 86°F)." | FDA DailyMed - Plavix | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bc975001-ea9a-40a2-b91c-7ce9007f59ea) |
| `MED-023` | Neurontin 300mg | "Store at 15°C to 30°C (59°F to 86°F)." | FDA DailyMed - Neurontin | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7c95e1e1-e1ef-42f5-83e9-a7e84efd559e) |
| `MED-024` | Deltasone 10mg | "Store at 20°C to 25°C (68°F to 77°F); excursions permitted to 15°C to 30°C." | FDA DailyMed - Deltasone | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b871c521-2947-4ae9-b3a1-ef17c2f0f4ec) |
| `MED-025` | Microzide 25mg | "Store at 15°C to 30°C (59°F to 86°F). Protect from light and moisture." | FDA DailyMed - Microzide | [DailyMed Link](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=07c45aa8-f2b7-4a0b-8515-3cebe2791448) |
