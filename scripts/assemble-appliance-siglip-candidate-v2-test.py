"""Assemble the prediction-blind candidate-v2 final test cohort.

The assembler deliberately accepts only reconciled human-audit records and
their source manifests.  It never imports a classifier, opens a prediction
report, or reads a score.  The only model-side JSON fields it reads are frozen
identity and artifact-hash links needed to bind the final ground-truth lock.

Outputs are deterministic for identical inputs.  In particular, freeze times
come from the reconciled audits rather than the wall clock, and samples stay in
source-manifest order (Open Images, Openverse, then the critical Wikimedia
Commons supplement).  Existing outputs are protected unless ``--overwrite``
is supplied; ``--check`` performs a byte-for-byte regeneration check without
writing anything.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT_VERSION = 2

# These labels are the frozen candidate-v2 operational surface.  Keeping the
# list here prevents this prediction-blind tool from reading policy thresholds.
ENABLED_CLASSES = (
    "air_fryer",
    "blender",
    "coffee_machine",
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
    "straightener",
    "toaster",
    "vaccum_cleaner",
)
MANUAL_ONLY_CLASSES = ("dehumidifier", "steam_cleaner")
ALL_OPERATIONAL_CLASSES = frozenset((*ENABLED_CLASSES, *MANUAL_ONLY_CLASSES))

ASSIGNMENTS = frozenset(
    {
        "eligible_operational_positive",
        "manual_only_operational_positive",
        "true_ood",
        "exclude_uncertain",
    }
)
HEX64 = frozenset("0123456789abcdef")
CRITICAL_EVIDENCE_FILES = frozenset(
    {
        "LICENSE-EVIDENCE.md",
        "README.md",
        "candidate-manifest.jsonl",
        "collection-summary.json",
        "exclusion-ledger-summary.json",
        "image-only-review.json",
        "local-abo-discovery.json",
    }
)
CRITICAL_FORBIDDEN_FILE_TOKENS = (
    "classifier",
    "evaluator",
    "model",
    "policy",
    "prediction",
    "score",
)


class AssemblyError(ValueError):
    """Raised when an input violates a prediction-blind assembly invariant."""


@dataclass(frozen=True)
class SourceSpec:
    """Describe one approved source schema without scanning unrelated files."""

    name: str
    namespace: str
    manifest_path: Path
    audit_path: Path
    primary_id_field: str
    image_path_field: str
    image_hash_field: str
    audit_id_fields: tuple[str, ...]
    audit_input_hash_attestation_field: str
    audit_prediction_attestation_field: str
    audit_blindness_attestation_field: str
    source_row_attestations: tuple[tuple[str, Any], ...]
    audit_row_bindings: tuple[tuple[str, str], ...] = ()
    manifest_label_field: str | None = None
    strict_critical_reconciliation: bool = False


@dataclass
class SourceAssembly:
    """Validated rows and traceability data for one reconciled source."""

    samples: list[dict[str, Any]]
    operational: dict[str, str]
    true_ood_ids: list[str]
    ood_groups: dict[str, str]
    excluded_ids: list[str]
    provenance_by_id: dict[str, dict[str, Any]]
    source_provenance: dict[str, Any]
    latest_audit_time: datetime


def fail(message: str) -> None:
    """Stop assembly with a concise invariant failure."""

    raise AssemblyError(message)


def require_object(value: Any, description: str) -> dict[str, Any]:
    """Return one JSON object or fail closed."""

    if not isinstance(value, dict):
        fail(f"{description} must be a JSON object.")
    return value


def require_string(value: Any, description: str) -> str:
    """Return one non-empty string, preserving exact source spelling."""

    if not isinstance(value, str) or not value.strip():
        fail(f"{description} must be a non-empty string.")
    return value


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
    details = []
    if missing:
        details.append(f"missing {', '.join(missing)}")
    if extra:
        details.append(f"unexpected {', '.join(extra)}")
    fail(f"{description} has invalid fields ({'; '.join(details)}).")


def sha256_file(path: Path) -> str:
    """Hash a file as bytes without interpreting model or image contents."""

    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
    except OSError as error:
        fail(f"Cannot hash {path}: {error}")
    return digest.hexdigest()


def sha256_bytes(content: bytes) -> str:
    """Hash deterministic output bytes before writing the lock."""

    return hashlib.sha256(content).hexdigest()


def read_json(path: Path, description: str) -> dict[str, Any]:
    """Read one required JSON object with useful closed-failure messages."""

    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as error:
        fail(f"Cannot read {description} at {path}: {error}")
    try:
        return require_object(json.loads(raw), description)
    except json.JSONDecodeError as error:
        fail(f"Invalid JSON in {description} at {path}: {error}")


def read_jsonl(path: Path, description: str) -> list[dict[str, Any]]:
    """Read a JSONL manifest and reject blank or non-object rows."""

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        fail(f"Cannot read {description} at {path}: {error}")
    if not lines:
        fail(f"{description} is empty: {path}")
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            fail(f"{description} contains a blank row at line {line_number}.")
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            fail(f"Invalid JSONL row {line_number} in {description}: {error}")
        rows.append(require_object(row, f"{description} row {line_number}"))
    return rows


def parse_utc(value: Any, description: str) -> datetime:
    """Parse an aware ISO-8601 timestamp and normalize it to UTC."""

    text = require_string(value, description)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        fail(f"{description} must be a valid ISO-8601 timestamp.")
    if parsed.tzinfo is None:
        fail(f"{description} must include a UTC offset.")
    return parsed.astimezone(timezone.utc)


def format_utc(value: datetime) -> str:
    """Write stable millisecond UTC timestamps for the audit and lock."""

    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def canonical_json_bytes(value: Any) -> bytes:
    """Serialize output identically across runs and Python dictionary order."""

    return (
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")


def resolve_cli_path(repo_root: Path, supplied: Path, description: str) -> Path:
    """Resolve an explicit CLI path and keep every input inside the repo root."""

    candidate = supplied if supplied.is_absolute() else repo_root / supplied
    try:
        resolved = candidate.resolve(strict=True)
    except OSError as error:
        fail(f"Cannot resolve {description} at {candidate}: {error}")
    try:
        resolved.relative_to(repo_root)
    except ValueError:
        fail(f"{description} must stay inside repository root {repo_root}.")
    if not resolved.is_file():
        fail(f"{description} is not a regular file: {resolved}")
    return resolved


def repo_relative(repo_root: Path, path: Path, description: str) -> str:
    """Return one forward-slash repository-relative path."""

    try:
        return path.resolve(strict=True).relative_to(repo_root).as_posix()
    except (OSError, ValueError):
        fail(f"{description} must resolve to a file inside {repo_root}: {path}")


def resolve_manifest_image(
    repo_root: Path, raw_path: Any, description: str
) -> tuple[str, Path]:
    """Validate a manifest image path and return its canonical repo path."""

    text = require_string(raw_path, description)
    normalized = text.replace("\\", "/")
    pure = PurePosixPath(normalized)
    if pure.is_absolute() or ".." in pure.parts or "." in pure.parts:
        fail(f"{description} must be a clean repository-relative path: {text}")
    # A colon in the first component rejects Windows drive-qualified paths.
    if not pure.parts or ":" in pure.parts[0]:
        fail(f"{description} must not be absolute: {text}")
    candidate = repo_root.joinpath(*pure.parts)
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(repo_root)
    except (OSError, ValueError):
        fail(f"{description} does not resolve inside the repository: {text}")
    if not resolved.is_file():
        fail(f"{description} is not a regular file: {text}")
    return resolved.relative_to(repo_root).as_posix(), resolved


def validate_audit_manifest_binding(
    audit: dict[str, Any],
    audit_path: Path,
    manifest_path: Path,
    manifest_sha256: str,
    repo_root: Path,
    source_name: str,
    input_hash_attestation_field: str,
) -> None:
    """Require the reconciliation to name and hash the exact source manifest."""

    inputs = require_object(audit.get("inputs"), f"{source_name} audit inputs")
    declared = require_object(
        inputs.get("source_manifest"), f"{source_name} audit source_manifest"
    )
    expected_path = repo_relative(repo_root, manifest_path, f"{source_name} manifest")
    if declared.get("path") != expected_path:
        fail(
            f"{source_name} audit binds {declared.get('path')!r}, not {expected_path!r}."
        )
    if require_sha256(
        declared.get("sha256"), f"{source_name} declared manifest hash"
    ) != manifest_sha256:
        fail(f"{source_name} audit source-manifest SHA-256 does not match the file.")
    if "bytes" in declared and declared["bytes"] != manifest_path.stat().st_size:
        fail(f"{source_name} audit source-manifest byte length does not match.")
    if declared.get("actual_hash_matches_both_audits") is not True:
        fail(f"{source_name} audit does not attest both auditors used that manifest hash.")
    if inputs.get(input_hash_attestation_field) is not True:
        fail(f"{source_name} reconciliation reports mismatched audit inputs.")
    if sha256_file(audit_path) == manifest_sha256:
        fail(f"{source_name} audit and manifest unexpectedly have the same hash.")


def validate_declared_file(
    repo_root: Path,
    entry: dict[str, Any],
    description: str,
    extra_fields: frozenset[str] = frozenset(),
) -> tuple[str, Path, str]:
    """Resolve and hash one strict audit-evidence file declaration."""

    require_exact_keys(
        entry,
        frozenset({"bytes", "path", "sha256"}) | extra_fields,
        description,
    )
    relative_path, resolved_path = resolve_manifest_image(
        repo_root, entry.get("path"), f"{description} path"
    )
    if entry.get("path") != relative_path:
        fail(f"{description} path must use its canonical repository spelling.")
    expected_hash = require_sha256(entry.get("sha256"), f"{description} sha256")
    if sha256_file(resolved_path) != expected_hash:
        fail(f"{description} SHA-256 does not match the file.")
    declared_bytes = entry.get("bytes")
    if type(declared_bytes) is not int or declared_bytes < 0:
        fail(f"{description} bytes must be a non-negative integer.")
    if resolved_path.stat().st_size != declared_bytes:
        fail(f"{description} byte length does not match the file.")
    return relative_path, resolved_path, expected_hash


def validate_critical_reconciliation(
    audit: dict[str, Any],
    source_rows: list[dict[str, Any]],
    spec: SourceSpec,
    repo_root: Path,
    manifest_sha256: str,
) -> dict[str, Any]:
    """Validate the critical supplement's closed, prediction-blind evidence set."""

    require_exact_keys(
        audit,
        frozenset(
            {
                "audit_id",
                "audit_type",
                "blindness_attestations",
                "files_opened",
                "frozen_at_utc",
                "inputs",
                "rows",
                "schema_version",
                "summary",
            }
        ),
        "critical reconciled audit",
    )
    inputs = require_object(audit.get("inputs"), "critical audit inputs")
    require_exact_keys(
        inputs,
        frozenset(
            {
                "all_files_opened_declared",
                "all_input_hashes_match",
                "independent_audits",
                "source_manifest",
            }
        ),
        "critical audit inputs",
    )
    if inputs.get("all_files_opened_declared") is not True:
        fail("critical audit must attest all_files_opened_declared=true.")

    declared_manifest = require_object(
        inputs.get("source_manifest"), "critical audit source_manifest"
    )
    require_exact_keys(
        declared_manifest,
        frozenset(
            {"actual_hash_matches_both_audits", "bytes", "path", "sha256"}
        ),
        "critical audit source_manifest",
    )

    independent = require_object(
        inputs.get("independent_audits"), "critical independent_audits"
    )
    require_exact_keys(
        independent,
        frozenset({"auditor_a", "auditor_b"}),
        "critical independent_audits",
    )
    independent_provenance: dict[str, Any] = {}
    seen_audit_paths: set[str] = set()
    seen_audit_hashes: set[str] = set()
    for auditor_id, expected_name in (
        ("auditor_a", "critical-supplement-audit-a.json"),
        ("auditor_b", "critical-supplement-audit-b.json"),
    ):
        entry = require_object(
            independent.get(auditor_id), f"critical {auditor_id} input"
        )
        path_text, resolved_path, file_hash = validate_declared_file(
            repo_root,
            entry,
            f"critical {auditor_id} input",
            frozenset({"audit_id"}),
        )
        require_string(entry.get("audit_id"), f"critical {auditor_id} audit_id")
        if resolved_path.name != expected_name or resolved_path.parent != spec.audit_path.parent:
            fail(
                f"critical {auditor_id} must bind {expected_name} beside the reconciled audit."
            )
        if path_text in seen_audit_paths or file_hash in seen_audit_hashes:
            fail("critical independent audits must be distinct files with distinct hashes.")
        seen_audit_paths.add(path_text)
        seen_audit_hashes.add(file_hash)
        independent_provenance[auditor_id] = dict(entry)

    attestations = require_object(
        audit.get("blindness_attestations"),
        "critical audit blindness_attestations",
    )
    require_exact_keys(
        attestations,
        frozenset(
            {
                "auditors_independent_before_reconciliation",
                "classifier_run_or_imported",
                "model_reports_opened",
                "policy_or_evaluator_files_opened",
                "prediction_blind_reconciliation",
                "prediction_or_score_files_opened",
                "selection_used_model_or_predictions",
            }
        ),
        "critical audit blindness_attestations",
    )
    if attestations.get("auditors_independent_before_reconciliation") is not True:
        fail(
            "critical audit must attest "
            "auditors_independent_before_reconciliation=true."
        )
    if attestations.get("selection_used_model_or_predictions") is not False:
        fail(
            "critical audit must attest selection_used_model_or_predictions=false."
        )
    if attestations.get("policy_or_evaluator_files_opened") is not False:
        fail("critical audit must attest policy_or_evaluator_files_opened=false.")

    manifest_path_text = repo_relative(
        repo_root, spec.manifest_path, "critical source manifest"
    )
    critical_root = spec.manifest_path.parent.resolve(strict=True)
    selected_image_hashes: dict[str, str] = {}
    optional_image_hashes: dict[str, str] = {}
    for row_number, row in enumerate(source_rows, start=1):
        selected_path, _ = resolve_manifest_image(
            repo_root,
            row.get(spec.image_path_field),
            f"critical row {row_number} {spec.image_path_field}",
        )
        selected_image_hashes[selected_path] = require_sha256(
            row.get(spec.image_hash_field),
            f"critical row {row_number} {spec.image_hash_field}",
        )
        if "local_path" in row:
            local_path, local_resolved = resolve_manifest_image(
                repo_root, row.get("local_path"), f"critical row {row_number} local_path"
            )
            local_hash = sha256_file(local_resolved)
            if local_hash != selected_image_hashes[selected_path]:
                fail(
                    f"critical row {row_number} local_path and selected image hashes differ."
                )
            optional_image_hashes[local_path] = local_hash

    files_opened = audit.get("files_opened")
    if not isinstance(files_opened, list) or not files_opened:
        fail("critical audit files_opened must be a nonempty list.")
    opened_by_path: dict[str, dict[str, Any]] = {}
    allowed_opened_by = ["auditor_a", "auditor_b"]
    for index, raw_entry in enumerate(files_opened, start=1):
        entry = require_object(raw_entry, f"critical files_opened row {index}")
        path_text, resolved_path, file_hash = validate_declared_file(
            repo_root,
            entry,
            f"critical files_opened row {index}",
            frozenset({"opened_by", "purpose"}),
        )
        if entry.get("opened_by") != allowed_opened_by:
            fail(
                f"critical files_opened row {index} must declare both auditors in order."
            )
        purpose = require_string(
            entry.get("purpose"), f"critical files_opened row {index} purpose"
        )
        if path_text in opened_by_path:
            fail(f"critical files_opened repeats {path_text!r}.")

        basename_lower = resolved_path.name.lower()
        if any(token in basename_lower for token in CRITICAL_FORBIDDEN_FILE_TOKENS):
            fail(
                f"critical files_opened includes forbidden model, policy, prediction, "
                f"score, classifier, or evaluator evidence: {path_text}."
            )
        if path_text == manifest_path_text:
            allowed = purpose == "source_manifest" and file_hash == manifest_sha256
        elif path_text in selected_image_hashes:
            allowed = (
                purpose == "referenced_image"
                and file_hash == selected_image_hashes[path_text]
            )
        elif path_text in optional_image_hashes:
            allowed = (
                purpose == "referenced_image"
                and file_hash == optional_image_hashes[path_text]
            )
        elif resolved_path == critical_root / "validation-report.json":
            allowed = purpose == "validation_report"
        elif (
            resolved_path.parent == critical_root / "selected-contact-sheets"
            and resolved_path.suffix.lower() in {".jpg", ".jpeg", ".png"}
        ):
            allowed = purpose == "selected_contact_sheet"
        elif resolved_path.parent == critical_root and resolved_path.name in CRITICAL_EVIDENCE_FILES:
            allowed = purpose == "licensing_or_provenance_evidence"
        else:
            allowed = False
        if not allowed:
            fail(
                f"critical files_opened row {index} is outside the permitted "
                f"prediction-blind evidence set: {path_text}."
            )
        opened_by_path[path_text] = dict(entry)

    manifest_entry = opened_by_path.get(manifest_path_text)
    if manifest_entry is None:
        fail("critical files_opened must include the exact source manifest.")
    missing_images = sorted(set(selected_image_hashes) - set(opened_by_path))
    if missing_images:
        fail(
            "critical files_opened omits selected image(s): "
            + ", ".join(missing_images)
        )
    return {
        "files_opened": files_opened,
        "independent_audits": independent_provenance,
    }


