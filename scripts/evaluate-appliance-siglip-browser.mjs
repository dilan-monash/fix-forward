#!/usr/bin/env node
/*
 * Evaluate the exact quantized SigLIP vision path proposed for a browser.
 *
 * This is an offline research harness. It imports a caller-supplied
 * Transformers.js installation, keeps photos local, applies already-frozen
 * acceptance margins and never changes the website's disabled model policy.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateCohortLock } from "./evaluate-appliance-siglip-candidate-policy.mjs";

const DEFAULT_MODEL = "onnx-community/siglip2-base-patch32-256-ONNX";
const DEFAULT_REVISION = "7efccb86b5b6601bfe9e14326e1c11b40b68d44c";
const DEFAULT_Q4_SHA256 = "9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499";
const SHIPPED_LOCAL_MODEL = "siglip2-base-patch32-256";
const SHIPPED_MODEL_FILE_NAME = `vision_model.${DEFAULT_Q4_SHA256}`;

// This list was frozen before the new held-out evaluation. The evaluator checks
// the policy file against this exact list so test results cannot silently expand
// the classes that the browser would be allowed to suggest.
export const SHIPPED_ENABLED_CLASSES = Object.freeze([
  "air_fryer",
  "blender",
  "coffee_machine",
  "fan",
  "hair_dryer",
  "kettle",
  "microwave",
  "mixer",
  "portable_ac",
  "portable_heater",
  "sandwich_press",
  "toaster",
  "vaccum_cleaner",
]);

const SHIPPED_SUPPORTED_CLASSES = Object.freeze([
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
]);

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flag?.startsWith("--") || argv[index + 1] === undefined) {
      throw new Error(`Expected --name value arguments; found ${flag || "end of input"}.`);
    }
    values[flag.slice(2)] = argv[index + 1];
  }
  const required = [
    "manifest",
    "audited-summary",
    "policy-manifest",
    "text-manifest",
    "transformers-dir",
    "cache-dir",
    "output",
  ];
  for (const name of required) {
    if (!values[name]) throw new Error(`Missing required --${name}.`);
  }
  if (values["cohort-lock"] && (!values["candidate-policy"] || !values["candidate-gate"])) {
    throw new Error("--cohort-lock also requires --candidate-policy and --candidate-gate.");
  }
  return {
    manifest: path.resolve(values.manifest),
    auditedSummary: path.resolve(values["audited-summary"]),
    semanticAudit: values["semantic-audit"] ? path.resolve(values["semantic-audit"]) : null,
    policyManifest: path.resolve(values["policy-manifest"]),
    cohortLock: values["cohort-lock"] ? path.resolve(values["cohort-lock"]) : null,
    candidatePolicy: values["candidate-policy"] ? path.resolve(values["candidate-policy"]) : null,
    candidateGate: values["candidate-gate"] ? path.resolve(values["candidate-gate"]) : null,
    textManifest: path.resolve(values["text-manifest"]),
    transformersDir: path.resolve(values["transformers-dir"]),
    cacheDir: path.resolve(values["cache-dir"]),
    output: path.resolve(values.output),
    repoRoot: path.resolve(values["repo-root"] || "."),
    model: values.model || DEFAULT_MODEL,
    revision: values.revision || DEFAULT_REVISION,
    dtype: values.dtype || "q4",
    expectedModelSha256: (values["expected-model-sha256"] || DEFAULT_Q4_SHA256).toLowerCase(),
    minOodMargin: Number(values["min-ood-margin"] ?? 0.035),
    minPositiveMargin: Number(values["min-positive-margin"] ?? 0.01),
    batchSize: Number(values["batch-size"] ?? 4),
  };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function sha256(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

/** Verify every locked image byte-for-byte before any model code is imported. */
export async function validateLockedSampleFiles(manifest, repoRoot) {
  if (!Array.isArray(manifest?.samples) || manifest.samples.length === 0) {
    throw new Error("Locked manifest must contain a non-empty samples array.");
  }
  const resolvedRoot = await fs.realpath(repoRoot);
  const seenIds = new Set();
  for (const [index, sample] of manifest.samples.entries()) {
    const imageId = sample?.image_id;
    if (typeof imageId !== "string" || !imageId || seenIds.has(imageId)) {
      throw new Error(`Locked manifest sample ${index + 1} needs a unique non-empty image_id.`);
    }
    seenIds.add(imageId);
    const relativePath = sample.downloaded_jpeg;
    if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
      throw new Error(`Locked sample ${imageId} needs a repository-relative image path.`);
    }
    if (!/^[a-f0-9]{64}$/.test(sample.sha256 ?? "")) {
      throw new Error(`Locked sample ${imageId} needs a lowercase SHA-256.`);
    }
    const candidatePath = path.resolve(resolvedRoot, relativePath);
    const lexicalRelative = path.relative(resolvedRoot, candidatePath);
    if (!lexicalRelative || lexicalRelative === ".." ||
        lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
      throw new Error(`Locked sample ${imageId} image path leaves the repository root.`);
    }
    let resolvedImage;
    try {
      resolvedImage = await fs.realpath(candidatePath);
    } catch (error) {
      throw new Error(`Cannot resolve locked sample ${imageId}: ${error.message}`);
    }
    const physicalRelative = path.relative(resolvedRoot, resolvedImage);
    if (!physicalRelative || physicalRelative === ".." ||
        physicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(physicalRelative)) {
      throw new Error(`Locked sample ${imageId} resolves outside the repository root.`);
    }
    const stat = await fs.stat(resolvedImage);
    if (!stat.isFile()) throw new Error(`Locked sample ${imageId} is not a regular file.`);
    if (await sha256(resolvedImage) !== sample.sha256) {
      throw new Error(`Locked sample ${imageId} SHA-256 does not match the manifest.`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} ${JSON.stringify(actual)} does not match ${JSON.stringify(expected)}.`);
  }
}

function assertExactStringList(actual, expected, label) {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error(`${label} must not contain duplicate values.`);
  }
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} does not match the frozen shipped list.`);
  }
}

