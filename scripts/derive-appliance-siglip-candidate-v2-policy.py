"""Derive the disabled SigLIP candidate-v2 policy from exposed q4 evidence.

This script intentionally uses only prediction reports that have already been
opened.  It must never be pointed at the future candidate-v2 release cohort:
that cohort stays prediction-blind until the separate v2 gate is frozen.

For every predicted class, the search examines the complete two-dimensional
0.0001 grid from 0.0000 through 0.1000.  A pair is eligible only when it accepts
zero known-unsafe rows.  Among eligible pairs it first maximises correctly
accepted operational photos, then maximises the sum of the two thresholds.  The
second step keeps the most conservative pair without sacrificing the observed
coverage.  Further deterministic tie-breaks are documented in ``pair_key``.

The generated files are candidate-only research artifacts.  Both release flags
remain false, and this script does not edit the browser manifest or application.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


GRID_STEP = 0.0001
GRID_MAXIMUM = 0.1000
GRID_MAX_INDEX = round(GRID_MAXIMUM / GRID_STEP)
MIN_OBSERVED_SAFE_ACCEPTS = 2
FROZEN_AT_UTC = "2026-10-09T03:15:00Z"

MODEL_REPOSITORY = "onnx-community/siglip2-base-patch32-256-ONNX"
MODEL_REVISION = "7efccb86b5b6601bfe9e14326e1c11b40b68d44c"
MODEL_SHA256 = "9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499"
TEXT_MANIFEST_SHA256 = "4b01be52acad78dae1783978e1bc191d50532dc63781a5cd7b96e24f3a390093"
TEXT_VECTORS_SHA256 = "2e63f55601cf3f011bf13b3c347bd456111c1b8132f9d8164105fff0a29877f2"

SUPPORTED_CLASSES = (
    "air_fryer",
    "blender",
    "coffee_machine",
    "dehumidifier",
    "fan",
    "food_processor",
    "hair_dryer",
    "kettle",
    "microwave",
    "mixer",
    "portable_ac",
    "portable_heater",
    "rice_cooker",
    "sandwich_press",
    "shaver",
    "steam_cleaner",
    "straightener",
    "toaster",
    "vaccum_cleaner",
)

# These values were selected before any candidate-v2 fresh prediction.  The
# derivation must reproduce the table exactly or stop instead of silently
# changing the policy.
EXPECTED_THRESHOLDS = {
    "air_fryer": (0.0312, 0.0386),
    "blender": (0.0215, 0.0362),
    "coffee_machine": (0.0283, 0.0224),
    "fan": (0.0226, 0.0349),
    "food_processor": (0.0283, 0.0282),
    "hair_dryer": (0.0093, 0.0055),
    "kettle": (0.0323, 0.0256),
    "microwave": (0.0044, 0.0408),
    "mixer": (0.0324, 0.0111),
    "portable_ac": (0.0540, 0.0154),
    "portable_heater": (0.0272, 0.0152),
    "rice_cooker": (0.0099, 0.0068),
    "sandwich_press": (0.0309, 0.0088),
    "shaver": (0.0493, 0.0583),
    "straightener": (0.0061, 0.0027),
    "toaster": (0.0358, 0.0497),
    "vaccum_cleaner": (0.0484, 0.0224),
}

EXPECTED_ACCEPTED_CORRECT = {
    "air_fryer": 4,
    "blender": 6,
    "coffee_machine": 11,
    "fan": 8,
    "food_processor": 9,
    "hair_dryer": 8,
    "kettle": 4,
    "microwave": 12,
    "mixer": 3,
    "portable_ac": 5,
    "portable_heater": 7,
    "rice_cooker": 8,
    "sandwich_press": 6,
    "shaver": 4,
    "straightener": 6,
    "toaster": 8,
    "vaccum_cleaner": 6,
}


@dataclass(frozen=True)
class EvidenceRow:
    """One q4 prediction plus the audit meaning assigned to that image."""

    dataset: str
    image_id: str
    predicted: str
    ood_margin: float
    positive_margin: float
    cohort: str
    expected: str | None = None
    possible_supported_class: str | None = None


def parse_args() -> argparse.Namespace:
    """Collect deterministic output locations; no fresh cohort is accepted."""

    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--policy-output",
        type=Path,
        default=Path("model/appliance-siglip/candidate-v2-policy.json"),
    )
    parser.add_argument(
        "--gate-output",
        type=Path,
        default=Path("model/appliance-siglip/pre-registered-release-gate-v2.json"),
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify that the existing artifacts equal deterministic output.",
    )
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    """Read one UTF-8 JSON object and reject other top-level shapes."""

    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def sha256(path: Path) -> str:
    """Fingerprint one evidence or model artifact."""

    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_bytes(value: dict[str, Any]) -> bytes:
    """Use one stable JSON representation for reproducible policy hashes."""

    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def relative(path: Path, root: Path) -> str:
    """Store portable repository-relative paths with forward slashes."""

    return path.resolve().relative_to(root.resolve()).as_posix()


def assert_unique_rows(report: dict[str, Any], path: Path) -> None:
    """Reject duplicate IDs because one image must have one observed score."""

    rows = report.get("rows")
    if not isinstance(rows, list):
        raise ValueError(f"Report has no rows array: {path}")
    ids = [row.get("image_id") for row in rows]
    if any(not isinstance(image_id, str) or not image_id for image_id in ids):
        raise ValueError(f"Report contains an invalid image ID: {path}")
    if len(ids) != len(set(ids)):
        raise ValueError(f"Report contains duplicate image IDs: {path}")


def validate_q4_report(report: dict[str, Any], path: Path) -> None:
    """Bind every score row to the same quantized model and text vectors."""

    assert_unique_rows(report, path)
    expected = {
        "evaluation": "fixforward-siglip2-quantized-browser-candidate-v1",
        "model": MODEL_REPOSITORY,
        "revision": MODEL_REVISION,
        "dtype": "q4",
        "model_sha256": MODEL_SHA256,
    }
    for field, expected_value in expected.items():
        if report.get(field) != expected_value:
            raise ValueError(
                f"{path}: {field}={report.get(field)!r}, expected {expected_value!r}."
            )
    inputs = report.get("inputs", {})
    if inputs.get("text_manifest_sha256") != TEXT_MANIFEST_SHA256:
        raise ValueError(f"{path}: text-manifest hash changed.")
    if inputs.get("text_vectors_sha256") != TEXT_VECTORS_SHA256:
        raise ValueError(f"{path}: text-vector hash changed.")


def audit_mapping(data: dict[str, Any], path: Path) -> dict[str, str]:
    """Validate and return an operational-positive audit map."""

    mapping = data.get("audited_operational_positive_ids")
    if not isinstance(mapping, dict) or not mapping:
        raise ValueError(f"Missing operational-positive audit map: {path}")
    if not all(
        isinstance(image_id, str) and expected in SUPPORTED_CLASSES
        for image_id, expected in mapping.items()
    ):
        raise ValueError(f"Invalid operational-positive audit map: {path}")
    return mapping


def append_rows(
    output: list[EvidenceRow],
    dataset: str,
    report: dict[str, Any],
    operational: dict[str, str],
    classify_non_operational: Callable[[dict[str, Any]], tuple[str, str | None]],
) -> None:
    """Join one report to its score-blind audit without changing score rows."""

    for raw in report["rows"]:
        image_id = raw["image_id"]
        if image_id in operational:
            cohort = "operational"
            expected = operational[image_id]
            possible = expected
        else:
            cohort, possible = classify_non_operational(raw)
            expected = None
        output.append(
            EvidenceRow(
                dataset=dataset,
                image_id=image_id,
                predicted=raw["top_positive"]["label"],
                ood_margin=float(raw["ood_margin"]),
                positive_margin=float(raw["positive_margin"]),
                cohort=cohort,
                expected=expected,
                possible_supported_class=possible,
            )
        )


def load_evidence(root: Path) -> tuple[list[EvidenceRow], dict[str, dict[str, Any]]]:
    """Load all four already-observed q4 reports and their audit evidence."""

    paths = {
        "calibration_report": root / "tmp/appliance-model-experiment-v3/browser-candidate/calibration-q4.json",
        "calibration_audit": root / "tmp/appliance-model-experiment-v3/siglip-calibration/audited-summary.json",
        "calibration_semantic_audit": root / "tmp/appliance-model-experiment-v3/siglip-calibration/ood-semantic-audit.json",
        "abo_report": root / "tmp/appliance-model-experiment-v3/browser-candidate/abo-q4.json",
        "abo_audit": root / "tmp/appliance-model-abo-test-v2/audited-summary.json",
        "open_images_report": root / "tmp/appliance-model-experiment-v3/browser-candidate/open-images-q4.json",
        "open_images_audit_reference": root / "tmp/appliance-model-experiment-v3/open-images-external-test-report.json",
        "fresh_v1_report": root / "model/appliance-siglip/fresh-heldout-evaluation.json",
        "fresh_v1_audit": root / "model/appliance-siglip/fresh-heldout-audit-summary.json",
    }
    loaded = {name: read_json(path) for name, path in paths.items()}
    for name in ("calibration_report", "abo_report", "open_images_report", "fresh_v1_report"):
        validate_q4_report(loaded[name], paths[name])

    rows: list[EvidenceRow] = []

    calibration_operational = audit_mapping(
        loaded["calibration_audit"], paths["calibration_audit"]
    )
    semantic_rows = loaded["calibration_semantic_audit"].get("rows", [])
    semantic = {row["image_id"]: row for row in semantic_rows}
    if len(semantic) != len(semantic_rows):
        raise ValueError("Calibration semantic audit contains duplicate image IDs.")
    calibration_non_operational = {
        row["image_id"]
        for row in loaded["calibration_report"]["rows"]
        if row["image_id"] not in calibration_operational
    }
    if set(semantic) != calibration_non_operational:
        raise ValueError("Calibration semantic audit does not cover every excluded row.")

    def calibration_classifier(raw: dict[str, Any]) -> tuple[str, str | None]:
        item = semantic[raw["image_id"]]
        label = item.get("semantic_label")
        cohort_by_label = {
            "true_ood": "true_ood",
            "supported": "supported_challenge",
            "uncertain": "uncertain",
        }
        if label not in cohort_by_label:
            raise ValueError(f"Unknown calibration semantic label: {label!r}")
        return cohort_by_label[label], item.get("possible_supported_class")

    append_rows(
        rows,
        "calibration_q4",
        loaded["calibration_report"],
        calibration_operational,
        calibration_classifier,
    )

    abo_operational = audit_mapping(loaded["abo_audit"], paths["abo_audit"])
    abo_ood = set(loaded["abo_audit"].get("audited_ood_ids", []))
    abo_rejected = set(loaded["abo_audit"].get("rejected_positive_image_ids", []))

    def abo_classifier(raw: dict[str, Any]) -> tuple[str, None]:
        image_id = raw["image_id"]
        if image_id in abo_ood:
            return "true_ood", None
        if image_id in abo_rejected:
            return "rejected", None
        raise ValueError(f"ABO audit does not classify {image_id}.")

    append_rows(rows, "abo_q4", loaded["abo_report"], abo_operational, abo_classifier)

    # The original Open Images audit file is not present in this checkout.  The
    # older evaluated report preserves its seven audited expected labels and 19
    # OOD rows, so it is hashed and used only as the audit reference.
    open_reference_rows = loaded["open_images_audit_reference"].get("rows", [])
    open_operational = {
        row["image_id"]: row["expected"]
        for row in open_reference_rows
        if row.get("expected") in SUPPORTED_CLASSES
    }
    open_ood = {
        row["image_id"] for row in open_reference_rows if row.get("kind") == "ood"
    }
    if len(open_operational) != 7 or len(open_ood) != 19:
        raise ValueError("Open Images audit reference no longer contains 7 positives/19 OOD.")

    def open_classifier(raw: dict[str, Any]) -> tuple[str, None]:
        if raw["image_id"] in open_ood:
            return "true_ood", None
        if raw.get("kind") == "positive":
            return "rejected", None
        raise ValueError(f"Open Images audit does not classify {raw['image_id']}.")

    append_rows(
        rows,
        "open_images_q4",
        loaded["open_images_report"],
        open_operational,
        open_classifier,
    )

    fresh_audit = loaded["fresh_v1_audit"]
    fresh_operational = audit_mapping(fresh_audit, paths["fresh_v1_audit"])
    fresh_ood = set(fresh_audit.get("audited_true_ood_ids", []))
    fresh_supported = set(fresh_audit.get("supported_challenge_ids", []))
    fresh_uncertain = set(fresh_audit.get("excluded_uncertain_ids", []))

    def fresh_classifier(raw: dict[str, Any]) -> tuple[str, str | None]:
        image_id = raw["image_id"]
        if image_id in fresh_ood:
            return "true_ood", None
        if image_id in fresh_supported:
            # Positive-source challenge rows retain their candidate label in the
            # q4 report.  A row drawn from an OOD query has no possible class.
            possible = raw.get("expected")
            return "supported_challenge", possible if possible in SUPPORTED_CLASSES else None
        if image_id in fresh_uncertain:
            return "uncertain", None
        raise ValueError(f"Fresh v1 audit does not classify {image_id}.")

    append_rows(
        rows,
        "fresh_v1_q4",
        loaded["fresh_v1_report"],
        fresh_operational,
        fresh_classifier,
    )

    provenance = {
        name: {
            "path": relative(path, root),
            "sha256": sha256(path),
        }
        for name, path in paths.items()
    }
    return rows, provenance


def is_known_safe_challenge(row: EvidenceRow) -> bool:
    """Permit a challenge only when its audited possible class wins exactly."""

    return (
        row.cohort == "supported_challenge"
        and row.possible_supported_class is not None
        and row.predicted == row.possible_supported_class
    )


def is_correct_operational(row: EvidenceRow, label: str) -> bool:
    """Return whether a row is an operational photo correctly won by label."""

    return row.cohort == "operational" and row.expected == label and row.predicted == label


def is_unsafe_for_label(row: EvidenceRow, label: str) -> bool:
    """Classify every accepted error/reject while exempting matching challenges."""

    if row.predicted != label:
        return False
    if is_correct_operational(row, label):
        return False
    return not is_known_safe_challenge(row)


def grid_limit(margin: float) -> int:
    """Return the highest 0.0001 threshold that a raw margin still passes."""

    if not math.isfinite(margin):
        raise ValueError("All observed margins must be finite.")
    # The small epsilon prevents a binary float just below an exact grid point
    # from being rounded into the preceding bucket.
    return min(GRID_MAX_INDEX, math.floor((margin + 1e-12) / GRID_STEP))


def derive_pair(label: str, rows: list[EvidenceRow]) -> dict[str, Any]:
    """Search the entire threshold grid for one predicted appliance class."""

    correct = [row for row in rows if is_correct_operational(row, label)]
    unsafe = [row for row in rows if is_unsafe_for_label(row, label)]
    correct_limits = [
        (grid_limit(row.ood_margin), grid_limit(row.positive_margin))
        for row in correct
    ]
    unsafe_limits = [
        (grid_limit(row.ood_margin), grid_limit(row.positive_margin))
        for row in unsafe
    ]

    # For each of the 1,001 OOD thresholds, the lowest safe positive threshold
    # is one grid step above the largest still-active unsafe positive margin.
    # The highest positive threshold retaining the same correct rows maximises
    # the conservative tie-break.  This is exactly equivalent to visiting all
    # 1,002,001 grid pairs, but avoids repeated row scans.
    selected: tuple[int, int, int, int, int] | None = None
    evaluated_pairs = (GRID_MAX_INDEX + 1) ** 2
    for ood_index in range(GRID_MAX_INDEX + 1):
        active_unsafe_positive = [
            positive_limit
            for ood_limit, positive_limit in unsafe_limits
            if ood_limit >= ood_index and positive_limit >= 0
        ]
        safe_positive_index = max(active_unsafe_positive, default=-1) + 1
        if safe_positive_index > GRID_MAX_INDEX:
            continue
        active_correct_positive = [
            positive_limit
            for ood_limit, positive_limit in correct_limits
            if ood_limit >= ood_index and positive_limit >= safe_positive_index
        ]
        accepted_correct = len(active_correct_positive)
        # If no correct row survives, the pair cannot establish class support.
        if not active_correct_positive:
            positive_index = safe_positive_index
        else:
            positive_index = min(active_correct_positive)
        pair_key = (
            accepted_correct,
            ood_index + positive_index,
            min(ood_index, positive_index),
            ood_index,
            positive_index,
        )
        if selected is None or pair_key > selected:
            selected = pair_key

    if selected is None:
        raise ValueError(f"No safe grid pair exists for {label}.")
    accepted_correct, _, _, ood_index, positive_index = selected
    return {
        "min_ood_margin": round(ood_index * GRID_STEP, 4),
        "min_positive_margin": round(positive_index * GRID_STEP, 4),
        "observed_correct_winners": len(correct),
        "observed_unsafe_winners": len(unsafe),
        "accepted_correct": accepted_correct,
        "accepted_unsafe": 0,
        "grid_pairs_evaluated": evaluated_pairs,
        "eligible": accepted_correct >= MIN_OBSERVED_SAFE_ACCEPTS,
    }


def accepts(row: EvidenceRow, thresholds: dict[str, dict[str, Any]]) -> bool:
    """Apply the candidate-v2 class thresholds to one saved prediction."""

    threshold = thresholds.get(row.predicted)
    return bool(
        threshold
        and row.ood_margin >= threshold["min_ood_margin"]
        and row.positive_margin >= threshold["min_positive_margin"]
    )


def evidence_summary(
    rows: list[EvidenceRow], thresholds: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    """Re-evaluate every exposed row and prove the frozen table's result."""

    enabled = set(thresholds)
    cohort_counts = Counter(row.cohort for row in rows)
    eligible = [
        row for row in rows if row.cohort == "operational" and row.expected in enabled
    ]
    disabled = [
        row for row in rows if row.cohort == "operational" and row.expected not in enabled
    ]
    accepted_eligible = [row for row in eligible if accepts(row, thresholds)]
    wrong_eligible = [
        row for row in accepted_eligible if row.predicted != row.expected
    ]
    accepted_disabled = [row for row in disabled if accepts(row, thresholds)]
    accepted_by_cohort: dict[str, list[EvidenceRow]] = defaultdict(list)
    for row in rows:
        if row.cohort != "operational" and accepts(row, thresholds):
            accepted_by_cohort[row.cohort].append(row)

    mismatched_supported = [
        row
        for row in accepted_by_cohort["supported_challenge"]
        if not is_known_safe_challenge(row)
    ]
    per_class: dict[str, dict[str, Any]] = {}
    for label in thresholds:
        class_rows = [row for row in eligible if row.expected == label]
        accepted_correct = [
            row for row in class_rows if accepts(row, thresholds) and row.predicted == label
        ]
        dataset_counts = Counter(row.dataset for row in class_rows)
        accepted_dataset_counts = Counter(row.dataset for row in accepted_correct)
        per_class[label] = {
            "audited_operational_positives": len(class_rows),
            "accepted_correct": len(accepted_correct),
            "coverage": len(accepted_correct) / len(class_rows),
            "accepted_wrong": sum(
                accepts(row, thresholds) and row.predicted != label
                for row in class_rows
            ),
            "dataset_counts": dict(sorted(dataset_counts.items())),
            "accepted_correct_dataset_counts": dict(
                sorted(accepted_dataset_counts.items())
            ),
        }

    unsafe_accepts = {
        "wrong_enabled_operational": len(wrong_eligible),
        "disabled_class_operational": len(accepted_disabled),
        "true_ood": len(accepted_by_cohort["true_ood"]),
        "uncertain": len(accepted_by_cohort["uncertain"]),
        "rejected": len(accepted_by_cohort["rejected"]),
        "mismatched_supported_challenge": len(mismatched_supported),
    }
    accepted_correct_count = len(accepted_eligible) - len(wrong_eligible)
    return {
        "observed_rows": len(rows),
        "cohort_counts": dict(sorted(cohort_counts.items())),
        "eligible_operational_positives": len(eligible),
        "manual_only_operational_positives": len(disabled),
        "accepted_correct": accepted_correct_count,
        "coverage": accepted_correct_count / len(eligible),
        "unsafe_accepts": unsafe_accepts,
        "matching_supported_challenges_accepted": sum(
            is_known_safe_challenge(row)
            for row in accepted_by_cohort["supported_challenge"]
        ),
        "per_class": per_class,
    }