def validate_blindness(audit: dict[str, Any], spec: SourceSpec) -> None:
    """Reject a reconciliation that does not make core blindness attestations."""

    source_name = spec.name
    if audit.get("schema_version") != 1:
        fail(f"{source_name} audit schema_version must be 1.")
    require_string(audit.get("audit_id"), f"{source_name} audit_id")
    if audit.get("audit_type") != "prediction_blind_two_auditor_reconciliation":
        fail(f"{source_name} audit_type is not the approved two-auditor reconciliation.")
    attestations = require_object(
        audit.get("blindness_attestations"),
        f"{source_name} audit blindness_attestations",
    )
    if attestations.get(spec.audit_blindness_attestation_field) is not True:
        fail(
            f"{source_name} audit must attest "
            f"{spec.audit_blindness_attestation_field}=true."
        )
    required_false = (
        "classifier_run_or_imported",
        "model_reports_opened",
        spec.audit_prediction_attestation_field,
    )
    for field in required_false:
        if attestations.get(field) is not False:
            fail(f"{source_name} audit must attest {field}=false.")


def manifest_aliases(spec: SourceSpec, row: dict[str, Any], row_number: int) -> set[str]:
    """Return stable source identifiers that an audit row may reference."""

    aliases: set[str] = set()
    for field in spec.audit_id_fields:
        value = row.get(field)
        if value is not None:
            aliases.add(require_string(value, f"{spec.name} row {row_number} {field}"))
    if not aliases:
        fail(f"{spec.name} manifest row {row_number} has no stable source identifier.")
    return aliases


