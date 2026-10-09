/**
 * Evaluate saved SigLIP prediction rows with a class-specific candidate policy.
 *
 * This offline evaluator never loads the model and never sends an image. A
 * separate parity harness may create prediction rows for a newly locked cohort;
 * this module then applies the frozen thresholds and whole-candidate gate.
 */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

function assertFiniteThreshold(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a finite number from 0 through 1.`);
  }
}

function exactUniqueStrings(values, label) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== "string" || !value)) {
    throw new Error(`${label} must be a non-empty string list.`);
  }
  if (new Set(values).size !== values.length) throw new Error(`${label} contains a duplicate.`);
  return [...values];
}

/** Validate a disabled candidate policy and return its frozen class map. */
export function validateClassThresholdPolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new Error("Candidate policy must be a JSON object.");
  }
  if (policy.release_ready !== false || policy.recognition_enabled !== false) {
    throw new Error("Offline candidate policy flags must remain false.");
  }
  if (policy.policy_version !== 2) throw new Error("Candidate policy_version must be 2.");
  const enabledClasses = exactUniqueStrings(policy.enabled_classes, "enabled_classes");
  const manualOnlyClasses = exactUniqueStrings(policy.manual_only_classes, "manual_only_classes");
  if (manualOnlyClasses.some((label) => enabledClasses.includes(label))) {
    throw new Error("Enabled and manual-only classes must be disjoint.");
  }
  const classThresholds = policy.acceptance?.class_thresholds;
  if (!classThresholds || typeof classThresholds !== "object" || Array.isArray(classThresholds)) {
    throw new Error("Candidate policy is missing acceptance.class_thresholds.");
  }
  const thresholdClasses = Object.keys(classThresholds);
  if (thresholdClasses.length !== enabledClasses.length || enabledClasses.some((label) => !thresholdClasses.includes(label))) {
    throw new Error("Threshold keys must match enabled_classes exactly.");
  }
  for (const label of enabledClasses) {
    const threshold = classThresholds[label];
    if (!threshold || typeof threshold !== "object") throw new Error(`Missing threshold object for ${label}.`);
    assertFiniteThreshold(threshold.min_ood_margin, `${label}.min_ood_margin`);
    assertFiniteThreshold(threshold.min_positive_margin, `${label}.min_positive_margin`);
  }
  return Object.freeze({
    enabledClasses,
    enabledSet: new Set(enabledClasses),
    supportedSet: new Set([...enabledClasses, ...manualOnlyClasses]),
    classThresholds,
  });
}

/**
 * Apply the winning label's thresholds. A disabled winner is rejected rather
 * than replaced with the next enabled label.
 */
export function acceptsClassThresholdPolicy(row, policyOrValidated) {
  const validated = policyOrValidated?.enabledSet
    ? policyOrValidated
    : validateClassThresholdPolicy(policyOrValidated);
  const label = row?.top_positive?.label;
  if (!validated.enabledSet.has(label)) return false;
  const threshold = validated.classThresholds[label];
  return Number.isFinite(row.ood_margin) && Number.isFinite(row.positive_margin) &&
    row.ood_margin >= threshold.min_ood_margin &&
    row.positive_margin >= threshold.min_positive_margin;
}

function acceptedRecord(row, expected = null) {
  return {
    image_id: row.image_id,
    expected,
    predicted: row.top_positive.label,
    ood_margin: row.ood_margin,
    positive_margin: row.positive_margin,
  };
}

function requireUniquePredictionRows(rows) {
  if (!Array.isArray(rows)) throw new Error("Prediction report rows must be an array.");
  const ids = rows.map((row) => row?.image_id);
  if (ids.some((imageId) => typeof imageId !== "string" || !imageId)) {
    throw new Error("Every prediction row needs an image_id.");
  }
  if (new Set(ids).size !== ids.length) throw new Error("Prediction rows contain duplicate image IDs.");
  if (rows.some((row) => typeof row.top_positive?.label !== "string" || !row.top_positive.label ||
    !Number.isFinite(row.ood_margin) || !Number.isFinite(row.positive_margin))) {
    throw new Error("Every prediction row needs a winning label and finite margins.");
  }
}

function requireAuditMap(audit) {
  const mapping = audit?.audited_operational_positive_ids;
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error("Audit must map audited_operational_positive_ids to expected labels.");
  }
  return mapping;
}

/** Summarise one untouched cohort without making a release decision. */
export function summariseClassThresholdEvaluation(rows, audit, policy) {
  requireUniquePredictionRows(rows);
  const expectedById = requireAuditMap(audit);
  const validated = validateClassThresholdPolicy(policy);
  const byId = new Map(rows.map((row) => [row.image_id, row]));
  const operationalIds = Object.keys(expectedById);
  if (operationalIds.some((imageId) => !imageId || !validated.supportedSet.has(expectedById[imageId]))) {
    throw new Error("Operational audit IDs need a valid enabled or manual-only expected label.");
  }
  const trueOodIds = audit.audited_true_ood_ids;
  if (!Array.isArray(trueOodIds) || trueOodIds.some((imageId) => typeof imageId !== "string" || !imageId) ||
    new Set(trueOodIds).size !== trueOodIds.length) {
    throw new Error("audited_true_ood_ids must be a list of unique nonempty IDs.");
  }
  const auditedIds = [...operationalIds, ...trueOodIds];
  if (new Set(auditedIds).size !== auditedIds.length) {
    throw new Error("Operational and true-OOD audits must be disjoint.");
  }
  if (auditedIds.length !== rows.length || auditedIds.some((imageId) => !byId.has(imageId))) {
    throw new Error("Operational and true-OOD audits must cover every prediction exactly once.");
  }
  const groupById = audit.ood_group_by_id;
  if (!groupById || typeof groupById !== "object" || Array.isArray(groupById) ||
    Object.keys(groupById).length !== trueOodIds.length ||
    trueOodIds.some((imageId) => typeof groupById[imageId] !== "string" || !groupById[imageId].trim())) {
    throw new Error("Every true-OOD ID needs exactly one nonempty source group.");
  }

  const accepts = (row) => acceptsClassThresholdPolicy(row, validated);
  const eligibleRows = [];
  const disabledRows = [];
  const perClass = Object.fromEntries(validated.enabledClasses.map((label) => [label, {
    audited_operational_positives: 0,
    accepted: 0,
    accepted_correct: 0,
    wrong_accepts: [],
  }]));

  for (const [imageId, expected] of Object.entries(expectedById)) {
    const row = byId.get(imageId);
    if (validated.enabledSet.has(expected)) {
      eligibleRows.push(row);
      const metrics = perClass[expected];
      const isAccepted = accepts(row);
      const isCorrect = row.top_positive.label === expected;
      metrics.audited_operational_positives += 1;
      metrics.accepted += Number(isAccepted);
      metrics.accepted_correct += Number(isAccepted && isCorrect);
      if (isAccepted && !isCorrect) metrics.wrong_accepts.push(acceptedRecord(row, expected));
    } else {
      disabledRows.push(row);
    }
  }

  const trueOodRows = trueOodIds.map((imageId) => byId.get(imageId));
  const acceptedEligible = eligibleRows.filter(accepts);
  const acceptedCorrect = acceptedEligible.filter((row) => row.top_positive.label === expectedById[row.image_id]);
  const wrongEnabled = acceptedEligible.filter((row) => row.top_positive.label !== expectedById[row.image_id]);
  const acceptedDisabled = disabledRows.filter(accepts);
  const acceptedTrueOod = trueOodRows.filter(accepts);
  const oodGroups = new Set(trueOodIds.map((imageId) => groupById[imageId]));

  for (const metrics of Object.values(perClass)) {
    metrics.coverage = metrics.audited_operational_positives
      ? metrics.accepted_correct / metrics.audited_operational_positives
      : null;
  }
  return {
    eligible_operational: {
      n: eligibleRows.length,
      accepted: acceptedEligible.length,
      accepted_correct: acceptedCorrect.length,
      coverage: eligibleRows.length ? acceptedCorrect.length / eligibleRows.length : null,
      wrong_accepts: wrongEnabled.map((row) => acceptedRecord(row, expectedById[row.image_id])),
      per_class: perClass,
    },
    manual_only_operational: {
      n: disabledRows.length,
      accepted: acceptedDisabled.length,
      accepted_rows: acceptedDisabled.map((row) => acceptedRecord(row, expectedById[row.image_id])),
    },
    true_ood: {
      n: trueOodRows.length,
      source_groups: oodGroups.size,
      accepted: acceptedTrueOod.length,
      accepted_rows: acceptedTrueOod.map((row) => acceptedRecord(row)),
    },
  };
}

function criterion(name, actual, required, passed) {
  return { name, actual, required, passed: Boolean(passed) };
}

/** Apply the preregistered aggregate and per-class whole-candidate gate. */
export function evaluateCandidateReleaseGate(summary, gate, policy) {
  const validated = validateClassThresholdPolicy(policy);
  const minimums = gate?.fresh_cohort_minimums;
  const pass = gate?.pass_criteria;
  if (!minimums || !pass) throw new Error("Release gate is missing minimums or pass criteria.");
  const criteria = [
    criterion(
      "eligible operational positives",
      summary.eligible_operational.n,
      minimums.audited_eligible_operational_positives,
      summary.eligible_operational.n >= minimums.audited_eligible_operational_positives,
    ),
    criterion(
      "true OOD photos",
      summary.true_ood.n,
      minimums.audited_true_ood,
      summary.true_ood.n >= minimums.audited_true_ood,
    ),
    criterion(
      "true OOD source groups",
      summary.true_ood.source_groups,
      minimums.distinct_true_ood_source_groups,
      summary.true_ood.source_groups >= minimums.distinct_true_ood_source_groups,
    ),
    criterion(
      "eligible coverage",
      summary.eligible_operational.coverage,
      pass.minimum_eligible_operational_coverage,
      summary.eligible_operational.coverage >= pass.minimum_eligible_operational_coverage,
    ),
    criterion(
      "wrong enabled-class accepts",
      summary.eligible_operational.wrong_accepts.length,
      pass.maximum_wrong_enabled_class_accepts,
      summary.eligible_operational.wrong_accepts.length <= pass.maximum_wrong_enabled_class_accepts,
    ),
    criterion(
      "manual-only-class accepts",
      summary.manual_only_operational.accepted,
      pass.maximum_manual_only_class_accepts,
      summary.manual_only_operational.accepted <= pass.maximum_manual_only_class_accepts,
    ),
    criterion(
      "true-OOD accepts",
      summary.true_ood.accepted,
      pass.maximum_true_ood_accepts,
      summary.true_ood.accepted <= pass.maximum_true_ood_accepts,
    ),
  ];

  for (const label of validated.enabledClasses) {
    const metrics = summary.eligible_operational.per_class[label];
    criteria.push(
      criterion(
        `${label}: audited positives`,
        metrics.audited_operational_positives,
        minimums.audited_operational_positives_per_enabled_class,
        metrics.audited_operational_positives >= minimums.audited_operational_positives_per_enabled_class,
      ),
      criterion(
        `${label}: accepted correct`,
        metrics.accepted_correct,
        pass.minimum_accepted_correct_per_enabled_class,
        metrics.accepted_correct >= pass.minimum_accepted_correct_per_enabled_class,
      ),
      criterion(
        `${label}: wrong accepts`,
        metrics.wrong_accepts.length,
        0,
        metrics.wrong_accepts.length === 0,
      ),
    );
  }
  return {
    passed: criteria.every((item) => item.passed),
    whole_candidate: true,
    criteria,
    failure_action: gate.whole_candidate_failure_policy?.failure_action ?? null,
  };
}

/** Check the prediction-blind lock against every file and model identity. */
export function validateCohortLock(lock, audit, policy, gate, hashes) {
  const inputs = lock?.inputs;
  const auditTime = Date.parse(audit?.frozen_at_utc);
  const lockTime = Date.parse(lock?.frozen_at_utc);
  if (lock?.model_outputs_opened !== false || lock?.prediction_scores_opened !== false ||
    !Number.isFinite(auditTime) || !Number.isFinite(lockTime) || lockTime <= auditTime) {
    throw new Error("Cohort lock must be frozen after the audit and before predictions are opened.");
  }
  const expected = {
    candidate_policy_sha256: hashes.policy,
    gate_sha256: hashes.gate,
    test_manifest_sha256: hashes.manifest,
    audit_sha256: hashes.audit,
    model_sha256: policy.model?.sha256,
    text_manifest_sha256: policy.artifact_hashes?.text_manifest?.sha256,
    text_vectors_sha256: policy.artifact_hashes?.text_vectors?.sha256,
  };
  if (Object.entries(expected).some(([key, value]) =>
    !/^[a-f0-9]{64}$/.test(value ?? "") || inputs?.[key] !== value)) {
    throw new Error("Cohort lock hashes do not match the frozen candidate and current inputs.");
  }
  if (gate.candidate_policy?.sha256 !== hashes.policy) {
    throw new Error("Gate does not match the exact candidate policy SHA-256.");
  }
  validateClassThresholdPolicy(policy);
  const frozen = gate?.frozen_candidate;
  if (gate?.release_ready !== false || gate?.recognition_enabled !== false ||
    gate?.candidate_policy?.candidate_id !== policy.candidate_id ||
    !isDeepStrictEqual(frozen?.enabled_classes, policy.enabled_classes) ||
    !isDeepStrictEqual(frozen?.manual_only_classes, policy.manual_only_classes) ||
    !isDeepStrictEqual(frozen?.class_thresholds, policy.acceptance.class_thresholds) ||
    frozen?.model_sha256 !== policy.model?.sha256 ||
    frozen?.text_manifest_sha256 !== policy.artifact_hashes?.text_manifest?.sha256 ||
    frozen?.text_vectors_sha256 !== policy.artifact_hashes?.text_vectors?.sha256) {
    throw new Error("Gate does not describe the exact disabled candidate policy.");
  }
}

/** Bind saved predictions to the exact locked q4 run. */
export function validateFrozenEvaluationInputs(report, lock, lockHash, policy) {
  const inputs = lock.inputs;
  if (report?.model !== policy.model.repository ||
    report?.revision !== policy.model.revision ||
    report?.dtype !== policy.model.dtype ||
    report?.model_sha256 !== inputs.model_sha256 ||
    report?.inputs?.manifest_sha256 !== inputs.test_manifest_sha256 ||
    report?.inputs?.audit_sha256 !== inputs.audit_sha256 ||
    report?.inputs?.text_manifest_sha256 !== inputs.text_manifest_sha256 ||
    report?.inputs?.text_vectors_sha256 !== inputs.text_vectors_sha256 ||
    report?.inputs?.cohort_lock_sha256 !== lockHash) {
    throw new Error("Prediction report does not match the locked model, manifest, audit, text artifacts, or lock.");
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("CLI arguments must use --name value pairs.");
    options[key.slice(2)] = value;
  }
  for (const required of ["prediction-report", "audit", "policy", "gate", "cohort-lock", "output"]) {
    if (!options[required]) throw new Error(`Missing --${required}.`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [report, audit, policy, gate, lock] = await Promise.all([
    readJson(options["prediction-report"]),
    readJson(options.audit),
    readJson(options.policy),
    readJson(options.gate),
    readJson(options["cohort-lock"]),
  ]);
  const [policyHash, gateHash, auditHash, lockHash] = await Promise.all([
    sha256(options.policy), sha256(options.gate), sha256(options.audit), sha256(options["cohort-lock"]),
  ]);
  validateCohortLock(lock, audit, policy, gate, {
    policy: policyHash, gate: gateHash, manifest: lock.inputs?.test_manifest_sha256, audit: auditHash,
  });
  validateFrozenEvaluationInputs(report, lock, lockHash, policy);
  const summary = summariseClassThresholdEvaluation(report.rows, audit, policy);
  const decision = evaluateCandidateReleaseGate(summary, gate, policy);
  const output = {
    evaluation: "fixforward-siglip2-class-threshold-candidate-v2-offline-gate",
    release_ready: false,
    candidate_policy_sha256: policyHash,
    cohort_lock_sha256: lockHash,
    inputs: {
      prediction_report_sha256: await sha256(options["prediction-report"]),
      audit_sha256: auditHash,
      gate_sha256: gateHash,
    },
    summary,
    decision,
  };
  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(decision, null, 2));
}

// Importing pure functions in synthetic tests must never read a report or model.
const isCliEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCliEntry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
