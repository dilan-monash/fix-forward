/* Synthetic policy tests for the offline browser-parity evaluator. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  acceptsShippedPolicy,
  buildPolicySummaries,
  summariseEvaluation,
  validateLockedSampleFiles,
} from "../scripts/evaluate-appliance-siglip-browser.mjs";

const thresholds = { minOodMargin: 0.035, minPositiveMargin: 0.01 };
const enabledClasses = ["fan"];

test("the frozen candidate thresholds determine the primary result, not the legacy runtime policy", () => {
  const rows = [prediction("photo", "fan", { oodMargin: 0.06, positiveMargin: 0.02 })];
  const audit = { audited_operational_positive_ids: { photo: "fan" }, audited_true_ood_ids: [], ood_group_by_id: {} };
  const candidate = { policy_version: 2, release_ready: false, recognition_enabled: false,
    enabled_classes: ["fan"], manual_only_classes: ["kettle"],
    acceptance: { class_thresholds: { fan: { min_ood_margin: 0.05, min_positive_margin: 0.04 } } } };
  const result = buildPolicySummaries(rows, audit, null, thresholds, enabledClasses, candidate);
  assert.equal(result.summary.eligible_operational.accepted, 0);
  assert.equal(result.diagnostic_legacy_policy_summary.audited_enabled_class_positives.accepted, 1);
});

test("an existing evidence file stops the CLI before model or input loading", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "siglip-immutable-evidence-"));
  try {
    const output = path.join(folder, "predictions.json");
    const original = '{"frozen":"earlier result"}\n';
    await fs.writeFile(output, original);
    const args = [fileURLToPath(new URL("../scripts/evaluate-appliance-siglip-browser.mjs", import.meta.url))];
    for (const flag of ["manifest", "audited-summary", "policy-manifest", "text-manifest", "transformers-dir", "cache-dir"]) {
      args.push(`--${flag}`, path.join(folder, "intentionally-missing"));
    }
    args.push("--output", output);
    const run = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 10000 });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Evidence already exists/);
    assert.equal(await fs.readFile(output, "utf8"), original);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

function prediction(imageId, predicted, { oodMargin = 0.2, positiveMargin = 0.1 } = {}) {
  return {
    image_id: imageId,
    top_positive: { label: predicted, score: 0.8 },
    top_ood: { label: "other_object", score: 0.6 },
    ood_margin: oodMargin,
    positive_margin: positiveMargin,
  };
}

test("disabled winners are rejected and disabled images accepted as enabled count wrong", () => {
  const disabledWinner = prediction("disabled-correct", "shaver");
  const disabledMispredictedAsEnabled = prediction("disabled-wrong", "fan");
  const enabledCorrect = prediction("enabled-correct", "fan");
  const trueOodAccepted = prediction("true-ood", "fan");

  // A high-margin manual-only winner remains rejected; the policy must never
  // skip it and silently choose a lower-ranked enabled appliance.
  assert.equal(
    acceptsShippedPolicy(disabledWinner, thresholds, enabledClasses),
    false,
  );
  assert.equal(
    acceptsShippedPolicy(disabledMispredictedAsEnabled, thresholds, enabledClasses),
    true,
  );

  const summary = summariseEvaluation(
    [disabledWinner, disabledMispredictedAsEnabled, enabledCorrect, trueOodAccepted],
    {
      audited_operational_positive_ids: {
        "disabled-correct": "shaver",
        "disabled-wrong": "shaver",
        "enabled-correct": "fan",
      },
      audited_ood_ids: ["true-ood"],
    },
    { rows: [{ image_id: "true-ood", semantic_label: "true_ood" }] },
    thresholds,
    enabledClasses,
  );

  assert.equal(summary.audited_enabled_class_positives.n, 1);
  assert.equal(summary.audited_enabled_class_positives.accepted_correct, 1);
  assert.equal(summary.audited_disabled_class_challenges.n, 2);
  assert.equal(summary.audited_disabled_class_challenges.accepted, 1);
  assert.deepEqual(
    summary.audited_disabled_class_challenges.wrong_accepts.map((row) => ({
      image_id: row.image_id,
      expected: row.expected,
      predicted: row.predicted,
    })),
    [{ image_id: "disabled-wrong", expected: "shaver", predicted: "fan" }],
  );
  assert.equal(summary.audited_true_ood.false_accepts, 1);
  assert.equal(summary.aggregate_wrong_accepts.n, 2);
  assert.deepEqual(
    summary.aggregate_wrong_accepts.rows.map((row) => row.cohort),
    ["disabled_class_challenge", "true_ood"],
  );
});

test("locked sample bytes are verified before evaluation", async (context) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fixforward-locked-samples-"));
  context.after(() => fs.rm(repoRoot, { recursive: true, force: true }));
  const imagePath = path.join(repoRoot, "fixtures", "sample.jpg");
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  const original = Buffer.from("synthetic locked image bytes");
  await fs.writeFile(imagePath, original);
  const manifest = {
    samples: [{
      image_id: "synthetic:sample",
      downloaded_jpeg: "fixtures/sample.jpg",
      sha256: crypto.createHash("sha256").update(original).digest("hex"),
    }],
  };

  await assert.doesNotReject(validateLockedSampleFiles(manifest, repoRoot));
  await fs.writeFile(imagePath, Buffer.from("tampered image bytes"));
  await assert.rejects(
    validateLockedSampleFiles(manifest, repoRoot),
    /SHA-256 does not match the manifest/,
  );
});