/**
 * Bind an offline evaluation to the exact policy and text schema shipped by
 * the disabled browser candidate. Feature flags are deliberately allowed to
 * remain false: this function validates evidence inputs, not release approval.
 */
export function validateShippedPolicy({
  policy,
  policySha256,
  textManifest,
  textManifestSha256,
  textVectorsSha256,
  options,
}) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new Error("Policy manifest must contain a JSON object.");
  }
  if (typeof policy.release_ready !== "boolean" || typeof policy.recognition_enabled !== "boolean") {
    throw new Error("Policy release flags must be booleans, even while they remain false for offline evaluation.");
  }
  assertEqual(policy.policy_version, 1, "Policy version");
  assertEqual(policy.model_name, "siglip2-base-patch32-256-vision-q4", "Policy model name");
  assertExactStringList(policy.enabled_classes, SHIPPED_ENABLED_CLASSES, "Policy enabled_classes");

  const vision = policy.vision_model;
  if (!vision || typeof vision !== "object") throw new Error("Policy vision_model is missing.");
  assertEqual(options.model, DEFAULT_MODEL, "CLI model");
  assertEqual(vision.repository, SHIPPED_LOCAL_MODEL, "Policy local model repository");
  assertEqual(options.revision, vision.revision, "CLI model revision");
  assertEqual(vision.revision, DEFAULT_REVISION, "Policy model revision");
  assertEqual(options.dtype, vision.dtype, "CLI model dtype");
  assertEqual(vision.dtype, "q4", "Policy model dtype");
  assertEqual(options.expectedModelSha256, vision.sha256, "CLI model SHA-256");
  assertEqual(vision.sha256, DEFAULT_Q4_SHA256, "Policy model SHA-256");
  assertEqual(vision.model_file_name, SHIPPED_MODEL_FILE_NAME, "Policy model_file_name");
  assertEqual(
    vision.file,
    `onnx/${SHIPPED_MODEL_FILE_NAME}_q4.onnx`,
    "Policy content-addressed model file",
  );

  const acceptance = policy.acceptance;
  if (!acceptance || typeof acceptance !== "object") throw new Error("Policy acceptance thresholds are missing.");
  assertEqual(options.minOodMargin, acceptance.min_ood_margin, "CLI OOD threshold");
  assertEqual(options.minPositiveMargin, acceptance.min_positive_margin, "CLI positive threshold");

  const textPolicy = policy.text_embeddings;
  if (!textPolicy || typeof textPolicy !== "object") throw new Error("Policy text_embeddings is missing.");
  assertEqual(textManifestSha256, textPolicy.manifest_sha256, "Text-manifest SHA-256");
  assertEqual(textVectorsSha256, textPolicy.vectors_sha256, "Text-vector SHA-256");
  assertEqual(textManifest.vectors_sha256, textPolicy.vectors_sha256, "Text manifest vector SHA-256");
  assertEqual(textManifest.model, vision.base_model, "Text model");
  assertEqual(textManifest.requested_revision, vision.base_model_revision, "Requested text-model revision");
  assertEqual(textManifest.resolved_revision, vision.base_model_revision, "Resolved text-model revision");
  assertEqual(textManifest.class_count, SHIPPED_SUPPORTED_CLASSES.length, "Text class count");
  assertExactStringList(
    textManifest.labels?.slice(0, textManifest.class_count),
    SHIPPED_SUPPORTED_CLASSES,
    "Text supported-class labels",
  );

  // Return the hashes used by the report so callers cannot accidentally record
  // a separately computed or stale policy identity.
  return Object.freeze({
    policySha256,
    enabledClasses: [...policy.enabled_classes],
  });
}

