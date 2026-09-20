"""
End-to-end smoke test against a running backend.

Exercises every endpoint the frontend depends on with real inputs and prints what came
back, so a failure points at the endpoint rather than at the UI.

    python tools/serve_api.py --no-reload      # in one shell
    python tools/smoke_api.py                  # in another

Exit code is 0 only if every check passed.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLES = PROJECT_ROOT / "public" / "samples"
TEST_IMAGES = PROJECT_ROOT / "ml" / "datasets" / "test"

failures: List[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail else ""))
    if not condition:
        failures.append(label)


def section(title: str) -> None:
    print()
    print("=" * 74)
    print(title)
    print("=" * 74)


def truncate(text: str, limit: int = 160) -> str:
    flat = " ".join(str(text).split())
    return flat if len(flat) <= limit else flat[:limit] + "…"


def test_health(client: httpx.Client) -> None:
    section("GET /api/health")
    response = client.get("/api/health")
    check("HTTP 200", response.status_code == 200, f"status {response.status_code}")
    body = response.json()
    print(f"  status={body.get('status')} database={body.get('database')} version={body.get('version')}")
    check("service healthy", body.get("status") == "healthy")
    check("database connected", body.get("database") == "connected")


def test_medicines(client: httpx.Client) -> None:
    section("GET /api/medicines")
    response = client.get("/api/medicines", params={"page": 1, "page_size": 100})
    check("HTTP 200", response.status_code == 200, f"status {response.status_code}")
    body = response.json()
    print(f"  total={body['total']} returned={len(body['items'])}")
    check("catalog seeded with 25 monographs", body["total"] == 25, f"got {body['total']}")

    required = {
        "medicine_id", "medicine_name", "generic_name", "strength", "dosage_form",
        "category", "storage_min_temperature", "storage_max_temperature",
        "image_class", "source", "source_url", "expiry_warning_days",
    }
    first = body["items"][0]
    check("item carries every field the UI renders", required.issubset(first), f"missing {required - set(first)}")

    cold_chain = [m for m in body["items"] if m["storage_max_temperature"] <= 8]
    print(f"  cold-chain products (max <= 8C): {[m['medicine_id'] for m in cold_chain]}")
    check("cold-chain products present", len(cold_chain) > 0)

    response = client.get("/api/medicines/categories")
    check("categories HTTP 200", response.status_code == 200)
    print(f"  distinct categories: {len(response.json())}")

    response = client.get("/api/medicines/search", params={"q": "insulin", "limit": 10})
    check("search HTTP 200", response.status_code == 200)
    hits = response.json()
    print(f"  search 'insulin' -> {[m['medicine_id'] for m in hits]}")
    check("search returns matches", len(hits) > 0)

    response = client.get("/api/medicines/MED-001")
    check("single lookup HTTP 200", response.status_code == 200)
    print(f"  MED-001 -> {response.json().get('medicine_name')}")

    response = client.get("/api/medicines/MED-999")
    check("unknown id returns 404", response.status_code == 404, f"status {response.status_code}")


def test_scan(client: httpx.Client) -> Dict[str, Any]:
    section("POST /api/scan")

    images: List[Path] = []
    if TEST_IMAGES.exists():
        images = sorted(TEST_IMAGES.glob("*/*.jpg"))
    if not images and SAMPLES.exists():
        images = sorted(SAMPLES.glob("*.jpg"))

    if not images:
        check("sample images available", False, "no images found")
        return {}

    correct = 0
    evaluated = 0
    last: Dict[str, Any] = {}

    for image_path in images:
        expected_class = image_path.parent.name if image_path.parent.parent.name == "test" else None
        with image_path.open("rb") as handle:
            response = client.post(
                "/api/scan",
                files={"file": (image_path.name, handle, "image/jpeg")},
                timeout=180.0,
            )
        if response.status_code != 200:
            check(f"scan {image_path.name}", False, f"status {response.status_code} {truncate(response.text)}")
            continue

        body = response.json()
        last = body
        predicted = body["predicted_class"]
        confidence = body["confidence"]
        verdict = ""
        if expected_class:
            evaluated += 1
            hit = predicted == expected_class
            correct += int(hit)
            verdict = "  correct" if hit else f"  WRONG (expected {expected_class})"

        print(
            f"  {image_path.name:<14} -> {predicted:<28} {confidence:.2f} "
            f"confident={str(body['is_confident']):<5} fusion={body['fusion']['identification_status']:<12}"
            f"ocr={body['ocr_status']}{verdict}"
        )

    if evaluated:
        print(f"\n  live top-1 accuracy over the held-out split: {correct}/{evaluated} = {correct / evaluated:.2f}")

    if last:
        print("\n  Last response detail")
        print(f"    quality      : acceptable={last['quality']['is_acceptable']} "
              f"blur={last['quality']['blur_score']} brightness={last['quality']['mean_brightness']} "
              f"res={last['quality']['resolution']}")
        print(f"    ocr status   : {last['ocr_status']} (engine {last['ocr']['engine']})")
        print(f"    ocr raw text : {truncate(last['ocr']['raw_text']) or '(empty)'}")
        fields = last["ocr"]["fields"]
        for name in ("medicine_name", "strength", "batch_number", "expiry_date", "manufacturer"):
            value = fields.get(name, {}).get("value")
            if value:
                print(f"    field {name:<14}: {value}")
        print(f"    candidates   : {[c['medicine_name'] for c in last['ocr']['candidate_matches']]}")
        print(f"    fusion       : {last['fusion']['identification_status']} "
              f"agreement={last['fusion']['agreement_score']}")
        for reason in last["fusion"]["reasons"][:4]:
            print(f"      - {truncate(reason, 120)}")
        print(f"    medicine     : {(last.get('medicine') or {}).get('medicine_name')}")
        print(f"    latency      : {last['inference_time_ms']} ms")
        print(f"    message      : {truncate(last['message'], 220)}")

        check("scan returns top-3 candidates", len(last["top_predictions"]) == 3,
              f"got {len(last['top_predictions'])}")
        check("quality metrics computed", last["quality"]["blur_score"] > 0)
        check("ocr_status is a known value",
              last["ocr_status"] in {"completed", "skipped_low_quality", "unavailable"},
              last["ocr_status"])

    section("POST /api/scan — rejection paths")
    response = client.post("/api/scan", files={"file": ("empty.jpg", b"", "image/jpeg")})
    check("empty upload returns 400", response.status_code == 400, f"status {response.status_code}")

    response = client.post("/api/scan", files={"file": ("notes.txt", b"hello", "text/plain")})
    check("wrong MIME type returns 415", response.status_code == 415, f"status {response.status_code}")

    response = client.post("/api/scan", files={"file": ("broken.jpg", b"not-an-image", "image/jpeg")})
    check("corrupt image returns 422", response.status_code == 422, f"status {response.status_code}")

    return last


def test_storage_risk(client: httpx.Client) -> None:
    section("GET /api/v1/storage-risk/metadata")
    response = client.get("/api/v1/storage-risk/metadata")
    check("HTTP 200", response.status_code == 200, f"status {response.status_code}")
    meta = response.json()
    print(f"  {meta['algorithm']} {meta['model_version']} — {len(meta['features'])} features, "
          f"classes {meta['target_classes']}")
    check("15 features exposed", len(meta["features"]) == 15, f"got {len(meta['features'])}")

    section("POST /api/v1/storage-risk/predict")
    scenarios = [
        ("Paracetamol 22C in range, no excursion", {
            "medicine_id": "MED-001", "current_temperature": 22.0, "current_humidity": 45.0,
            "excursion_duration_hours": 0.0, "days_to_expiry": 400}, True, "LOW"),
        ("Paracetamol 27C for 3h — out of range, brief", {
            "medicine_id": "MED-001", "current_temperature": 27.0, "current_humidity": 55.0,
            "excursion_duration_hours": 3.0, "days_to_expiry": 300}, False, None),
        ("Humulin R 9.2C for 3h — cold-chain breach, brief", {
            "medicine_id": "MED-014", "current_temperature": 9.2, "current_humidity": 50.0,
            "excursion_duration_hours": 3.0, "days_to_expiry": 180}, False, None),
        ("Humulin R 35C for 24h — severe heat", {
            "medicine_id": "MED-014", "current_temperature": 35.0, "current_humidity": 65.0,
            "excursion_duration_hours": 24.0, "days_to_expiry": 90}, False, "HIGH"),
        ("Humulin R -5C for 12h — frozen", {
            "medicine_id": "MED-014", "current_temperature": -5.0, "current_humidity": 50.0,
            "excursion_duration_hours": 12.0, "days_to_expiry": 120}, False, "HIGH"),
        ("Paracetamol in range, expiry date 2026-10", {
            "medicine_id": "MED-001", "current_temperature": 23.0, "current_humidity": 45.0,
            "excursion_duration_hours": 0.0, "expiry_date": "2026-10"}, True, None),
    ]

    for label, payload, expect_compliant, expect_level in scenarios:
        response = client.post("/api/v1/storage-risk/predict", json=payload)
        if response.status_code != 200:
            check(label, False, f"status {response.status_code} {truncate(response.text)}")
            continue

        body = response.json()
        compliance = body["deterministic_compliance"]
        risk = body["ml_risk"]
        probabilities = " ".join(f"{k} {v:.3f}" for k, v in risk["probabilities"].items())

        print(f"\n  {label}")
        print(f"    rule-based : compliant={compliance['is_compliant']} "
              f"temp_ok={compliance['temp_compliant']} deviation={compliance['temp_deviation']}C")
        print(f"    ml risk    : {risk['level']} (confidence {risk['confidence']:.3f}) | {probabilities}")
        print(f"    top factor : {risk['top_factors'][0]['feature']} = "
              f"{risk['top_factors'][0]['observed_value']} "
              f"(weight {risk['top_factors'][0]['importance_weight']:.4f})")
        print(f"    summary    : {truncate(compliance['summary'], 150)}")

        check(f"{label}: compliance verdict", compliance["is_compliant"] == expect_compliant,
              f"got {compliance['is_compliant']}")
        if expect_level:
            check(f"{label}: risk level {expect_level}", risk["level"] == expect_level, f"got {risk['level']}")
        check(f"{label}: probabilities sum to 1",
              abs(sum(risk["probabilities"].values()) - 1.0) < 1e-3)
        check(f"{label}: 5 explainability factors", len(risk["top_factors"]) == 5,
              f"got {len(risk['top_factors'])}")

    print()
    response = client.post("/api/v1/storage-risk/predict",
                           json={"medicine_id": "MED-999", "current_temperature": 22.0,
                                 "excursion_duration_hours": 0.0})
    check("unknown medicine returns 404", response.status_code == 404, f"status {response.status_code}")

    response = client.post("/api/v1/storage-risk/predict",
                           json={"medicine_id": "MED-001", "current_temperature": 500.0,
                                 "excursion_duration_hours": 0.0})
    check("out-of-range temperature returns 422", response.status_code == 422,
          f"status {response.status_code}")


def test_models(client: httpx.Client) -> None:
    section("GET /api/models")
    response = client.get("/api/models")
    check("HTTP 200", response.status_code == 200, f"status {response.status_code}")
    body = response.json()

    vision = body["vision"]
    risk = body["storage_risk"]

    print(f"  vision      : {vision['architecture']} — {vision['class_count']} classes, "
          f"{vision['image_size']}px, gate {vision['confidence_threshold']}")
    print(f"                top-1 {vision['test_metrics'].get('top1_accuracy')} / "
          f"top-3 {vision['test_metrics'].get('top3_accuracy')} on "
          f"{vision['test_metrics'].get('sample_count')} images")
    print(f"  storage risk: {risk['algorithm']} — accuracy "
          f"{risk['test_metrics'].get('accuracy')}, macro F1 {risk['test_metrics'].get('macro_f1')}, "
          f"{risk['dataset_samples']} scenarios")
    print(f"  verification report attached: {body['independent_verification'] is not None}")
    print(f"  limitations surfaced: {len(body['limitations'])}")
    for note in body["limitations"]:
        print(f"    - {truncate(note, 150)}")

    check("vision checkpoint available", vision["available"])
    check("vision class list populated", len(vision["class_names"]) == 10, f"got {len(vision['class_names'])}")
    check("vision training history present", len(vision["training_history"]) > 0)
    check("storage-risk artifact available", risk["available"])
    check("feature importances present", len(risk["feature_importances"]) == 15,
          f"got {len(risk['feature_importances'])}")
    check("candidate model comparison present", len(risk["validation_comparison"]) >= 3)
    check("limitations are generated", len(body["limitations"]) >= 3)
    check("disclaimer present", "not clinically validated" in body["disclaimer"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    print(f"Target: {args.base_url}")

    with httpx.Client(base_url=args.base_url, timeout=120.0) as client:
        try:
            client.get("/api/health")
        except httpx.ConnectError:
            print(f"\nCannot reach {args.base_url}. Start the backend first:\n"
                  f"  python tools/serve_api.py --no-reload", file=sys.stderr)
            return 1

        test_health(client)
        test_medicines(client)
        test_scan(client)
        test_storage_risk(client)
        test_models(client)

    section("Result")
    if failures:
        print(f"  {len(failures)} check(s) failed:")
        for name in failures:
            print(f"    - {name}")
        return 1

    print("  All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
