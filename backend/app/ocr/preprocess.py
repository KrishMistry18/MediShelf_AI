from typing import Tuple, List, Union
import cv2
import numpy as np
from PIL import Image

from app.ocr.schemas import ImageQualityAssessment

# Quality Thresholds
MIN_RESOLUTION = 64
BLUR_THRESHOLD = 45.0  # Variance of Laplacian below this indicates excessive blur
DARKNESS_THRESHOLD = 38.0  # Mean grayscale brightness below this indicates underexposure
BRIGHTNESS_THRESHOLD = 238.0  # Mean grayscale brightness above this indicates overexposure
MAX_OCR_DIMENSION = 1280  # Rescale images larger than this to optimize CPU OCR latency


def assess_image_quality(image: Union[Image.Image, np.ndarray]) -> ImageQualityAssessment:
    """
    Evaluates image clarity, resolution, exposure, and blur before running OCR.
    Provides clear, actionable guidance if the image is degraded.
    """
    if isinstance(image, Image.Image):
        # Convert PIL to OpenCV BGR
        pil_rgb = image.convert("RGB")
        cv_img = cv2.cvtColor(np.array(pil_rgb), cv2.COLOR_RGB2BGR)
    else:
        cv_img = image

    h, w = cv_img.shape[:2]
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 1. Blur Detection using Laplacian Variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = float(laplacian.var())

    # 2. Exposure Check using Mean Grayscale Intensity
    mean_brightness = float(np.mean(gray))

    issues: List[str] = []
    recommendations: List[str] = []

    if w < MIN_RESOLUTION or h < MIN_RESOLUTION:
        issues.append(f"Image resolution ({w}x{h}) is too small for reliable text detection.")
        recommendations.append("Move closer to the medicine packaging to capture higher detail.")

    if blur_score < BLUR_THRESHOLD:
        issues.append(f"Excessive motion or lens blur detected (sharpness score: {blur_score:.1f} < {BLUR_THRESHOLD}).")
        recommendations.append("Hold your mobile camera steady or tap to refocus on packaging text.")

    if mean_brightness < DARKNESS_THRESHOLD:
        issues.append(f"Packaging image is severely underexposed (mean brightness: {mean_brightness:.1f} < {DARKNESS_THRESHOLD}).")
        recommendations.append("Increase ambient lighting or enable camera flash.")
    elif mean_brightness > BRIGHTNESS_THRESHOLD:
        issues.append(f"Packaging image is severely overexposed/glared (mean brightness: {mean_brightness:.1f} > {BRIGHTNESS_THRESHOLD}).")
        recommendations.append("Avoid direct reflective glare from packaging blister packs.")

    is_acceptable = len(issues) == 0

    return ImageQualityAssessment(
        is_acceptable=is_acceptable,
        blur_score=round(blur_score, 2),
        mean_brightness=round(mean_brightness, 2),
        width=w,
        height=h,
        resolution=f"{w}x{h}",
        issues=issues,
        recommendations=recommendations,
    )


def preprocess_for_ocr(image: Union[Image.Image, np.ndarray]) -> np.ndarray:
    """
    Preprocesses medicine packaging image for optimal optical character recognition:
    - Scales excessively large dimensions down to MAX_OCR_DIMENSION (preserves text while cutting CPU runtime)
    - Applies Contrast Limited Adaptive Histogram Equalization (CLAHE) to boost subtle label typography
    - Returns standardized uint8 RGB / BGR image for EasyOCR
    """
    if isinstance(image, Image.Image):
        pil_rgb = image.convert("RGB")
        cv_img = cv2.cvtColor(np.array(pil_rgb), cv2.COLOR_RGB2BGR)
    else:
        cv_img = image.copy()

    h, w = cv_img.shape[:2]

    # Rescale if overly large to prevent CPU bottleneck
    max_dim = max(h, w)
    if max_dim > MAX_OCR_DIMENSION:
        scale = MAX_OCR_DIMENSION / float(max_dim)
        new_w = int(w * scale)
        new_h = int(h * scale)
        cv_img = cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Convert to LAB color space to apply CLAHE only on the Luminance (L) channel
    lab = cv2.cvtColor(cv_img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    enhanced_lab = cv2.merge((cl, a, b))
    enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

    # Return RGB for EasyOCR reader
    enhanced_rgb = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2RGB)
    return enhanced_rgb
