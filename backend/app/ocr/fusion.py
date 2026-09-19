from typing import List, Optional
from app.models.medicine import Medicine
from app.ocr.schemas import CandidateMatch, FusionAssessment, StructuredFields


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
    Does NOT claim clinical diagnosis; produces transparent agreement signals.
    """
    reasons: List[str] = []
    ocr_name = ocr_fields.medicine_name.value
    ocr_strength = ocr_fields.strength.value

    # Check if OCR matches the CV class's medicine
    name_agrees = False
    strength_agrees = False

    if matched_medicine:
        # Check name agreement
        if ocr_name:
            if (
                ocr_name.lower() == matched_medicine.medicine_name.lower()
                or (ocr_fields.generic_name.value and ocr_fields.generic_name.value.lower() == matched_medicine.generic_name.lower())
            ):
                name_agrees = True
            elif candidate_matches and candidate_matches[0].medicine_id == matched_medicine.medicine_id:
                name_agrees = True

        # Check strength agreement
        if ocr_strength:
            norm_ocr_str = ocr_strength.lower().replace(" ", "")
            norm_db_str = matched_medicine.strength.lower().replace(" ", "")
            if norm_ocr_str in norm_db_str or norm_db_str in norm_ocr_str:
                strength_agrees = True

    # 1. Check for DIVERGENT status
    if (
        cv_confidence >= cv_threshold
        and candidate_matches
        and candidate_matches[0].similarity_score >= 0.85
        and matched_medicine
        and candidate_matches[0].medicine_id != matched_medicine.medicine_id
    ):
        reasons.append(
            f"Divergence detected: Visual model predicted '{matched_medicine.medicine_name}', "
            f"but packaging text explicitly matches '{candidate_matches[0].medicine_name}'."
        )
        return FusionAssessment(
            identification_status="DIVERGENT",
            agreement_score=round(float(abs(cv_confidence - candidate_matches[0].similarity_score)), 4),
            cv_prediction=cv_class,
            ocr_match=candidate_matches[0].medicine_name,
            strength_match=strength_agrees,
            reasons=reasons,
        )

    # 2. Check for CONFIRMED status
    if cv_confidence >= cv_threshold and (name_agrees or (strength_agrees and cv_confidence >= 0.70)):
        if name_agrees:
            reasons.append(
                f"Identification evidence is consistent: Computer-vision prediction and OCR packaging text both corroborate '{matched_medicine.medicine_name}'."
            )
        if strength_agrees:
            reasons.append(f"Packaging dosage strength '{ocr_strength}' matches catalog specification.")
        if ocr_fields.expiry_date.value:
            reasons.append(f"Packaging expiration date detected: {ocr_fields.expiry_date.value}.")

        agreement_score = round(float((cv_confidence + 0.90) / 2.0), 4)
        return FusionAssessment(
            identification_status="CONFIRMED",
            agreement_score=min(agreement_score, 0.98),
            cv_prediction=cv_class,
            ocr_match=ocr_name or (matched_medicine.medicine_name if matched_medicine else None),
            strength_match=strength_agrees,
            reasons=reasons,
        )

    # 3. Check for PARTIAL status
    if cv_confidence >= 0.45 or (candidate_matches and candidate_matches[0].similarity_score >= 0.75):
        if cv_confidence >= cv_threshold and not name_agrees:
            reasons.append(
                f"Visual appearance strongly suggests '{matched_medicine.medicine_name if matched_medicine else cv_class}', "
                "but packaging text could not independently confirm active ingredient title."
            )
        elif candidate_matches and candidate_matches[0].similarity_score >= 0.75:
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
            ocr_match=ocr_name or (candidate_matches[0].medicine_name if candidate_matches else None),
            strength_match=strength_agrees,
            reasons=reasons,
        )

    # 4. UNCONFIRMED fallback
    reasons.append(
        "Neither computer vision nor OCR could decisively confirm medicine identity. "
        "Please ensure packaging is well-lit, clearly oriented, and within supported classes."
    )
    return FusionAssessment(
        identification_status="UNCONFIRMED",
        agreement_score=round(float(cv_confidence * 0.5), 4),
        cv_prediction=cv_class,
        ocr_match=ocr_name,
        strength_match=strength_agrees,
        reasons=reasons,
    )
