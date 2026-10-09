"""Select SigLIP suggestion thresholds using calibration photos only."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np


# A class needs more than one audited example before its accepted suggestions can
# count as evidence. This is deliberately small for development calibration, but
# it still prevents a single lucky photo from making a supported class look safe.
MIN_POSITIVES_PER_CLASS = 2


def parse_args() -> argparse.Namespace:
    """Require the scored calibration report and its explicit audit."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--audited-summary", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def sha256(path: Path) -> str:
    """Fingerprint the exact score and label evidence used."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def summarise_class_evidence(
    supported_labels: list[str],
    positives: list[dict],
    accepted_positive: list[dict],
    positive_ids: dict[str, str],
) -> dict:
    """Report whether every supported class has safe calibration coverage.

    A class with at least two audited positives passes only when the threshold
    accepts one or more correct examples and accepts no incorrect examples. A
    class with fewer than two positives remains an evidence blocker even when
    its only example is accepted correctly.
    """
    accepted_ids = {row["image_id"] for row in accepted_positive}
    per_class = {
        label: {"n": 0, "accepted": 0, "correct": 0}
        for label in sorted(supported_labels)
    }
    for row in positives:
        label = positive_ids[row["image_id"]]
        # Audited labels must map to a prompt the candidate model supports.
        if label not in per_class:
            raise ValueError(f"Audited label has no class prompt: {label}")
        class_metrics = per_class[label]
        class_metrics["n"] += 1
        if row["image_id"] in accepted_ids:
            class_metrics["accepted"] += 1
            class_metrics["correct"] += int(row["top_positive"]["label"] == label)

    classes_passing = []
    classes_with_zero_safe_coverage = []
    classes_with_unsafe_accepts = []
    classes_with_insufficient_evidence = []
    for label, class_metrics in per_class.items():
        accepted = class_metrics["accepted"]
        correct = class_metrics["correct"]
        class_metrics["selective_accuracy"] = (
            correct / accepted if accepted else None
        )
        if class_metrics["n"] < MIN_POSITIVES_PER_CLASS:
            status = "insufficient_calibration_evidence"
            classes_with_insufficient_evidence.append(label)
        elif accepted == 0:
            status = "no_safe_coverage"
            classes_with_zero_safe_coverage.append(label)
        elif correct != accepted:
            status = "unsafe_accepted_example"
            classes_with_unsafe_accepts.append(label)
        else:
            status = "passes"
            classes_passing.append(label)
        class_metrics["evidence_status"] = status
        class_metrics["passes_evidence_rule"] = status == "passes"

    blocked = sorted(
        classes_with_zero_safe_coverage
        + classes_with_unsafe_accepts
        + classes_with_insufficient_evidence
    )
    return {
        "rule": (
            "Each supported class needs at least 2 audited calibration positives, "
            "at least 1 correctly accepted sample, and 100% selective accuracy."
        ),
        "minimum_positives_per_class": MIN_POSITIVES_PER_CLASS,
        "supported_class_count": len(per_class),
        "classes_passing_count": len(classes_passing),
        "classes_passing": classes_passing,
        "classes_blocked": blocked,
        "classes_with_zero_safe_coverage": classes_with_zero_safe_coverage,
        "classes_with_unsafe_accepts": classes_with_unsafe_accepts,
        "classes_with_insufficient_evidence": classes_with_insufficient_evidence,
        "all_supported_classes_pass": not blocked,
        "per_class": per_class,
    }


def main() -> None:
    """Maximise useful coverage under strict accuracy and OOD constraints."""
    args = parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    audit = json.loads(args.audited_summary.read_text(encoding="utf-8"))
    positive_ids = audit["audited_operational_positive_ids"]
    ood_ids = set(audit["audited_ood_ids"])
    positives = [row for row in report["rows"] if row["image_id"] in positive_ids]
    ood = [row for row in report["rows"] if row["image_id"] in ood_ids]
    supported_labels = list(report["class_prompts"])
    candidates = []
    for ood_margin in np.arange(-0.01, 0.081, 0.005):
        for positive_margin in np.arange(0.0, 0.061, 0.005):
            accepted_positive = [
                row for row in positives
                if row["ood_margin"] >= ood_margin
                and row["positive_margin"] >= positive_margin
            ]
            accepted_ood = [
                row for row in ood
                if row["ood_margin"] >= ood_margin
                and row["positive_margin"] >= positive_margin
            ]
            correct = [
                row for row in accepted_positive
                if row["top_positive"]["label"] == positive_ids[row["image_id"]]
            ]
            class_evidence = summarise_class_evidence(
                supported_labels,
                positives,
                accepted_positive,
                positive_ids,
            )
            metrics = {
                "min_ood_margin": round(float(ood_margin), 4),
                "min_positive_margin": round(float(positive_margin), 4),
                "accepted": len(accepted_positive),
                "accepted_accuracy": (
                    len(correct) / len(accepted_positive)
                    if accepted_positive else 1.0
                ),
                "positive_coverage": len(accepted_positive) / len(positives),
                "ood_false_accepts": len(accepted_ood),
                "ood_false_accept_rate": len(accepted_ood) / len(ood),
                "class_evidence": class_evidence,
            }
            # Keep the aggregate constraints as the conservative threshold
            # selection rule, then require every class to pass its own evidence
            # rule before this candidate can pass the overall development gate.
            metrics["passes_aggregate_gate"] = (
                metrics["accepted_accuracy"] >= 0.95
                and metrics["ood_false_accept_rate"] <= 0.03
                and metrics["accepted"] > 0
            )
            metrics["passes_per_class_evidence_gate"] = class_evidence[
                "all_supported_classes_pass"
            ]
            metrics["passes_development_gate"] = (
                metrics["passes_aggregate_gate"]
                and metrics["passes_per_class_evidence_gate"]
            )
            candidates.append(metrics)

    # Select exactly as before from candidates that satisfy the aggregate
    # safety limits. Per-class gaps must block release; they must not make the
    # search fall back to a looser, higher-coverage threshold.
    aggregate_passing = [row for row in candidates if row["passes_aggregate_gate"]]
    selected = max(
        aggregate_passing if aggregate_passing else candidates,
        key=lambda row: (
            row["passes_aggregate_gate"], row["positive_coverage"],
            row["accepted_accuracy"], -row["ood_false_accept_rate"],
        ),
    )
    output = {
        "calibration": "siglip2-appliance-suggestion-v1",
        "release_ready": False,
        "model": report["model"],
        "resolved_revision": report.get("resolved_revision"),
        "report_sha256": sha256(args.report),
        "audit_sha256": sha256(args.audited_summary),
        "threshold_selection_rule": (
            "Maximise positive coverage only among candidates with at least 95% "
            "accepted accuracy, no more than 3% OOD false accepts, and at least "
            "one accepted positive. Per-class evidence is a separate release blocker."
        ),
        "selected": selected,
        "limitation": "Similarity thresholds are calibration results, not user-facing confidence percentages.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(selected, indent=2))


if __name__ == "__main__":
    main()