def build_policy(root: Path) -> dict[str, Any]:
    """Derive and validate the candidate-v2 policy without enabling it."""

    rows, provenance = load_evidence(root)
    derived_all = {label: derive_pair(label, rows) for label in SUPPORTED_CLASSES}
    enabled = [
        label for label in SUPPORTED_CLASSES if derived_all[label]["eligible"]
    ]
    manual_only = [label for label in SUPPORTED_CLASSES if label not in enabled]
    thresholds = {label: derived_all[label] for label in enabled}
    compact_pairs = {
        label: (
            item["min_ood_margin"],
            item["min_positive_margin"],
        )
        for label, item in thresholds.items()
    }
    if compact_pairs != EXPECTED_THRESHOLDS:
        raise ValueError(
            "Derived class-threshold table differs from the preselected v2 table."
        )
    accepted_by_class = {
        label: item["accepted_correct"] for label, item in thresholds.items()
    }
    if accepted_by_class != EXPECTED_ACCEPTED_CORRECT:
        raise ValueError("Derived per-class accepted counts changed.")

    summary = evidence_summary(rows, thresholds)
    if summary["eligible_operational_positives"] != 157:
        raise ValueError("Expected exactly 157 eligible operational positives.")
    if summary["accepted_correct"] != 115:
        raise ValueError("Expected exactly 115 accepted-correct operational photos.")
    if any(summary["unsafe_accepts"].values()):
        raise ValueError("The preselected table now accepts a known-unsafe row.")
    if manual_only != ["dehumidifier", "steam_cleaner"]:
        raise ValueError(f"Unexpected manual-only class list: {manual_only}")

    model_path = (
        root
        / "model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx"
        / f"vision_model.{MODEL_SHA256}_q4.onnx"
    )
    text_manifest_path = root / "model/appliance-siglip/text-embeddings.json"
    text_vectors_path = root / "model/appliance-siglip/text-embeddings.f32"
    artifact_hashes = {
        "vision_model": {
            "path": relative(model_path, root),
            "bytes": model_path.stat().st_size,
            "sha256": sha256(model_path),
        },
        "text_manifest": {
            "path": relative(text_manifest_path, root),
            "sha256": sha256(text_manifest_path),
        },
        "text_vectors": {
            "path": relative(text_vectors_path, root),
            "bytes": text_vectors_path.stat().st_size,
            "sha256": sha256(text_vectors_path),
        },
    }
    if artifact_hashes["vision_model"]["sha256"] != MODEL_SHA256:
        raise ValueError("Pinned q4 model file hash changed.")
    if artifact_hashes["text_manifest"]["sha256"] != TEXT_MANIFEST_SHA256:
        raise ValueError("Pinned text manifest hash changed.")
    if artifact_hashes["text_vectors"]["sha256"] != TEXT_VECTORS_SHA256:
        raise ValueError("Pinned text vectors hash changed.")

    class_thresholds = {
        label: {
            "min_ood_margin": item["min_ood_margin"],
            "min_positive_margin": item["min_positive_margin"],
        }
        for label, item in thresholds.items()
    }
    return {
        "_comment": (
            "Candidate-only policy derived from already exposed q4 reports. "
            "It is not wired into the browser and must remain disabled until a "
            "new prediction-blind cohort passes the separate v2 gate."
        ),
        "candidate_id": "fixforward-siglip2-class-threshold-candidate-v2",
        "policy_version": 2,
        "release_ready": False,
        "recognition_enabled": False,
        "integration_status": "candidate_only_not_wired",
        "frozen_at_utc": FROZEN_AT_UTC,
        "enabled_classes": enabled,
        "manual_only_classes": manual_only,
        "model": {
            "repository": MODEL_REPOSITORY,
            "revision": MODEL_REVISION,
            "dtype": "q4",
            "sha256": MODEL_SHA256,
        },
        "artifact_hashes": artifact_hashes,
        "acceptance": {
            "rule": (
                "The top appliance label must be enabled and both thresholds "
                "for that winning label must pass. Never fall through to a "
                "lower-ranked enabled label."
            ),
            "comparison": "greater_than_or_equal",
            "class_thresholds": class_thresholds,
            "score_notice": (
                "Cosine margins are internal rejection evidence, not a user-facing "
                "confidence percentage."
            ),
        },
        "derivation": {
            "script": "scripts/derive-appliance-siglip-candidate-v2-policy.py",
            "evidence_scope": (
                "All four already observed q4 reports: calibration, ABO, Open "
                "Images and the failed v1 fresh-heldout report. The future v2 "
                "cohort was not opened or scored."
            ),
            "threshold_grid": {
                "minimum": 0.0,
                "maximum": GRID_MAXIMUM,
                "step": GRID_STEP,
                "pairs_per_class": (GRID_MAX_INDEX + 1) ** 2,
            },
            "selection_order": [
                "maximise accepted-correct operational photos",
                "require zero known-unsafe accepts",
                "maximise threshold sum without reducing that coverage",
                "maximise the smaller threshold",
                "maximise OOD margin, then positive margin",
            ],
            "known_unsafe_definition": (
                "Wrong operational winners, manual-only-class photos, true OOD, "
                "uncertain, explicitly rejected, and supported challenges whose "
                "winner differs from the audit's possible class."
            ),
            "matching_supported_challenge_rule": (
                "A matching supported challenge may pass but is excluded from "
                "operational coverage and release evidence."
            ),
            "minimum_observed_safe_accepts_to_enable_class": MIN_OBSERVED_SAFE_ACCEPTS,
            "input_hashes": provenance,
        },
        "observed_development_evidence": {
            **summary,
            "coverage_percent": round(summary["coverage"] * 100, 2),
            "threshold_search": {
                label: {
                    "observed_correct_winners": derived_all[label]["observed_correct_winners"],
                    "observed_unsafe_winners": derived_all[label]["observed_unsafe_winners"],
                    "selected_accepted_correct": derived_all[label]["accepted_correct"],
                    "eligible": derived_all[label]["eligible"],
                }
                for label in SUPPORTED_CLASSES
            },
            "limitations": [
                "This 115/157 result is development evidence because every score report used to choose the thresholds has been exposed.",
                "The observed rows are not a population-accuracy estimate and do not prove household or tablet performance.",
                "A new frozen cohort must test this exact table without threshold, prompt or class changes.",
            ],
        },
    }