function quantizedModelPath(options) {
  const file = options.dtype === "q4" ? "vision_model_q4.onnx" : `vision_model_${options.dtype}.onnx`;
  return path.join(options.cacheDir, ...options.model.split("/"), "onnx", file);
}

function loadEmbeddings(buffer, rows, columns) {
  const expectedBytes = rows * columns * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(`Text-vector byte length ${buffer.byteLength} does not match ${expectedBytes}.`);
  }
  // Copy into an aligned ArrayBuffer because Node Buffers can start at any byte offset.
  const aligned = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Float32Array(aligned);
}

function scoreVector(imageData, imageOffset, vectorSize, textData, textCount) {
  let normSquared = 0;
  for (let index = 0; index < vectorSize; index += 1) {
    const value = imageData[imageOffset + index];
    normSquared += value * value;
  }
  const norm = Math.sqrt(normSquared);
  if (!Number.isFinite(norm) || norm === 0) throw new Error("Vision model returned an invalid vector.");
  const scores = new Float64Array(textCount);
  for (let row = 0; row < textCount; row += 1) {
    let dot = 0;
    const textOffset = row * vectorSize;
    for (let column = 0; column < vectorSize; column += 1) {
      dot += (imageData[imageOffset + column] / norm) * textData[textOffset + column];
    }
    scores[row] = dot;
  }
  return scores;
}

function predictionFor(sample, scores, labels, classCount) {
  const ranked = Array.from(scores, (_, index) => index).sort((left, right) => scores[right] - scores[left]);
  const positives = ranked.filter((index) => index < classCount);
  const ood = ranked.filter((index) => index >= classCount);
  return {
    image_id: sample.image_id,
    kind: sample.kind,
    expected: sample.expected ?? null,
    top_positive: { label: labels[positives[0]], score: scores[positives[0]] },
    top_ood: { label: labels[ood[0]], score: scores[ood[0]] },
    positive_margin: scores[positives[0]] - scores[positives[1]],
    ood_margin: scores[positives[0]] - scores[ood[0]],
  };
}

/**
 * Apply the exact browser acceptance policy. A strong margin is insufficient
 * when the winning appliance is manual-only; the evaluator must not fall back
 * to the next-highest enabled class.
 */
export function acceptsShippedPolicy(row, options, enabledClasses) {
  const allowed = enabledClasses instanceof Set ? enabledClasses : new Set(enabledClasses);
  return row.ood_margin >= options.minOodMargin &&
    row.positive_margin >= options.minPositiveMargin &&
    allowed.has(row.top_positive?.label);
}

