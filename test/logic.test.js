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
  locationHasCoordinates,
  parseMoney,
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

test("S14 Not sure keeps planning paths open without recommending community repair", () => {
  for (const recallStatus of ["none", "insufficient", "unavailable"]) {
    const decision = journeyDecision(recallStatus, "uncertain");
    assert.equal(decision.allowCost, true, recallStatus);
    assert.equal(decision.allowRepairExploration, true, recallStatus);
    assert.equal(decision.exploratoryOnly, true, recallStatus);
    assert.equal(decision.allowCommunityRepair, false, recallStatus);
    assert.equal(decision.pathway, "professional", recallStatus);
  }
});

test("S15 a possible recall still takes priority when the safety answers are unsure", () => {
  const decision = journeyDecision("possible", "uncertain");
  assert.equal(decision.allowCost, false);
  assert.equal(decision.allowRepairExploration, false);
  assert.equal(decision.allowCommunityRepair, false);
  assert.equal(decision.pathway, "official-guidance");
});

test("S16 opting out of further checks must not downgrade a warning already reported", () => {
  const result = evaluateSafety({ burning: "yes", "unable-to-check": "unsure" });
  assert.equal(result.status, "high");
  assert.deepEqual(result.unsure, ["unable-to-check"]);
  assert.equal(journeyDecision("none", result.status).allowCost, false);
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

test("V05 problem descriptions can contain ordinary pasted or typed line breaks", () => {
  assert.equal(validateProblem("It turns on.\nThen it stops.\r\nNo unusual smell.").valid, true);
  assert.equal(validateProblem("It makes\ta loud noise.").valid, true);
  assert.equal(validateProblem("It stops\u0000again.").valid, false);
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

test("C03 a free warranty repair quote is a valid comparison", () => {
  const result = compareCosts("0", "320");
  assert.equal(result.valid, true);
  assert.equal(result.lower, "repair");
  assert.equal(result.difference, 320);
  assert.equal(result.repairRatio, 0);
  assert.equal(compareCosts("0", "0").valid, false);
});

test("C04 common Australian price formats can be pasted without retyping", () => {
  for (const amount of ["1,200.50", "$1,200.50", "AUD 1,200.50", "AUD $1,200.50", "A$1,200.50", " 1200.50 "]) {
    assert.deepEqual(parseMoney(amount), { valid: true, amount: 1200.50 }, amount);
  }
  for (const amount of ["1,20", "12,00.50", "1 200", "1e3", "12.345", "$", "NaN", "Infinity", "--20"]) {
    assert.equal(parseMoney(amount).valid, false, amount);
  }
});

test("C05 invalid amounts show useful errors and differences stay in exact cents", () => {
  assert.match(compareCosts("-20", "300").errors.repair, /negative/);
  assert.match(compareCosts("20", "12.345").errors.replacement, /decimal/);
  assert.equal(compareCosts("0.10", "0.30").difference, 0.20);
  assert.equal(compareCosts("120.00", "$120").lower, "equal");
});

test("L07 missing and out-of-range coordinates never become a location at zero", () => {
  const melbourne = { latitude: -37.8136, longitude: 144.9631 };
  for (const location of [
    { latitude: null, longitude: null },
    { latitude: "", longitude: "" },
    { latitude: " ", longitude: " " },
    { latitude: false, longitude: false },
    { latitude: 91, longitude: 140 },
    { latitude: -37, longitude: 181 },
    {}
  ]) {
    assert.equal(locationHasCoordinates(location), false, JSON.stringify(location));
    assert.equal(distanceKm(melbourne, location), null, JSON.stringify(location));
  }
  assert.equal(locationHasCoordinates({ latitude: 0, longitude: 0 }), true);
  assert.equal(locationHasCoordinates({ latitude: "-37.8", longitude: "144.9" }), true);
});

test("L08 nearby results honour zero limits and never count invalid coordinates", () => {
  const user = { latitude: 0, longitude: 0 };
  const data = [
    { id: "missing", pathway: "repair", latitude: null, longitude: null },
    { id: "same", pathway: "repair", latitude: 0, longitude: 0 },
    { id: "near", pathway: "repair", latitude: 0.005, longitude: 0 }
  ];
  const limited = getNearbyLocations(user, "repair", data, { radiusKm: 1, limit: 0 });
  assert.equal(limited.total, 2);
  assert.deepEqual(limited.matches, []);
  const exact = getNearbyLocations(user, "repair", data, { radiusKm: 0 });
  assert.deepEqual(exact.matches.map((item) => item.id), ["same"]);
  assert.equal(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }) > 20000, true);
});
