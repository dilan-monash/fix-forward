"""Test conservative per-class SigLIP thresholds without changing the website.

The experiment learns thresholds from the calibration split only. It freezes
that map before applying it to external reports whose scores already exist.
Rejected appliance-search photos are reported as a challenge set rather than
being mislabeled as unrelated objects.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path


GLOBAL_OOD_MARGIN = 0.045
MIN_CLASS_TUNING_POSITIVES = 4
MIN_CLASS_EVIDENCE_POSITIVES = 2
MAX_OBSERVED_OOD_FALSE_ACCEPT_RATE = 0.03
THRESHOLD_STEP = 0.005
MAX_THRESHOLD = 0.1


def parse_args() -> argparse.Namespace:
    """Collect calibration evidence and optional frozen external evaluations."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--calibration-report", required=True, type=Path)
    parser.add_argument("--calibration-audit", required=True, type=Path)
    parser.add_argument("--semantic-audit", required=True, type=Path)
    parser.add_argument(
        "--external",
        action="append",
        nargs=3,
        metavar=("NAME", "SCORE_REPORT", "AUDIT_OR_REFERENCE_REPORT"),
        default=[],
        help="Apply the frozen threshold map to one named external score report.",
    )
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def sha256(path: Path) -> str:
    """Fingerprint every input so later results can be reproduced exactly."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    """Read one UTF-8 JSON research artifact."""
    return json.loads(path.read_text(encoding="utf-8"))


def load_semantic_audit(path: Path) -> dict[str, dict]:
    """Load the score-blind visual labels for disputed calibration negatives."""
    data = read_json(path)
    indexed = {row["image_id"]: row for row in data["rows"]}
    if len(indexed) != len(data["rows"]):
        raise ValueError("Semantic audit contains duplicate image IDs.")
    observed_counts = Counter(row["semantic_label"] for row in data["rows"])
    if dict(observed_counts) != data["counts"]:
        raise ValueError("Semantic audit counts do not match its row labels.")
    return indexed


def load_audit(path: Path) -> tuple[dict[str, str], set[str]]:
    """Load either a benchmark audit or an older audited evaluation report."""
    data = read_json(path)
    if "audited_operational_positive_ids" in data:
        return (
            data["audited_operational_positive_ids"],
            set(data["audited_ood_ids"]),
        )
    if "rows" in data:
        positives = {
            row["image_id"]: row["expected"]
            for row in data["rows"]
            if row.get("kind") == "positive" and row.get("expected")
        }
        ood_ids = {
            row["image_id"]
            for row in data["rows"]
            if row.get("kind") == "ood"
        }
        return positives, ood_ids
    raise ValueError(f"Unsupported audit format: {path}")


def accepted(row: dict, thresholds: dict[str, float | None]) -> bool:
    """Apply the frozen threshold belonging to the predicted appliance class."""
    threshold = thresholds.get(row["top_positive"]["label"])
    return threshold is not None and row["ood_margin"] >= threshold


def zero_event_upper_bound(n: int, alpha: float = 0.05) -> float | None:
    """Give the one-sided exact upper rate when zero errors were observed."""
    return 1 - math.pow(alpha, 1 / n) if n else None


def evaluate_rows(
    rows: list[dict],
    positive_ids: dict[str, str],
    ood_ids: set[str],
    thresholds: dict[str, float | None],
) -> dict:
    """Measure selective positive accuracy and true-OOD false accepts."""
    positives = [row for row in rows if row["image_id"] in positive_ids]
    ood = [row for row in rows if row["image_id"] in ood_ids]
    accepted_positive = [row for row in positives if accepted(row, thresholds)]
    accepted_ood = [row for row in ood if accepted(row, thresholds)]
    correct = [
        row for row in accepted_positive
        if row["top_positive"]["label"] == positive_ids[row["image_id"]]
    ]
    wrong = [row for row in accepted_positive if row not in correct]
    per_class = {}
    for label in sorted(set(positive_ids.values())):
        class_rows = [
            row for row in positives if positive_ids[row["image_id"]] == label
        ]
        class_accepted = [row for row in class_rows if accepted(row, thresholds)]
        class_correct = [
            row for row in class_accepted
            if row["top_positive"]["label"] == label
        ]
        per_class[label] = {
            "n": len(class_rows),
            "top1_correct": sum(
                row["top_positive"]["label"] == label for row in class_rows
            ),
            "accepted": len(class_accepted),
            "correctly_accepted": len(class_correct),
        }
    return {
        "positive": {
            "n": len(positives),
            "top1_correct": sum(
                row["top_positive"]["label"] == positive_ids[row["image_id"]]
                for row in positives
            ),
            "accepted": len(accepted_positive),
            "correctly_accepted": len(correct),
            "coverage": len(accepted_positive) / len(positives) if positives else 0,
            "selective_accuracy": (
                len(correct) / len(accepted_positive)
                if accepted_positive else None
            ),
            "wrong_accepts": [
                {
                    "image_id": row["image_id"],
                    "expected": positive_ids[row["image_id"]],
                    "predicted": row["top_positive"]["label"],
                    "ood_margin": row["ood_margin"],
                }
                for row in wrong
            ],
        },
        "true_ood": {
            "n": len(ood),
            "false_accepts": len(accepted_ood),
            "false_accept_rate": len(accepted_ood) / len(ood) if ood else 0,
            "zero_false_accept_95_percent_upper_bound": (
                zero_event_upper_bound(len(ood)) if not accepted_ood else None
            ),
            "accepted_rows": [
                {
                    "image_id": row["image_id"],
                    "ood_class": row.get("ood_class"),
                    "predicted": row["top_positive"]["label"],
                    "ood_margin": row["ood_margin"],
                }
                for row in accepted_ood
            ],
        },
        "per_class": per_class,
    }


def split_calibration_negatives(
    report_rows: list[dict],
    audited_negative_ids: set[str],
    semantic_audit: dict[str, dict],
) -> tuple[list[dict], list[dict], list[dict]]:
    """Use blind visual labels to split true OOD, supported and uncertain rows."""
    missing = sorted(audited_negative_ids - semantic_audit.keys())
    extra = sorted(semantic_audit.keys() - audited_negative_ids)
    if missing or extra:
        raise ValueError(
            "Semantic audit must cover exactly the calibration negative IDs; "
            f"missing={len(missing)}, extra={len(extra)}."
        )
    true_ood = []
    supported_challenges = []
    uncertain = []
    for row in report_rows:
        if row["image_id"] not in audited_negative_ids:
            continue
        semantic_label = semantic_audit[row["image_id"]]["semantic_label"]
        if semantic_label == "true_ood":
            true_ood.append(row)
        elif semantic_label == "supported":
            supported_challenges.append(row)
        elif semantic_label == "uncertain":
            uncertain.append(row)
        else:
            raise ValueError(f"Unknown semantic label: {semantic_label}")
    return true_ood, supported_challenges, uncertain


def threshold_grid() -> list[float]:
    """Use coarse non-negative values to limit exact-sample overfitting."""
    steps = round(MAX_THRESHOLD / THRESHOLD_STEP)
    return [round(index * THRESHOLD_STEP, 4) for index in range(steps + 1)]


def calibrate_thresholds(
    supported_labels: list[str],
    positives: list[dict],
    positive_ids: dict[str, str],
    true_ood: list[dict],
    supported_challenges: list[dict],
    semantic_audit: dict[str, dict],
) -> tuple[dict[str, float | None], dict]:
    """Fit each eligible class while preserving strict calibration safety."""
    positive_counts = Counter(positive_ids.values())
    thresholds = {}
    evidence = {}
    for label in sorted(supported_labels):
        n = positive_counts[label]
        if n >= MIN_CLASS_TUNING_POSITIVES:
            mode = "class_specific_grid"
            candidates = threshold_grid()
        elif n >= MIN_CLASS_EVIDENCE_POSITIVES:
            # Sparse classes may keep the already calibrated global cutoff, but
            # their small sample cannot justify learning a more permissive one.
            mode = "global_threshold_only_low_n"
            candidates = [GLOBAL_OOD_MARGIN]
        else:
            mode = "disabled_insufficient_evidence"
            candidates = []

        safe_candidates = []
        for threshold in candidates:
            accepted_positive = [
                row for row in positives
                if row["top_positive"]["label"] == label
                and row["ood_margin"] >= threshold
            ]
            correctly_accepted = [
                row for row in accepted_positive
                if positive_ids[row["image_id"]] == label
            ]
            accepted_true_ood = [
                row for row in true_ood
                if row["top_positive"]["label"] == label
                and row["ood_margin"] >= threshold
            ]
            accepted_challenges = [
                row for row in supported_challenges
                if row["top_positive"]["label"] == label
                and row["ood_margin"] >= threshold
            ]
            mismatched_challenges = [
                row for row in accepted_challenges
                if semantic_audit[row["image_id"]].get(
                    "possible_supported_class"
                ) != label
            ]
            if (
                correctly_accepted
                and len(correctly_accepted) == len(accepted_positive)
                # Zero is stricter than the <=3% aggregate allowance. It also
                # prevents separately tuned classes from each spending it.
                and not accepted_true_ood
                and not mismatched_challenges
            ):
                safe_candidates.append({
                    "threshold": threshold,
                    "correctly_accepted": len(correctly_accepted),
                    "accepted_rejected_supported_challenges": len(
                        accepted_challenges
                    ),
                })

        selected = max(
            safe_candidates,
            key=lambda item: (
                item["correctly_accepted"],
                -item["accepted_rejected_supported_challenges"],
                item["threshold"],
            ),
            default=None,
        )
        thresholds[label] = selected["threshold"] if selected else None
        evidence[label] = {
            "calibration_positives": n,
            "selection_mode": mode,
            "selected_threshold": thresholds[label],
            "calibration_correctly_accepted": (
                selected["correctly_accepted"] if selected else 0
            ),
            "accepted_rejected_supported_challenges": (
                selected["accepted_rejected_supported_challenges"]
                if selected else 0
            ),
            "status": "enabled" if selected else "disabled_no_safe_candidate",
        }
    return thresholds, evidence


def evaluate_challenges(
    rows: list[dict],
    thresholds: dict[str, float | None],
    semantic_audit: dict[str, dict],
) -> dict:
    """Describe visually supported challenge photos without calling them OOD."""
    accepted_rows = [row for row in rows if accepted(row, thresholds)]
    return {
        "n": len(rows),
        "accepted": len(accepted_rows),
        "accepted_with_matching_supported_class": sum(
            row["top_positive"]["label"]
            == semantic_audit[row["image_id"]].get("possible_supported_class")
            for row in accepted_rows
        ),
        "accepted_rows": [
            {
                "image_id": row["image_id"],
                "possible_supported_class": semantic_audit[row["image_id"]].get(
                    "possible_supported_class"
                ),
                "predicted": row["top_positive"]["label"],
                "ood_margin": row["ood_margin"],
                "audit_reason": semantic_audit[row["image_id"]].get("reason"),
            }
            for row in accepted_rows
        ],
    }


def main() -> None:
    """Calibrate once, freeze thresholds, and run named external checks."""
    args = parse_args()
    calibration_report = read_json(args.calibration_report)
    positive_ids, audited_negative_ids = load_audit(args.calibration_audit)
    semantic_audit = load_semantic_audit(args.semantic_audit)
    rows = calibration_report["rows"]
    positives = [row for row in rows if row["image_id"] in positive_ids]
    true_ood, challenges, uncertain = split_calibration_negatives(
        rows,
        audited_negative_ids,
        semantic_audit,
    )
    supported_labels = list(calibration_report["class_prompts"])
    thresholds, per_class_evidence = calibrate_thresholds(
        supported_labels,
        positives,
        positive_ids,
        true_ood,
        challenges,
        semantic_audit,
    )
    uniform_thresholds = {
        label: GLOBAL_OOD_MARGIN for label in supported_labels
    }
    true_ood_ids = {row["image_id"] for row in true_ood}

    external_results = {}
    external_hashes = {}
    for name, report_path_raw, audit_path_raw in args.external:
        report_path = Path(report_path_raw)
        audit_path = Path(audit_path_raw)
        external_report = read_json(report_path)
        external_positive_ids, external_ood_ids = load_audit(audit_path)
        external_results[name] = {
            "uniform_global_threshold": evaluate_rows(
                external_report["rows"],
                external_positive_ids,
                external_ood_ids,
                uniform_thresholds,
            ),
            "frozen_class_thresholds": evaluate_rows(
                external_report["rows"],
                external_positive_ids,
                external_ood_ids,
                thresholds,
            ),
        }
        external_hashes[name] = {
            "score_report_sha256": sha256(report_path),
            "audit_or_reference_sha256": sha256(audit_path),
        }

    external_wrong_accepts = sum(
        result["frozen_class_thresholds"]["positive"]["accepted"]
        - result["frozen_class_thresholds"]["positive"]["correctly_accepted"]
        for result in external_results.values()
    )

    calibration_class_specific = evaluate_rows(
        rows,
        positive_ids,
        true_ood_ids,
        thresholds,
    )
    output = {
        "experiment": "siglip2-class-specific-ood-margin-v1",
        "release_ready": False,
        "integration_recommended": False,
        "scope": (
            "Offline calibration experiment only; it does not change or enable "
            "the website photo helper."
        ),
        "input_hashes": {
            "calibration_report_sha256": sha256(args.calibration_report),
            "calibration_audit_sha256": sha256(args.calibration_audit),
            "semantic_audit_sha256": sha256(args.semantic_audit),
            "external": external_hashes,
        },
        "selection_rule": {
            "threshold_metric": "top-positive score minus top-OOD-prompt score",
            "grid": {
                "minimum": 0.0,
                "maximum": MAX_THRESHOLD,
                "step": THRESHOLD_STEP,
            },
            "class_specific_tuning_requires_positives": (
                MIN_CLASS_TUNING_POSITIVES
            ),
            "classes_with_2_or_3_positives": (
                "May use the frozen global 0.045 threshold only."
            ),
            "classes_with_fewer_than_2_positives": "Disabled.",
            "accepted_positive_rule": "100% selective accuracy on calibration.",
            "true_ood_rule": (
                "Require zero accepted true-OOD examples. One of 48 would still "
                f"fit under the {MAX_OBSERVED_OOD_FALSE_ACCEPT_RATE:.0%} aggregate "
                "limit, but zero preserves headroom across separately tuned classes."
            ),
            "challenge_rule": (
                "Visually supported challenge photos are separate; an accepted "
                "challenge must match the auditor's possible supported class."
            ),
            "uncertain_rule": "Exclude visually uncertain rows from threshold fitting.",
        },
        "frozen_thresholds": thresholds,
        "per_class_calibration_evidence": per_class_evidence,
        "calibration": {
            "negative_partition": {
                "true_ood": len(true_ood),
                "supported_challenge": len(challenges),
                "uncertain_excluded": len(uncertain),
            },
            "uniform_global_threshold": evaluate_rows(
                rows,
                positive_ids,
                true_ood_ids,
                uniform_thresholds,
            ),
            "frozen_class_thresholds": calibration_class_specific,
            "supported_challenge": evaluate_challenges(
                challenges,
                thresholds,
                semantic_audit,
            ),
        },
        "external_results": external_results,
        "decision": (
            "Do not integrate: the frozen external checks contain a wrong accepted "
            "suggestion, and the true-OOD samples are too small for zero observed "
            "errors to establish a 3% population false-accept rate."
            if external_wrong_accepts
            else
            "Do not integrate: no external wrong accept was observed, but the "
            "true-OOD samples are too small for zero observed errors to establish "
            "a 3% population false-accept rate."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "thresholds": thresholds,
        "calibration": output["calibration"],
        "external_results": external_results,
        "decision": output["decision"],
    }, indent=2))


if __name__ == "__main__":
    main()
