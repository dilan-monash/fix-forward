"""Exercise the final-cohort assembler without opening or running a model."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ASSEMBLER = REPOSITORY_ROOT / "scripts/assemble-appliance-siglip-candidate-v2-test.py"
CANDIDATE_EVALUATOR = (
    REPOSITORY_ROOT / "scripts/evaluate-appliance-siglip-candidate-policy.mjs"
)
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


def digest(content: bytes) -> str:
    """Return a lowercase SHA-256 used throughout the synthetic fixture."""

    return hashlib.sha256(content).hexdigest()


def write_json(path: Path, value: object) -> None:
    """Write stable fixture JSON."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_jsonl(path: Path, rows: list[dict]) -> None:
    """Write one compact object per fixture line."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows),
        encoding="utf-8",
    )


class SyntheticRepository:
    """Create a complete hash-bound cohort using non-image placeholder bytes."""

    def __init__(self, root: Path, duplicate_cross_source_hash: bool = False):
        self.root = root
        self.duplicate_cross_source_hash = duplicate_cross_source_hash
        self.fixtures = root / "fixtures"
        self.output = root / "model/appliance-siglip"
        self.oi_manifest = self.fixtures / "open-images.jsonl"
        self.oi_audit = self.fixtures / "open-images-audit.json"
        self.ov_manifest = self.fixtures / "openverse.jsonl"
        self.ov_audit = self.fixtures / "openverse-audit.json"
        self.critical_root = self.fixtures / "critical-supplement"
        self.critical_manifest = self.critical_root / "selected-manifest.jsonl"
        self.critical_audit = (
            self.fixtures / "audits/critical-supplement-reconciled-audit.json"
        )
        self.critical_audit_a = (
            self.fixtures / "audits/critical-supplement-audit-a.json"
        )
        self.critical_audit_b = (
            self.fixtures / "audits/critical-supplement-audit-b.json"
        )
        self.policy = self.output / "candidate-v2-policy.json"
        self.gate = self.output / "pre-registered-release-gate-v2.json"
        self.first_image_bytes: bytes | None = None
        self.build()

    def relative(self, path: Path) -> str:
        """Return the POSIX repository path expected by production inputs."""

        return path.relative_to(self.root).as_posix()

    def image_file(self, source: str, identity: str, content: bytes) -> tuple[str, str]:
        """Create one unique evaluated asset and return its path/hash pair."""

        path = self.fixtures / "images" / source / f"{identity}.jpg"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return self.relative(path), digest(content)

    def source_file(self, identity: str, content: bytes) -> tuple[str, str]:
        """Create an Open Images original so both declared hashes are checked."""

        path = self.fixtures / "source-images" / f"{identity}.jpg"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return self.relative(path), digest(content)

    def critical_image_files(
        self, identity: str, label: str, content: bytes
    ) -> tuple[str, str, str]:
        """Create matching candidate/selected copies for the critical source."""

        candidate = self.critical_root / "images/candidates" / label / f"{identity}.jpg"
        selected = self.critical_root / "images/selected" / label / f"{identity}.jpg"
        candidate.parent.mkdir(parents=True, exist_ok=True)
        selected.parent.mkdir(parents=True, exist_ok=True)
        candidate.write_bytes(content)
        selected.write_bytes(content)
        return self.relative(candidate), self.relative(selected), digest(content)

    def build_source_rows(
        self,
        source: str,
        decisions: list[tuple[str, str | None]],
    ) -> tuple[list[dict], list[dict]]:
        """Build manifest/audit rows in the same stable order."""

        manifest_rows = []
        audit_rows = []
        for index, (assignment, label_or_group) in enumerate(decisions, start=1):
            identity = f"{source}-{index:03d}"
            image_bytes = f"evaluated-{identity}".encode()
            if self.first_image_bytes is None:
                self.first_image_bytes = image_bytes
            if (
                self.duplicate_cross_source_hash
                and source == "cr"
                and index == len(decisions)
            ):
                image_bytes = self.first_image_bytes
            if source == "cr":
                self.assert_critical_label(label_or_group)
                local_path, selected_path, image_hash = self.critical_image_files(
                    identity, label_or_group, image_bytes
                )
                image_path = selected_path
            else:
                image_path, image_hash = self.image_file(source, identity, image_bytes)
            final_class = (
                label_or_group
                if assignment in {
                    "eligible_operational_positive",
                    "manual_only_operational_positive",
                }
                else None
            )
            final_group = label_or_group if assignment == "true_ood" else None
            if source == "oi":
                source_path, source_hash = self.source_file(
                    identity, f"original-{identity}".encode()
                )
                manifest_row = {
                    "candidate_id": f"OI-{index:03d}",
                    "crop_local_path": image_path,
                    "crop_sha256": image_hash,
                    "image_id": identity,
                    "selection_uses_model_predictions": False,
                    "source_dataset": "Synthetic Open Images",
                    "source_local_path": source_path,
                    "source_sha256": source_hash,
                }
                audit_identity = {"image_id": identity}
            elif source == "ov":
                manifest_row = {
                    "downloaded_jpeg": image_path,
                    "ground_truth_status": "pending_independent_blind_audit",
                    "openverse_id": identity,
                    "pool_index": f"P{index:03d}",
                    "sha256": image_hash,
                    "source_asset_id": identity,
                    "source_dataset": "Synthetic Openverse",
                    "visual_prefilter_basis": "numbered_image_pixels_only_no_model_predictions",
                }
                audit_identity = {
                    "openverse_id": identity,
                    "pool_index": f"P{index:03d}",
                }
            else:
                manifest_row = {
                    "candidate_id": identity,
                    "candidate_label": label_or_group,
                    "ground_truth_status": (
                        "provisionally_approved_prediction_blind_image_review"
                    ),
                    "independent_blind_audit_status": "pending",
                    "local_path": local_path,
                    "selected_local_path": selected_path,
                    "selection_used_model_or_predictions": False,
                    "sha256": image_hash,
                    "source_asset_id": f"commons-{index:03d}",
                    "source_dataset": "Wikimedia Commons",
                }
                audit_identity = {
                    "candidate_id": identity,
                    "candidate_label": label_or_group,
                    "ground_truth_status": manifest_row["ground_truth_status"],
                    "independent_blind_audit_status": "pending",
                    "local_path": local_path,
                    "selected_local_path": selected_path,
                    "selection_used_model_or_predictions": False,
                    "sha256": image_hash,
                    "source_dataset": "Wikimedia Commons",
                }
            manifest_rows.append(manifest_row)
            audit_rows.append(
                {
                    **audit_identity,
                    "final_assignment": assignment,
                    "final_class": final_class,
                    "final_group": final_group,
                    "row": index,
                }
            )
        return manifest_rows, audit_rows

    @staticmethod
    def assert_critical_label(label: str | None) -> None:
        """Keep fixture mistakes separate from assembler failures."""

        if label not in ENABLED_CLASSES:
            raise AssertionError(f"Invalid synthetic critical label: {label!r}")

    def audit_document(
        self,
        source: str,
        manifest_path: Path,
        audit_rows: list[dict],
        frozen_at: str,
    ) -> dict:
        """Create the same hash/summary contract as a reconciled human audit."""

        assignments = Counter(row["final_assignment"] for row in audit_rows)
        classes = Counter(
            row["final_class"] for row in audit_rows if row["final_class"] is not None
        )
        groups = Counter(
            row["final_group"] for row in audit_rows if row["final_group"] is not None
        )
        is_open_images = source == "open-images"
        input_hash_attestation = (
            "all_audit_input_hashes_match"
            if is_open_images
            else "all_input_hashes_match"
        )
        prediction_attestation = (
            "predictions_or_scores_opened"
            if is_open_images
            else "prediction_or_score_files_opened"
        )
        blindness_attestation = (
            "prediction_blind_adjudication"
            if is_open_images
            else "prediction_blind_reconciliation"
        )
        return {
            "audit_id": f"synthetic-{source}-reconciled-audit",
            "audit_type": "prediction_blind_two_auditor_reconciliation",
            "blindness_attestations": {
                blindness_attestation: True,
                "classifier_run_or_imported": False,
                "model_reports_opened": False,
                prediction_attestation: False,
            },
            "frozen_at_utc": frozen_at,
            "inputs": {
                input_hash_attestation: True,
                "source_manifest": {
                    "actual_hash_matches_both_audits": True,
                    "bytes": manifest_path.stat().st_size,
                    "path": self.relative(manifest_path),
                    "sha256": digest(manifest_path.read_bytes()),
                },
            },
            "rows": audit_rows,
            "schema_version": 1,
            "summary": {
                "by_assignment": {
                    assignment: assignments[assignment]
                    for assignment in (
                        "eligible_operational_positive",
                        "manual_only_operational_positive",
                        "true_ood",
                        "exclude_uncertain",
                    )
                },
                "final_class_counts": dict(classes),
                "total_rows": len(audit_rows),
                "true_ood_by_group": dict(groups),
            },
        }

    def file_binding(self, path: Path, **extra: object) -> dict:
        """Describe one exact synthetic evidence file."""

        return {
            "bytes": path.stat().st_size,
            "path": self.relative(path),
            "sha256": digest(path.read_bytes()),
            **extra,
        }

    def critical_audit_document(
        self,
        manifest_rows: list[dict],
        audit_rows: list[dict],
        frozen_at: str,
    ) -> dict:
        """Create the strict critical-supplement reconciliation contract."""

        assignments = Counter(row["final_assignment"] for row in audit_rows)
        classes = Counter(
            row["final_class"] for row in audit_rows if row["final_class"] is not None
        )
        groups = Counter(
            row["final_group"] for row in audit_rows if row["final_group"] is not None
        )
        source_labels = Counter(row["candidate_label"] for row in manifest_rows)

        contact_sheet = self.critical_root / "selected-contact-sheets/synthetic.jpg"
        contact_sheet.parent.mkdir(parents=True, exist_ok=True)
        contact_sheet.write_bytes(b"synthetic contact sheet")
        validation_report = self.critical_root / "validation-report.json"
        write_json(validation_report, {"synthetic": True})
        licence_evidence = self.critical_root / "LICENSE-EVIDENCE.md"
        licence_evidence.write_text("Synthetic licence evidence.\n", encoding="utf-8")

        files_opened = [
            self.file_binding(
                self.critical_manifest,
                opened_by=["auditor_a", "auditor_b"],
                purpose="source_manifest",
            )
        ]
        for row in manifest_rows:
            selected_path = self.root.joinpath(*Path(row["selected_local_path"]).parts)
            files_opened.append(
                self.file_binding(
                    selected_path,
                    opened_by=["auditor_a", "auditor_b"],
                    purpose="referenced_image",
                )
            )
        files_opened.extend(
            [
                self.file_binding(
                    contact_sheet,
                    opened_by=["auditor_a", "auditor_b"],
                    purpose="selected_contact_sheet",
                ),
                self.file_binding(
                    validation_report,
                    opened_by=["auditor_a", "auditor_b"],
                    purpose="validation_report",
                ),
                self.file_binding(
                    licence_evidence,
                    opened_by=["auditor_a", "auditor_b"],
                    purpose="licensing_or_provenance_evidence",
                ),
            ]
        )
        return {
            "audit_id": "synthetic-critical-supplement-reconciled-audit",
            "audit_type": "prediction_blind_two_auditor_reconciliation",
            "blindness_attestations": {
                "auditors_independent_before_reconciliation": True,
                "classifier_run_or_imported": False,
                "model_reports_opened": False,
                "policy_or_evaluator_files_opened": False,
                "prediction_blind_reconciliation": True,
                "prediction_or_score_files_opened": False,
                "selection_used_model_or_predictions": False,
            },
            "files_opened": files_opened,
            "frozen_at_utc": frozen_at,
            "inputs": {
                "all_files_opened_declared": True,
                "all_input_hashes_match": True,
                "independent_audits": {
                    "auditor_a": self.file_binding(
                        self.critical_audit_a, audit_id="synthetic-critical-a"
                    ),
                    "auditor_b": self.file_binding(
                        self.critical_audit_b, audit_id="synthetic-critical-b"
                    ),
                },
                "source_manifest": {
                    "actual_hash_matches_both_audits": True,
                    "bytes": self.critical_manifest.stat().st_size,
                    "path": self.relative(self.critical_manifest),
                    "sha256": digest(self.critical_manifest.read_bytes()),
                },
            },
            "rows": audit_rows,
            "schema_version": 1,
            "summary": {
                "by_assignment": {
                    assignment: assignments[assignment]
                    for assignment in (
                        "eligible_operational_positive",
                        "manual_only_operational_positive",
                        "true_ood",
                        "exclude_uncertain",
                    )
                },
                "final_class_counts": dict(classes),
                "source_candidate_label_counts": dict(source_labels),
                "total_rows": len(audit_rows),
                "true_ood_by_group": dict(groups),
            },
        }

    def build(self) -> None:
        """Create the two base sources plus 26 critical operational rows."""

        positive_labels = [label for label in ENABLED_CLASSES for _ in range(2)]
        positive_labels.extend(ENABLED_CLASSES[:6])
        positive_decisions = [
            ("eligible_operational_positive", label) for label in positive_labels
        ]
        ood_decisions = [
            ("true_ood", f"synthetic_group_{index % 18:02d}")
            for index in range(100)
        ]
        oi_decisions = [
            *positive_decisions[:20],
            *ood_decisions[:50],
            ("exclude_uncertain", None),
        ]
        ov_decisions = [
            *positive_decisions[20:],
            *ood_decisions[50:],
            ("exclude_uncertain", None),
        ]
        critical_labels = [
            *("air_fryer" for _ in range(8)),
            *("rice_cooker" for _ in range(9)),
            *("shaver" for _ in range(9)),
        ]
        critical_decisions = [
            ("eligible_operational_positive", label) for label in critical_labels
        ]
        oi_rows, oi_audit_rows = self.build_source_rows("oi", oi_decisions)
        ov_rows, ov_audit_rows = self.build_source_rows("ov", ov_decisions)
        critical_rows, critical_audit_rows = self.build_source_rows(
            "cr", critical_decisions
        )
        write_jsonl(self.oi_manifest, oi_rows)
        write_jsonl(self.ov_manifest, ov_rows)
        write_jsonl(self.critical_manifest, critical_rows)
        write_json(
            self.oi_audit,
            self.audit_document(
                "open-images",
                self.oi_manifest,
                oi_audit_rows,
                "2026-10-09T01:00:00.000Z",
            ),
        )
        write_json(
            self.ov_audit,
            self.audit_document(
                "openverse",
                self.ov_manifest,
                ov_audit_rows,
                "2026-10-09T01:00:01.000Z",
            ),
        )
        manifest_hash = digest(self.critical_manifest.read_bytes())
        write_json(
            self.critical_audit_a,
            {
                "audit_id": "synthetic-critical-a",
                "auditor_id": "auditor_a",
                "source_manifest_sha256": manifest_hash,
            },
        )
        write_json(
            self.critical_audit_b,
            {
                "audit_id": "synthetic-critical-b",
                "auditor_id": "auditor_b",
                "source_manifest_sha256": manifest_hash,
            },
        )
        write_json(
            self.critical_audit,
            self.critical_audit_document(
                critical_rows,
                critical_audit_rows,
                "2026-10-09T01:00:02.000Z",
            ),
        )

        model_path = self.output / "upstream/synthetic-model.onnx"
        text_manifest_path = self.output / "text-embeddings.json"
        text_vectors_path = self.output / "text-embeddings.f32"
        for path, content in (
            (model_path, b"synthetic model bytes"),
            (text_manifest_path, b'{"synthetic":true}\n'),
            (text_vectors_path, b"synthetic vector bytes"),
        ):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        model_hash = digest(model_path.read_bytes())
        text_manifest_hash = digest(text_manifest_path.read_bytes())
        text_vectors_hash = digest(text_vectors_path.read_bytes())
        class_thresholds = {
            label: {"min_ood_margin": 0.0, "min_positive_margin": 0.0}
            for label in ENABLED_CLASSES
        }
        policy = {
            "acceptance": {"class_thresholds": class_thresholds},
            "artifact_hashes": {
                "text_manifest": {
                    "path": self.relative(text_manifest_path),
                    "sha256": text_manifest_hash,
                },
                "text_vectors": {
                    "path": self.relative(text_vectors_path),
                    "sha256": text_vectors_hash,
                },
                "vision_model": {
                    "path": self.relative(model_path),
                    "sha256": model_hash,
                },
            },
            "candidate_id": "synthetic-candidate-v2",
            "enabled_classes": list(ENABLED_CLASSES),
            "frozen_at_utc": "2026-10-09T00:59:00.000Z",
            "manual_only_classes": list(MANUAL_ONLY_CLASSES),
            "model": {
                "dtype": "q4",
                "repository": "synthetic/model",
                "revision": "synthetic-revision",
                "sha256": model_hash,
            },
            "policy_version": 2,
            "recognition_enabled": False,
            "release_ready": False,
        }
        write_json(self.policy, policy)
        write_json(
            self.gate,
            {
                "candidate_policy": {
                    "candidate_id": policy["candidate_id"],
                    "sha256": digest(self.policy.read_bytes()),
                },
                "frozen_candidate": {
                    "class_thresholds": class_thresholds,
                    "enabled_classes": list(ENABLED_CLASSES),
                    "manual_only_classes": list(MANUAL_ONLY_CLASSES),
                    "model_sha256": model_hash,
                    "text_manifest_sha256": text_manifest_hash,
                    "text_vectors_sha256": text_vectors_hash,
                },
                "fresh_cohort_minimums": {
                    "audited_eligible_operational_positives": 40,
                    "audited_operational_positives_per_enabled_class": 2,
                    "audited_true_ood": 100,
                    "distinct_true_ood_source_groups": 18,
                },
                "frozen_at_utc": "2026-10-09T00:59:01.000Z",
                "pass_criteria": {
                    "maximum_manual_only_class_accepts": 0,
                    "maximum_true_ood_accepts": 0,
                    "maximum_wrong_enabled_class_accepts": 0,
                    "minimum_accepted_correct_per_enabled_class": 1,
                    "minimum_eligible_operational_coverage": 0.5,
                },
                "recognition_enabled": False,
                "release_ready": False,
                "whole_candidate_failure_policy": {
                    "failure_action": "keep synthetic candidate disabled"
                },
            },
        )

    def command(self, *extra: str) -> list[str]:
        """Return an explicit command that cannot discover production inputs."""

        return [
            sys.executable,
            str(ASSEMBLER),
            "--repo-root",
            str(self.root),
            "--open-images-manifest",
            self.relative(self.oi_manifest),
            "--open-images-audit",
            self.relative(self.oi_audit),
            "--openverse-manifest",
            self.relative(self.ov_manifest),
            "--openverse-audit",
            self.relative(self.ov_audit),
            "--critical-manifest",
            self.relative(self.critical_manifest),
            "--critical-audit",
            self.relative(self.critical_audit),
            "--candidate-policy",
            self.relative(self.policy),
            "--gate",
            self.relative(self.gate),
            "--output-dir",
            self.relative(self.output),
            *extra,
        ]

    def rebind_critical_manifest(self) -> None:
        """Update only the reconciled fixture's exact manifest file binding."""

        audit = json.loads(self.critical_audit.read_text(encoding="utf-8"))
        manifest_hash = digest(self.critical_manifest.read_bytes())
        manifest_bytes = self.critical_manifest.stat().st_size
        audit["inputs"]["source_manifest"]["sha256"] = manifest_hash
        audit["inputs"]["source_manifest"]["bytes"] = manifest_bytes
        for entry in audit["files_opened"]:
            if entry["purpose"] == "source_manifest":
                entry["sha256"] = manifest_hash
                entry["bytes"] = manifest_bytes
        write_json(self.critical_audit, audit)


