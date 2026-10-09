"""Apply a locked SigLIP calibration to an external score report.

This script only evaluates thresholds already selected on calibration data. It
does not search, round or otherwise change them. Audited IDs are supplied
separately so unreviewed benchmark candidates cannot inflate test metrics.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path


def parse_args() -> argparse.Namespace:
    """Require the score, calibration, audit evidence and output explicitly."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--calibration", required=True, type=Path)
    audit = parser.add_mutually_exclusive_group(required=True)
    audit.add_argument("--audited-summary", type=Path)
    audit.add_argument(
        "--audit-report",
        type=Path,
        help=(
            "Compatible external-test report whose non-null expected labels "
            "and OOD rows preserve a missing audited-summary."
        ),
    )
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def sha256(path: Path) -> str:
    """Fingerprint each exact input rather than relying on its filename."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_object(path: Path, description: str) -> dict:
    """Read one JSON object and give malformed evidence a concise error."""
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Cannot read {description} {path}: {error}") from error
    if not isinstance(value, dict):
        raise SystemExit(f"{description.capitalize()} must contain a JSON object.")
    return value


def rows_by_id(rows: object, description: str) -> dict[str, dict]:
    """Index rows once and reject ambiguous duplicate image identifiers."""
    if not isinstance(rows, list):
        raise SystemExit(f"{description.capitalize()} must contain a rows list.")
    indexed = {}
    for row in rows:
        if not isinstance(row, dict) or not row.get("image_id"):
            raise SystemExit(f"Every {description} row must have an image_id.")
        image_id = str(row["image_id"])
        if image_id in indexed:
            raise SystemExit(f"Duplicate image_id in {description}: {image_id}")
        indexed[image_id] = row
    return indexed


def audit_from_summary(path: Path) -> tuple[dict[str, str], set[str], dict]:
    """Load the normal explicit mapping produced by benchmark review."""
    audit = read_object(path, "audited summary")
    positives = audit.get("audited_operational_positive_ids")
    ood = audit.get("audited_ood_ids")
    if not isinstance(positives, dict) or not isinstance(ood, list):
        raise SystemExit(
            "Audited summary needs audited_operational_positive_ids and "
            "audited_ood_ids."
        )
    provenance = {
        "kind": "audited-summary",
        "path": str(path.resolve()),
        "sha256": sha256(path),
        "benchmark": audit.get("benchmark"),
        "review_method": audit.get("review_method"),
    }
    return ({str(key): str(value) for key, value in positives.items()},
            {str(value) for value in ood}, provenance)


def audit_from_report(path: Path) -> tuple[dict[str, str], set[str], dict]:
    """Recover an audit mapping preserved by a compatible prior evaluator.

    This route is useful when the original audit file is no longer present.
    Counts and the complete image-ID set are checked later against the SigLIP
    report, while the prior report retains the original audit and manifest
    hashes for provenance.
    """
    audit_report = read_object(path, "audit report")
    indexed = rows_by_id(audit_report.get("rows"), "audit report")
    positives = {
        image_id: str(row["expected"])
        for image_id, row in indexed.items()
        if row.get("expected") is not None
    }
    ood = {
        image_id for image_id, row in indexed.items()
        if row.get("kind") == "ood"
    }
    metrics = audit_report.get("metrics", {})
    expected_positive_n = metrics.get("audited_positive", {}).get("n")
    expected_ood_n = metrics.get("ood", {}).get("n")
    if expected_positive_n != len(positives) or expected_ood_n != len(ood):
        raise SystemExit(
            "Audit-report row mapping does not match its recorded audited counts."
        )
    provenance = {
        "kind": "compatible-external-test-report",
        "path": str(path.resolve()),
        "sha256": sha256(path),
        "evaluation": audit_report.get("evaluation"),
        "benchmark": audit_report.get("benchmark"),
        "manifest_sha256": audit_report.get("manifest_sha256"),
        "upstream_audit_sha256": audit_report.get("audit_sha256"),
    }
    return positives, ood, provenance


def finite_number(value: object, name: str) -> float:
    """Reject missing, non-numeric and non-finite decision evidence."""
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise SystemExit(f"{name} must be numeric.") from error
    if not math.isfinite(number):
        raise SystemExit(f"{name} must be finite.")
    return number


def accepts(row: dict, thresholds: dict[str, float]) -> bool:
    """Apply both saved margins without fitting anything on external data."""
    ood_margin = finite_number(row.get("ood_margin"), "ood_margin")
    positive_margin = row.get("positive_margin")
    if positive_margin is None:
        # Older saved reports omitted this field. At the locked zero threshold,
        # the comparison is tautological because top-positive margin is >= 0.
        if thresholds["min_positive_margin"] > 0:
            raise SystemExit(
                "Report omits positive_margin required by a positive threshold."
            )
        positive_passes = True
    else:
        positive_passes = finite_number(
            positive_margin, "positive_margin"
        ) >= thresholds["min_positive_margin"]
    return (
        ood_margin >= thresholds["min_ood_margin"]
        and positive_passes
    )


def decision_evidence(row: dict, expected: str | None) -> dict:
    """Keep error lists compact while retaining the exact decision evidence."""
    return {
        "image_id": row["image_id"],
        "expected": expected,
        "predicted": row["top_positive"]["label"],
        "ood_class": row.get("ood_class"),
        "ood_margin": row.get("ood_margin"),
        "positive_margin": row.get("positive_margin"),
    }


def main() -> None:
    """Validate provenance, apply locked thresholds and write test metrics."""
    args = parse_args()
    report = read_object(args.report, "SigLIP report")
    calibration = read_object(args.calibration, "calibration")
    report_rows = rows_by_id(report.get("rows"), "SigLIP report")
    if args.audited_summary:
        positive_ids, ood_ids, audit_provenance = audit_from_summary(
            args.audited_summary
        )
    else:
        positive_ids, ood_ids, audit_provenance = audit_from_report(
            args.audit_report
        )
        audit_rows = rows_by_id(
            read_object(args.audit_report, "audit report").get("rows"),
            "audit report",
        )
        if set(audit_rows) != set(report_rows):
            raise SystemExit(
                "Audit report and SigLIP report do not contain the same image IDs."
            )

    if not positive_ids or not ood_ids:
        raise SystemExit("Audit evidence must contain positives and OOD images.")
    if set(positive_ids) & ood_ids:
        raise SystemExit("Audit evidence assigns an image to both positive and OOD.")
    missing = (set(positive_ids) | ood_ids) - set(report_rows)
    if missing:
        raise SystemExit(f"Audited image IDs missing from report: {sorted(missing)}")

    class_labels = set(report.get("class_prompts", {}))
    unknown_labels = sorted(set(positive_ids.values()) - class_labels)
    if unknown_labels:
        raise SystemExit(f"Audit contains unknown SigLIP labels: {unknown_labels}")
    for image_id, expected in positive_ids.items():
        row = report_rows[image_id]
        if row.get("kind") != "positive" or row.get("expected") != expected:
            raise SystemExit(f"Positive audit disagrees with report row {image_id}.")
    for image_id in ood_ids:
        if report_rows[image_id].get("kind") != "ood":
            raise SystemExit(f"OOD audit disagrees with report row {image_id}.")

    if calibration.get("model") != report.get("model"):
        raise SystemExit("Calibration and report model names do not match.")
    if calibration.get("resolved_revision") != report.get("resolved_revision"):
        raise SystemExit("Calibration and report resolved revisions do not match.")
    selected = calibration.get("selected", {})
    thresholds = {
        "min_ood_margin": finite_number(
            selected.get("min_ood_margin"), "min_ood_margin"
        ),
        "min_positive_margin": finite_number(
            selected.get("min_positive_margin"), "min_positive_margin"
        ),
    }

    positives = [report_rows[image_id] for image_id in positive_ids]
    ood = [report_rows[image_id] for image_id in ood_ids]
    top1_correct = [
        row for row in positives
        if row["top_positive"]["label"] == positive_ids[row["image_id"]]
    ]
    accepted_positive = [row for row in positives if accepts(row, thresholds)]
    correct_accepts = [
        row for row in accepted_positive
        if row["top_positive"]["label"] == positive_ids[row["image_id"]]
    ]
    wrong_accepts = [
        decision_evidence(row, positive_ids[row["image_id"]])
        for row in accepted_positive
        if row["top_positive"]["label"] != positive_ids[row["image_id"]]
    ]
    false_accepts = [
        decision_evidence(row, None) for row in ood if accepts(row, thresholds)
    ]

    result = {
        "evaluation": "siglip2-locked-calibration-external-test-v1",
        "release_ready": False,
        "scope": (
            "Locked calibration applied to audited external rows; this does "
            "not change the website model or establish release readiness."
        ),
        "model": report.get("model"),
        "resolved_revision": report.get("resolved_revision"),
        "thresholds": thresholds,
        "provenance": {
            "external_report": {
                "path": str(args.report.resolve()),
                "sha256": sha256(args.report),
                "evaluation": report.get("evaluation"),
            },
            "calibration": {
                "path": str(args.calibration.resolve()),
                "sha256": sha256(args.calibration),
                "name": calibration.get("calibration"),
                "calibration_report_sha256": calibration.get("report_sha256"),
                "calibration_audit_sha256": calibration.get("audit_sha256"),
            },
            "external_audit": audit_provenance,
            "missing_positive_margin_rows": sum(
                "positive_margin" not in row for row in report_rows.values()
            ),
        },
        "metrics": {
            "audited_positive": {
                "n": len(positives),
                "top1_correct": len(top1_correct),
                "top1_accuracy": len(top1_correct) / len(positives),
                "accepted": len(accepted_positive),
                "coverage": len(accepted_positive) / len(positives),
                "selective_accuracy": (
                    len(correct_accepts) / len(accepted_positive)
                    if accepted_positive else None
                ),
                "wrong_accept_count": len(wrong_accepts),
                "wrong_accepts": wrong_accepts,
            },
            "audited_ood": {
                "n": len(ood),
                "false_accept_rate": len(false_accepts) / len(ood),
                "false_accept_count": len(false_accepts),
                "false_accepts": false_accepts,
            },
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
