/* Synthetic tests for the candidate-only class-threshold evaluator and gate. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptsClassThresholdPolicy,
  evaluateCandidateReleaseGate,
  summariseClassThresholdEvaluation,
  validateClassThresholdPolicy,
  validateCohortLock,
  validateFrozenEvaluationInputs,
} from "../scripts/evaluate-appliance-siglip-candidate-policy.mjs";

function policy() {
  return {
    policy_version: 2,
    release_ready: false,
    recognition_enabled: false,
    enabled_classes: ["fan", "kettle"],
    manual_only_classes: ["shaver"],
    acceptance: {
      class_thresholds: {
        fan: { min_ood_margin: 0.03, min_positive_margin: 0.02 },
        kettle: { min_ood_margin: 0.05, min_positive_margin: 0.01 },
      },
    },
  };
}

function prediction(imageId, predicted, oodMargin, positiveMargin) {
  return {
    image_id: imageId,
    top_positive: { label: predicted, score: 0.5 },
    ood_margin: oodMargin,
    positive_margin: positiveMargin,
  };
}

function gate() {
  return {
    fresh_cohort_minimums: {
      audited_eligible_operational_positives: 4,
      audited_operational_positives_per_enabled_class: 2,
      audited_true_ood: 2,
      distinct_true_ood_source_groups: 2,
    },
    pass_criteria: {
      minimum_eligible_operational_coverage: 0.5,
      minimum_accepted_correct_per_enabled_class: 1,
      maximum_wrong_enabled_class_accepts: 0,
      maximum_manual_only_class_accepts: 0,
      maximum_true_ood_accepts: 0,
    },
    whole_candidate_failure_policy: { failure_action: "keep disabled" },
  };
}

test("winning class uses its own two margins and disabled winners never fall through", () => {
  const candidate = policy();
  assert.equal(acceptsClassThresholdPolicy(prediction("fan-ok", "fan", 0.03, 0.02), candidate), true);
  assert.equal(acceptsClassThresholdPolicy(prediction("fan-low", "fan", 0.0299, 0.9), candidate), false);
  assert.equal(acceptsClassThresholdPolicy(prediction("kettle-low", "kettle", 0.0499, 0.9), candidate), false);
  assert.equal(acceptsClassThresholdPolicy(prediction("manual", "shaver", 0.9, 0.9), candidate), false);
});

test("a complete clean cohort passes aggregate and every per-class condition", () => {
  const rows = [
    prediction("fan-1", "fan", 0.04, 0.03),
    prediction("fan-2", "fan", 0.01, 0.01),
    prediction("kettle-1", "kettle", 0.06, 0.02),
    prediction("kettle-2", "kettle", 0.01, 0.01),
    prediction("manual", "shaver", 0.9, 0.9),
    prediction("ood-1", "fan", 0.01, 0.9),
    prediction("ood-2", "kettle", 0.9, 0.001),
  ];
  const audit = {
    audited_operational_positive_ids: {
      "fan-1": "fan",
      "fan-2": "fan",
      "kettle-1": "kettle",
      "kettle-2": "kettle",
      manual: "shaver",
    },
    audited_true_ood_ids: ["ood-1", "ood-2"],
    ood_group_by_id: { "ood-1": "chair", "ood-2": "laptop" },
  };
  const summary = summariseClassThresholdEvaluation(rows, audit, policy());
  const decision = evaluateCandidateReleaseGate(summary, gate(), policy());
  assert.equal(summary.eligible_operational.accepted_correct, 2);
  assert.equal(summary.eligible_operational.coverage, 0.5);
  assert.equal(summary.manual_only_operational.accepted, 0);
  assert.equal(summary.true_ood.accepted, 0);
  assert.equal(decision.passed, true);
});

test("one class with no accepted-correct fresh example fails the whole candidate", () => {
  const rows = [
    prediction("fan-1", "fan", 0.04, 0.03),
    prediction("fan-2", "fan", 0.04, 0.03),
    prediction("kettle-1", "kettle", 0.01, 0.01),
    prediction("kettle-2", "kettle", 0.01, 0.01),
    prediction("ood-1", "fan", 0.01, 0.9),
    prediction("ood-2", "kettle", 0.9, 0.001),
  ];
  const audit = {
    audited_operational_positive_ids: {
      "fan-1": "fan",
      "fan-2": "fan",
      "kettle-1": "kettle",
      "kettle-2": "kettle",
    },
    audited_true_ood_ids: ["ood-1", "ood-2"],
    ood_group_by_id: { "ood-1": "chair", "ood-2": "laptop" },
  };
  const summary = summariseClassThresholdEvaluation(rows, audit, policy());
  const decision = evaluateCandidateReleaseGate(summary, gate(), policy());
  assert.equal(summary.eligible_operational.coverage, 0.5);
  assert.equal(decision.passed, false);
  assert.equal(
    decision.criteria.find((item) => item.name === "kettle: accepted correct")?.passed,
    false,
  );
  assert.equal(decision.whole_candidate, true);
});

test("wrong, manual-only and true-OOD accepts are reported independently", () => {
  const rows = [
    prediction("fan-wrong", "kettle", 0.08, 0.08),
    prediction("manual", "fan", 0.08, 0.08),
    prediction("ood", "fan", 0.08, 0.08),
  ];
  const audit = {
    audited_operational_positive_ids: { "fan-wrong": "fan", manual: "shaver" },
    audited_true_ood_ids: ["ood"],
    ood_group_by_id: { ood: "chair" },
  };
  const summary = summariseClassThresholdEvaluation(rows, audit, policy());
  assert.equal(summary.eligible_operational.wrong_accepts.length, 1);
  assert.equal(summary.manual_only_operational.accepted, 1);
  assert.equal(summary.true_ood.accepted, 1);
});

test("candidate validation refuses enabled flags and incomplete threshold maps", () => {
  assert.throws(
    () => validateClassThresholdPolicy({ ...policy(), recognition_enabled: true }),
    /flags must remain false/,
  );
  const incomplete = policy();
  delete incomplete.acceptance.class_thresholds.kettle;
  assert.throws(() => validateClassThresholdPolicy(incomplete), /match enabled_classes exactly/);
});

test("audit partitions must cover each prediction exactly once", () => {
  const rows = [
    prediction("fan", "fan", 0.04, 0.03),
    prediction("ood", "fan", 0.01, 0.01),
  ];
  const audit = {
    audited_operational_positive_ids: { fan: "fan" },
    audited_true_ood_ids: ["ood"],
    ood_group_by_id: { ood: "chair" },
  };
  assert.doesNotThrow(() => summariseClassThresholdEvaluation(rows, audit, policy()));
  assert.throws(
    () => summariseClassThresholdEvaluation([...rows, prediction("ignored", "fan", 0.9, 0.9)], audit, policy()),
    /cover every prediction exactly once/,
  );
  assert.throws(
    () => summariseClassThresholdEvaluation(rows, { ...audit, audited_true_ood_ids: ["ood", "ood"] }, policy()),
    /unique nonempty IDs/,
  );
  assert.throws(
    () => summariseClassThresholdEvaluation(rows, { ...audit, audited_true_ood_ids: ["fan", "ood"] }, policy()),
    /must be disjoint/,
  );
  assert.throws(
    () => summariseClassThresholdEvaluation(rows, { ...audit, audited_operational_positive_ids: { fan: "fan", ghost: "kettle" } }, policy()),
    /cover every prediction exactly once/,
  );
});

test("audit labels and every OOD source group must be valid", () => {
  const rows = [prediction("fan", "fan", 0.04, 0.03), prediction("ood", "fan", 0.01, 0.01)];
  const audit = {
    audited_operational_positive_ids: { fan: "fan" },
    audited_true_ood_ids: ["ood"],
    ood_group_by_id: { ood: "chair" },
  };
  assert.throws(
    () => summariseClassThresholdEvaluation(rows, { ...audit, audited_operational_positive_ids: { fan: "" } }, policy()),
    /valid enabled or manual-only expected label/,
  );
  assert.throws(
    () => summariseClassThresholdEvaluation(rows, { ...audit, audited_operational_positive_ids: { fan: "unknown" } }, policy()),
    /valid enabled or manual-only expected label/,
  );
  assert.throws(
    () => summariseClassThresholdEvaluation(rows, { ...audit, ood_group_by_id: { ood: " " } }, policy()),
    /nonempty source group/,
  );
  assert.throws(
    () => summariseClassThresholdEvaluation(rows, { ...audit, ood_group_by_id: { ood: "chair", ghost: "laptop" } }, policy()),
    /nonempty source group/,
  );
});

test("the prediction-blind lock binds the exact candidate and test inputs", () => {
  const hash = (digit) => digit.repeat(64);
  const candidate = {
    ...policy(),
    candidate_id: "candidate-v2",
    model: { repository: "example/model", revision: "pinned", dtype: "q4", sha256: hash("a") },
    artifact_hashes: {
      text_manifest: { sha256: hash("b") },
      text_vectors: { sha256: hash("c") },
    },
  };
  const frozenGate = {
    ...gate(),
    release_ready: false,
    recognition_enabled: false,
    candidate_policy: { candidate_id: "candidate-v2", sha256: hash("d") },
    frozen_candidate: {
      model_sha256: hash("a"),
      text_manifest_sha256: hash("b"),
      text_vectors_sha256: hash("c"),
      enabled_classes: candidate.enabled_classes,
      manual_only_classes: candidate.manual_only_classes,
      class_thresholds: candidate.acceptance.class_thresholds,
    },
  };
  const audit = { frozen_at_utc: "2026-10-09T02:00:00Z" };
  const hashes = { policy: hash("d"), gate: hash("e"), manifest: hash("f"), audit: hash("0") };
  const lock = {
    frozen_at_utc: "2026-10-09T03:00:00Z",
    model_outputs_opened: false,
    prediction_scores_opened: false,
    inputs: {
      candidate_policy_sha256: hashes.policy,
      gate_sha256: hashes.gate,
      test_manifest_sha256: hashes.manifest,
      audit_sha256: hashes.audit,
      model_sha256: hash("a"),
      text_manifest_sha256: hash("b"),
      text_vectors_sha256: hash("c"),
    },
  };
  const lockHash = hash("1");
  const report = {
    model: "example/model",
    revision: "pinned",
    dtype: "q4",
    model_sha256: hash("a"),
    inputs: {
      manifest_sha256: hashes.manifest,
      audit_sha256: hashes.audit,
      text_manifest_sha256: hash("b"),
      text_vectors_sha256: hash("c"),
      cohort_lock_sha256: lockHash,
    },
  };
  assert.doesNotThrow(() => validateCohortLock(lock, audit, candidate, frozenGate, hashes));
  assert.doesNotThrow(() => validateFrozenEvaluationInputs(report, lock, lockHash, candidate));
  for (const field of ["model_sha256", "text_manifest_sha256", "text_vectors_sha256", "audit_sha256", "test_manifest_sha256"]) {
    const changed = structuredClone(lock);
    changed.inputs[field] = hash("2");
    assert.throws(() => validateCohortLock(changed, audit, candidate, frozenGate, hashes), /lock hashes/);
  }
  for (const field of ["model_sha256", "manifest_sha256", "audit_sha256", "text_manifest_sha256", "text_vectors_sha256", "cohort_lock_sha256"]) {
    const changed = structuredClone(report);
    if (field === "model_sha256") changed.model_sha256 = hash("2");
    else changed.inputs[field] = hash("2");
    assert.throws(() => validateFrozenEvaluationInputs(changed, lock, lockHash, candidate), /does not match/);
  }
  assert.throws(
    () => validateCohortLock(lock, { frozen_at_utc: "2026-10-09T04:00:00Z" }, candidate, frozenGate, hashes),
    /frozen after the audit/,
  );
});