function acceptedRow(row, expected) {
  return {
    image_id: row.image_id,
    expected,
    predicted: row.top_positive.label,
    ood_margin: row.ood_margin,
    positive_margin: row.positive_margin,
  };
}

function positiveSummary(rows, expectedById, accepts, { everyAcceptanceIsWrong = false } = {}) {
  const accepted = rows.filter(accepts);
  const top1 = rows.filter((row) => row.top_positive.label === expectedById[row.image_id]);
  const correct = everyAcceptanceIsWrong
    ? []
    : accepted.filter((row) => row.top_positive.label === expectedById[row.image_id]);
  const wrong = everyAcceptanceIsWrong
    ? accepted
    : accepted.filter((row) => row.top_positive.label !== expectedById[row.image_id]);
  const perClass = {};
  for (const row of rows) {
    const label = expectedById[row.image_id];
    perClass[label] ||= { n: 0, top1_correct: 0, accepted: 0, accepted_correct: 0, wrong_accepts: 0 };
    const item = perClass[label];
    const isAccepted = accepts(row);
    const isCorrect = row.top_positive.label === label;
    item.n += 1;
    item.top1_correct += Number(isCorrect);
    item.accepted += Number(isAccepted);
    item.accepted_correct += Number(isAccepted && isCorrect && !everyAcceptanceIsWrong);
    item.wrong_accepts += Number(isAccepted && (everyAcceptanceIsWrong || !isCorrect));
  }
  return {
    n: rows.length,
    top1_correct: top1.length,
    top1_accuracy: rows.length ? top1.length / rows.length : null,
    accepted: accepted.length,
    coverage: rows.length ? accepted.length / rows.length : null,
    accepted_correct: correct.length,
    selective_accuracy: accepted.length ? correct.length / accepted.length : null,
    wrong_accepts: wrong.map((row) => acceptedRow(row, expectedById[row.image_id])),
    per_class: perClass,
  };
}

function oodSummary(rows, accepts, auditBasis, classificationComplete) {
  const accepted = rows.filter(accepts);
  return {
    n: rows.length,
    false_accepts: accepted.length,
    false_accept_rate: rows.length ? accepted.length / rows.length : null,
    audit_basis: auditBasis,
    classification_complete: classificationComplete,
    accepted_rows: accepted.map((row) => acceptedRow(row, null)),
  };
}

/**
 * Summarise synthetic or real predictions without loading a model. Keeping the
 * summariser pure lets policy edge cases be tested before any fresh benchmark
 * is opened or scored.
 */