def audit_aliases(
    spec: SourceSpec, row: dict[str, Any], row_number: int
) -> list[tuple[str, str]]:
    """Return the audit identifiers supported by the approved source adapter."""

    aliases: list[tuple[str, str]] = []
    for field in spec.audit_id_fields:
        value = row.get(field)
        if value is not None:
            aliases.append(
                (
                    field,
                    require_string(
                        value, f"{spec.name} audit row {row_number} {field}"
                    ),
                )
            )
    if not aliases:
        fail(
            f"{spec.name} audit row {row_number} has none of the required identity fields "
            f"{spec.audit_id_fields}."
        )
    return aliases


def validate_source_row_attestations(
    spec: SourceSpec, row: dict[str, Any], row_number: int
) -> None:
    """Require the source-specific declarations that make selection model-blind."""

    for field, expected in spec.source_row_attestations:
        if row.get(field) != expected:
            fail(
                f"{spec.name} source row {row_number} must declare "
                f"{field}={expected!r}."
            )


def validate_audit_row_bindings(
    spec: SourceSpec,
    source_row: dict[str, Any],
    audit_row: dict[str, Any],
    row_number: int,
) -> None:
    """Require strict source-to-audit field copies for adapters that declare them."""

    for audit_field, source_field in spec.audit_row_bindings:
        if audit_row.get(audit_field) != source_row.get(source_field):
            fail(
                f"{spec.name} audit row {row_number} {audit_field} does not match "
                f"source-manifest field {source_field}."
            )
    if not spec.strict_critical_reconciliation:
        return
    require_exact_keys(
        audit_row,
        frozenset(
            {
                "candidate_id",
                "candidate_label",
                "final_assignment",
                "final_class",
                "final_group",
                "ground_truth_status",
                "independent_blind_audit_status",
                "local_path",
                "row",
                "selection_used_model_or_predictions",
                "selected_local_path",
                "sha256",
                "source_dataset",
            }
        ),
        f"critical audit row {row_number}",
    )


