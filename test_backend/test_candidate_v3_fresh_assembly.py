"""Check the evidence boundary without loading a model or touching real data."""

import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "assemble-appliance-siglip-candidate-v3-test.py"
SPEC = importlib.util.spec_from_file_location("candidate_v3_assembly", SCRIPT)
assembly = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = assembly
SPEC.loader.exec_module(assembly)


class CandidateV3AssemblyTests(unittest.TestCase):
    """Failures here would otherwise allow reused images or invented labels."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.image = self.write("images/fresh.jpg", b"synthetic unique image fixture")
        self.row = assembly.ManifestRow(
            "positives", 1, "fresh", "positives:fresh", "Openverse", "new-asset",
            "openverse\x1fnew-asset", "images/fresh.jpg", assembly.sha256_file(self.image),
        )
        prior = self.write("model/appliance-siglip/candidate-v2-fresh-test-manifest.json", b'{"samples":[]}')
        self.prior = {
            "schema_version": 1, "index_id": "synthetic-prior-index",
            "frozen_at_utc": "2026-10-10T00:00:00Z",
            "covers_all_prior_derivation_and_evaluation": True,
            "sources": [{"path": prior.relative_to(self.root).as_posix(), "bytes": prior.stat().st_size,
                         "sha256": assembly.sha256_file(prior)}],
            "source_identities": [{"source_dataset": "Openverse", "source_asset_id": "old-asset"}],
            "image_sha256": [assembly.sha256_bytes(b"previous synthetic image")],
        }

    def write(self, name, content):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return target

    def prior_check(self, document=None):
        target = self.write("prior.json", assembly.canonical_json_bytes(document or self.prior))
        return assembly.validate_prior_evidence(self.root, target, [self.row])

    def test_fresh_identity_and_bytes_are_accepted_and_provenance_bound(self):
        result = self.prior_check()
        self.assertFalse(result["overlap_found"])
        self.assertEqual(result["sha256"], assembly.sha256_file(self.root / "prior.json"))

    def test_renamed_prior_image_is_rejected_by_content_hash(self):
        data = copy.deepcopy(self.prior)
        data["image_sha256"].append(self.row.sha256)
        with self.assertRaisesRegex(assembly.AssemblyError, "image-byte overlap"):
            self.prior_check(data)

    def test_reencoded_prior_asset_is_rejected_by_source_identity(self):
        data = copy.deepcopy(self.prior)
        data["source_identities"].append({"source_dataset": " openverse ", "source_asset_id": "new-asset"})
        with self.assertRaisesRegex(assembly.AssemblyError, "source identity overlap"):
            self.prior_check(data)

    def test_changed_prior_manifest_does_not_keep_old_provenance(self):
        self.write("model/appliance-siglip/candidate-v2-fresh-test-manifest.json", b"changed")
        with self.assertRaisesRegex(assembly.AssemblyError, "declared bytes or hash"):
            self.prior_check()

    def test_prior_index_cannot_omit_previous_v2_cohort(self):
        data = copy.deepcopy(self.prior)
        data["sources"] = []
        with self.assertRaisesRegex(assembly.AssemblyError, "candidate-v2 fresh test manifest"):
            self.prior_check(data)

    def test_json_duplicate_label_is_rejected(self):
        path = self.write("ambiguous.json", b'{"class_label":"kettle","class_label":"fan"}')
        with self.assertRaisesRegex(assembly.AssemblyError, "Duplicate JSON key"):
            assembly.read_json(path, "audit fixture")

    def test_declared_traversal_and_path_aliases_are_rejected(self):
        for path in ("images/../images/fresh.jpg", "images//fresh.jpg", "images/./fresh.jpg", "images\\fresh.jpg"):
            with self.subTest(path=path), self.assertRaises(assembly.AssemblyError):
                assembly.resolve_declared_file(self.root, path, "image")

    @staticmethod
    def final_row(assignment="eligible_operational_positive", label="kettle", group=None, status="agreed"):
        return {"final_assignment": assignment, "final_class": label,
                "true_ood_source_group": group, "reconciliation_status": status}

    def test_final_label_cannot_override_two_visual_auditors(self):
        with self.assertRaisesRegex(assembly.AssemblyError, "preserve"):
            assembly.validate_reconciliation(self.final_row(label="fan"),
                [("operational_positive", "kettle", None)] * 2, "fixture")

    def test_agreed_manual_only_visual_label_keeps_its_class(self):
        assembly.validate_reconciliation(self.final_row("manual_only_operational_positive", "blender"),
            [("operational_positive", "blender", None)] * 2, "fixture")

    def test_disagreement_is_excluded_instead_of_picking_convenient_label(self):
        decisions = [("operational_positive", "kettle", None), ("operational_positive", "fan", None)]
        with self.assertRaisesRegex(assembly.AssemblyError, "disagreement"):
            assembly.validate_reconciliation(self.final_row(status="resolved"), decisions, "fixture")
        assembly.validate_reconciliation(self.final_row("exclude_uncertain", None, status="resolved"), decisions, "fixture")

    def test_ood_group_cannot_be_invented_at_reconciliation(self):
        with self.assertRaisesRegex(assembly.AssemblyError, "preserve"):
            assembly.validate_reconciliation(self.final_row("true_ood", None, "many-groups"),
                [("true_ood", None, "furniture")] * 2, "fixture")

    def test_visual_decision_requires_observation_not_coverage_only(self):
        with self.assertRaises(assembly.AssemblyError):
            assembly.visual_decision({"row_key": "positives:fresh"}, "fixture")
        good = {"row_key": "positives:fresh", "assignment": "operational_positive", "class_label": "kettle",
                "true_ood_source_group": None, "reason": "Visible chamber, handle, spout and electrical base."}
        self.assertEqual(assembly.visual_decision(good, "fixture"), ("operational_positive", "kettle", None))

    def independent_audit_fixtures(self, include_decisions=True):
        """Make two separately hashed visual-audit documents for one source row."""
        manifests = {}
        for role in ("positives", "ood"):
            path = self.write(f"{role}.json", role.encode())
            manifests[role] = assembly.FrozenManifest(
                role, path, path.name, assembly.sha256_file(path), path.stat().st_size,
                role, assembly.parse_utc("2026-10-10T00:00:00Z", "fixture"),
                "2026-10-10T00:00:00Z", (self.row,) if role == "positives" else (),
            )
        declarations = []
        for number in (1, 2):
            document = {
                "schema_version": 1, "audit_id": f"audit-{number}", "auditor_id": f"agent-{number}",
                "audit_type": "prediction_blind_independent_visual_audit",
                "frozen_at_utc": f"2026-10-10T00:00:0{number}Z",
                "model_outputs_opened": False, "prediction_scores_opened": False,
                "policy_gate_or_thresholds_opened": False,
                "source_manifest_hashes": {role: item.file_sha256 for role, item in manifests.items()},
                "reviewed_row_keys": [self.row.row_key],
            }
            if include_decisions:
                document["rows"] = [{"row_key": self.row.row_key, "assignment": "operational_positive",
                    "class_label": "kettle", "true_ood_source_group": None, "reason": "Spout, handle and electrical base visible."}]
            path = self.write(f"audit-{number}.json", assembly.canonical_json_bytes(document))
            declarations.append({"audit_id": document["audit_id"], "auditor_id": document["auditor_id"],
                "path": path.name, "bytes": path.stat().st_size, "sha256": assembly.sha256_file(path),
                "frozen_at_utc": document["frozen_at_utc"]})
        return manifests, declarations

    def test_independent_audits_return_both_bound_visual_decisions(self):
        manifests, declarations = self.independent_audit_fixtures()
        provenance, _, decisions = assembly.validate_independent_audits(self.root, declarations, manifests, [self.row.row_key])
        self.assertEqual(len(provenance), 2)
        self.assertEqual(decisions[self.row.row_key], [("operational_positive", "kettle", None)] * 2)

    def test_coverage_attestation_without_visual_labels_is_rejected(self):
        manifests, declarations = self.independent_audit_fixtures(include_decisions=False)
        with self.assertRaisesRegex(assembly.AssemblyError, "rows must be a JSON list"):
            assembly.validate_independent_audits(self.root, declarations, manifests, [self.row.row_key])

    def test_atomic_output_never_overwrites_previous_evidence(self):
        path = self.root / "result.json"
        assembly.atomic_write(path, b"first frozen result")
        with self.assertRaisesRegex(assembly.AssemblyError, "overwrite"):
            assembly.atomic_write(path, b"replacement")
        self.assertEqual(path.read_bytes(), b"first frozen result")

    def test_incomplete_diagnostic_never_claims_release_sample_minimums(self):
        with self.assertRaisesRegex(assembly.AssemblyError, "at least 33"):
            assembly.validate_minimums({"one": "kettle"}, ["ood"], {"ood": "furniture"})
        result = assembly.validate_minimums({"one": "kettle"}, ["ood"], {"ood": "furniture"}, allow_incomplete=True)
        self.assertFalse(result["minimums_met"])
        self.assertEqual(len(result["minimum_failures"]), 4)

    def test_diagnostic_mode_still_rejects_invalid_ground_truth(self):
        with self.assertRaises(assembly.AssemblyError):
            assembly.validate_minimums({"one": "invented_label"}, [], {}, allow_incomplete=True)
        with self.assertRaises(assembly.AssemblyError):
            assembly.validate_minimums({}, ["ood"], {}, allow_incomplete=True)


if __name__ == "__main__":
    unittest.main()
