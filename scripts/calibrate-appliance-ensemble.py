"""Calibrate the classifier-plus-gate decision on calibration data only.

The category model already rejects many inputs. Therefore the binary gate does
not need to meet a strict standalone threshold; it needs to remove the category
model's remaining false accepts without discarding unnecessary correct answers.
This script joins predictions by stable image ID and never reads an external
test report.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np


def parse_args() -> argparse.Namespace:
    """Require both training reports and an explicit output file."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--classifier-report", required=True, type=Path)
    parser.add_argument("--gate-report", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def sha256(path: Path) -> str:
    """Fingerprint the evidence used to select the ensemble threshold."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    """Choose the widest zero-OOD-false-accept ensemble on calibration data."""
    args = parse_args()
    classifier = json.loads(args.classifier_report.read_text(encoding="utf-8"))
    gate = json.loads(args.gate_report.read_text(encoding="utf-8"))
    labels = classifier["labels"]
    unknown = labels.index("unsupported_or_unknown")
    classifier_gate = classifier["validation_calibration"]
    classifier_rows = {row["id"]: row for row in classifier["calibration_predictions"]}
    gate_rows = {row["id"]: row for row in gate["calibration_predictions"]}
    if set(classifier_rows) != set(gate_rows):
        raise SystemExit("Classifier and OOD gate calibration IDs do not match.")

    candidates = []
    for threshold in np.arange(0.0, 0.991, 0.01):
        accepted = []
        positives = []
        ood = []
        for identity, row in classifier_rows.items():
            if row["actual"] == unknown:
                ood.append(row)
            else:
                positives.append(row)
            classifier_accepts = (
                row["predicted"] != unknown
                and row["confidence"] >= classifier_gate["min_confidence"]
                and row["margin"] >= classifier_gate["min_margin"]
            )
            if (
                classifier_accepts
                and gate_rows[identity]["supported_probability"] >= threshold
            ):
                accepted.append(row)
        correct = [row for row in accepted if row["predicted"] == row["actual"]]
        false_ood = [row for row in accepted if row["actual"] == unknown]
        metrics = {
            "min_supported_probability": round(float(threshold), 4),
            "accepted": len(accepted),
            "accepted_accuracy": len(correct) / len(accepted) if accepted else 1.0,
            "positive_coverage": sum(row["actual"] != unknown for row in accepted) / len(positives),
            "ood_false_accepts": len(false_ood),
            "ood_false_accept_rate": len(false_ood) / len(ood),
        }
        metrics["passes_development_gate"] = (
            metrics["accepted_accuracy"] >= 0.95
            and metrics["ood_false_accepts"] == 0
            and metrics["accepted"] > 0
        )
        candidates.append(metrics)
    passing = [row for row in candidates if row["passes_development_gate"]]
    selected = max(
        passing if passing else candidates,
        key=lambda row: (
            row["passes_development_gate"], row["positive_coverage"],
            row["accepted_accuracy"], -row["ood_false_accept_rate"],
        ),
    )
    report = {
        "calibration": "classifier-plus-supported-photo-gate-v1",
        "release_ready": False,
        "classifier_report_sha256": sha256(args.classifier_report),
        "gate_report_sha256": sha256(args.gate_report),
        "classifier_thresholds": {
            "min_confidence": classifier_gate["min_confidence"],
            "min_margin": classifier_gate["min_margin"],
        },
        "gate_threshold": selected,
        "limitation": "Threshold selected on calibration data; external tests remain separate.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(selected, indent=2))


if __name__ == "__main__":
    main()