def assignment_for_row(
    row: dict[str, Any], source_name: str, row_number: int
) -> tuple[str, str | None, str | None]:
    """Validate one mutually exclusive final human assignment."""

    assignment = require_string(
        row.get("final_assignment"),
        f"{source_name} audit row {row_number} final_assignment",
    )
    if assignment not in ASSIGNMENTS:
        fail(f"{source_name} audit row {row_number} has unknown assignment {assignment!r}.")
    final_class = row.get("final_class")
    final_group = row.get("final_group")
    if final_class is not None:
        final_class = require_string(
            final_class, f"{source_name} audit row {row_number} final_class"
        )
    if final_group is not None:
        final_group = require_string(
            final_group, f"{source_name} audit row {row_number} final_group"
        )

    if assignment == "eligible_operational_positive":
        if final_class not in ENABLED_CLASSES or final_group is not None:
            fail(
                f"{source_name} audit row {row_number} eligible assignment must have "
                "exactly one enabled class and no OOD group."
            )
    elif assignment == "manual_only_operational_positive":
        if final_class not in MANUAL_ONLY_CLASSES or final_group is not None:
            fail(
                f"{source_name} audit row {row_number} manual-only assignment must have "
                "exactly one manual-only class and no OOD group."
            )
    elif assignment == "true_ood":
        if final_class is not None or final_group is None:
            fail(
                f"{source_name} audit row {row_number} true-OOD assignment must have "
                "one nonempty group and no class."
            )
    elif final_class is not None or final_group is not None:
        fail(
            f"{source_name} audit row {row_number} excluded assignment must have no "
            "class or OOD group."
        )
    return assignment, final_class, final_group


def compare_declared_summary(
    audit: dict[str, Any],
    assignments: Counter[str],
    class_counts: Counter[str],
    group_counts: Counter[str],
    source_name: str,
) -> None:
    """Cross-check the audit's own totals instead of trusting its summary."""

    summary = require_object(audit.get("summary"), f"{source_name} audit summary")
    total = sum(assignments.values())
    if summary.get("total_rows") != total:
        fail(f"{source_name} audit summary total_rows does not match its rows.")
    declared_assignments = require_object(
        summary.get("by_assignment"), f"{source_name} by_assignment"
    )
    for assignment in ASSIGNMENTS:
        if declared_assignments.get(assignment, 0) != assignments.get(assignment, 0):
            fail(f"{source_name} audit summary miscounts {assignment}.")
    if any(key not in ASSIGNMENTS for key in declared_assignments):
        fail(f"{source_name} audit summary contains an unknown assignment.")

    declared_classes = require_object(
        summary.get("final_class_counts"), f"{source_name} final_class_counts"
    )
    normalized_classes = {
        key: value for key, value in declared_classes.items() if value != 0
    }
    if normalized_classes != dict(class_counts):
        fail(f"{source_name} audit summary final_class_counts do not match its rows.")
    declared_groups = require_object(
        summary.get("true_ood_by_group"), f"{source_name} true_ood_by_group"
    )
    normalized_groups = {
        key: value for key, value in declared_groups.items() if value != 0
    }
    if normalized_groups != dict(group_counts):
        fail(f"{source_name} audit summary true_ood_by_group does not match its rows.")


def compare_critical_label_summary(
    audit: dict[str, Any], source_rows: list[dict[str, Any]]
) -> None:
    """Bind the critical audit summary to every selected manifest label."""

    summary = require_object(audit.get("summary"), "critical audit summary")
    require_exact_keys(
        summary,
        frozenset(
            {
                "by_assignment",
                "final_class_counts",
                "source_candidate_label_counts",
                "total_rows",
                "true_ood_by_group",
            }
        ),
        "critical audit summary",
    )
    expected = Counter(
        require_string(
            row.get("candidate_label"),
            f"critical source row {index} candidate_label",
        )
        for index, row in enumerate(source_rows, start=1)
    )
    declared = require_object(
        summary.get("source_candidate_label_counts"),
        "critical source_candidate_label_counts",
    )
    if declared != dict(expected):
        fail(
            "critical audit summary source_candidate_label_counts do not match "
            "the source manifest."
        )


def exact_source_identity(spec: SourceSpec, row: dict[str, Any], row_number: int) -> str:
    """Build a source-scoped identity used to reject duplicate source assets."""

    primary = require_string(
        row.get(spec.primary_id_field),
        f"{spec.name} row {row_number} {spec.primary_id_field}",
    )
    dataset = require_string(
        row.get("source_dataset"), f"{spec.name} row {row_number} source_dataset"
    )
    asset = row.get("source_asset_id", primary)
    asset = require_string(asset, f"{spec.name} row {row_number} source asset ID")
    return f"{dataset}:{asset}"


def validate_optional_source_file(
    repo_root: Path, row: dict[str, Any], source_name: str, row_number: int
) -> None:
    """Verify Open Images' original file when its manifest supplies one."""

    raw_path = row.get("source_local_path")
    raw_hash = row.get("source_sha256")
    if raw_path is None and raw_hash is None:
        return
    if raw_path is None or raw_hash is None:
        fail(f"{source_name} row {row_number} has an incomplete source-file hash pair.")
    _, resolved = resolve_manifest_image(
        repo_root, raw_path, f"{source_name} row {row_number} source_local_path"
    )
    expected = require_sha256(
        raw_hash, f"{source_name} row {row_number} source_sha256"
    )
    if sha256_file(resolved) != expected:
        fail(f"{source_name} row {row_number} original source image hash differs.")


