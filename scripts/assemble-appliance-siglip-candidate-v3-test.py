"""Assemble the prediction-blind candidate-v3 test cohort.

The command accepts two frozen source manifests, one for operational-positive
candidates and one for true-OOD candidates, plus one combined reconciled blind
audit.  It never imports a classifier, loads a model, or reads predictions or
scores.  Model and text artifacts are handled only as opaque files whose hashes
must match the already frozen candidate policy and release gate.

For identical inputs, all three outputs are byte-for-byte deterministic.  The
default mode refuses to replace any output.  ``--check`` regenerates everything
in memory and compares it with existing outputs without writing.

Frozen source-manifest schema (JSON object):

* ``schema_version``: 1
* ``manifest_id``: non-empty string
* ``cohort_role``: ``positives`` or ``ood``
* ``frozen_at_utc``: UTC timestamp
* ``selection_uses_model_predictions``: false
* ``model_outputs_opened``: false
* ``prediction_scores_opened``: false
* ``rows``: objects containing exactly ``row_id``, ``source_dataset``,
  ``source_asset_id``, ``downloaded_jpeg`` and ``sha256``

The combined audit binds both manifests and exactly two independent source
audits by path, size, SHA-256, ID and timestamp.  Its rows bind every manifest
row in manifest order and assign it to an enabled operational class, a
manual-only class, true OOD, or exclusion as uncertain.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT_VERSION = 2
CANDIDATE_ID = "fixforward-siglip2-selective-class-threshold-candidate-v3"

# This exact surface was frozen before any candidate-v3 cohort prediction.
ENABLED_CLASSES = (
    "air_fryer",
    "coffee_machine",
    "fan",
    "hair_dryer",
    "kettle",
    "microwave",
    "portable_ac",
    "portable_heater",
    "rice_cooker",
    "sandwich_press",
    "straightener",
)
MANUAL_ONLY_CLASSES = (
    "blender",
    "food_processor",
    "mixer",
    "shaver",
    "toaster",
    "vaccum_cleaner",
    "dehumidifier",
    "steam_cleaner",
)
ALL_OPERATIONAL_CLASSES = frozenset((*ENABLED_CLASSES, *MANUAL_ONLY_CLASSES))

EXPECTED_MINIMUMS = {
    "audited_eligible_operational_positives": 33,
    "audited_operational_positives_per_enabled_class": 3,
    "audited_true_ood": 120,
    "distinct_true_ood_source_groups": 20,
}
EXPECTED_PASS_CRITERIA = {
    "minimum_eligible_operational_coverage": 0.5,
    "minimum_accepted_correct_per_enabled_class": 1,
    "maximum_wrong_enabled_class_accepts": 0,
    "maximum_manual_only_class_accepts": 0,
    "maximum_true_ood_accepts": 0,
    "per_class_wrong_accepts_must_be_zero": True,
}
ASSIGNMENTS = frozenset(
    {
        "eligible_operational_positive",
        "manual_only_operational_positive",
        "true_ood",
        "exclude_uncertain",
    }
)
MANIFEST_KEYS = frozenset(
    {
        "schema_version",
        "manifest_id",
        "cohort_role",
        "frozen_at_utc",
        "selection_uses_model_predictions",
        "model_outputs_opened",
        "prediction_scores_opened",
        "rows",
    }
)
MANIFEST_ROW_KEYS = frozenset(
    {"row_id", "source_dataset", "source_asset_id", "downloaded_jpeg", "sha256"}
)
AUDIT_KEYS = frozenset(
    {
        "schema_version",
        "audit_id",
        "audit_type",
        "frozen_at_utc",
        "inputs",
        "blindness_attestations",
        "rows",
        "summary",
    }
)
AUDIT_INPUT_KEYS = frozenset({"source_manifests", "independent_audits"})
MANIFEST_DECLARATION_KEYS = frozenset(
    {"manifest_id", "path", "bytes", "sha256", "frozen_at_utc"}
)
INDEPENDENT_AUDIT_DECLARATION_KEYS = frozenset(
    {"audit_id", "auditor_id", "path", "bytes", "sha256", "frozen_at_utc"}
)
AUDIT_ROW_KEYS = frozenset(
    {
        "row_key",
        "source_role",
        "source_row_id",
        "downloaded_jpeg",
        "sha256",
        "final_assignment",
        "final_class",
        "true_ood_source_group",
        "reconciliation_status",
    }
)
BLINDNESS_KEYS = frozenset(
    {
        "auditors_independent_before_reconciliation",
        "model_outputs_opened",
        "prediction_scores_opened",
        "policy_gate_or_thresholds_opened_by_visual_auditors",
        "selection_used_model_predictions",
    }
)
SUMMARY_KEYS = frozenset(
    {"total_rows", "final_assignment_counts", "final_class_counts", "true_ood_by_group"}
)
HEX64 = frozenset("0123456789abcdef")
ROW_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class AssemblyError(ValueError):
    """Raised when an input violates a frozen assembly invariant."""


@dataclass(frozen=True)
class ManifestRow:
    """One verified source row and its canonical identity."""

    role: str
    row_number: int
    row_id: str
    row_key: str
    source_dataset: str
    source_asset_id: str
    source_identity: str
    downloaded_jpeg: str
    sha256: str


@dataclass(frozen=True)
class FrozenManifest:
    """One fully validated source manifest."""

    role: str
    path: Path
    repo_path: str
    file_sha256: str
    bytes: int
    manifest_id: str
    frozen_at: datetime
    frozen_at_text: str
    rows: tuple[ManifestRow, ...]


def fail(message: str) -> None:
    """Stop assembly with one concise closed-failure message."""

    raise AssemblyError(message)


def require_object(value: Any, description: str) -> dict[str, Any]:
    """Return a JSON object or fail closed."""

    if not isinstance(value, dict):
        fail(f"{description} must be a JSON object.")
    return value


def require_list(value: Any, description: str) -> list[Any]:
    """Return a JSON list or fail closed."""

    if not isinstance(value, list):
        fail(f"{description} must be a JSON list.")
    return value


def require_string(value: Any, description: str) -> str:
    """Return one non-empty string without changing its spelling."""

    if not isinstance(value, str) or not value.strip():
        fail(f"{description} must be a non-empty string.")
    return value


def require_false(value: Any, description: str) -> None:
    """Require an explicit false value rather than truthy coercion."""

    if value is not False:
        fail(f"{description} must be false.")


def require_true(value: Any, description: str) -> None:
    """Require an explicit true value rather than truthy coercion."""

    if value is not True:
        fail(f"{description} must be true.")


def require_sha256(value: Any, description: str) -> str:
    """Accept only canonical lowercase SHA-256 text."""

    value = require_string(value, description)
    if len(value) != 64 or any(character not in HEX64 for character in value):
        fail(f"{description} must be a lowercase 64-character SHA-256.")
    return value


def require_exact_keys(
    value: dict[str, Any], expected: frozenset[str], description: str
) -> None:
    """Reject missing and undeclared fields in a strict evidence structure."""

    actual = frozenset(value)
    if actual == expected:
        return
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    details: list[str] = []
    if missing:
        details.append(f"missing {', '.join(missing)}")
    if extra:
        details.append(f"unexpected {', '.join(extra)}")
    fail(f"{description} has invalid fields ({'; '.join(details)}).")


def sha256_file(path: Path) -> str:
    """Hash one file as opaque bytes without interpreting its contents."""

    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
    except OSError as error:
        fail(f"Cannot hash {path}: {error}")
    return digest.hexdigest()


def sha256_bytes(content: bytes) -> str:
    """Hash deterministic output bytes before any write."""

    return hashlib.sha256(content).hexdigest()


def read_json(path: Path, description: str) -> dict[str, Any]:
    """Read one required JSON object with a useful failure message."""

    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as error:
        fail(f"Cannot read {description} at {path}: {error}")
    try:
        # Duplicate keys could make a displayed audit differ from its parsed
        # label. Evidence JSON must have one unambiguous value for every field.
        def unique_object(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    fail(f"Duplicate JSON key {key!r} in {description}.")
                result[key] = value
            return result

        return require_object(json.loads(raw, object_pairs_hook=unique_object), description)
    except json.JSONDecodeError as error:
        fail(f"Invalid JSON in {description} at {path}: {error}")


def parse_utc(value: Any, description: str) -> datetime:
    """Parse a timezone-explicit UTC timestamp."""

    text = require_string(value, description)
    if not text.endswith("Z"):
        fail(f"{description} must end in Z.")
    try:
        parsed = datetime.fromisoformat(f"{text[:-1]}+00:00")
    except ValueError:
        fail(f"{description} is not a valid ISO-8601 UTC timestamp.")
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        fail(f"{description} must be UTC.")
    return parsed.astimezone(timezone.utc)


def format_utc(value: datetime) -> str:
    """Write deterministic UTC timestamps with millisecond precision."""

    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def canonical_json_bytes(value: Any) -> bytes:
    """Serialize stable JSON used by both output files and their hashes."""

    return (
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")


def resolve_cli_file(repo_root: Path, supplied: Path, description: str) -> Path:
    """Resolve one explicit CLI file and keep it inside the repository."""

    candidate = supplied if supplied.is_absolute() else repo_root / supplied
    if candidate.is_symlink():
        fail(f"{description} must not be a symlink: {candidate}")
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(repo_root)
    except (OSError, ValueError) as error:
        fail(f"Cannot resolve {description} inside the repository: {candidate}: {error}")
    if not resolved.is_file():
        fail(f"{description} is not a regular file: {resolved}")
    return resolved


def repo_relative(repo_root: Path, path: Path, description: str) -> str:
    """Return one canonical POSIX path inside the repository."""

    try:
        return path.resolve(strict=True).relative_to(repo_root).as_posix()
    except (OSError, ValueError) as error:
        fail(f"{description} must stay inside the repository: {path}: {error}")


def resolve_declared_file(
    repo_root: Path, path_text: Any, description: str
) -> tuple[str, Path]:
    """Resolve a JSON-declared POSIX path without traversal or symlink aliases."""

    path_text = require_string(path_text, f"{description} path")
    pure = PurePosixPath(path_text)
    if (
        pure.is_absolute()
        or pure.as_posix() != path_text
        or "\\" in path_text
        or not pure.parts
        or any(part in {"", ".", ".."} for part in pure.parts)
    ):
        fail(f"{description} path must be a normalized repository-relative POSIX path.")
    candidate = repo_root.joinpath(*pure.parts)
    if candidate.is_symlink():
        fail(f"{description} path must not be a symlink: {path_text}")
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(repo_root)
    except (OSError, ValueError) as error:
        fail(f"Cannot resolve {description} path {path_text}: {error}")
    if not resolved.is_file():
        fail(f"{description} path is not a regular file: {path_text}")
    canonical = resolved.relative_to(repo_root).as_posix()
    if canonical != path_text:
        fail(f"{description} path must use canonical spelling {canonical!r}.")
    return canonical, resolved


def visual_decision(row: Any, description: str) -> tuple[str, str | None, str | None]:
    """Read policy-blind labels; visual reviewers never need the class partition."""

    row = require_object(row, description)
    require_exact_keys(row, frozenset({
        "row_key", "assignment", "class_label", "true_ood_source_group", "reason"
    }), description)
    require_string(row.get("reason"), f"{description} visual reason")
    assignment, label, group = (
        row.get("assignment"), row.get("class_label"), row.get("true_ood_source_group")
    )
    if assignment == "operational_positive":
        if not isinstance(label, str) or label not in ALL_OPERATIONAL_CLASSES or group is not None:
            fail(f"{description} needs one supported visual class and no OOD group.")
    elif assignment == "true_ood":
        if label is not None or not isinstance(group, str) or not group.strip():
            fail(f"{description} needs an OOD group and no supported class.")
    elif assignment != "exclude_uncertain" or label is not None or group is not None:
        fail(f"{description} has an invalid or ambiguous visual assignment.")
    return assignment, label, group


def validate_reconciliation(row: dict[str, Any], decisions: list[tuple], description: str) -> None:
    """Bind final labels to actual independent observations, not attestations alone.

    Agreement must be preserved exactly. Disagreements are conservatively
    excluded in this bounded evaluation; retaining them requires a separately
    recorded adjudication workflow rather than silently choosing an answer.
    """

    assignment, label, group = validate_assignment(row, 0)
    final = (
        "operational_positive" if assignment.endswith("operational_positive") else assignment,
        label, group,
    )
    agree = decisions[0] == decisions[1]
    if agree:
        if row.get("reconciliation_status") != "agreed" or final != decisions[0]:
            fail(f"{description} must preserve both independent auditors' agreed decision.")
    elif row.get("reconciliation_status") != "resolved" or final != ("exclude_uncertain", None, None):
        fail(f"{description} disagreement must be resolved as exclude_uncertain.")


def validate_manifest(
    repo_root: Path,
    path: Path,
    expected_role: str,
    seen_row_ids: set[str],
    seen_identities: set[str],
    seen_paths: set[str],
    seen_hashes: set[str],
) -> FrozenManifest:
    """Validate one frozen source manifest and every referenced image."""

    document = read_json(path, f"{expected_role} source manifest")
    require_exact_keys(document, MANIFEST_KEYS, f"{expected_role} source manifest")
    if document.get("schema_version") != 1:
        fail(f"{expected_role} source manifest schema_version must be 1.")
    if document.get("cohort_role") != expected_role:
        fail(f"{expected_role} source manifest cohort_role must be {expected_role!r}.")
    manifest_id = require_string(
        document.get("manifest_id"), f"{expected_role} source manifest_id"
    )
    frozen_at_text = require_string(
        document.get("frozen_at_utc"), f"{expected_role} manifest frozen_at_utc"
    )
    frozen_at = parse_utc(frozen_at_text, f"{expected_role} manifest frozen_at_utc")
    require_false(
        document.get("selection_uses_model_predictions"),
        f"{expected_role} manifest selection_uses_model_predictions",
    )
    require_false(
        document.get("model_outputs_opened"),
        f"{expected_role} manifest model_outputs_opened",
    )
    require_false(
        document.get("prediction_scores_opened"),
        f"{expected_role} manifest prediction_scores_opened",
    )
    source_rows = require_list(document.get("rows"), f"{expected_role} manifest rows")
    if not source_rows:
        fail(f"{expected_role} source manifest must contain at least one row.")

    rows: list[ManifestRow] = []
    for row_number, raw_row in enumerate(source_rows, start=1):
        row = require_object(raw_row, f"{expected_role} manifest row {row_number}")
        require_exact_keys(
            row, MANIFEST_ROW_KEYS, f"{expected_role} manifest row {row_number}"
        )
        row_id = require_string(
            row.get("row_id"), f"{expected_role} manifest row {row_number} row_id"
        )
        if not ROW_ID_PATTERN.fullmatch(row_id):
            fail(
                f"{expected_role} manifest row {row_number} row_id must match "
                "[A-Za-z0-9][A-Za-z0-9._-]{0,127}."
            )
        if row_id in seen_row_ids:
            fail(f"Duplicate row_id across source manifests: {row_id}")
        seen_row_ids.add(row_id)
        source_dataset = require_string(
            row.get("source_dataset"),
            f"{expected_role} manifest row {row_number} source_dataset",
        )
        source_asset_id = require_string(
            row.get("source_asset_id"),
            f"{expected_role} manifest row {row_number} source_asset_id",
        )
        # Dataset spelling differences must not let the same source identity
        # enter both manifests. Asset IDs retain their case-sensitive meaning.
        source_identity = f"{source_dataset.strip().casefold()}\x1f{source_asset_id.strip()}"
        if source_identity in seen_identities:
            fail(
                "Duplicate source identity across source manifests: "
                f"{source_dataset}:{source_asset_id}"
            )
        seen_identities.add(source_identity)
        downloaded_jpeg, image_path = resolve_declared_file(
            repo_root,
            row.get("downloaded_jpeg"),
            f"{expected_role} manifest row {row_number} downloaded_jpeg",
        )
        expected_hash = require_sha256(
            row.get("sha256"), f"{expected_role} manifest row {row_number} sha256"
        )
        actual_hash = sha256_file(image_path)
        if actual_hash != expected_hash:
            fail(
                f"{expected_role} manifest row {row_number} SHA-256 does not match its file."
            )
        if downloaded_jpeg in seen_paths:
            fail(f"Duplicate evaluated image path across source manifests: {downloaded_jpeg}")
        if actual_hash in seen_hashes:
            fail(f"Duplicate evaluated image SHA-256 across source manifests: {actual_hash}")
        seen_paths.add(downloaded_jpeg)
        seen_hashes.add(actual_hash)
        rows.append(
            ManifestRow(
                role=expected_role,
                row_number=row_number,
                row_id=row_id,
                row_key=f"{expected_role}:{row_id}",
                source_dataset=source_dataset,
                source_asset_id=source_asset_id,
                source_identity=source_identity,
                downloaded_jpeg=downloaded_jpeg,
                sha256=actual_hash,
            )
        )

    return FrozenManifest(
        role=expected_role,
        path=path,
        repo_path=repo_relative(repo_root, path, f"{expected_role} source manifest"),
        file_sha256=sha256_file(path),
        bytes=path.stat().st_size,
        manifest_id=manifest_id,
        frozen_at=frozen_at,
        frozen_at_text=frozen_at_text,
        rows=tuple(rows),
    )


def validate_manifest_declaration(
    declaration: Any, manifest: FrozenManifest, description: str
) -> dict[str, Any]:
    """Match one combined-audit declaration to an exact source manifest."""

    declared = require_object(declaration, description)
    require_exact_keys(declared, MANIFEST_DECLARATION_KEYS, description)
    expected = {
        "manifest_id": manifest.manifest_id,
        "path": manifest.repo_path,
        "bytes": manifest.bytes,
        "sha256": manifest.file_sha256,
        "frozen_at_utc": manifest.frozen_at_text,
    }
    if declared != expected:
        fail(f"{description} does not bind the exact frozen source manifest.")
    return expected


def validate_independent_audits(
    repo_root: Path,
    declarations: Any,
    manifests: dict[str, FrozenManifest],
    expected_row_keys: list[str],
) -> tuple[list[dict[str, Any]], datetime, dict[str, list[tuple]]]:
    """Bind two distinct independent blind audits and verify their coverage."""

    items = require_list(declarations, "combined audit independent_audits")
    if len(items) != 2:
        fail("Combined audit must bind exactly two independent audits.")
    seen_paths: set[str] = set()
    seen_hashes: set[str] = set()
    seen_ids: set[str] = set()
    seen_auditors: set[str] = set()
    provenance: list[dict[str, Any]] = []
    decisions_by_id = {key: [] for key in expected_row_keys}
    latest = max(manifest.frozen_at for manifest in manifests.values())
    manifest_hashes = {
        "positives": manifests["positives"].file_sha256,
        "ood": manifests["ood"].file_sha256,
    }

    for index, raw_declaration in enumerate(items, start=1):
        description = f"independent audit declaration {index}"
        declaration = require_object(raw_declaration, description)
        require_exact_keys(
            declaration, INDEPENDENT_AUDIT_DECLARATION_KEYS, description
        )
        path_text, audit_path = resolve_declared_file(
            repo_root, declaration.get("path"), description
        )
        file_hash = sha256_file(audit_path)
        file_bytes = audit_path.stat().st_size
        if declaration.get("path") != path_text:
            fail(f"{description} path is not canonical.")
        if declaration.get("bytes") != file_bytes:
            fail(f"{description} byte length does not match its file.")
        if require_sha256(declaration.get("sha256"), f"{description} sha256") != file_hash:
            fail(f"{description} SHA-256 does not match its file.")
        if path_text in seen_paths or file_hash in seen_hashes:
            fail("Independent audits must use distinct paths and distinct hashes.")
        seen_paths.add(path_text)
        seen_hashes.add(file_hash)

        audit = read_json(audit_path, description)
        if audit.get("schema_version") != 1:
            fail(f"{description} schema_version must be 1.")
        if audit.get("audit_type") != "prediction_blind_independent_visual_audit":
            fail(f"{description} audit_type is not approved.")
        audit_id = require_string(audit.get("audit_id"), f"{description} audit_id")
        auditor_id = require_string(audit.get("auditor_id"), f"{description} auditor_id")
        frozen_at_text = require_string(
            audit.get("frozen_at_utc"), f"{description} frozen_at_utc"
        )
        frozen_at = parse_utc(frozen_at_text, f"{description} frozen_at_utc")
        if audit_id in seen_ids or auditor_id in seen_auditors:
            fail("Independent audits must use distinct audit_id and auditor_id values.")
        seen_ids.add(audit_id)
        seen_auditors.add(auditor_id)
        if frozen_at <= max(manifest.frozen_at for manifest in manifests.values()):
            fail("Each independent audit must be frozen after both source manifests.")
        latest = max(latest, frozen_at)
        for field in (
            "model_outputs_opened",
            "prediction_scores_opened",
            "policy_gate_or_thresholds_opened",
        ):
            require_false(audit.get(field), f"{description} {field}")
        if audit.get("source_manifest_hashes") != manifest_hashes:
            fail(f"{description} source_manifest_hashes do not match both manifests.")
        reviewed = require_list(
            audit.get("reviewed_row_keys"), f"{description} reviewed_row_keys"
        )
        if reviewed != expected_row_keys or len(reviewed) != len(set(reviewed)):
            fail(f"{description} must review every source row exactly once in order.")
        decisions = require_list(audit.get("rows"), f"{description} rows")
        if len(decisions) != len(expected_row_keys):
            fail(f"{description} must give a visual decision for every source row.")
        for row_number, (decision, expected_key) in enumerate(zip(decisions, expected_row_keys), 1):
            parsed = visual_decision(decision, f"{description} row {row_number}")
            if decision.get("row_key") != expected_key:
                fail(f"{description} visual decisions must follow source-manifest order.")
            decisions_by_id[expected_key].append(parsed)

        expected_declaration = {
            "audit_id": audit_id,
            "auditor_id": auditor_id,
            "path": path_text,
            "bytes": file_bytes,
            "sha256": file_hash,
            "frozen_at_utc": frozen_at_text,
        }
        if declaration != expected_declaration:
            fail(f"{description} does not match the referenced audit identity or timestamp.")
        provenance.append(expected_declaration)

    return provenance, latest, decisions_by_id


def validate_assignment(
    row: dict[str, Any], row_number: int
) -> tuple[str, str | None, str | None]:
    """Validate one reconciled final assignment against the frozen class split."""

    assignment = require_string(
        row.get("final_assignment"), f"combined audit row {row_number} final_assignment"
    )
    if assignment not in ASSIGNMENTS:
        fail(f"Combined audit row {row_number} has unknown assignment {assignment!r}.")
    final_class = row.get("final_class")
    group = row.get("true_ood_source_group")
    if assignment == "eligible_operational_positive":
        if final_class not in ENABLED_CLASSES or group is not None:
            fail(
                f"Combined audit row {row_number} eligible assignment needs exactly "
                "one frozen enabled class and no OOD group."
            )
    elif assignment == "manual_only_operational_positive":
        if final_class not in MANUAL_ONLY_CLASSES or group is not None:
            fail(
                f"Combined audit row {row_number} manual-only assignment needs exactly "
                "one frozen manual-only class and no OOD group."
            )
    elif assignment == "true_ood":
        if final_class is not None or not isinstance(group, str) or not group.strip():
            fail(
                f"Combined audit row {row_number} true-OOD assignment needs one "
                "non-empty source group and no class."
            )
    elif final_class is not None or group is not None:
        fail(
            f"Combined audit row {row_number} excluded assignment must have no class "
            "or OOD group."
        )
    return assignment, final_class, group


def validate_declared_summary(
    summary: Any,
    assignments: Counter[str],
    classes: Counter[str],
    groups: Counter[str],
    total_rows: int,
) -> None:
    """Cross-check every combined-audit summary count against its rows."""

    declared = require_object(summary, "combined audit summary")
    require_exact_keys(declared, SUMMARY_KEYS, "combined audit summary")
    if declared.get("total_rows") != total_rows:
        fail("Combined audit summary total_rows does not match its rows.")
    expected_assignments = {name: assignments[name] for name in sorted(ASSIGNMENTS)}
    expected_classes = {name: classes[name] for name in (*ENABLED_CLASSES, *MANUAL_ONLY_CLASSES)}
    expected_groups = {name: groups[name] for name in sorted(groups)}
    if declared.get("final_assignment_counts") != expected_assignments:
        fail("Combined audit summary final_assignment_counts do not match its rows.")
    if declared.get("final_class_counts") != expected_classes:
        fail("Combined audit summary final_class_counts do not match its rows.")
    if declared.get("true_ood_by_group") != expected_groups:
        fail("Combined audit summary true_ood_by_group does not match its rows.")


def validate_combined_audit(
    repo_root: Path,
    audit_path: Path,
    manifests: dict[str, FrozenManifest],
) -> tuple[
    dict[str, str],
    list[str],
    dict[str, str],
    list[str],
    dict[str, dict[str, Any]],
    dict[str, Any],
    datetime,
    str,
]:
    """Validate the combined reconciliation and return evaluator partitions."""

    audit = read_json(audit_path, "combined reconciled blind audit")
    require_exact_keys(audit, AUDIT_KEYS, "combined reconciled blind audit")
    if audit.get("schema_version") != 1:
        fail("Combined reconciled blind audit schema_version must be 1.")
    if audit.get("audit_type") != "prediction_blind_two_auditor_reconciliation":
        fail("Combined reconciled blind audit audit_type is not approved.")
    audit_id = require_string(audit.get("audit_id"), "combined audit_id")
    frozen_at_text = require_string(
        audit.get("frozen_at_utc"), "combined audit frozen_at_utc"
    )
    frozen_at = parse_utc(frozen_at_text, "combined audit frozen_at_utc")

    inputs = require_object(audit.get("inputs"), "combined audit inputs")
    require_exact_keys(inputs, AUDIT_INPUT_KEYS, "combined audit inputs")
    declared_manifests = require_object(
        inputs.get("source_manifests"), "combined audit source_manifests"
    )
    require_exact_keys(
        declared_manifests,
        frozenset({"positives", "ood"}),
        "combined audit source_manifests",
    )
    for role, manifest in manifests.items():
        validate_manifest_declaration(
            declared_manifests.get(role), manifest, f"combined audit {role} manifest"
        )

    all_manifest_rows = [
        row for role in ("positives", "ood") for row in manifests[role].rows
    ]
    expected_row_keys = [row.row_key for row in all_manifest_rows]
    independent_provenance, latest_independent_time, independent_decisions = validate_independent_audits(
        repo_root,
        inputs.get("independent_audits"),
        manifests,
        expected_row_keys,
    )
    if frozen_at <= latest_independent_time:
        fail("Combined reconciliation must be frozen after both independent audits.")

    blindness = require_object(
        audit.get("blindness_attestations"), "combined audit blindness_attestations"
    )
    require_exact_keys(blindness, BLINDNESS_KEYS, "combined audit blindness_attestations")
    require_true(
        blindness.get("auditors_independent_before_reconciliation"),
        "combined audit auditors_independent_before_reconciliation",
    )
    for field in (
        "model_outputs_opened",
        "prediction_scores_opened",
        "policy_gate_or_thresholds_opened_by_visual_auditors",
        "selection_used_model_predictions",
    ):
        require_false(blindness.get(field), f"combined audit {field}")

    audit_rows = require_list(audit.get("rows"), "combined audit rows")
    if len(audit_rows) != len(all_manifest_rows):
        fail("Combined audit must contain exactly one row for every source-manifest row.")
    operational: dict[str, str] = {}
    true_ood_ids: list[str] = []
    ood_groups: dict[str, str] = {}
    excluded_ids: list[str] = []
    provenance_by_id: dict[str, dict[str, Any]] = {}
    assignments: Counter[str] = Counter()
    classes: Counter[str] = Counter()
    groups: Counter[str] = Counter()

    for index, (raw_audit_row, source_row) in enumerate(
        zip(audit_rows, all_manifest_rows), start=1
    ):
        row = require_object(raw_audit_row, f"combined audit row {index}")
        require_exact_keys(row, AUDIT_ROW_KEYS, f"combined audit row {index}")
        if row.get("row_key") != source_row.row_key:
            fail(f"Combined audit row {index} is not in exact source-manifest order.")
        expected_bindings = {
            "source_role": source_row.role,
            "source_row_id": source_row.row_id,
            "downloaded_jpeg": source_row.downloaded_jpeg,
            "sha256": source_row.sha256,
        }
        for field, expected in expected_bindings.items():
            if row.get(field) != expected:
                fail(f"Combined audit row {index} {field} does not match its source row.")
        if row.get("reconciliation_status") not in {"agreed", "resolved"}:
            fail(
                f"Combined audit row {index} reconciliation_status must be agreed or resolved."
            )
        assignment, final_class, group = validate_assignment(row, index)
        validate_reconciliation(row, independent_decisions[source_row.row_key], f"Combined audit row {index}")
        assignments[assignment] += 1
        if final_class is not None:
            classes[final_class] += 1
        if group is not None:
            groups[group] += 1

        image_id = source_row.row_key
        retained = assignment != "exclude_uncertain"
        if assignment in {
            "eligible_operational_positive",
            "manual_only_operational_positive",
        }:
            operational[image_id] = final_class
        elif assignment == "true_ood":
            true_ood_ids.append(image_id)
            ood_groups[image_id] = group
        else:
            excluded_ids.append(image_id)
        provenance_by_id[image_id] = {
            "audit_row_number": index,
            "downloaded_jpeg": source_row.downloaded_jpeg,
            "final_assignment": assignment,
            "final_class": final_class,
            "reconciliation_status": row.get("reconciliation_status"),
            "retained": retained,
            "sha256": source_row.sha256,
            "source_asset_id": source_row.source_asset_id,
            "source_dataset": source_row.source_dataset,
            "source_identity": f"{source_row.source_dataset}:{source_row.source_asset_id}",
            "source_manifest_role": source_row.role,
            "source_manifest_row_number": source_row.row_number,
            "true_ood_source_group": group,
        }

    validate_declared_summary(
        audit.get("summary"), assignments, classes, groups, len(audit_rows)
    )
    audit_provenance = {
        "audit_id": audit_id,
        "path": repo_relative(repo_root, audit_path, "combined audit"),
        "bytes": audit_path.stat().st_size,
        "sha256": sha256_file(audit_path),
        "frozen_at_utc": frozen_at_text,
        "independent_audits": independent_provenance,
    }
    return (
        operational,
        true_ood_ids,
        ood_groups,
        excluded_ids,
        provenance_by_id,
        audit_provenance,
        frozen_at,
        frozen_at_text,
    )


def require_threshold_map(value: Any, description: str) -> dict[str, Any]:
    """Validate a complete finite threshold pair for every enabled class."""

    thresholds = require_object(value, description)
    if list(thresholds) != list(ENABLED_CLASSES):
        fail(f"{description} keys and order must exactly match enabled_classes.")
    for label, raw_pair in thresholds.items():
        pair = require_object(raw_pair, f"{description} {label}")
        require_exact_keys(
            pair,
            frozenset({"min_ood_margin", "min_positive_margin"}),
            f"{description} {label}",
        )
        for field in ("min_ood_margin", "min_positive_margin"):
            number = pair.get(field)
            if isinstance(number, bool) or not isinstance(number, (int, float)):
                fail(f"{description} {label} {field} must be numeric.")
            if not math.isfinite(number) or number < 0 or number > 1:
                fail(f"{description} {label} {field} must be finite from 0 through 1.")
    return thresholds


def validate_artifact_entry(
    repo_root: Path,
    policy: dict[str, Any],
    key: str,
    description: str,
) -> tuple[str, str, int]:
    """Validate one policy artifact path, size and hash against opaque bytes."""

    hashes = require_object(policy.get("artifact_hashes"), "candidate artifact_hashes")
    entry = require_object(hashes.get(key), description)
    required = frozenset({"path", "bytes", "sha256"})
    require_exact_keys(entry, required, description)
    path_text, path = resolve_declared_file(repo_root, entry.get("path"), description)
    expected_hash = require_sha256(entry.get("sha256"), f"{description} sha256")
    if entry.get("bytes") != path.stat().st_size:
        fail(f"{description} byte length does not match its file.")
    if sha256_file(path) != expected_hash:
        fail(f"{description} SHA-256 does not match its file.")
    return path_text, expected_hash, path.stat().st_size


def validate_frozen_candidate(
    repo_root: Path, policy_path: Path, gate_path: Path
) -> tuple[dict[str, str], datetime, dict[str, Any]]:
    """Bind the exact disabled v3 candidate, gate, model and text artifacts."""

    policy = read_json(policy_path, "candidate-v3 policy")
    gate = read_json(gate_path, "candidate-v3 release gate")
    policy_hash = sha256_file(policy_path)
    gate_hash = sha256_file(gate_path)
    if policy.get("candidate_id") != CANDIDATE_ID:
        fail("Candidate-v3 policy candidate_id is not the frozen selective candidate.")
    if policy.get("policy_version") != 2 or policy.get("candidate_generation") != 3:
        fail("Candidate-v3 policy must use policy_version 2 and candidate_generation 3.")
    require_false(policy.get("release_ready"), "candidate-v3 policy release_ready")
    require_false(
        policy.get("recognition_enabled"), "candidate-v3 policy recognition_enabled"
    )
    if policy.get("enabled_classes") != list(ENABLED_CLASSES):
        fail("Candidate-v3 enabled_classes do not match the frozen 11-class surface.")
    if policy.get("manual_only_classes") != list(MANUAL_ONLY_CLASSES):
        fail("Candidate-v3 manual_only_classes do not match the frozen 8-class surface.")
    if set(ENABLED_CLASSES) & set(MANUAL_ONLY_CLASSES) or len(ALL_OPERATIONAL_CLASSES) != 19:
        fail("Assembler class constants do not form the complete 19-class partition.")
    acceptance = require_object(policy.get("acceptance"), "candidate-v3 acceptance")
    thresholds = require_threshold_map(
        acceptance.get("class_thresholds"), "candidate-v3 class_thresholds"
    )
    policy_time = parse_utc(policy.get("frozen_at_utc"), "candidate-v3 frozen_at_utc")

    model = require_object(policy.get("model"), "candidate-v3 model")
    if model.get("dtype") != "q4":
        fail("Candidate-v3 model dtype must be q4.")
    model_repository = require_string(model.get("repository"), "model repository")
    model_revision = require_string(model.get("revision"), "model revision")
    model_hash = require_sha256(model.get("sha256"), "model sha256")
    _, vision_hash, _ = validate_artifact_entry(
        repo_root, policy, "vision_model", "candidate vision_model artifact"
    )
    if vision_hash != model_hash:
        fail("Candidate model and vision-model artifact SHA-256 values differ.")

    text_model = require_object(policy.get("text_model"), "candidate-v3 text_model")
    text_repository = require_string(
        text_model.get("repository"), "text model repository"
    )
    text_requested_revision = require_string(
        text_model.get("requested_revision"), "text model requested_revision"
    )
    text_resolved_revision = require_string(
        text_model.get("resolved_revision"), "text model resolved_revision"
    )
    _, text_manifest_hash, _ = validate_artifact_entry(
        repo_root, policy, "text_manifest", "candidate text_manifest artifact"
    )
    _, text_vectors_hash, _ = validate_artifact_entry(
        repo_root, policy, "text_vectors", "candidate text_vectors artifact"
    )

    if gate.get("gate_version") != 3:
        fail("Candidate-v3 release gate gate_version must be 3.")
    require_false(gate.get("release_ready"), "candidate-v3 gate release_ready")
    require_false(
        gate.get("recognition_enabled"), "candidate-v3 gate recognition_enabled"
    )
    gate_time = parse_utc(gate.get("frozen_at_utc"), "candidate-v3 gate frozen_at_utc")
    if gate_time < policy_time:
        fail("Candidate-v3 gate cannot be frozen before its policy.")
    gate_policy = require_object(gate.get("candidate_policy"), "gate candidate_policy")
    if gate_policy.get("candidate_id") != CANDIDATE_ID:
        fail("Gate candidate_id does not match candidate v3.")
    if require_sha256(
        gate_policy.get("sha256"), "gate candidate policy sha256"
    ) != policy_hash:
        fail("Gate does not bind the exact candidate-v3 policy file.")
    expected_policy_path = repo_relative(repo_root, policy_path, "candidate-v3 policy")
    if gate_policy.get("path") != expected_policy_path:
        fail("Gate candidate policy path does not match the supplied policy.")

    pre_registration = require_object(
        gate.get("pre_registration"), "gate pre_registration"
    )
    require_false(
        pre_registration.get("candidate_v3_predictions_generated"),
        "gate candidate_v3_predictions_generated",
    )
    require_false(
        pre_registration.get("candidate_v3_scores_opened"),
        "gate candidate_v3_scores_opened",
    )
    require_true(
        pre_registration.get("candidate_v2_fresh_results_are_development_evidence"),
        "gate candidate_v2_fresh_results_are_development_evidence",
    )

    frozen = require_object(gate.get("frozen_candidate"), "gate frozen_candidate")
    if frozen.get("policy_version") != 2 or frozen.get("candidate_generation") != 3:
        fail("Gate frozen_candidate version fields do not match candidate v3.")
    if frozen.get("enabled_classes") != list(ENABLED_CLASSES):
        fail("Gate enabled_classes do not match the frozen 11-class surface.")
    if frozen.get("manual_only_classes") != list(MANUAL_ONLY_CLASSES):
        fail("Gate manual_only_classes do not match the frozen 8-class surface.")
    if frozen.get("class_thresholds") != thresholds:
        fail("Gate class_thresholds do not exactly match the candidate-v3 policy.")
    if frozen.get("model_sha256") != model_hash:
        fail("Gate model_sha256 does not match the candidate-v3 policy.")
    if frozen.get("text_manifest_sha256") != text_manifest_hash:
        fail("Gate text_manifest_sha256 does not match candidate v3.")
    if frozen.get("text_vectors_sha256") != text_vectors_hash:
        fail("Gate text_vectors_sha256 does not match candidate v3.")
    frozen_vision = require_object(
        frozen.get("vision_model"), "gate frozen_candidate vision_model"
    )
    expected_vision = {
        "repository": model_repository,
        "revision": model_revision,
        "dtype": "q4",
        "sha256": model_hash,
    }
    if frozen_vision != expected_vision:
        fail("Gate vision model repository, revision, dtype or hash differs from policy.")
    frozen_text = require_object(
        frozen.get("text_model"), "gate frozen_candidate text_model"
    )
    expected_text = {
        "repository": text_repository,
        "requested_revision": text_requested_revision,
        "resolved_revision": text_resolved_revision,
        "manifest_sha256": text_manifest_hash,
        "vectors_sha256": text_vectors_hash,
    }
    if frozen_text != expected_text:
        fail("Gate text model revisions or hashes differ from candidate-v3 policy.")
    if gate.get("fresh_cohort_minimums") != EXPECTED_MINIMUMS:
        fail("Gate fresh-cohort minimums differ from the frozen v3 minimums.")
    if gate.get("pass_criteria") != EXPECTED_PASS_CRITERIA:
        fail("Gate pass criteria differ from the frozen v3 criteria.")
    failure_policy = require_object(
        gate.get("whole_candidate_failure_policy"),
        "gate whole_candidate_failure_policy",
    )
    require_true(
        failure_policy.get("post_test_class_removal_is_forbidden"),
        "gate post_test_class_removal_is_forbidden",
    )
    cohort_requirements = require_object(
        gate.get("cohort_lock_requirements"), "gate cohort_lock_requirements"
    )
    for field in (
        "new_untouched_cohort_required",
        "candidate_v2_fresh_cohort_reuse_forbidden",
        "labels_and_audits_frozen_before_predictions",
        "source_group_labels_frozen_before_predictions",
        "no_identity_overlap_with_candidate_v2_or_earlier_derivation_evidence",
        "no_threshold_prompt_model_text_artifact_or_class_changes_after_lock",
        "model_outputs_scores_and_thresholds_hidden_from_visual_auditors",
        "post_test_class_removal_is_forbidden",
    ):
        require_true(cohort_requirements.get(field), f"gate cohort requirement {field}")

    hashes = {
        "candidate_policy_sha256": policy_hash,
        "gate_sha256": gate_hash,
        "model_sha256": model_hash,
        "text_manifest_sha256": text_manifest_hash,
        "text_vectors_sha256": text_vectors_hash,
    }
    candidate_provenance = {
        "candidate_id": CANDIDATE_ID,
        "candidate_policy": {
            "path": expected_policy_path,
            "sha256": policy_hash,
            "frozen_at_utc": policy.get("frozen_at_utc"),
        },
        "gate": {
            "path": repo_relative(repo_root, gate_path, "candidate-v3 gate"),
            "sha256": gate_hash,
            "frozen_at_utc": gate.get("frozen_at_utc"),
        },
        "model": expected_vision,
        "text_model": expected_text,
        "enabled_classes": list(ENABLED_CLASSES),
        "manual_only_classes": list(MANUAL_ONLY_CLASSES),
        "fresh_cohort_minimums": EXPECTED_MINIMUMS,
    }
    return hashes, max(policy_time, gate_time), candidate_provenance


def validate_minimums(
    operational: dict[str, str], true_ood_ids: list[str], groups: dict[str, str],
    *, allow_incomplete: bool = False,
) -> dict[str, Any]:
    """Enforce release sample sizes, or explicitly report diagnostic shortfalls.

    Diagnostic mode does not change the frozen gate. It lets research measure
    rejection on available audited images while recording that release cannot
    pass. Invalid labels and inconsistent OOD groups are never permitted.
    """

    enabled_counts = Counter(
        label for label in operational.values() if label in ENABLED_CLASSES
    )
    manual_counts = Counter(
        label for label in operational.values() if label in MANUAL_ONLY_CLASSES
    )
    if len(operational) != sum(enabled_counts.values()) + sum(manual_counts.values()):
        fail("Operational audit map contains a class outside the frozen partition.")
    enabled_total = sum(enabled_counts.values())
    failures = []
    if enabled_total < EXPECTED_MINIMUMS["audited_eligible_operational_positives"]:
        failures.append("Final cohort needs at least 33 eligible operational positives.")
    missing = [
        label
        for label in ENABLED_CLASSES
        if enabled_counts[label]
        < EXPECTED_MINIMUMS["audited_operational_positives_per_enabled_class"]
    ]
    if missing:
        failures.append(
            "Final cohort needs at least three positives for every enabled class; "
            f"below minimum: {', '.join(missing)}."
        )
    if len(true_ood_ids) < EXPECTED_MINIMUMS["audited_true_ood"]:
        failures.append("Final cohort needs at least 120 audited true-OOD images.")
    if set(true_ood_ids) != set(groups):
        fail("Every true-OOD ID must have exactly one group and no other ID may have one.")
    distinct_groups = len(set(groups.values()))
    if distinct_groups < EXPECTED_MINIMUMS["distinct_true_ood_source_groups"]:
        failures.append("Final cohort needs at least 20 distinct true-OOD source groups.")
    if failures and not allow_incomplete:
        fail(" ".join(failures))
    return {
        "minimums_met": not failures,
        "minimum_failures": failures,
        "distinct_true_ood_groups": distinct_groups,
        "eligible_operational_positives": enabled_total,
        "enabled_positive_counts": {
            label: enabled_counts[label] for label in ENABLED_CLASSES
        },
        "manual_only_operational_positives": sum(manual_counts.values()),
        "manual_only_positive_counts": {
            label: manual_counts[label] for label in MANUAL_ONLY_CLASSES
        },
        "operational_positives": len(operational),
        "true_ood": len(true_ood_ids),
    }


def manifest_provenance(manifest: FrozenManifest) -> dict[str, Any]:
    """Return stable source-manifest provenance for both output artifacts."""

    return {
        "manifest_id": manifest.manifest_id,
        "path": manifest.repo_path,
        "bytes": manifest.bytes,
        "sha256": manifest.file_sha256,
        "frozen_at_utc": manifest.frozen_at_text,
        "rows": len(manifest.rows),
    }


def validate_prior_evidence(repo_root: Path, index_path: Path, rows: list[ManifestRow]) -> dict[str, Any]:
    """Reject known source identities and image bytes from previous experiments.

    The coordinator builds this provenance index from previous data manifests;
    this assembler hashes those sources as opaque files and never reads model
    predictions. The declaration is not a substitute for a perceptual/product
    duplicate audit, which must also happen before the cohort is frozen.
    """

    index = read_json(index_path, "prior-evidence index")
    require_exact_keys(index, frozenset({
        "schema_version", "index_id", "frozen_at_utc",
        "covers_all_prior_derivation_and_evaluation", "sources",
        "source_identities", "image_sha256",
    }), "prior-evidence index")
    if index.get("schema_version") != 1:
        fail("Prior-evidence index schema_version must be 1.")
    require_string(index.get("index_id"), "prior-evidence index_id")
    parse_utc(index.get("frozen_at_utc"), "prior-evidence frozen_at_utc")
    require_true(index.get("covers_all_prior_derivation_and_evaluation"), "prior-evidence coverage attestation")
    sources = require_list(index.get("sources"), "prior-evidence sources")
    seen_sources = set()
    for number, declaration in enumerate(sources, 1):
        declaration = require_object(declaration, f"prior-evidence source {number}")
        require_exact_keys(declaration, frozenset({"path", "bytes", "sha256"}), f"prior-evidence source {number}")
        relative, path = resolve_declared_file(repo_root, declaration.get("path"), f"prior-evidence source {number}")
        if relative in seen_sources:
            fail("Prior-evidence sources must be unique.")
        seen_sources.add(relative)
        if declaration.get("bytes") != path.stat().st_size or require_sha256(declaration.get("sha256"), "prior source sha256") != sha256_file(path):
            fail(f"Prior-evidence source {number} differs from its declared bytes or hash.")
    if "model/appliance-siglip/candidate-v2-fresh-test-manifest.json" not in seen_sources:
        fail("Prior-evidence index must bind the candidate-v2 fresh test manifest.")
    identities = set()
    for number, identity in enumerate(require_list(index.get("source_identities"), "prior source identities"), 1):
        identity = require_object(identity, f"prior source identity {number}")
        require_exact_keys(identity, frozenset({"source_dataset", "source_asset_id"}), f"prior source identity {number}")
        dataset = require_string(identity.get("source_dataset"), "prior source_dataset").strip().casefold()
        asset = require_string(identity.get("source_asset_id"), "prior source_asset_id").strip()
        identities.add((dataset, asset))
    hashes = {require_sha256(value, "prior image sha256") for value in require_list(index.get("image_sha256"), "prior image hashes")}
    if not identities or not hashes:
        fail("Prior-evidence index must contain source identities and image hashes.")
    for row in rows:
        identity = (row.source_dataset.strip().casefold(), row.source_asset_id.strip())
        if identity in identities:
            fail(f"Prior-evidence source identity overlap: {row.row_key}")
        if row.sha256 in hashes:
            fail(f"Prior-evidence image-byte overlap: {row.row_key}")
    return {
        "path": repo_relative(repo_root, index_path, "prior-evidence index"),
        "bytes": index_path.stat().st_size,
        "sha256": sha256_file(index_path),
        "index_id": index["index_id"],
        "frozen_at_utc": index["frozen_at_utc"],
        "source_count": len(sources),
        "prior_identity_count": len(identities),
        "prior_image_hash_count": len(hashes),
        "overlap_found": False,
    }


def assemble_outputs(
    repo_root: Path,
    positives_path: Path,
    ood_path: Path,
    audit_path: Path,
    policy_path: Path,
    gate_path: Path,
    manifest_output_repo_path: str,
    prior_evidence_path: Path,
    *, diagnostic: bool = False,
) -> tuple[bytes, bytes, bytes, dict[str, Any]]:
    """Validate all inputs and assemble three deterministic artifacts in memory."""

    seen_row_ids: set[str] = set()
    seen_identities: set[str] = set()
    seen_paths: set[str] = set()
    seen_hashes: set[str] = set()
    positives = validate_manifest(
        repo_root,
        positives_path,
        "positives",
        seen_row_ids,
        seen_identities,
        seen_paths,
        seen_hashes,
    )
    ood = validate_manifest(
        repo_root,
        ood_path,
        "ood",
        seen_row_ids,
        seen_identities,
        seen_paths,
        seen_hashes,
    )
    manifests = {"positives": positives, "ood": ood}
    prior_evidence = validate_prior_evidence(
        repo_root, prior_evidence_path, [*positives.rows, *ood.rows]
    )
    frozen_hashes, candidate_time, candidate_provenance = validate_frozen_candidate(
        repo_root, policy_path, gate_path
    )
    gate_time = parse_utc(
        candidate_provenance["gate"]["frozen_at_utc"], "candidate-v3 gate time"
    )
    if positives.frozen_at <= gate_time or ood.frozen_at <= gate_time:
        fail("Both source manifests must be frozen after the candidate-v3 gate.")

    (
        operational,
        true_ood_ids,
        ood_groups,
        excluded_ids,
        provenance_by_id,
        audit_provenance,
        audit_time,
        audit_time_text,
    ) = validate_combined_audit(repo_root, audit_path, manifests)
    summary = validate_minimums(operational, true_ood_ids, ood_groups, allow_incomplete=diagnostic)

    retained_ids = set(operational) | set(true_ood_ids)
    source_rows = [row for role in ("positives", "ood") for row in manifests[role].rows]
    samples = [
        {
            "image_id": row.row_key,
            "downloaded_jpeg": row.downloaded_jpeg,
            "sha256": row.sha256,
        }
        for row in source_rows
        if row.row_key in retained_ids
    ]
    sample_ids = [sample["image_id"] for sample in samples]
    if len(sample_ids) != len(set(sample_ids)):
        fail("Final test manifest image_id values are not unique.")
    if set(sample_ids) != retained_ids:
        fail("Final audit partitions do not cover the retained manifest exactly once.")
    if set(operational) & set(true_ood_ids):
        fail("Operational and true-OOD partitions overlap.")
    if set(excluded_ids) & retained_ids:
        fail("An excluded uncertain row leaked into the final test manifest.")

    source_provenance = {
        role: manifest_provenance(manifests[role]) for role in ("positives", "ood")
    }
    manifest = {
        "schema_version": 1,
        "scope": "diagnostic_incomplete_cohort_not_release_evidence" if diagnostic else "frozen_release_candidate_cohort",
        "manifest_id": "candidate-v3-fresh-test-manifest",
        "frozen_at_utc": audit_time_text,
        "prediction_blind": True,
        "selection_uses_model_predictions": False,
        "inputs": {
            "source_manifests": source_provenance,
            "reconciled_audit": audit_provenance,
            "prior_evidence": prior_evidence,
        },
        "samples": samples,
    }
    manifest_bytes = canonical_json_bytes(manifest)
    manifest_hash = sha256_bytes(manifest_bytes)
    audit_summary = {
        "schema_version": 1,
        "audit_id": "candidate-v3-fresh-audit-summary",
        "audit_type": "prediction_blind_reconciled_two_manifest_cohort",
        "cohort_scope": manifest["scope"],
        "frozen_at_utc": audit_time_text,
        "model_outputs_opened": False,
        "prediction_scores_opened": False,
        "audited_operational_positive_ids": operational,
        "audited_true_ood_ids": true_ood_ids,
        "ood_group_by_id": ood_groups,
        "true_ood_source_groups": sorted(set(ood_groups.values())),
        "excluded_uncertain_ids": excluded_ids,
        "minimums_verified": {
            "at_least_33_eligible_operational_positives": summary["eligible_operational_positives"] >= 33,
            "at_least_3_per_enabled_class": all(n >= 3 for n in summary["enabled_positive_counts"].values()),
            "at_least_120_true_ood": summary["true_ood"] >= 120,
            "at_least_20_true_ood_groups": summary["distinct_true_ood_groups"] >= 20,
        },
        "summary": summary,
        "provenance": {
            "assembler": {
                "name": "assemble-appliance-siglip-candidate-v3-test.py",
                "version": SCRIPT_VERSION,
            },
            "candidate": candidate_provenance,
            "source_manifests": source_provenance,
            "reconciled_audit": audit_provenance,
            "prior_evidence": prior_evidence,
            "records_by_namespaced_id": provenance_by_id,
            "test_manifest": {
                "path": manifest_output_repo_path,
                "sha256": manifest_hash,
            },
        },
    }
    audit_bytes = canonical_json_bytes(audit_summary)
    audit_hash = sha256_bytes(audit_bytes)
    lock = {
        "frozen_at_utc": format_utc(max(candidate_time, audit_time, parse_utc(prior_evidence["frozen_at_utc"], "prior index timestamp")) + timedelta(seconds=1)),
        "inputs": {
            "candidate_policy_sha256": frozen_hashes["candidate_policy_sha256"],
            "gate_sha256": frozen_hashes["gate_sha256"],
            "test_manifest_sha256": manifest_hash,
            "audit_sha256": audit_hash,
            "model_sha256": frozen_hashes["model_sha256"],
            "text_manifest_sha256": frozen_hashes["text_manifest_sha256"],
            "text_vectors_sha256": frozen_hashes["text_vectors_sha256"],
        },
        "model_outputs_opened": False,
        "prediction_scores_opened": False,
    }
    if set(lock["inputs"]) != {
        "candidate_policy_sha256",
        "gate_sha256",
        "test_manifest_sha256",
        "audit_sha256",
        "model_sha256",
        "text_manifest_sha256",
        "text_vectors_sha256",
    }:
        fail("Internal error: cohort lock must contain exactly seven input hashes.")
    return manifest_bytes, audit_bytes, canonical_json_bytes(lock), summary


def atomic_write(path: Path, content: bytes) -> None:
    """Write one new output atomically without following an output symlink."""

    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="wb", prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, delete=False
    )
    temp_path = Path(handle.name)
    try:
        with handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        # Link is an atomic create-if-absent operation on this same filesystem.
        # A check followed by os.replace could overwrite a concurrent writer.
        try:
            os.link(temp_path, path)
        except FileExistsError:
            fail(f"Refusing to overwrite existing output: {path}")
    finally:
        if temp_path.exists():
            temp_path.unlink()


def output_paths(output_dir: Path) -> tuple[Path, Path, Path]:
    """Return the fixed evaluator-facing candidate-v3 output names."""

    return (
        output_dir / "candidate-v3-fresh-test-manifest.json",
        output_dir / "candidate-v3-fresh-audit-summary.json",
        output_dir / "candidate-v3-fresh-ground-truth-lock.json",
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse explicit source paths without discovering unrelated files."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root", type=Path, default=Path(__file__).resolve().parents[1]
    )
    parser.add_argument(
        "--positives-manifest",
        type=Path,
        default=Path(
            "tmp/appliance-model-v3-fresh-validation/positives-source-manifest.json"
        ),
    )
    parser.add_argument(
        "--ood-manifest",
        type=Path,
        default=Path("tmp/appliance-model-v3-fresh-validation/ood-source-manifest.json"),
    )
    parser.add_argument(
        "--reconciled-audit",
        type=Path,
        default=Path(
            "tmp/appliance-model-v3-fresh-validation/combined-reconciled-blind-audit.json"
        ),
    )
    parser.add_argument(
        "--candidate-policy",
        type=Path,
        default=Path("model/appliance-siglip/candidate-v3-policy.json"),
    )
    parser.add_argument(
        "--gate",
        type=Path,
        default=Path("model/appliance-siglip/pre-registered-release-gate-v3.json"),
    )
    parser.add_argument(
        "--prior-evidence-index", type=Path,
        default=Path("tmp/appliance-model-v3-fresh-validation/prior-evidence-index.json"),
    )
    parser.add_argument(
        "--output-dir", type=Path, default=Path("model/appliance-siglip")
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Regenerate in memory and compare existing outputs byte for byte.",
    )
    parser.add_argument(
        "--diagnostic-incomplete-cohort", action="store_true",
        help="Measure an incomplete audited cohort under tmp only; frozen release minimums still fail.",
    )
    return parser.parse_args(argv)


def run(args: argparse.Namespace) -> dict[str, Any]:
    """Resolve inputs, assemble in memory, then check or create all outputs."""

    try:
        repo_root = args.repo_root.resolve(strict=True)
    except OSError as error:
        fail(f"Cannot resolve repository root {args.repo_root}: {error}")
    if not repo_root.is_dir():
        fail(f"Repository root is not a directory: {repo_root}")
    positives_path = resolve_cli_file(
        repo_root, args.positives_manifest, "positives source manifest"
    )
    ood_path = resolve_cli_file(repo_root, args.ood_manifest, "OOD source manifest")
    audit_path = resolve_cli_file(
        repo_root, args.reconciled_audit, "combined reconciled audit"
    )
    policy_path = resolve_cli_file(
        repo_root, args.candidate_policy, "candidate-v3 policy"
    )
    gate_path = resolve_cli_file(repo_root, args.gate, "candidate-v3 gate")
    prior_evidence_path = resolve_cli_file(repo_root, args.prior_evidence_index, "prior-evidence index")

    output_dir = args.output_dir if args.output_dir.is_absolute() else repo_root / args.output_dir
    output_dir = output_dir.resolve(strict=False)
    if args.diagnostic_incomplete_cohort and not output_dir.is_relative_to(repo_root / "tmp"):
        fail("Incomplete diagnostic evidence must stay under tmp; it cannot replace release artifacts.")
    try:
        output_dir.relative_to(repo_root)
    except ValueError:
        fail("Output directory must stay inside the repository root.")
    outputs = output_paths(output_dir)
    if any(path.is_symlink() for path in outputs):
        fail("Refusing to read or create a symlinked output path.")
    manifest_repo_path = outputs[0].relative_to(repo_root).as_posix()
    manifest_bytes, audit_bytes, lock_bytes, summary = assemble_outputs(
        repo_root,
        positives_path,
        ood_path,
        audit_path,
        policy_path,
        gate_path,
        manifest_repo_path,
        prior_evidence_path,
        diagnostic=args.diagnostic_incomplete_cohort,
    )
    expected = dict(zip(outputs, (manifest_bytes, audit_bytes, lock_bytes)))

    if args.check:
        for path, content in expected.items():
            if not path.is_file() or path.is_symlink():
                fail(f"Check mode requires an existing regular output: {path}")
            try:
                actual = path.read_bytes()
            except OSError as error:
                fail(f"Cannot read output during check: {path}: {error}")
            if actual != content:
                fail(f"Output differs from deterministic assembly: {path}")
        action = "checked"
    else:
        existing = [path for path in outputs if path.exists() or path.is_symlink()]
        if existing:
            fail(
                "Refusing to overwrite existing output(s): "
                + ", ".join(str(path) for path in existing)
            )
        for path, content in expected.items():
            atomic_write(path, content)
        action = "written"
    return {
        "action": action,
        "outputs": [path.relative_to(repo_root).as_posix() for path in outputs],
        "summary": summary,
    }


def main() -> int:
    """Run the CLI with concise errors and no partial traceback noise."""

    try:
        result = run(parse_args())
    except AssemblyError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
