"""Evaluate an experimental checkpoint on an untouched external manifest.

This tool keeps model selection separate from the final test. It loads the
thresholds stored during validation and applies them unchanged; the test report
never rewrites the checkpoint or enables the website feature.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import time
from pathlib import Path

import torch
from PIL import Image
from appliance_model_training import (
    MODEL_LABELS, UNKNOWN_LABEL, make_model, transforms_for_training,
)
from appliance_ood_gate import gate_transforms, make_ood_gate


def parse_args() -> argparse.Namespace:
    """Require every evidence input so a stale local file is not guessed."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--audited-summary", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--gate-checkpoint", type=Path)
    parser.add_argument("--ensemble-calibration", type=Path)
    return parser.parse_args()


def sha256(path: Path) -> str:
    """Fingerprint the exact experimental checkpoint used by the report."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_model(checkpoint: dict, device: str):
    """Recreate the documented architecture without downloading new weights."""
    model = make_model(pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device).eval()
    return model


def load_gate(checkpoint: dict, device: str):
    """Recreate the optional lightweight supported-photo gate."""
    model = make_ood_gate(pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device).eval()
    return model


def crop_image(sample: dict) -> Image.Image:
    """Use a benchmark crop when supplied, otherwise evaluate the full image.

    Open Images scenes include a reviewed appliance bounding box, while the
    Amazon Berkeley Objects benchmark contains already-cropped catalogue
    photographs. Supporting both formats avoids silently inventing a crop for
    the independent catalogue test.
    """
    image = Image.open(sample["downloaded_jpeg"]).convert("RGB")
    crop = sample.get("expanded_crop_pixels")
    return image.crop(tuple(crop)) if crop else image


def predict(model, transform, image: Image.Image, calibration: dict,
            labels: list[str], device: str, gate=None, gate_transform=None,
            gate_calibration: dict | None = None) -> dict:
    """Return top scores and the unchanged validation-derived gate decision."""
    started = time.perf_counter()
    tensor = transform(image).unsqueeze(0).to(device)
    with torch.inference_mode():
        probability = torch.softmax(model(tensor), dim=1).squeeze(0).cpu()
    values, indices = torch.topk(probability, 3)
    predicted = int(indices[0])
    confidence = float(values[0])
    margin = float(values[0] - values[1])
    classifier_accepted = (
        labels[predicted] != UNKNOWN_LABEL
        and confidence >= calibration["min_confidence"]
        and margin >= calibration["min_margin"]
    )
    gate_probability = None
    gate_accepted = True
    if gate is not None:
        gate_tensor = gate_transform(image).unsqueeze(0).to(device)
        with torch.inference_mode():
            gate_probability = float(torch.sigmoid(gate(gate_tensor).squeeze()).cpu())
        gate_accepted = (
            gate_probability >= gate_calibration["min_supported_probability"]
        )
    return {
        "top_three": [
            {"label": labels[int(index)], "score": float(value)}
            for value, index in zip(values, indices)
        ],
        "predicted": labels[predicted],
        "confidence": confidence,
        "margin": margin,
        "classifier_accepted": classifier_accepted,
        "gate_probability": gate_probability,
        "gate_accepted": gate_accepted,
        "accepted": classifier_accepted and gate_accepted,
        "inference_ms": (time.perf_counter() - started) * 1000,
    }


def metrics(rows: list[dict], audited_ids: dict[str, str],
            audited_ood_ids: set[str]) -> dict:
    """Separate operationally audited positives from OOD false accepts."""
    positive = [row for row in rows if row["image_id"] in audited_ids]
    ood = [row for row in rows if row["image_id"] in audited_ood_ids]
    accepted_positive = [row for row in positive if row["accepted"]]
    correct_accepted = [row for row in accepted_positive if row["predicted"] == row["expected"]]
    false_ood = [row for row in ood if row["accepted"]]
    return {
        "audited_positive": {
            "n": len(positive),
            "top1_accuracy": sum(row["predicted"] == row["expected"] for row in positive) / len(positive) if positive else None,
            "coverage": len(accepted_positive) / len(positive) if positive else None,
            "selective_accuracy": len(correct_accepted) / len(accepted_positive) if accepted_positive else None,
            "wrong_accepts": [row for row in accepted_positive if row["predicted"] != row["expected"]],
        },
        "ood": {
            "n": len(ood),
            "false_accept_rate": len(false_ood) / len(ood) if ood else None,
            "false_accepts": false_ood,
        },
        "timing_ms": {
            "median": statistics.median(row["inference_ms"] for row in rows),
            "p95": sorted(row["inference_ms"] for row in rows)[max(0, int(len(rows) * 0.95) - 1)],
        },
    }


def main() -> None:
    """Apply locked validation thresholds and write a bounded test report."""
    args = parse_args()
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    if checkpoint.get("labels") != MODEL_LABELS:
        raise SystemExit("Checkpoint labels do not match the current experiment.")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    audit = json.loads(args.audited_summary.read_text(encoding="utf-8"))
    audited_ids = audit["audited_operational_positive_ids"]
    invalid_labels = sorted(set(audited_ids.values()) - set(MODEL_LABELS))
    if invalid_labels:
        raise SystemExit(f"Audit contains unknown model labels: {invalid_labels}")
    audited_ood_ids = set(audit.get("audited_ood_ids", []))
    if not audited_ood_ids:
        raise SystemExit("Audit must explicitly list reviewed OOD image IDs.")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = load_model(checkpoint, device)
    _, transform = transforms_for_training()
    gate_checkpoint = None
    gate = None
    gate_transform = None
    if args.gate_checkpoint:
        gate_checkpoint = torch.load(
            args.gate_checkpoint, map_location="cpu", weights_only=True
        )
        gate = load_gate(gate_checkpoint, device)
        _, gate_transform = gate_transforms()
    ensemble_calibration = None
    if args.ensemble_calibration:
        ensemble_calibration = json.loads(
            args.ensemble_calibration.read_text(encoding="utf-8")
        )
        if not gate_checkpoint:
            raise SystemExit("Ensemble calibration requires --gate-checkpoint.")
        gate_checkpoint = {
            **gate_checkpoint,
            "calibration": {
                **gate_checkpoint["calibration"],
                "min_supported_probability": ensemble_calibration[
                    "gate_threshold"
                ]["min_supported_probability"],
            },
        }
    rows = []
    for sample in manifest["samples"]:
        result = predict(
            model, transform, crop_image(sample), checkpoint["calibration"],
            checkpoint["labels"], device, gate, gate_transform,
            gate_checkpoint["calibration"] if gate_checkpoint else None,
        )
        rows.append({
            "image_id": sample["image_id"],
            "kind": sample["kind"],
            "expected": audited_ids.get(sample["image_id"]),
            "ood_class": sample.get("ood_class"),
            # The two benchmark builders use different field names, but both
            # retain the original public source URL for evidence and licensing.
            "source_url": sample.get("source_url", sample.get("url")),
            **result,
        })
    report = {
        "evaluation": "experimental-efficientnet-external-test-v1",
        "checkpoint_sha256": sha256(args.checkpoint),
        "gate_checkpoint_sha256": (
            sha256(args.gate_checkpoint) if args.gate_checkpoint else None
        ),
        "ensemble_calibration_sha256": (
            sha256(args.ensemble_calibration)
            if args.ensemble_calibration else None
        ),
        "benchmark": manifest.get("benchmark"),
        "manifest_sha256": sha256(args.manifest),
        "audit_sha256": sha256(args.audited_summary),
        "calibration_locked_from_validation": checkpoint["calibration"],
        "gate_calibration_locked_from_validation": (
            gate_checkpoint["calibration"] if gate_checkpoint else None
        ),
        "scope": "Small external test covering only audited available classes; not a release claim.",
        "release_ready": False,
        "release_blocker": "This test is too small and does not cover all 19 classes or target tablets.",
        "metrics": metrics(rows, audited_ids, audited_ood_ids),
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["metrics"], indent=2))


if __name__ == "__main__":
    main()