export function summariseEvaluation(rows, audit, semanticAudit, options, enabledClasses) {
  const positiveIds = audit?.audited_operational_positive_ids;
  if (!positiveIds || typeof positiveIds !== "object" || Array.isArray(positiveIds)) {
    throw new Error("Audit must map audited_operational_positive_ids to expected class labels.");
  }
  const enabled = new Set(enabledClasses);
  const positiveIdSet = new Set(Object.keys(positiveIds));
  const positives = rows.filter((row) => positiveIdSet.has(row.image_id));
  const enabledPositives = positives.filter((row) => enabled.has(positiveIds[row.image_id]));
  const disabledChallenges = positives.filter((row) => !enabled.has(positiveIds[row.image_id]));

  // The reviewed semantic audit is the authoritative way to separate true OOD
  // images from supported-appliance challenge rows. The legacy fallback is kept
  // for old reports, and is marked incomplete so it cannot masquerade as the
  // reviewed true-OOD partition.
  const semanticTrueOod = semanticAudit?.rows
    ?.filter((row) => row.semantic_label === "true_ood")
    .map((row) => row.image_id);
  const explicitTrueOod = Array.isArray(audit.audited_true_ood_ids)
    ? audit.audited_true_ood_ids
    : null;
  const trueOodIds = semanticTrueOod || explicitTrueOod || audit.audited_ood_ids || [];
  const trueOodBasis = semanticTrueOod
    ? "semantic_audit:true_ood"
    : explicitTrueOod
      ? "audited_true_ood_ids"
      : "legacy_audited_ood_ids_unpartitioned";
  const classificationComplete = Boolean(semanticTrueOod || explicitTrueOod);
  const trueOodSet = new Set(trueOodIds);
  // Positive audit membership takes precedence if an older input accidentally
  // puts the same ID in both partitions.
  const trueOod = rows.filter((row) => trueOodSet.has(row.image_id) && !positiveIdSet.has(row.image_id));
  const accepts = (row) => acceptsShippedPolicy(row, options, enabled);

  const allPositiveMetrics = positiveSummary(positives, positiveIds, accepts);
  const enabledMetrics = positiveSummary(enabledPositives, positiveIds, accepts);
  const disabledMetrics = positiveSummary(disabledChallenges, positiveIds, accepts, {
    everyAcceptanceIsWrong: true,
  });
  const trueOodMetrics = oodSummary(trueOod, accepts, trueOodBasis, classificationComplete);
  const aggregateWrongRows = [
    ...enabledMetrics.wrong_accepts.map((row) => ({ cohort: "enabled_class_positive", ...row })),
    ...disabledMetrics.wrong_accepts.map((row) => ({ cohort: "disabled_class_challenge", ...row })),
    ...trueOodMetrics.accepted_rows.map((row) => ({ cohort: "true_ood", ...row })),
  ];

  return {
    thresholds: {
      min_ood_margin: options.minOodMargin,
      min_positive_margin: options.minPositiveMargin,
      enabled_classes: [...enabled],
    },
    // Retain the two original fields for scripts that consume earlier reports.
    audited_operational_positives: allPositiveMetrics,
    audited_ood: trueOodMetrics,
    audited_enabled_class_positives: enabledMetrics,
    audited_disabled_class_challenges: {
      ...disabledMetrics,
      acceptance_rule: "Every accepted output is a wrong acceptance because the expected class is manual-only.",
    },
    audited_true_ood: trueOodMetrics,
    aggregate_wrong_accepts: {
      n: aggregateWrongRows.length,
      rows: aggregateWrongRows,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (![options.minOodMargin, options.minPositiveMargin].every(Number.isFinite) ||
      !Number.isInteger(options.batchSize) || options.batchSize < 1) {
    throw new Error("Thresholds must be finite and batch size must be a positive integer.");
  }
  const [manifest, audit, policy, textManifest, semanticAudit, cohortLock, candidatePolicy, candidateGate] = await Promise.all([
    readJson(options.manifest),
    readJson(options.auditedSummary),
    readJson(options.policyManifest),
    readJson(options.textManifest),
    options.semanticAudit ? readJson(options.semanticAudit) : null,
    options.cohortLock ? readJson(options.cohortLock) : null,
    options.candidatePolicy ? readJson(options.candidatePolicy) : null,
    options.candidateGate ? readJson(options.candidateGate) : null,
  ]);
  const vectorsPath = path.join(path.dirname(options.textManifest), textManifest.vectors_file);
  const [policySha256, textManifestSha256, textVectorsSha256] = await Promise.all([
    sha256(options.policyManifest),
    sha256(options.textManifest),
    sha256(vectorsPath),
  ]);
  if (textVectorsSha256 !== textManifest.vectors_sha256) {
    throw new Error("Text-vector hash does not match its manifest.");
  }
  const validatedPolicy = validateShippedPolicy({
    policy,
    policySha256,
    textManifest,
    textManifestSha256,
    textVectorsSha256,
    options,
  });
  // Bind the entire untouched cohort before importing or running the model.
  let cohortLockSha256 = null;
  if (options.cohortLock) {
    const [manifestHash, auditHash, candidatePolicyHash, candidateGateHash, lockHash] = await Promise.all([
      sha256(options.manifest), sha256(options.auditedSummary), sha256(options.candidatePolicy),
      sha256(options.candidateGate), sha256(options.cohortLock),
    ]);
    validateCohortLock(cohortLock, audit, candidatePolicy, candidateGate, {
      policy: candidatePolicyHash,
      gate: candidateGateHash,
      manifest: manifestHash,
      audit: auditHash,
    });
    assertEqual(options.expectedModelSha256, cohortLock.inputs.model_sha256, "Cohort model SHA-256");
    assertEqual(textManifestSha256, cohortLock.inputs.text_manifest_sha256, "Cohort text-manifest SHA-256");
    assertEqual(textVectorsSha256, cohortLock.inputs.text_vectors_sha256, "Cohort text-vector SHA-256");
    await validateLockedSampleFiles(manifest, options.repoRoot);
    cohortLockSha256 = lockHash;
  }
  const [textRows, vectorSize] = textManifest.shape;
  if (textRows !== textManifest.labels.length || textManifest.class_count < 1 || textManifest.class_count >= textRows) {
    throw new Error("Text-vector manifest has an invalid shape or class boundary.");
  }
  const textData = loadEmbeddings(await fs.readFile(vectorsPath), textRows, vectorSize);
  const modulePath = path.join(options.transformersDir, "dist", "transformers.node.mjs");
  const { AutoProcessor, SiglipVisionModel, RawImage, env } = await import(pathToFileURL(modulePath));
  env.cacheDir = options.cacheDir;
  const processor = await AutoProcessor.from_pretrained(options.model, { revision: options.revision });
  const model = await SiglipVisionModel.from_pretrained(options.model, {
    revision: options.revision,
    dtype: options.dtype,
  });
  const modelPath = quantizedModelPath(options);
  const actualModelSha256 = await sha256(modelPath);
  if (actualModelSha256 !== options.expectedModelSha256) {
    await model.dispose();
    throw new Error(`Quantized model hash ${actualModelSha256} does not match the pinned artifact.`);
  }

  const predictions = [];
  const started = performance.now();
  for (let start = 0; start < manifest.samples.length; start += options.batchSize) {
    const group = manifest.samples.slice(start, start + options.batchSize);
    const images = [];
    for (const sample of group) {
      let image = await RawImage.read(path.resolve(options.repoRoot, sample.downloaded_jpeg));
      if (sample.expanded_crop_pixels) image = await image.crop(sample.expanded_crop_pixels);
      images.push(image);
    }
    const inputs = await processor(images);
    const output = await model(inputs);
    const tensor = output.pooler_output;
    if (tensor.dims.at(-1) !== vectorSize || tensor.dims[0] !== group.length) {
      throw new Error(`Unexpected vision-vector shape: ${JSON.stringify(tensor.dims)}.`);
    }
    for (let index = 0; index < group.length; index += 1) {
      const scores = scoreVector(tensor.data, index * vectorSize, vectorSize, textData, textRows);
      predictions.push(predictionFor(group[index], scores, textManifest.labels, textManifest.class_count));
    }
  }
  const elapsedMs = performance.now() - started;
  const summary = summariseEvaluation(
    predictions,
    audit,
    semanticAudit,
    options,
    validatedPolicy.enabledClasses,
  );
  const report = {
    evaluation: "fixforward-siglip2-quantized-browser-candidate-v1",
    release_ready: false,
    scope: "Node parity harness for the proposed browser weights; not a device/browser release result.",
    model: options.model,
    revision: options.revision,
    dtype: options.dtype,
    model_sha256: actualModelSha256,
    transformers_js_version: "caller-supplied; see transformers_dir in the command record",
    inputs: {
      manifest_sha256: await sha256(options.manifest),
      audit_sha256: await sha256(options.auditedSummary),
      semantic_audit_sha256: options.semanticAudit ? await sha256(options.semanticAudit) : null,
      policy_manifest_sha256: validatedPolicy.policySha256,
      text_manifest_sha256: textManifestSha256,
      text_vectors_sha256: textVectorsSha256,
      ...(cohortLockSha256 ? { cohort_lock_sha256: cohortLockSha256 } : {}),
    },
    timing: { evaluated_images: predictions.length, total_ms: elapsedMs, mean_ms: elapsedMs / predictions.length },
    summary,
    rows: predictions,
  };
  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await model.dispose();
  console.log(JSON.stringify(summary, null, 2));
}

// Importing the module for a synthetic policy test must never start model
// loading. Only execute the expensive harness when this file is the CLI entry.
const isCliEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCliEntry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