class CandidateV2FreshAssemblyTests(unittest.TestCase):
    """Verify deterministic output and critical fail-closed boundaries."""

    def test_synthetic_assembly_is_deterministic_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            created = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertEqual(created.returncode, 0, created.stderr)

            manifest_path = fixture.output / "candidate-v2-fresh-test-manifest.json"
            audit_path = fixture.output / "candidate-v2-fresh-audit-summary.json"
            lock_path = fixture.output / "candidate-v2-fresh-ground-truth-lock.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            audit = json.loads(audit_path.read_text(encoding="utf-8"))
            lock = json.loads(lock_path.read_text(encoding="utf-8"))

            self.assertEqual(len(manifest["samples"]), 166)
            self.assertTrue(
                all(
                    row["image_id"].startswith("open_images:")
                    for row in manifest["samples"][:70]
                )
            )
            self.assertTrue(
                all(
                    row["image_id"].startswith("openverse:")
                    for row in manifest["samples"][70:140]
                )
            )
            self.assertTrue(
                all(
                    row["image_id"].startswith("critical:")
                    for row in manifest["samples"][140:]
                )
            )
            self.assertTrue(
                all(
                    "/images/selected/" in row["downloaded_jpeg"]
                    for row in manifest["samples"][140:]
                )
            )
            self.assertEqual(set(manifest["inputs"]), {"open_images", "openverse", "critical"})
            self.assertEqual(len(audit["audited_operational_positive_ids"]), 66)
            self.assertEqual(len(audit["audited_true_ood_ids"]), 100)
            self.assertEqual(len(audit["ood_group_by_id"]), 100)
            self.assertEqual(len(set(audit["ood_group_by_id"].values())), 18)
            self.assertEqual(len(audit["excluded_uncertain_ids"]), 2)
            self.assertEqual(
                len(audit["provenance"]["records_by_namespaced_id"]), 168
            )
            self.assertEqual(
                set(audit["summary"]["enabled_positive_counts"]),
                set(ENABLED_CLASSES),
            )
            self.assertEqual(
                set(audit["summary"]["manual_only_positive_counts"]),
                set(MANUAL_ONLY_CLASSES),
            )
            self.assertEqual(
                audit["provenance"]["test_manifest"]["path"],
                "model/appliance-siglip/candidate-v2-fresh-test-manifest.json",
            )
            self.assertEqual(
                audit["audit_type"],
                "prediction_blind_reconciled_three_source_cohort",
            )
            critical_provenance = audit["provenance"]["sources"]["critical"]
            self.assertEqual(critical_provenance["source_manifest"]["rows"], 26)
            self.assertEqual(
                critical_provenance["source_manifest"]["sha256"],
                digest(fixture.critical_manifest.read_bytes()),
            )
            self.assertEqual(
                critical_provenance["audit"]["sha256"],
                digest(fixture.critical_audit.read_bytes()),
            )
            self.assertEqual(
                set(critical_provenance["independent_audits"]),
                {"auditor_a", "auditor_b"},
            )
            self.assertFalse(lock["model_outputs_opened"])
            self.assertFalse(lock["prediction_scores_opened"])
            self.assertEqual(lock["frozen_at_utc"], "2026-10-09T01:00:03.000Z")
            self.assertEqual(
                lock["inputs"]["test_manifest_sha256"],
                digest(manifest_path.read_bytes()),
            )
            self.assertEqual(
                lock["inputs"]["audit_sha256"], digest(audit_path.read_bytes())
            )
            self.assertEqual(
                lock["inputs"]["candidate_policy_sha256"],
                digest(fixture.policy.read_bytes()),
            )
            self.assertEqual(
                lock["inputs"]["gate_sha256"], digest(fixture.gate.read_bytes())
            )

            checked = subprocess.run(
                fixture.command("--check"),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(checked.returncode, 0, checked.stderr)

            original_manifest = manifest_path.read_bytes()
            manifest_path.write_bytes(original_manifest + b" ")
            drifted = subprocess.run(
                fixture.command("--check"),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(drifted.returncode, 0)
            self.assertIn("Output differs from deterministic assembly", drifted.stderr)
            self.assertEqual(manifest_path.read_bytes(), original_manifest + b" ")

            overwritten = subprocess.run(
                fixture.command("--overwrite"),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(overwritten.returncode, 0, overwritten.stderr)
            self.assertEqual(manifest_path.read_bytes(), original_manifest)
            refused = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(refused.returncode, 0)
            self.assertIn("Refusing to overwrite", refused.stderr)

    def test_duplicate_cross_source_image_hash_fails_before_output(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(
                Path(directory), duplicate_cross_source_hash=True
            )
            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Duplicate evaluated image SHA-256", result.stderr)
            self.assertFalse(
                (fixture.output / "candidate-v2-fresh-test-manifest.json").exists()
            )

    def test_critical_row_and_hash_tampering_fail_before_output(self):
        cases = (
            ("candidate_label", "kettle", "candidate_label does not match"),
            ("sha256", "0" * 64, "sha256 does not match"),
        )
        for field, replacement, expected_error in cases:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                fixture = SyntheticRepository(Path(directory))
                audit = json.loads(fixture.critical_audit.read_text(encoding="utf-8"))
                audit["rows"][0][field] = replacement
                write_json(fixture.critical_audit, audit)

                result = subprocess.run(
                    fixture.command(), capture_output=True, text=True, check=False
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(expected_error, result.stderr)
                self.assertFalse(
                    (fixture.output / "candidate-v2-fresh-test-manifest.json").exists()
                )

        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            audit = json.loads(fixture.critical_audit.read_text(encoding="utf-8"))
            audit["inputs"]["independent_audits"]["auditor_a"]["sha256"] = "0" * 64
            write_json(fixture.critical_audit, audit)
            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("auditor_a input SHA-256 does not match", result.stderr)

        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            first_row = json.loads(
                fixture.critical_manifest.read_text(encoding="utf-8").splitlines()[0]
            )
            selected_path = fixture.root.joinpath(
                *Path(first_row["selected_local_path"]).parts
            )
            selected_path.write_bytes(b"tampered selected image")
            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("files_opened row", result.stderr)
            self.assertIn("SHA-256 does not match", result.stderr)

    def test_critical_source_attestations_and_opened_file_inventory_are_required(self):
        cases = (
            "source_dataset",
            "selection_used_model_or_predictions",
            "ground_truth_status",
            "independent_blind_audit_status",
        )
        for field in cases:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                fixture = SyntheticRepository(Path(directory))
                rows = [
                    json.loads(line)
                    for line in fixture.critical_manifest.read_text(
                        encoding="utf-8"
                    ).splitlines()
                ]
                rows[0].pop(field)
                write_jsonl(fixture.critical_manifest, rows)
                fixture.rebind_critical_manifest()

                result = subprocess.run(
                    fixture.command(), capture_output=True, text=True, check=False
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"{field}=", result.stderr)

        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            audit = json.loads(fixture.critical_audit.read_text(encoding="utf-8"))
            audit["files_opened"] = [
                entry
                for entry in audit["files_opened"]
                if not (
                    entry["purpose"] == "referenced_image"
                    and entry["path"].endswith("cr-001.jpg")
                )
            ]
            write_json(fixture.critical_audit, audit)
            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("files_opened omits selected image", result.stderr)

        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            audit = json.loads(fixture.critical_audit.read_text(encoding="utf-8"))
            audit["blindness_attestations"].pop(
                "policy_or_evaluator_files_opened"
            )
            write_json(fixture.critical_audit, audit)
            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("policy_or_evaluator_files_opened", result.stderr)

    def test_every_supplied_audit_identifier_must_match_the_same_source_row(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            audit = json.loads(fixture.ov_audit.read_text(encoding="utf-8"))
            audit["rows"][0]["pool_index"] = "not-in-the-source-manifest"
            write_json(fixture.ov_audit, audit)

            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("do not match its source manifest", result.stderr)
            self.assertFalse(
                (fixture.output / "candidate-v2-fresh-test-manifest.json").exists()
            )

    def test_custom_output_path_is_bound_in_audit_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            custom_relative = "artifacts/final-cohort"
            result = subprocess.run(
                fixture.command("--output-dir", custom_relative),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            custom_output = fixture.root / custom_relative
            audit = json.loads(
                (custom_output / "candidate-v2-fresh-audit-summary.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual(
                audit["provenance"]["test_manifest"]["path"],
                "artifacts/final-cohort/candidate-v2-fresh-test-manifest.json",
            )

    @unittest.skipUnless(shutil.which("node"), "Node.js is required for the JS contract check")
    def test_generated_lock_matches_candidate_evaluator_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            assembled = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertEqual(assembled.returncode, 0, assembled.stderr)

            validator = """
                import fs from 'node:fs';
                import crypto from 'node:crypto';
                import { pathToFileURL } from 'node:url';
                const [modulePath, lockPath, auditPath, policyPath, gatePath, manifestPath] = process.argv.slice(2);
                const { validateCohortLock } = await import(pathToFileURL(modulePath).href);
                const read = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const hash = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
                validateCohortLock(read(lockPath), read(auditPath), read(policyPath), read(gatePath), {
                  policy: hash(policyPath),
                  gate: hash(gatePath),
                  manifest: hash(manifestPath),
                  audit: hash(auditPath),
                });
            """
            result = subprocess.run(
                [
                    shutil.which("node"),
                    "--input-type=module",
                    "--eval",
                    validator,
                    "synthetic-contract-check",
                    str(CANDIDATE_EVALUATOR),
                    str(fixture.output / "candidate-v2-fresh-ground-truth-lock.json"),
                    str(fixture.output / "candidate-v2-fresh-audit-summary.json"),
                    str(fixture.policy),
                    str(fixture.gate),
                    str(fixture.output / "candidate-v2-fresh-test-manifest.json"),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_output_directory_cannot_escape_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory) / "repository")
            outside = fixture.root.parent / "outside"
            result = subprocess.run(
                fixture.command("--output-dir", str(outside)),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("inside the repository root", result.stderr)
            self.assertFalse(outside.exists())

    def test_lock_timestamp_follows_a_later_frozen_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            gate = json.loads(fixture.gate.read_text(encoding="utf-8"))
            gate["frozen_at_utc"] = "2026-10-09T02:00:00.000Z"
            write_json(fixture.gate, gate)

            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            lock = json.loads(
                (
                    fixture.output
                    / "candidate-v2-fresh-ground-truth-lock.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(lock["frozen_at_utc"], "2026-10-09T02:00:01.000Z")

    def test_source_selection_and_candidate_class_surface_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            rows = [
                json.loads(line)
                for line in fixture.oi_manifest.read_text(encoding="utf-8").splitlines()
            ]
            rows[0]["selection_uses_model_predictions"] = True
            write_jsonl(fixture.oi_manifest, rows)
            audit = json.loads(fixture.oi_audit.read_text(encoding="utf-8"))
            audit["inputs"]["source_manifest"]["sha256"] = digest(
                fixture.oi_manifest.read_bytes()
            )
            audit["inputs"]["source_manifest"]["bytes"] = fixture.oi_manifest.stat().st_size
            write_json(fixture.oi_audit, audit)

            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("selection_uses_model_predictions=False", result.stderr)

        with tempfile.TemporaryDirectory() as directory:
            fixture = SyntheticRepository(Path(directory))
            policy = json.loads(fixture.policy.read_text(encoding="utf-8"))
            policy["enabled_classes"] = policy["enabled_classes"][:-1]
            write_json(fixture.policy, policy)
            result = subprocess.run(
                fixture.command(), capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("enabled_classes do not match", result.stderr)


if __name__ == "__main__":
    unittest.main()