def build_gate(policy: dict[str, Any], policy_hash: str) -> dict[str, Any]:
    """Build the preregistered whole-candidate gate for untouched v2 data."""

    return {
        "_comment": (
            "Frozen before any candidate-v2 prediction on a new cohort. Any "
            "failed aggregate or per-class criterion keeps the entire helper "
            "disabled; classes may not be removed after results are opened."
        ),
        "gate_id": "fixforward-siglip2-candidate-v2-fresh-release-gate",
        "gate_version": 2,
        "frozen_at_utc": FROZEN_AT_UTC,
        "release_ready": False,
        "recognition_enabled": False,
        "candidate_policy": {
            "path": "model/appliance-siglip/candidate-v2-policy.json",
            "sha256": policy_hash,
            "candidate_id": policy["candidate_id"],
        },
        "frozen_candidate": {
            "model_sha256": policy["model"]["sha256"],
            "text_manifest_sha256": policy["artifact_hashes"]["text_manifest"]["sha256"],
            "text_vectors_sha256": policy["artifact_hashes"]["text_vectors"]["sha256"],
            "enabled_classes": policy["enabled_classes"],
            "manual_only_classes": policy["manual_only_classes"],
            "class_thresholds": policy["acceptance"]["class_thresholds"],
        },
        "fresh_cohort_minimums": {
            "audited_eligible_operational_positives": 40,
            "audited_operational_positives_per_enabled_class": 2,
            "audited_true_ood": 100,
            "distinct_true_ood_source_groups": 18,
        },
        "pass_criteria": {
            "minimum_eligible_operational_coverage": 0.5,
            "minimum_accepted_correct_per_enabled_class": 1,
            "maximum_wrong_enabled_class_accepts": 0,
            "maximum_manual_only_class_accepts": 0,
            "maximum_true_ood_accepts": 0,
            "per_class_wrong_accepts_must_be_zero": True,
        },
        "whole_candidate_failure_policy": {
            "any_unmet_aggregate_condition_fails_candidate": True,
            "any_enabled_class_below_two_audited_positives_fails_candidate": True,
            "any_enabled_class_without_an_accepted_correct_example_fails_candidate": True,
            "any_enabled_class_wrong_accept_fails_candidate": True,
            "post_test_class_removal_is_forbidden": True,
            "failure_action": (
                "Keep release_ready and recognition_enabled false. Treat the "
                "opened cohort as development evidence for any later candidate."
            ),
        },
        "cohort_lock_requirements": {
            "labels_and_audits_frozen_before_predictions": True,
            "source_group_labels_frozen_before_predictions": True,
            "no_identity_overlap_with_derivation_evidence": True,
            "no_threshold_prompt_model_or_class_changes_after_lock": True,
            "model_outputs_scores_and_thresholds_hidden_from_visual_auditors": True,
        },
        "scope": (
            "Passing this offline gate would justify a separate local browser "
            "review only. It would not itself authorize a public deployment or "
            "establish real-tablet performance."
        ),
    }