def assemble_source(
    spec: SourceSpec,
    repo_root: Path,
    seen_source_identities: set[str],
    seen_paths: set[str],
    seen_hashes: set[str],
) -> SourceAssembly:
    """Validate, reconcile and normalize every row from one approved source."""

    source_rows = read_jsonl(spec.manifest_path, f"{spec.name} source manifest")
    audit = read_json(spec.audit_path, f"{spec.name} reconciled audit")
    manifest_sha256 = sha256_file(spec.manifest_path)
    audit_sha256 = sha256_file(spec.audit_path)
    strict_provenance: dict[str, Any] = {}
    if spec.strict_critical_reconciliation:
        strict_provenance = validate_critical_reconciliation(
            audit,
            source_rows,
            spec,
            repo_root,
            manifest_sha256,
        )
    validate_audit_manifest_binding(
        audit,
        spec.audit_path,
        spec.manifest_path,
        manifest_sha256,
        repo_root,
        spec.name,
        spec.audit_input_hash_attestation_field,
    )
    validate_blindness(audit, spec)
    audit_time = parse_utc(audit.get("frozen_at_utc"), f"{spec.name} audit frozen_at_utc")

    audit_rows = audit.get("rows")
    if not isinstance(audit_rows, list) or not audit_rows:
        fail(f"{spec.name} reconciled audit must contain a nonempty rows list.")
    if len(audit_rows) != len(source_rows):
        fail(
            f"{spec.name} audit has {len(audit_rows)} rows for "
            f"{len(source_rows)} source-manifest rows."
        )
    audit_rows = [
        require_object(row, f"{spec.name} audit row {index}")
        for index, row in enumerate(audit_rows, start=1)
    ]
    if all("row" in row for row in audit_rows):
        if [row.get("row") for row in audit_rows] != list(range(1, len(audit_rows) + 1)):
            fail(f"{spec.name} audit row numbers must be exactly 1..N in order.")

    alias_to_source_index: dict[str, int] = {}
    primary_ids: set[str] = set()
    image_details: list[tuple[str, str, str, str]] = []
    for index, source_row in enumerate(source_rows, start=1):
        validate_source_row_attestations(spec, source_row, index)
        primary_id = require_string(
            source_row.get(spec.primary_id_field),
            f"{spec.name} row {index} {spec.primary_id_field}",
        )
        if primary_id in primary_ids:
            fail(f"{spec.name} source manifest repeats primary ID {primary_id!r}.")
        primary_ids.add(primary_id)
        if spec.manifest_label_field is not None:
            label = require_string(
                source_row.get(spec.manifest_label_field),
                f"{spec.name} row {index} {spec.manifest_label_field}",
            )
            if label not in ENABLED_CLASSES:
                fail(
                    f"{spec.name} row {index} {spec.manifest_label_field} must be "
                    "one of the frozen enabled classes."
                )
        for alias in manifest_aliases(spec, source_row, index):
            previous = alias_to_source_index.setdefault(alias, index - 1)
            if previous != index - 1:
                fail(f"{spec.name} source alias {alias!r} identifies multiple rows.")

        relative_path, resolved_path = resolve_manifest_image(
            repo_root,
            source_row.get(spec.image_path_field),
            f"{spec.name} row {index} {spec.image_path_field}",
        )
        declared_hash = require_sha256(
            source_row.get(spec.image_hash_field),
            f"{spec.name} row {index} {spec.image_hash_field}",
        )
        actual_hash = sha256_file(resolved_path)
        if actual_hash != declared_hash:
            fail(f"{spec.name} row {index} evaluated image hash differs from manifest.")
        validate_optional_source_file(repo_root, source_row, spec.name, index)

        source_identity = exact_source_identity(spec, source_row, index)
        if source_identity in seen_source_identities:
            fail(f"Duplicate source asset across manifests: {source_identity}")
        if relative_path in seen_paths:
            fail(f"Duplicate evaluated image path across manifests: {relative_path}")
        if actual_hash in seen_hashes:
            fail(f"Duplicate evaluated image SHA-256 across manifests: {actual_hash}")
        seen_source_identities.add(source_identity)
        seen_paths.add(relative_path)
        seen_hashes.add(actual_hash)
        image_details.append((primary_id, relative_path, actual_hash, source_identity))

    decision_by_source_index: dict[int, tuple[dict[str, Any], int, str, str | None, str | None]] = {}
    assignments: Counter[str] = Counter()
    class_counts: Counter[str] = Counter()
    group_counts: Counter[str] = Counter()
    for audit_index, audit_row in enumerate(audit_rows, start=1):
        audit_identifiers = audit_aliases(spec, audit_row, audit_index)
        unknown_fields = [
            field
            for field, alias in audit_identifiers
            if alias not in alias_to_source_index
        ]
        if unknown_fields:
            fail(
                f"{spec.name} audit row {audit_index} has identifier field(s) "
                f"that do not match its source manifest: {', '.join(unknown_fields)}."
            )
        matched_indices = {
            alias_to_source_index[alias]
            for _, alias in audit_identifiers
        }
        if len(matched_indices) != 1:
            fail(
                f"{spec.name} audit row {audit_index} maps to "
                f"{len(matched_indices)} source-manifest rows."
            )
        source_index = matched_indices.pop()
        if source_index != audit_index - 1:
            fail(
                f"{spec.name} audit row {audit_index} is out of source-manifest order "
                f"(it maps to row {source_index + 1})."
            )
        if source_index in decision_by_source_index:
            fail(f"{spec.name} source row {source_index + 1} has multiple audit decisions.")
        validate_audit_row_bindings(
            spec,
            source_rows[source_index],
            audit_row,
            audit_index,
        )
        assignment, final_class, final_group = assignment_for_row(
            audit_row, spec.name, audit_index
        )
        if (
            spec.manifest_label_field is not None
            and assignment == "eligible_operational_positive"
            and final_class != source_rows[source_index].get(spec.manifest_label_field)
        ):
            fail(
                f"{spec.name} audit row {audit_index} final_class must match "
                f"the bound {spec.manifest_label_field}."
            )
        decision_by_source_index[source_index] = (
            audit_row,
            audit_index,
            assignment,
            final_class,
            final_group,
        )
        assignments[assignment] += 1
        if final_class is not None:
            class_counts[final_class] += 1
        if final_group is not None:
            group_counts[final_group] += 1
    if set(decision_by_source_index) != set(range(len(source_rows))):
        fail(f"{spec.name} audit does not assign every source-manifest row exactly once.")
    compare_declared_summary(audit, assignments, class_counts, group_counts, spec.name)
    if spec.strict_critical_reconciliation:
        compare_critical_label_summary(audit, source_rows)

    samples: list[dict[str, Any]] = []
    operational: dict[str, str] = {}
    true_ood_ids: list[str] = []
    ood_groups: dict[str, str] = {}
    excluded_ids: list[str] = []
    provenance_by_id: dict[str, dict[str, Any]] = {}
    for source_index, source_row in enumerate(source_rows):
        primary_id, relative_path, image_hash, source_identity = image_details[source_index]
        audit_row, audit_index, assignment, final_class, final_group = (
            decision_by_source_index[source_index]
        )
        namespaced_id = f"{spec.namespace}:{primary_id}"
        provenance = {
            "audit_row_number": audit_index,
            "reconciled_audit_record": audit_row,
            "source": spec.namespace,
            "source_identity": source_identity,
            "source_manifest_record": source_row,
            "source_manifest_row_number": source_index + 1,
        }
        provenance_by_id[namespaced_id] = provenance
        if assignment == "exclude_uncertain":
            excluded_ids.append(namespaced_id)
            continue

        is_operational = assignment in {
            "eligible_operational_positive",
            "manual_only_operational_positive",
        }
        sample: dict[str, Any] = {
            "downloaded_jpeg": relative_path,
            "expected": final_class if is_operational else None,
            "image_id": namespaced_id,
            "kind": "positive" if is_operational else "ood",
            "ood_class": final_group if not is_operational else None,
            "sha256": image_hash,
            "source": spec.namespace,
            "source_id": primary_id,
        }
        # Some existing benchmark manifests contain a reviewed crop box.  Copy
        # it exactly when present; never create or infer a new crop here.
        if "expanded_crop_pixels" in source_row:
            sample["expanded_crop_pixels"] = source_row["expanded_crop_pixels"]
        samples.append(sample)
        if is_operational:
            if final_class not in ALL_OPERATIONAL_CLASSES:
                fail(f"Internal error: invalid operational class for {namespaced_id}.")
            operational[namespaced_id] = final_class
        else:
            true_ood_ids.append(namespaced_id)
            ood_groups[namespaced_id] = final_group

    source_provenance = {
        "assignment_counts": dict(sorted(assignments.items())),
        "audit": {
            "audit_id": audit.get("audit_id"),
            "bytes": spec.audit_path.stat().st_size,
            "frozen_at_utc": audit.get("frozen_at_utc"),
            "path": repo_relative(repo_root, spec.audit_path, f"{spec.name} audit"),
            "sha256": audit_sha256,
        },
        "excluded_uncertain_ids": excluded_ids,
        "source_manifest": {
            "bytes": spec.manifest_path.stat().st_size,
            "path": repo_relative(
                repo_root, spec.manifest_path, f"{spec.name} source manifest"
            ),
            "rows": len(source_rows),
            "sha256": manifest_sha256,
        },
        "verified_evaluated_image_hashes": len(source_rows),
    }
    source_provenance.update(strict_provenance)
    return SourceAssembly(
        samples=samples,
        operational=operational,
        true_ood_ids=true_ood_ids,
        ood_groups=ood_groups,
        excluded_ids=excluded_ids,
        provenance_by_id=provenance_by_id,
        source_provenance=source_provenance,
        latest_audit_time=audit_time,
    )


