import io
import time
import threading
from typing import List, Optional, Tuple, Union
import numpy as np
from PIL import Image

from app.ocr.schemas import ImageQualityAssessment, OCRTextLine
from app.ocr.preprocess import assess_image_quality, preprocess_for_ocr


class OCRExtractor:
    """
    Production wrapper around EasyOCR 1.7.2 (CRAFT detector + CRNN deep learning recognition).
    Caches model in memory with thread-safe lazy initialization for CPU inference.
    Extracts detected text, OCR confidence, and polygon bounding box coordinates.
    """

    def __init__(self, languages: Optional[List[str]] = None):
        self.languages = languages or ["en"]
        self._reader = None
        self._lock = threading.Lock()

    @property
    def reader(self):
        with self._lock:
            if self._reader is None:
                import easyocr
                # Initialize reader in CPU mode with pre-downloaded weights (EasyOCR 1.7.2)
                self._reader = easyocr.Reader(self.languages, gpu=False, download_enabled=False)
            return self._reader

    def extract_text(
        self,
        image_input: Union[bytes, Image.Image, np.ndarray],
    ) -> Tuple[str, List[OCRTextLine], ImageQualityAssessment, float]:
        """
        Runs quality inspection, image optimization, and deep learning OCR text extraction.
        Returns:
            raw_text: Full concatenated text string
            lines: List of structured OCRTextLine objects with coordinates and confidences
            quality: Pre-OCR image quality assessment
            latency_ms: Processing time in milliseconds
        """
        start_time = time.perf_counter()

        # Convert bytes to PIL Image if needed
        if isinstance(image_input, (bytes, bytearray)):
            pil_image = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, Image.Image):
            pil_image = image_input
        elif isinstance(image_input, np.ndarray):
            pil_image = Image.fromarray(image_input)
        else:
            raise TypeError(f"Unsupported image input type: {type(image_input)}")

        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        # 1. Quality Assessment Gate
        quality = assess_image_quality(pil_image)

        # If image is clearly unusable, short-circuit to avoid unnecessary CPU OCR overhead
        if not quality.is_acceptable:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return "", [], quality, latency_ms

        # 2. Image Preprocessing for OCR (CLAHE + resizing)
        processed_rgb = preprocess_for_ocr(pil_image)

        # 3. EasyOCR Text Recognition
        ocr_results = self.reader.readtext(processed_rgb)

        lines: List[OCRTextLine] = []
        text_snippets: List[str] = []

        for bbox, text, conf in ocr_results:
            cleaned_text = str(text).strip()
            if not cleaned_text:
                continue

            # Convert bbox coordinates to integer list
            poly_coords = [[int(pt[0]), int(pt[1])] for pt in bbox]

            line_item = OCRTextLine(
                text=cleaned_text,
                confidence=round(float(conf), 4),
                bounding_box=poly_coords,
            )
            lines.append(line_item)
            text_snippets.append(cleaned_text)

        raw_text = "\n".join(text_snippets)
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return raw_text, lines, quality, latency_ms

    def extract(
        self,
        image_input: Union[bytes, Image.Image, np.ndarray],
    ) -> Tuple[str, List[OCRTextLine], ImageQualityAssessment, float]:
        """Convenience alias for extract_text."""
        return self.extract_text(image_input)


_extractor_instance: Optional[OCRExtractor] = None
_singleton_lock = threading.Lock()


def get_ocr_extractor() -> OCRExtractor:
    global _extractor_instance
    with _singleton_lock:
        if _extractor_instance is None:
            _extractor_instance = OCRExtractor()
        return _extractor_instance
