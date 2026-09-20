import re
from typing import List, Optional
from app.models.medicine import Medicine
from app.ocr.schemas import CandidateMatch, FusionAssessment, StructuredFields


def normalize_strength(s: Optional[str]) -> Optional[str]:
    """
    Normalizes pharmaceutical strength strings so equivalent representations can be reliably compared:
    - '500 mg', '500mg', '500 MG' -> '500 mg'
    - '160 mg/5 mL' -> '160 mg / 5 ml'
    - '875 mg / 125 mg' -> '875 mg / 125 mg'
    - '100 U/mL', '100 IU/mL' -> '100 u / ml'
    Does NOT equate differing strengths (e.g. '500 mg' != '160 mg')
    and does NOT equate concentrations to unit doses (e.g. '100 mg/5 mL' != '100 mg').
    """
    if not s:
        return None
    cleaned = s.lower().strip()
    # Normalize slash and plus spacing
    cleaned = re.sub(r"\s*([/|+])\s*", r" \1 ", cleaned)
    # Ensure space between numbers and unit letters (e.g. "500mg" -> "500 mg", "5ml" -> "5 ml")
    cleaned = re.sub(r"(\d+(?:\.\d+)?)\s*([a-z]+)", r"\1 \2", cleaned)
    # Unit normalization: iu -> u
    cleaned = re.sub(r"\biu\b", "u", cleaned)
    # Collapse multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def normalize_dosage_form(f: Optional[str]) -> Optional[str]:
    """
    Normalizes pharmaceutical dosage forms for robust categorical comparison:
    - 'Tablet', 'Tablets', 'tab', 'Film-coated tablet' -> 'tablet'
    - 'Capsule', 'Capsules', 'cap', 'Delayed-Release Capsule' -> 'capsule'
    - 'Oral Suspension', 'Suspension' -> 'suspension'
    - 'Subcutaneous Injection', 'Injection', 'Vial' -> 'injection'
    - 'Inhalation Aerosol', 'Inhaler' -> 'inhaler'
    - 'Nasal Spray Suspension', 'Nasal Spray' -> 'nasal spray'
    - 'Solution', 'Syrup' -> 'solution'
    - 'Topical', 'Cream', 'Ointment' -> 'topical'
    Does NOT equate incompatible dosage forms (e.g. 'tablet' != 'suspension').
    """
    if not f:
        return None
    form = f.lower().strip()
    if "tablet" in form or re.search(r"\btabs?\b", form) or "caplet" in form:
        return "tablet"
    if "capsule" in form or re.search(r"\bcaps?\b", form):
        return "capsule"
    if "suspension" in form:
        return "suspension"
    if "injection" in form or "vial" in form or "subcutaneous" in form:
        return "injection"
    if "inhal" in form or "aerosol" in form:
        return "inhaler"
    if "nasal" in form or "spray" in form:
        return "nasal spray"
    if "solution" in form or "syrup" in form or "elixir" in form:
        return "solution"
    if "cream" in form or "ointment" in form or "gel" in form:
        return "topical"
    return form


