/* Synthetic policy tests for the offline browser-parity evaluator. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acceptsShippedPolicy,
  summariseEvaluation,
  validateLockedSampleFiles,
} from "../scripts/evaluate-appliance-siglip-browser.mjs";

const thresholds = { minOodMargin: 0.035, minPositiveMargin: 0.01 };
const enabledClasses = ["fan"];

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
