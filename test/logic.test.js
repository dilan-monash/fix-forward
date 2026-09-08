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
  applicableSafetySigns,
  safetyPlanFor,
  validateBrand,
  validateModel,
  validateProblem,
  classifyProblem,
  findSuburbSuggestions,
  resolveAreaInput
} from "../src/logic.js";
import { SAFETY_SIGNS } from "../src/data.js";
import { SUBURB_POSTCODES } from "../src/suburb-index.js";

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

test("S02 caution-only signs get a distinct caution result", () => {
  const result = evaluateSafety({ heat: "yes", power: "no" });
  assert.equal(result.status, "caution");
  assert.deepEqual(result.caution, ["heat"]);
});

test("S03 adaptive questions hide battery for a kettle but keep it for a shaver", () => {
  const kettle = applicableSafetySigns("Kettle", SAFETY_SIGNS).map(([id]) => id);
  const shaver = applicableSafetySigns("Shaver", SAFETY_SIGNS).map(([id]) => id);
  assert.equal(kettle.includes("battery"), false);
  assert.equal(shaver.includes("battery"), true);
});



test("S06 direct repair plan stays short and keeps appliance-relevant questions", () => {
  const plan = safetyPlanFor("Shaver", "repair", SAFETY_SIGNS).map(([id]) => id);
  assert.ok(plan.length <= 4);
  assert.deepEqual(plan.slice(0, 2), ["burning", "electrical"]);
  assert.ok(plan.includes("battery"));
});

test("S07 recycle plan is intentionally shorter and prioritises a damaged battery for a shaver", () => {
  const plan = safetyPlanFor("Shaver", "recycle", SAFETY_SIGNS).map(([id]) => id);
  assert.deepEqual(plan, ["burning", "battery"]);
});

test("S08 compare plan for a kettle asks only three questions and includes water ingress", () => {
  const plan = safetyPlanFor("Kettle", "compare", SAFETY_SIGNS).map(([id]) => id);
  assert.equal(plan.length, 3);
  assert.deepEqual(plan, ["burning", "electrical", "water"]);
});

test("S09 guided plan can ask more than the direct compare plan", () => {
  const guided = safetyPlanFor("Kettle", "guide", SAFETY_SIGNS);
  const compare = safetyPlanFor("Kettle", "compare", SAFETY_SIGNS);
  assert.ok(guided.length > compare.length);
  assert.ok(guided.length <= 5);
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

test("S10 water ingress remains a serious stop-use warning under the I1 safety baseline", () => {
  const result = evaluateSafety({ water: "yes" });
  assert.equal(result.status, "high");
  assert.deepEqual(result.critical, ["water"]);
});


test("S11 a critical Yes wins even when other answers are No or Not sure", () => {
  const result = evaluateSafety({ burning: "yes", electrical: "no", heat: "unsure" });
  assert.equal(result.status, "high");
  assert.deepEqual(result.critical, ["burning"]);
});

test("S12 Not sure remains uncertain after the rest of the quick check is answered", () => {
  const result = evaluateSafety({ burning: "no", electrical: "unsure", water: "no" });
  assert.equal(result.status, "uncertain");
  assert.deepEqual(result.unsure, ["electrical"]);
});

test("S13 caution planning allows cost context but not community repair", () => {
  const decision = journeyDecision("none", "caution");
  assert.equal(decision.allowCost, true);
  assert.equal(decision.allowCommunityRepair, false);
  assert.equal(decision.pathway, "assessment");
});

test("V01 brand validation blocks very long or number-only brands", () => {
  assert.equal(validateBrand("Dyson").valid, true);
  assert.equal(validateBrand("12345").valid, false);
  assert.equal(validateBrand("D".repeat(61)).valid, false);
});

test("V02 model validation allows numeric-only model numbers but caps length", () => {
  assert.equal(validateModel("123456").valid, true);
  assert.equal(validateModel("BVC-160/2").valid, true);
  assert.equal(validateModel("1".repeat(51)).valid, false);
});

test("V03 problem description rejects meaningless or oversized input", () => {
  assert.equal(validateProblem("won't start").valid, true);
  assert.equal(validateProblem("12345").valid, false);
  assert.equal(validateProblem("a".repeat(301)).valid, false);
});

test("V04 problem classifier organises plain language without diagnosing", () => {
  assert.equal(classifyProblem("The battery will not charge anymore").label, "battery / charging");
  assert.equal(classifyProblem("It makes a loud rattling noise").label, "noise / movement");
});

test("L04 postcode prefix suggestions include postcode and suburb labels", () => {
  const suggestions = findSuburbSuggestions("312", SUBURB_POSTCODES, 20);
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.some((item) => String(item.postcode).startsWith("312")));
  assert.ok(suggestions.every((item) => item.label.includes("—")));
});

test("L05 suburb-name autocomplete can resolve an exact suburb", () => {
  const suggestions = findSuburbSuggestions("Rich", SUBURB_POSTCODES, 20);
  assert.ok(suggestions.some((item) => /Richmond/i.test(item.suburb)));
  const richmond = suggestions.find((item) => /^Richmond$/i.test(item.suburb));
  if (richmond) {
    const resolved = resolveAreaInput(richmond.label, SUBURB_POSTCODES);
    assert.equal(resolved.valid, true);
    assert.equal(resolved.suburb, "Richmond");
  }
});

test("L06 a partial postcode must be completed or selected from suggestions", () => {
  const result = resolveAreaInput("312", SUBURB_POSTCODES);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "partial-postcode");
});

test("C02 manual cost validation rejects text, negative and implausibly large values", () => {
  assert.equal(compareCosts("abc", "300").valid, false);
  assert.equal(compareCosts("-20", "300").valid, false);
  assert.equal(compareCosts("100001", "300").valid, false);
});