def validate_minimums(
    operational: dict[str, str], true_ood_ids: list[str], ood_groups: dict[str, str]
) -> dict[str, Any]:
    """Enforce the pre-registered final-cohort coverage minimums."""

    enabled_counts = Counter(
        label for label in operational.values() if label in ENABLED_CLASSES
    )
    manual_counts = Counter(
        label for label in operational.values() if label in MANUAL_ONLY_CLASSES
    )
    if len(operational) != sum(enabled_counts.values()) + sum(manual_counts.values()):
        fail("Operational audit map contains a class outside the frozen class surface.")
    if sum(enabled_counts.values()) < 40:
        fail("Final cohort needs at least 40 enabled operational positives.")
    missing = [label for label in ENABLED_CLASSES if enabled_counts[label] < 2]
    if missing:
        fail(
            "Final cohort needs at least two positives for every enabled class; "
            f"below minimum: {', '.join(missing)}."
        )
    if len(true_ood_ids) < 100:
        fail("Final cohort needs at least 100 audited true-OOD images.")
    distinct_groups = len(set(ood_groups.values()))
    if distinct_groups < 18:
        fail("Final cohort needs at least 18 distinct true-OOD source groups.")
    if set(true_ood_ids) != set(ood_groups):
        fail("Every true-OOD ID must have exactly one group and no other ID may have one.")
    return {
        "distinct_true_ood_groups": distinct_groups,
        "enabled_operational_positives": sum(enabled_counts.values()),
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


def artifact_entry(
    policy: dict[str, Any], key: str, description: str
) -> tuple[str, str]:
    """Read only one frozen policy artifact's path and SHA-256 linkage."""

    hashes = require_object(policy.get("artifact_hashes"), "candidate artifact_hashes")
    entry = require_object(hashes.get(key), description)
    return (
        require_string(entry.get("path"), f"{description} path"),
        require_sha256(entry.get("sha256"), f"{description} sha256"),
    )


def validate_frozen_artifacts(
    repo_root: Path, policy_path: Path, gate_path: Path
) -> tuple[dict[str, str], datetime]:
    """Bind policy, gate, model and text artifacts without reading thresholds."""

    policy_hash = sha256_file(policy_path)
    gate_hash = sha256_file(gate_path)
    policy = read_json(policy_path, "candidate-v2 policy")
    gate = read_json(gate_path, "candidate-v2 release gate")

    if policy.get("policy_version") != 2:
        fail("Candidate policy_version must be 2.")
    if policy.get("release_ready") is not False or policy.get("recognition_enabled") is not False:
        fail("Candidate-v2 policy must remain disabled before final evaluation.")
    if policy.get("enabled_classes") != list(ENABLED_CLASSES):
        fail("Candidate-v2 enabled_classes do not match the assembler's frozen class surface.")
    if policy.get("manual_only_classes") != list(MANUAL_ONLY_CLASSES):
        fail("Candidate-v2 manual_only_classes do not match the assembler's frozen class surface.")
    acceptance = require_object(policy.get("acceptance"), "candidate acceptance policy")
    thresholds = require_object(
        acceptance.get("class_thresholds"), "candidate class_thresholds"
    )
    if set(thresholds) != set(ENABLED_CLASSES):
        fail("Candidate class-threshold keys must match enabled_classes exactly.")
    policy_time = parse_utc(policy.get("frozen_at_utc"), "candidate policy frozen_at_utc")
    gate_time = parse_utc(gate.get("frozen_at_utc"), "candidate gate frozen_at_utc")
    if gate_time < policy_time:
        fail("Candidate release gate cannot be frozen before the policy it binds.")

    gate_candidate = require_object(gate.get("candidate_policy"), "gate candidate_policy")
    if require_sha256(
        gate_candidate.get("sha256"), "gate candidate policy sha256"
    ) != policy_hash:
        fail("Release gate does not bind the exact candidate-v2 policy file.")
    if gate_candidate.get("candidate_id") != policy.get("candidate_id"):
        fail("Release gate candidate_id does not match the candidate policy.")
    if gate.get("release_ready") is not False or gate.get("recognition_enabled") is not False:
        fail("Candidate-v2 release gate must remain disabled before final evaluation.")

    model = require_object(policy.get("model"), "candidate model identity")
    model_hash = require_sha256(model.get("sha256"), "candidate model sha256")
    model_path_text, linked_model_hash = artifact_entry(
        policy, "vision_model", "candidate vision_model artifact"
    )
    if linked_model_hash != model_hash:
        fail("Candidate model identity and vision-model artifact hashes differ.")
    text_manifest_path_text, text_manifest_hash = artifact_entry(
        policy, "text_manifest", "candidate text_manifest artifact"
    )
    text_vectors_path_text, text_vectors_hash = artifact_entry(
        policy, "text_vectors", "candidate text_vectors artifact"
    )

    for description, path_text, expected_hash in (
        ("candidate vision model", model_path_text, model_hash),
        ("candidate text manifest", text_manifest_path_text, text_manifest_hash),
        ("candidate text vectors", text_vectors_path_text, text_vectors_hash),
    ):
        _, artifact_path = resolve_manifest_image(repo_root, path_text, description)
        if sha256_file(artifact_path) != expected_hash:
            fail(f"{description.capitalize()} file does not match its frozen SHA-256.")

    frozen = require_object(gate.get("frozen_candidate"), "gate frozen_candidate")
    if frozen.get("enabled_classes") != list(ENABLED_CLASSES):
        fail("Gate frozen_candidate enabled_classes do not match the candidate policy.")
    if frozen.get("manual_only_classes") != list(MANUAL_ONLY_CLASSES):
        fail("Gate frozen_candidate manual_only_classes do not match the candidate policy.")
    for field, expected in (
        ("model_sha256", model_hash),
        ("text_manifest_sha256", text_manifest_hash),
        ("text_vectors_sha256", text_vectors_hash),
    ):
        if frozen.get(field) != expected:
            fail(f"Gate frozen_candidate {field} does not match the candidate policy.")
    minimums = require_object(gate.get("fresh_cohort_minimums"), "gate cohort minimums")
    expected_minimums = {
        "audited_eligible_operational_positives": 40,
        "audited_operational_positives_per_enabled_class": 2,
        "audited_true_ood": 100,
        "distinct_true_ood_source_groups": 18,
    }
    if any(minimums.get(field) != expected for field, expected in expected_minimums.items()):
        fail("Gate fresh-cohort minimums do not match the assembler's frozen minimums.")
    return (
        {
            "candidate_policy_sha256": policy_hash,
            "gate_sha256": gate_hash,
            "model_sha256": model_hash,
            "text_manifest_sha256": text_manifest_hash,
            "text_vectors_sha256": text_vectors_hash,
        },
        max(policy_time, gate_time),
    )


def assemble_outputs(
    repo_root: Path,
    source_specs: tuple[SourceSpec, ...],
    policy_path: Path,
    gate_path: Path,
    manifest_output_repo_path: str,
) -> tuple[bytes, bytes, bytes, dict[str, Any]]:
    """Build and hash all three final artifacts entirely in memory."""

    seen_source_identities: set[str] = set()
    seen_paths: set[str] = set()
    seen_hashes: set[str] = set()
    assembled = [
        assemble_source(
            spec,
            repo_root,
            seen_source_identities,
            seen_paths,
            seen_hashes,
        )
        for spec in source_specs
    ]

    samples = [sample for source in assembled for sample in source.samples]
    operational = {
        image_id: label
        for source in assembled
        for image_id, label in source.operational.items()
    }
    true_ood_ids = [
        image_id for source in assembled for image_id in source.true_ood_ids
    ]
    ood_groups = {
        image_id: group
        for source in assembled
        for image_id, group in source.ood_groups.items()
    }
    excluded_ids = [image_id for source in assembled for image_id in source.excluded_ids]
    provenance_by_id = {
        image_id: provenance
        for source in assembled
        for image_id, provenance in source.provenance_by_id.items()
    }
    if len(samples) != len(operational) + len(true_ood_ids):
        fail("Retained manifest rows do not exactly match operational and OOD partitions.")
    sample_ids = [sample["image_id"] for sample in samples]
    if len(sample_ids) != len(set(sample_ids)):
        fail("Namespaced final manifest IDs are not unique.")
    if set(sample_ids) != set(operational) | set(true_ood_ids):
        fail("Final audit partitions do not cover the final manifest exactly once.")
    if set(operational) & set(true_ood_ids):
        fail("Final operational and true-OOD partitions overlap.")
    if set(excluded_ids) & set(sample_ids):
        fail("An exclude_uncertain row leaked into the final manifest.")

    minimums = validate_minimums(operational, true_ood_ids, ood_groups)
    audit_time = max(source.latest_audit_time for source in assembled)
    audit_frozen_at = format_utc(audit_time)
    input_provenance = {
        spec.namespace: result.source_provenance
        for spec, result in zip(source_specs, assembled)
    }
    manifest = {
        "frozen_at_utc": audit_frozen_at,
        "inputs": input_provenance,
        "manifest_id": "candidate-v2-fresh-test-manifest",
        "prediction_blind": True,
        "samples": samples,
        "schema_version": 1,
        "selection_uses_model_predictions": False,
    }
    manifest_bytes = canonical_json_bytes(manifest)
    audit_summary = {
        "audit_id": "candidate-v2-fresh-audit-summary",
        "audit_type": "prediction_blind_reconciled_three_source_cohort",
        "audited_operational_positive_ids": operational,
        "audited_true_ood_ids": true_ood_ids,
        "excluded_uncertain_ids": excluded_ids,
        "frozen_at_utc": audit_frozen_at,
        "minimums_verified": {
            "at_least_100_true_ood": True,
            "at_least_18_true_ood_groups": True,
            "at_least_2_per_enabled_class": True,
            "at_least_40_enabled_operational_positives": True,
        },
        "model_outputs_opened": False,
        "ood_group_by_id": ood_groups,
        "prediction_scores_opened": False,
        "provenance": {
            "assembler": {
                "name": "assemble-appliance-siglip-candidate-v2-test.py",
                "version": SCRIPT_VERSION,
            },
            "records_by_namespaced_id": provenance_by_id,
            "sources": input_provenance,
            "test_manifest": {
                "path": manifest_output_repo_path,
                "sha256": sha256_bytes(manifest_bytes),
            },
        },
        "schema_version": 1,
        "summary": minimums,
    }
    audit_bytes = canonical_json_bytes(audit_summary)

    frozen_hashes, candidate_time = validate_frozen_artifacts(
        repo_root, policy_path, gate_path
    )
    lock = {
        "frozen_at_utc": format_utc(
            max(audit_time, candidate_time) + timedelta(seconds=1)
        ),
        "inputs": {
            **frozen_hashes,
            "test_manifest_sha256": sha256_bytes(manifest_bytes),
            "audit_sha256": sha256_bytes(audit_bytes),
        },
        "model_outputs_opened": False,
        "prediction_scores_opened": False,
    }
    lock_bytes = canonical_json_bytes(lock)
    return manifest_bytes, audit_bytes, lock_bytes, minimums


def atomic_write(path: Path, content: bytes) -> None:
    """Replace one explicitly approved output through a same-directory temp file."""

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
        temp_path.replace(path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def output_paths(output_dir: Path) -> tuple[Path, Path, Path]:
    """Keep the three evaluator-facing output names in one place."""

    return (
        output_dir / "candidate-v2-fresh-test-manifest.json",
        output_dir / "candidate-v2-fresh-audit-summary.json",
        output_dir / "candidate-v2-fresh-ground-truth-lock.json",
    )


def parse_args() -> argparse.Namespace:
    """Expose fixture overrides while defaulting to the approved final inputs."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--open-images-manifest",
        type=Path,
        default=Path(
            "tmp/appliance-model-v2-fresh-validation/open-images/"
            "open-images-v2-final.jsonl"
        ),
    )
    parser.add_argument(
        "--open-images-audit",
        type=Path,
        default=Path(
            "tmp/appliance-model-v2-fresh-validation/audits/"
            "open-images-reconciled-audit.json"
        ),
    )
    parser.add_argument(
        "--openverse-manifest",
        type=Path,
        default=Path(
            "tmp/appliance-model-v2-fresh-validation/"
            "openverse-v2-final-pending-audit.jsonl"
        ),
    )
    parser.add_argument(
        "--openverse-audit",
        type=Path,
        default=Path(
            "tmp/appliance-model-v2-fresh-validation/audits/"
            "openverse-final-reconciled-audit.json"
        ),
    )
    parser.add_argument(
        "--critical-manifest",
        type=Path,
        default=Path(
            "tmp/appliance-model-v2-fresh-validation/critical-supplement/"
            "selected-manifest.jsonl"
        ),
    )
    parser.add_argument(
        "--critical-audit",
        type=Path,
        default=Path(
            "tmp/appliance-model-v2-fresh-validation/audits/"
            "critical-supplement-reconciled-audit.json"
        ),
    )
    parser.add_argument(
        "--candidate-policy",
        type=Path,
        default=Path("model/appliance-siglip/candidate-v2-policy.json"),
    )
    parser.add_argument(
        "--gate",
        type=Path,
        default=Path("model/appliance-siglip/pre-registered-release-gate-v2.json"),
    )
    parser.add_argument(
        "--output-dir", type=Path, default=Path("model/appliance-siglip")
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--check",
        action="store_true",
        help="Regenerate in memory and verify existing outputs byte for byte.",
    )
    mode.add_argument(
        "--overwrite",
        action="store_true",
        help="Explicitly allow replacement of all three deterministic outputs.",
    )
    return parser.parse_args()


def run(args: argparse.Namespace) -> dict[str, Any]:
    """Resolve approved paths, assemble outputs, then check or write them."""

    try:
        repo_root = args.repo_root.resolve(strict=True)
    except OSError as error:
        fail(f"Cannot resolve repository root {args.repo_root}: {error}")
    if not repo_root.is_dir():
        fail(f"Repository root is not a directory: {repo_root}")

    open_images_manifest = resolve_cli_path(
        repo_root, args.open_images_manifest, "Open Images source manifest"
    )
    open_images_audit = resolve_cli_path(
        repo_root, args.open_images_audit, "Open Images reconciled audit"
    )
    openverse_manifest = resolve_cli_path(
        repo_root, args.openverse_manifest, "Openverse source manifest"
    )
    openverse_audit = resolve_cli_path(
        repo_root, args.openverse_audit, "Openverse reconciled audit"
    )
    critical_manifest = resolve_cli_path(
        repo_root, args.critical_manifest, "critical supplement source manifest"
    )
    critical_audit = resolve_cli_path(
        repo_root, args.critical_audit, "critical supplement reconciled audit"
    )
    policy_path = resolve_cli_path(
        repo_root, args.candidate_policy, "candidate-v2 policy"
    )
    gate_path = resolve_cli_path(repo_root, args.gate, "candidate-v2 release gate")

    output_dir = args.output_dir if args.output_dir.is_absolute() else repo_root / args.output_dir
    output_dir = output_dir.resolve(strict=False)
    try:
        output_dir.relative_to(repo_root)
    except ValueError:
        fail("Output directory must stay inside the repository root.")
    outputs = output_paths(output_dir)
    if any(path.is_symlink() for path in outputs):
        fail("Refusing to read or replace a symlinked output path.")

    specs = (
        SourceSpec(
            name="open_images",
            namespace="open_images",
            manifest_path=open_images_manifest,
            audit_path=open_images_audit,
            primary_id_field="image_id",
            image_path_field="crop_local_path",
            image_hash_field="crop_sha256",
            audit_id_fields=("image_id",),
            audit_input_hash_attestation_field="all_audit_input_hashes_match",
            audit_prediction_attestation_field="predictions_or_scores_opened",
            audit_blindness_attestation_field="prediction_blind_adjudication",
            source_row_attestations=(("selection_uses_model_predictions", False),),
        ),
        SourceSpec(
            name="openverse",
            namespace="openverse",
            manifest_path=openverse_manifest,
            audit_path=openverse_audit,
            primary_id_field="openverse_id",
            image_path_field="downloaded_jpeg",
            image_hash_field="sha256",
            audit_id_fields=("openverse_id", "pool_index", "source_asset_id", "image_id"),
            audit_input_hash_attestation_field="all_input_hashes_match",
            audit_prediction_attestation_field="prediction_or_score_files_opened",
            audit_blindness_attestation_field="prediction_blind_reconciliation",
            source_row_attestations=(
                (
                    "visual_prefilter_basis",
                    "numbered_image_pixels_only_no_model_predictions",
                ),
                ("ground_truth_status", "pending_independent_blind_audit"),
            ),
        ),
        SourceSpec(
            name="critical",
            namespace="critical",
            manifest_path=critical_manifest,
            audit_path=critical_audit,
            primary_id_field="candidate_id",
            image_path_field="selected_local_path",
            image_hash_field="sha256",
            audit_id_fields=("candidate_id",),
            audit_input_hash_attestation_field="all_input_hashes_match",
            audit_prediction_attestation_field="prediction_or_score_files_opened",
            audit_blindness_attestation_field="prediction_blind_reconciliation",
            source_row_attestations=(
                ("source_dataset", "Wikimedia Commons"),
                ("selection_used_model_or_predictions", False),
                (
                    "ground_truth_status",
                    "provisionally_approved_prediction_blind_image_review",
                ),
                ("independent_blind_audit_status", "pending"),
            ),
            audit_row_bindings=(
                ("candidate_id", "candidate_id"),
                ("candidate_label", "candidate_label"),
                ("local_path", "local_path"),
                ("selected_local_path", "selected_local_path"),
                ("sha256", "sha256"),
                ("source_dataset", "source_dataset"),
                (
                    "selection_used_model_or_predictions",
                    "selection_used_model_or_predictions",
                ),
                ("ground_truth_status", "ground_truth_status"),
                (
                    "independent_blind_audit_status",
                    "independent_blind_audit_status",
                ),
            ),
            manifest_label_field="candidate_label",
            strict_critical_reconciliation=True,
        ),
    )
    manifest_bytes, audit_bytes, lock_bytes, minimums = assemble_outputs(
        repo_root,
        specs,
        policy_path,
        gate_path,
        outputs[0].relative_to(repo_root).as_posix(),
    )
    expected = dict(zip(outputs, (manifest_bytes, audit_bytes, lock_bytes)))

    if args.check:
        for path, content in expected.items():
            if not path.is_file():
                fail(f"Check mode requires existing output: {path}")
            try:
                actual = path.read_bytes()
            except OSError as error:
                fail(f"Cannot read output during check: {path}: {error}")
            if actual != content:
                fail(f"Output differs from deterministic assembly: {path}")
        action = "checked"
    else:
        existing = [path for path in outputs if path.exists()]
        if existing and not args.overwrite:
            joined = ", ".join(str(path) for path in existing)
            fail(f"Refusing to overwrite existing output(s): {joined}")
        for path, content in expected.items():
            atomic_write(path, content)
        action = "written"
    return {
        "action": action,
        "outputs": [repo_relative(repo_root, path, "final output") for path in outputs],
        "summary": minimums,
    }


def main() -> int:
    """CLI entry point with closed failure and no partial traceback noise."""

    try:
        result = run(parse_args())
    except AssemblyError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
