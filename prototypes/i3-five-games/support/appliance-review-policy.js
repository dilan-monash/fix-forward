/*
 * Frozen Iteration 3 policy for confirmation-first photo suggestions.
 * This pure module neither runs a model nor enables a deployed feature. Its
 * thresholds were fitted using audited DEVELOPMENT data, not a fresh test.
 * It returns alternative labels for ONE region, never a detected object count.
 */

export const APPLIANCE_REVIEW_LABELS = Object.freeze([
  "air_fryer", "blender", "coffee_machine", "dehumidifier", "fan",
  "food_processor", "hair_dryer", "kettle", "microwave", "mixer",
  "portable_ac", "portable_heater", "rice_cooker", "sandwich_press",
  "shaver", "steam_cleaner", "straightener", "toaster", "vaccum_cleaner",
]);

// The first 19 rows are appliance classes; the last 10 compete as unrelated
// content. This is the existing 29-row text-embedding order, NOT the discarded
// supervised experiment's 20-class output (19 appliances plus one unknown).
export const APPLIANCE_REVIEW_SCORE_LABELS = Object.freeze([
  ...APPLIANCE_REVIEW_LABELS,
  "other_kitchen_appliance", "built_in_oven", "refrigerator",
  "washing_machine", "screen_device", "person_or_pet", "furniture",
  "vehicle", "nature", "other_object",
]);

export const APPLIANCE_REVIEW_POLICY = Object.freeze({
  policyId: "fixforward-siglip2-confirmation-review-development-v4",
  releaseReady: false,
  scope: "i3_authorised_experimental_preview",
  requiresConfirmation: true,
  modelSha256: "9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499",
  minSimilarity: 0.1076883765432923,
  minOodMargin: 0.017378100156106337,
  maxChoiceGap: 0.006854580313702425,
  maxChoices: 3,
});

function uncertain(reason) {
  // A failed score gate means insufficient evidence, not a safety judgement or
  // proof that the photo contains no appliance. The UI should offer another
  // photo and manual selection without exposing raw scores as percentages.
  return { status: "uncertain", reason, choices: [], requiresConfirmation: true,
    objectCount: null, policyId: APPLIANCE_REVIEW_POLICY.policyId };
}

export function reviewApplianceScores(scores, scoreLabels = APPLIANCE_REVIEW_SCORE_LABELS) {
  // Fail closed on the wrong tensor shape or class mapping. Treating a 20-row
  // supervised head as this 29-row cosine tensor silently mislabels appliances.
  if ((!Array.isArray(scores) && !ArrayBuffer.isView(scores)) ||
      scores.length !== APPLIANCE_REVIEW_SCORE_LABELS.length ||
      !Array.isArray(scoreLabels) || scoreLabels.length !== scores.length ||
      scoreLabels.some((label, index) => label !== APPLIANCE_REVIEW_SCORE_LABELS[index]) ||
      Array.from(scores).some((score) => !Number.isFinite(score) || score < -1 || score > 1)) {
    return uncertain("invalid_scores");
  }
  const ranked = APPLIANCE_REVIEW_LABELS.map((label, index) => ({ label, score: scores[index], index }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const best = ranked[0];
  const bestOod = Math.max(...Array.from(scores).slice(APPLIANCE_REVIEW_LABELS.length));
  if (best.score < APPLIANCE_REVIEW_POLICY.minSimilarity ||
      best.score - bestOod < APPLIANCE_REVIEW_POLICY.minOodMargin) {
    return uncertain("not_enough_appliance_evidence");
  }
  // Show alternatives only when their similarities are close to the winner.
  // This calibrated gap is not a probability and is never an object counter.
  const choices = ranked.slice(0, APPLIANCE_REVIEW_POLICY.maxChoices)
    .filter((item) => best.score - item.score <= APPLIANCE_REVIEW_POLICY.maxChoiceGap)
    .map(({ label }) => ({ label }));
  return {
    status: "suggestions", reason: choices.length > 1 ? "similar_appliance_types" : "one_possible_type",
    choices, requiresConfirmation: true, objectCount: null,
    policyId: APPLIANCE_REVIEW_POLICY.policyId,
  };
}
