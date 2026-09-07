import test from "node:test";
import assert from "node:assert/strict";
import { matchRecall, evaluateSafety, journeyDecision, compareCosts, getLocations, applicableSafetySigns } from "../src/logic.js";
import { SAFETY_SIGNS } from "../src/data.js";

const recall = [{
  id: "1", categoryCodes: ["vacuum-cleaner"], brand: "Mistral", title: "Vacuum recall",
  identifiers: [{ type: "model", value: "BVC 160", normalizedValue: "BVC160" }],
  noticeUrl: "https://www.productsafety.gov.au/recalls/example"
}];

test("R01 category-only never gives recall clearance", () => {
  assert.equal(matchRecall({ categoryCode: "vacuum-cleaner", brand: "", model: "" }, recall, true).status, "insufficient");
});

test("R02 exact model is matched even when punctuation differs", () => {
  assert.equal(matchRecall({ categoryCode: "vacuum-cleaner", brand: "Mistral", model: "bvc-160" }, recall, true).status, "possible");
});

test("R03 exact model remains visible when brand differs, but conflict is flagged", () => {
  const result = matchRecall({ categoryCode: "vacuum-cleaner", brand: "Mistral Australia", model: "BVC160" }, recall, true);
  assert.equal(result.status, "possible");
  assert.equal(result.brandConflict, true);
});

test("R04 one-character model difference is not promoted to an exact recall match", () => {
  const result = matchRecall({ categoryCode: "vacuum-cleaner", brand: "Mistral", model: "BVC161" }, recall, true);
  assert.equal(result.status, "none");
  assert.ok(Array.isArray(result.near));
});

test("R05 recall outage remains explicit", () => {
  assert.equal(matchRecall({ categoryCode: "vacuum-cleaner", model: "BVC160" }, recall, false).status, "unavailable");
});

test("S01 critical signs create a high-risk result", () => {
  const result = evaluateSafety({ burning: "yes", heat: "yes" });
  assert.equal(result.status, "high");
  assert.deepEqual(result.critical, ["burning"]);
});

test("S02 caution-only signs do not become the same as immediate critical danger", () => {
  const result = evaluateSafety({ heat: "yes", trips: "no" });
  assert.equal(result.status, "uncertain");
  assert.deepEqual(result.caution, ["heat"]);
});

test("S03 battery question is hidden for a kettle but retained for a shaver", () => {
  const kettle = applicableSafetySigns("Kettle", SAFETY_SIGNS).map(([id]) => id);
  const shaver = applicableSafetySigns("Shaver", SAFETY_SIGNS).map(([id]) => id);
  assert.equal(kettle.includes("battery"), false);
  assert.equal(shaver.includes("battery"), true);
});

test("S04 recall outage no longer prevents the static safety journey", () => {
  const decision = journeyDecision("unavailable", "clear");
  assert.equal(decision.allowNextSteps, true);
  assert.equal(decision.kind, "recall-unavailable");
});

test("S05 high risk blocks cost comparison", () => {
  assert.equal(journeyDecision("none", "high").allowCost, false);
});

test("C01 cost comparison uses only valid positive values", () => {
  assert.equal(compareCosts("180", "320").lower, "repair");
  assert.equal(compareCosts("", "320").valid, false);
  assert.equal(compareCosts("free", "320").valid, false);
});

test("L01 location result reports total separately from displayed matches", () => {
  const data = Array.from({ length: 10 }, (_, i) => ({ pathway: "repair", suburb: "Ascot Vale", postcode: "3032", name: `Cafe ${i}` }));
  const result = getLocations("3032", "repair", data, 8);
  assert.equal(result.total, 10);
  assert.equal(result.matches.length, 8);
});