def compute_cv_ocr_fusion(
    cv_class: str,
    cv_confidence: float,
    cv_threshold: float,
    ocr_fields: StructuredFields,
    candidate_matches: List[CandidateMatch],
    matched_medicine: Optional[Medicine] = None,
) -> FusionAssessment:
    """
    Computes a deterministic, explainable multi-modal fusion assessment
    combining visual computer vision classification with optical text extraction.
    Strictly evaluates active ingredient, strength, and dosage form alignment.
    Does NOT produce medical or clinical safety claims; evaluates identification evidence only.
    """
    reasons: List[str] = []
    ocr_name = ocr_fields.medicine_name.value
    ocr_generic = ocr_fields.generic_name.value
    ocr_strength = ocr_fields.strength.value
    ocr_dosage_form = getattr(ocr_fields, "dosage_form", None)
    ocr_df_val = ocr_dosage_form.value if ocr_dosage_form else None

    # Step 1: Active Ingredient / Medicine Identity Corroboration
    name_agrees = False
    generic_agrees = False
    best_ocr_title = ocr_name

    if matched_medicine:
        db_med_name = matched_medicine.medicine_name.lower()
        db_gen_name = matched_medicine.generic_name.lower()
        db_brand_names = [
            b.strip().lower() for b in (matched_medicine.brand_name or "").split("/") if b.strip()
        ]

        # Direct token checks against OCR fields
        for val in [ocr_name, ocr_generic]:
            if not val:
                continue
            v_lower = val.lower().strip()
            # Direct name/generic/brand substring matches
            if (
                v_lower in db_med_name
                or db_med_name in v_lower
                or v_lower in db_gen_name
                or db_gen_name in v_lower
                or any(b in v_lower or v_lower in b for b in db_brand_names)
                or (v_lower == "paracetamol" and "acetaminophen" in db_gen_name)
                or (v_lower == "acetaminophen" and "paracetamol" in db_med_name)
            ):
                name_agrees = True
                generic_agrees = True
                break

        # Check candidate matches if field values did not match directly
        if not name_agrees and candidate_matches:
            top_cand = candidate_matches[0]
            cand_gen = top_cand.generic_name.lower()
            cand_med = top_cand.medicine_name.lower()
            if (
                top_cand.medicine_id == matched_medicine.medicine_id
                or cand_gen == db_gen_name
                or cand_med == db_med_name
                or (cand_gen == "acetaminophen" and "paracetamol" in db_med_name)
                or (cand_gen == "paracetamol" and "acetaminophen" in db_gen_name)
            ):
                name_agrees = True
                generic_agrees = True
                if not best_ocr_title:
                    best_ocr_title = top_cand.medicine_name

    # Step 2: Strength Comparison (Strict Normalized Equality)
    strength_evaluated = False
    strength_agrees = False
    if matched_medicine and ocr_strength:
        strength_evaluated = True
        norm_ocr_str = normalize_strength(ocr_strength)
        norm_db_str = normalize_strength(matched_medicine.strength)
        if norm_ocr_str and norm_db_str and norm_ocr_str == norm_db_str:
            strength_agrees = True

    # Step 3: Dosage Form Comparison (Strict Normalized Equality)
    dosage_form_evaluated = False
    dosage_form_agrees = False
    if matched_medicine and ocr_df_val:
        dosage_form_evaluated = True
        norm_ocr_df = normalize_dosage_form(ocr_df_val)
        norm_db_df = normalize_dosage_form(matched_medicine.dosage_form)
        if norm_ocr_df and norm_db_df and norm_ocr_df == norm_db_df:
            dosage_form_agrees = True

    # Step 4: Check for DIVERGENT status
    # Visual classifier is confident, but OCR text decisively matches a different medicine
    if (
        cv_confidence >= cv_threshold
        and candidate_matches
        and candidate_matches[0].similarity_score >= 0.75
        and matched_medicine
        and not name_agrees
        and not generic_agrees
    ):
        reasons.append(
            f"Divergence detected: CV and OCR identification disagree. Visual model suggested '{matched_medicine.medicine_name}', "
            f"but packaging text indicates '{candidate_matches[0].medicine_name}'."
        )
        return FusionAssessment(
            identification_status="DIVERGENT",
            agreement_score=round(float(abs(cv_confidence - candidate_matches[0].similarity_score)), 4),
            cv_prediction=cv_class,
            ocr_match=candidate_matches[0].medicine_name,
            strength_match=strength_agrees,
            dosage_form_match=dosage_form_agrees if dosage_form_evaluated else None,
            reasons=reasons,
        )

    # Step 5: Check for CONFIRMED status
    # Requirements:
    # 1. cv_confidence >= cv_threshold
    # 2. Active ingredient identity corroborated (name_agrees)
    # 3. If strength was provided by OCR, it MUST match
    # 4. If dosage form was provided by OCR, it MUST match
    # 5. Evidence must not be incomplete (strength required if specified in catalog)
    if cv_confidence >= cv_threshold and name_agrees:
        # Negative check: Strength mismatch -> PARTIAL
        if strength_evaluated and not strength_agrees:
            reasons.append(
                f"Identification evidence is partially consistent: Active ingredient corroborated "
                f"('{best_ocr_title or ocr_name or (matched_medicine.medicine_name if matched_medicine else cv_class)}'), "
                f"but packaging strength '{ocr_strength}' differs from catalog specification '{matched_medicine.strength}'."
            )
            return FusionAssessment(
                identification_status="PARTIAL",
                agreement_score=round(float(cv_confidence * 0.70), 4),
                cv_prediction=cv_class,
                ocr_match=best_ocr_title or ocr_name or (matched_medicine.medicine_name if matched_medicine else None),
                strength_match=False,
                dosage_form_match=dosage_form_agrees if dosage_form_evaluated else None,
                reasons=reasons,
            )

        # Negative check: Dosage form mismatch -> PARTIAL
        if dosage_form_evaluated and not dosage_form_agrees:
            reasons.append(
                f"Identification evidence is partially consistent: Active ingredient and strength corroborated, "
                f"but packaging dosage form '{ocr_df_val}' differs from catalog specification '{matched_medicine.dosage_form}'."
            )
            return FusionAssessment(
                identification_status="PARTIAL",
                agreement_score=round(float(cv_confidence * 0.75), 4),
                cv_prediction=cv_class,
                ocr_match=best_ocr_title or ocr_name or (matched_medicine.medicine_name if matched_medicine else None),
                strength_match=strength_agrees,
                dosage_form_match=False,
                reasons=reasons,
            )

        # Positive corroboration: Strength agrees (or high-confidence visual confirmation when strength was not extracted)
        if strength_agrees or (not strength_evaluated and cv_confidence >= 0.85):
            reasons.append(
                f"Identification evidence is consistent: Computer-vision prediction and OCR packaging text both corroborate '{matched_medicine.medicine_name}'."
            )
            if strength_agrees:
                reasons.append(f"Packaging dosage strength '{ocr_strength}' matches catalog specification.")
            if dosage_form_agrees:
                reasons.append(f"Packaging dosage form '{ocr_df_val}' matches catalog specification.")
            if ocr_fields.expiry_date.value:
                reasons.append(f"Packaging expiration date detected: {ocr_fields.expiry_date.value}.")

            agreement_score = round(float((cv_confidence + 0.90) / 2.0), 4)
            return FusionAssessment(
                identification_status="CONFIRMED",
                agreement_score=min(agreement_score, 0.98),
                cv_prediction=cv_class,
                ocr_match=best_ocr_title or ocr_name or (matched_medicine.medicine_name if matched_medicine else None),
                strength_match=strength_agrees,
                dosage_form_match=dosage_form_agrees if dosage_form_evaluated else None,
                reasons=reasons,
            )

    # Step 6: Check for PARTIAL status
    # Used when identity agrees but details are incomplete, or moderate confidence without text corroboration
    if cv_confidence >= 0.45 or (candidate_matches and candidate_matches[0].similarity_score >= 0.70) or name_agrees:
        if name_agrees and not strength_evaluated:
            reasons.append(
                f"Identification evidence is partially consistent: Active ingredient corroborated "
                f"('{best_ocr_title or ocr_name or (matched_medicine.medicine_name if matched_medicine else cv_class)}'), "
                "but packaging dosage strength was not detected on label."
            )
        elif cv_confidence >= cv_threshold and not name_agrees:
            reasons.append(
                f"Visual appearance suggests '{matched_medicine.medicine_name if matched_medicine else cv_class}', "
                "but packaging text could not independently confirm active ingredient title."
            )
        elif candidate_matches and candidate_matches[0].similarity_score >= 0.70:
            reasons.append(
                f"OCR matched '{candidate_matches[0].medicine_name}' from packaging text, "
                f"while visual classifier reported moderate confidence ({cv_confidence * 100:.1f}%)."
            )
        if strength_agrees:
            reasons.append(f"Packaging strength '{ocr_strength}' matches catalog specification.")

        return FusionAssessment(
            identification_status="PARTIAL",
            agreement_score=round(float(cv_confidence * 0.75), 4),
            cv_prediction=cv_class,
            ocr_match=best_ocr_title or ocr_name or (candidate_matches[0].medicine_name if candidate_matches else None),
            strength_match=strength_agrees,
            dosage_form_match=dosage_form_agrees if dosage_form_evaluated else None,
            reasons=reasons,
        )

    # Step 7: UNCONFIRMED fallback
    reasons.append(
        "Identification evidence is inconclusive: Neither computer vision nor OCR could decisively confirm medicine identity."
    )
    return FusionAssessment(
        identification_status="UNCONFIRMED",
        agreement_score=round(float(cv_confidence * 0.5), 4),
        cv_prediction=cv_class,
        ocr_match=best_ocr_title or ocr_name,
        strength_match=strength_agrees,
        dosage_form_match=None,
        reasons=reasons,
    )