def write_or_check(path: Path, content: bytes, check: bool) -> None:
    """Write deterministic bytes or verify an existing artifact exactly."""

    if check:
        if not path.exists() or path.read_bytes() != content:
            raise ValueError(f"Artifact is missing or stale: {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def main() -> None:
    """Derive the policy, bind the gate to its hash, then write/check both."""

    args = parse_args()
    root = args.repo_root.resolve()
    policy_path = args.policy_output if args.policy_output.is_absolute() else root / args.policy_output
    gate_path = args.gate_output if args.gate_output.is_absolute() else root / args.gate_output
    policy = build_policy(root)
    policy_content = json_bytes(policy)
    policy_hash = hashlib.sha256(policy_content).hexdigest()
    gate = build_gate(policy, policy_hash)
    gate_content = json_bytes(gate)
    write_or_check(policy_path, policy_content, args.check)
    write_or_check(gate_path, gate_content, args.check)
    print(
        json.dumps(
            {
                "policy": relative(policy_path, root),
                "policy_sha256": policy_hash,
                "gate": relative(gate_path, root),
                "gate_sha256": hashlib.sha256(gate_content).hexdigest(),
                "enabled_classes": len(policy["enabled_classes"]),
                "accepted_correct": policy["observed_development_evidence"]["accepted_correct"],
                "eligible_operational_positives": policy["observed_development_evidence"]["eligible_operational_positives"],
                "coverage_percent": policy["observed_development_evidence"]["coverage_percent"],
                "release_ready": policy["release_ready"],
                "recognition_enabled": policy["recognition_enabled"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
