/* Pure policy tests: these verify boundaries, never claim photo accuracy. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APPLIANCE_REVIEW_LABELS, APPLIANCE_REVIEW_SCORE_LABELS, APPLIANCE_REVIEW_POLICY, reviewApplianceScores } from "../src/appliance-review-policy.js";

function scoresFor(label, similarity = 0.17) {
  const scores = Array(29).fill(-0.1);
  scores[APPLIANCE_REVIEW_LABELS.indexOf(label)] = similarity;
  return scores;
}

test("all 19 catalogue types can be offered for explicit confirmation", () => {
  for (const label of APPLIANCE_REVIEW_LABELS) {
    const result = reviewApplianceScores(scoresFor(label));
    assert.deepEqual(result.choices, [{ label }]);
    assert.equal(result.status, "suggestions");
    assert.equal(result.requiresConfirmation, true);
    assert.equal(result.objectCount, null);
  }
});

test("weak absolute evidence is rejected even when unrelated scores are weaker", () => {
  assert.equal(reviewApplianceScores(scoresFor("toaster", 0.06)).status, "uncertain");
});

test("unrelated content can veto a strongly ranked appliance", () => {
  const scores = scoresFor("blender");
  scores[28] = 0.169;
  assert.deepEqual(reviewApplianceScores(scores).choices, []);
});

test("near-tied appliance types become alternatives without claiming two objects", () => {
  const scores = scoresFor("dehumidifier");
  scores[APPLIANCE_REVIEW_LABELS.indexOf("portable_ac")] = 0.166;
  const result = reviewApplianceScores(scores);
  assert.deepEqual(result.choices, [{ label: "dehumidifier" }, { label: "portable_ac" }]);
  assert.equal(result.reason, "similar_appliance_types");
  assert.equal(result.objectCount, null);
});

test("a clear winner is not padded with unnecessary alternatives", () => {
  const scores = scoresFor("mixer");
  scores[1] = 0.14;
  assert.equal(reviewApplianceScores(scores).choices.length, 1);
});

test("at most three near-tied alternatives are shown and tie order is stable", () => {
  const scores = Array(29).fill(-0.1);
  scores.fill(0.17, 0, 5);
  assert.deepEqual(reviewApplianceScores(scores).choices.map((item) => item.label), APPLIANCE_REVIEW_LABELS.slice(0, 3));
});

test("malformed, nonfinite, out-of-range and legacy 20-row results fail closed", () => {
  for (const scores of [null, {}, Array(20).fill(0.2), Array(29).fill(NaN), Array(29).fill(Infinity), Array(29).fill(1.2)]) {
    assert.equal(reviewApplianceScores(scores).reason, "invalid_scores");
  }
  const labels = [...APPLIANCE_REVIEW_SCORE_LABELS];
  [labels[0], labels[1]] = [labels[1], labels[0]];
  assert.equal(reviewApplianceScores(scoresFor("blender"), labels).reason, "invalid_scores");
});

test("float tensors work and their input buffers are not mutated", () => {
  const scores = new Float32Array(scoresFor("vaccum_cleaner"));
  const before = [...scores];
  assert.equal(reviewApplianceScores(scores).choices[0].label, "vaccum_cleaner");
  assert.deepEqual([...scores], before);
});

test("policy is immutable and an I3 preview cannot assert general release readiness", () => {
  assert.equal(APPLIANCE_REVIEW_POLICY.releaseReady, false);
  assert.equal(APPLIANCE_REVIEW_POLICY.scope, "i3_authorised_experimental_preview");
  assert.ok(Object.isFrozen(APPLIANCE_REVIEW_POLICY));
  assert.ok(Object.isFrozen(APPLIANCE_REVIEW_SCORE_LABELS));
});

test("score ordering matches the actual shipped text manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("../model/appliance-siglip/text-embeddings.json", import.meta.url), "utf8"));
  assert.deepEqual(APPLIANCE_REVIEW_SCORE_LABELS, manifest.labels);
  assert.equal(manifest.class_count, 19);
});

test("module thresholds match the frozen development evidence, including failed checks", () => {
  const evidence = JSON.parse(readFileSync(new URL("../docs/appliance-review-v4-evidence.json", import.meta.url), "utf8"));
  assert.equal(APPLIANCE_REVIEW_POLICY.minSimilarity, evidence.frozen_policy.min_similarity);
  assert.equal(APPLIANCE_REVIEW_POLICY.minOodMargin, evidence.frozen_policy.min_ood_margin);
  assert.equal(APPLIANCE_REVIEW_POLICY.maxChoiceGap, evidence.frozen_policy.max_choice_gap);
  assert.equal(evidence.release_ready, false);
  assert.equal(evidence.comparison.opened_v3_review.positive.wrong_choice_sets.length, 1);
  assert.equal(evidence.comparison.opened_v3_review.ood.offered, 1);
});
