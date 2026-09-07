import test from "node:test";
import assert from "node:assert/strict";
import {
  matchRecall,
  evaluateSafety,
  journeyDecision,
  compareCosts,
  getLocations,
  getNearbyLocations,
  distanceKm,
  applicableSafetySigns
} from "../src/logic.js";
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

test("R04 one-character model difference is never promoted to an exact recall match", () => {
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

test("S02 caution-only signs do not become the same as immediate danger", () => {
  const result = evaluateSafety({ heat: "yes", power: "no" });
  assert.equal(result.status, "uncertain");
  assert.deepEqual(result.caution, ["heat"]);
});

test("S03 adaptive questions hide battery for a kettle but keep it for a shaver", () => {
  const kettle = applicableSafetySigns("Kettle", SAFETY_SIGNS).map(([id]) => id);
  const shaver = applicableSafetySigns("Shaver", SAFETY_SIGNS).map(([id]) => id);
  assert.equal(kettle.includes("battery"), false);
  assert.equal(shaver.includes("battery"), true);
});

test("S04 recall outage does not block ordinary options after a clear warning check", () => {
  const decision = journeyDecision("unavailable", "clear");
  assert.equal(decision.allowNextSteps, true);
  assert.equal(decision.allowCommunityRepair, true);
});

test("S05 high risk blocks cost and community repair", () => {
  const decision = journeyDecision("none", "high");
  assert.equal(decision.allowCost, false);
  assert.equal(decision.allowCommunityRepair, false);
});

test("C01 manual comparison accepts only valid positive values", () => {
  assert.equal(compareCosts("180", "320").lower, "repair");
  assert.equal(compareCosts("", "320").valid, false);
  assert.equal(compareCosts("free", "320").valid, false);
});

test("L01 manual area search reports total separately from displayed matches", () => {
  const data = Array.from({ length: 14 }, (_, i) => ({ pathway: "repair", suburb: "Ascot Vale", postcode: "3032", name: `Cafe ${i}` }));
  const result = getLocations("3032", "repair", data, 12);
  assert.equal(result.total, 14);
  assert.equal(result.matches.length, 12);
});

test("L02 distance calculation is approximately correct for Melbourne coordinates", () => {
  const distance = distanceKm(
    { latitude: -37.8136, longitude: 144.9631 },
    { latitude: -37.8183, longitude: 144.9671 }
  );
  assert.ok(distance > 0.5 && distance < 1.0);
});

test("L03 nearby search sorts by distance and respects radius/provider filter", () => {
  const user = { latitude: -37.80, longitude: 144.95 };
  const data = [
    { id: "far", pathway: "repair", providerType: "repair_cafe", latitude: -37.90, longitude: 144.95 },
    { id: "near", pathway: "repair", providerType: "repair_cafe", latitude: -37.805, longitude: 144.95 },
    { id: "shop", pathway: "repair", providerType: "electronics_repair", latitude: -37.806, longitude: 144.95 }
  ];
  const result = getNearbyLocations(user, "repair", data, { radiusKm: 5, providerType: "repair_cafe" });
  assert.equal(result.total, 1);
  assert.equal(result.matches[0].id, "near");
});
