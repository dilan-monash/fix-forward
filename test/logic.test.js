import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FAMILIES, RECALLS, SAFETY_SIGNS, SAFETY_GROUPS, LOCATIONS } from "../src/data.js";
import { validateAppliance, matchRecall, evaluateSafety, journeyDecision, parseMoney, compareCosts, getLocations } from "../src/logic.js";

const validAppliance = { family: "heating-simple-cooking", category: "Kettle" };
const allNo = Object.fromEntries(SAFETY_SIGNS.map(([id]) => [id, "no"]));

test("AC01 exactly six approved families are exposed", () => assert.equal(FAMILIES.length, 6));
test("AC02 family and category are required", () => assert.deepEqual(Object.keys(validateAppliance({}, FAMILIES)).sort(), ["category", "family"]));
test("AC03 family and category alone are valid", () => assert.deepEqual(validateAppliance(validAppliance, FAMILIES), {}));
test("AC04 unsupported category is rejected", () => assert.match(validateAppliance({ family: "heating-simple-cooking", category: "Portable heater" }, FAMILIES).category, /chosen family/));

test("AC04a appliance scope matches the approved six-family mapping", () => {
  assert.deepEqual(FAMILIES.map(({ name }) => name), [
    "Heating and simple cooking",
    "Motorised kitchen",
    "Complex kitchen",
    "Cleaning",
    "Personal care",
    "Air treatment"
  ]);
  assert.deepEqual(FAMILIES.find(({ id }) => id === "heating-simple-cooking").categories, ["Kettle", "Toaster", "Sandwich press", "Rice cooker"]);
  assert.deepEqual(FAMILIES.find(({ id }) => id === "air-treatment").categories, ["Fan", "Portable heater", "Dehumidifier", "Portable air conditioner"]);
});
test("AC05 real ACCC fixture produces a possible match", () => { const result = matchRecall(validAppliance, RECALLS); assert.equal(result.status, "possible"); assert.equal(result.match.published, "21 February 2018"); assert.match(result.match.noticeUrl, /productsafety\.gov\.au/); });
test("AC06 recall screening matches by family and category only", () => assert.equal(matchRecall(validAppliance, RECALLS).status, "possible"));
test("AC07 a category with no indexed recall does not become a false positive", () => assert.equal(matchRecall({ family: "motorised-kitchen", category: "Blender" }, RECALLS).status, "none"));
test("AC08 category-level possible recall is clearly limited", () => { const result = matchRecall(validAppliance, RECALLS); assert.equal(result.status, "possible"); assert.equal(result.limited, true); });
test("AC09 recall data failure produces unavailable status", () => assert.equal(matchRecall(validAppliance, RECALLS, false).status, "unavailable"));

test("AC10 burning smell is high risk", () => assert.equal(evaluateSafety({ ...allNo, burning: "yes" }).status, "high"));
test("AC11 shock is high risk", () => assert.equal(evaluateSafety({ ...allNo, shock: "yes" }).status, "high"));
test("AC12 exposed wiring is high risk", () => assert.equal(evaluateSafety({ ...allNo, wiring: "yes" }).status, "high"));
test("AC13 battery damage is high risk", () => assert.equal(evaluateSafety({ ...allNo, battery: "yes" }).status, "high"));
test("AC14 Not sure produces uncertain", () => assert.equal(evaluateSafety({ ...allNo, plug: "unsure" }).status, "uncertain"));
test("AC15 Yes takes precedence over Not sure", () => assert.equal(evaluateSafety({ ...allNo, plug: "unsure", sparks: "yes" }).status, "high"));
test("AC16 all No produces clear screening status", () => assert.equal(evaluateSafety(allNo).status, "clear"));

test("AC17 recall plus high risk is combined and ends with official guidance", () => assert.deepEqual(journeyDecision("possible", "high"), { allowCost: false, allowNextSteps: false, kind: "recall-high", pathway: "official-guidance" }));
test("AC18 recall plus no warning ends with official guidance", () => assert.deepEqual(journeyDecision("possible", "clear"), { allowCost: false, allowNextSteps: false, kind: "recall", pathway: "official-guidance" }));
test("AC19 no recall plus high risk blocks cost", () => assert.equal(journeyDecision("none", "high").allowCost, false));
test("AC20 no recall plus Not sure blocks cost", () => assert.equal(journeyDecision("none", "uncertain").allowCost, false));
test("AC21 no recall plus all No opens pathways before cost", () => { const result = journeyDecision("none", "clear"); assert.equal(result.allowNextSteps, true); assert.equal(result.pathway, "pathway"); });
test("AC22 unavailable recall data blocks cost", () => assert.equal(journeyDecision("unavailable", "clear").allowCost, false));

test("AC23 missing repair cost is identified", () => assert.equal(compareCosts("", "200").errors.repair.includes("quote is required"), true));
test("AC24 missing replacement cost is identified", () => assert.equal(compareCosts("100", "").errors.replacement.includes("estimated replacement"), true));
test("AC25 negative cost is rejected", () => assert.equal(parseMoney("-2").valid, false));
test("AC26 non-numeric cost is rejected", () => assert.equal(parseMoney("free").valid, false));
test("AC27 zero cost is rejected by agreed rule", () => assert.equal(parseMoney("0").reason, "zero"));
test("AC28 more than two decimals is rejected", () => assert.equal(parseMoney("12.345").valid, false));
test("AC29 repair-lower calculation is correct", () => assert.deepEqual(compareCosts("180", "320"), { valid: true, repair: 180, replacement: 320, difference: 140, lower: "repair" }));
test("AC30 replacement-lower calculation is correct", () => assert.equal(compareCosts("500", "320").lower, "replacement"));
test("AC31 equal costs are handled", () => assert.deepEqual(compareCosts("250", "250"), { valid: true, repair: 250, replacement: 250, difference: 0, lower: "equal" }));

test("AC32 local repair search carries contact-before-travel wording", () => assert.match(getLocations("Brunswick", "repair", LOCATIONS)[0].contact, /before travelling/i));
test("AC33 local disposal search carries acceptance wording", () => assert.match(getLocations("Footscray", "dispose", LOCATIONS)[0].contact, /accepts your appliance/i));
test("AC34 no-data area returns no invented providers", () => assert.deepEqual(getLocations("Other", "repair", LOCATIONS), []));

test("AC35 no prohibited feature controls or persistence APIs appear", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8"); const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /type=["']file["']|barcode|log[ -]?in|sign[ -]?in/i);
  assert.doesNotMatch(app, /name=["'](?:brand|model)["']/i);
  assert.doesNotMatch(app, /localStorage\.|sessionStorage\.|document\.cookie|fetch\(/);
});
test("AC36 required privacy and limitation wording is present", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /does not confirm that the appliance is safe/i); assert.match(app, /not sent to the server/i); assert.match(app, /never requested/i); assert.match(app, /confirm appliance acceptance/i);
});
test("AC37 all warning topics required by register are represented", () => {
  const labels = SAFETY_SIGNS.map(([, label]) => label).join(" ").toLowerCase();
  for (const word of ["burning", "smoke", "fire", "sparks", "overheating", "shock", "wiring", "melted", "water", "battery", "circuit", "buzzing"]) assert.match(labels, new RegExp(word));
});

test("AC38 improved questionnaire keeps all ten signs in three non-overlapping groups", async () => {
  assert.equal(SAFETY_GROUPS.length, 3);
  assert.deepEqual(SAFETY_GROUPS.flatMap(({ signIds }) => signIds).sort(), SAFETY_SIGNS.map(([id]) => id).sort());
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /None of these signs/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /View guidance now/);
});

test("AC43 UI follows V2.2 recall, safety, pathway, quote and cost order", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf('data-phase="pathway"') < html.indexOf('data-phase="cost"'));
  assert.match(source, /id="to-pathways">Choose next action/);
  assert.match(source, /function renderQuoteCheck/);
  assert.match(source, /id="has-quote"/);
  assert.match(source, /id="needs-quote"/);
});
test("AC44 keyboard focus, labels and native controls are defined", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8"); const css = await readFile(new URL("../styles.css", import.meta.url), "utf8"); const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(html, /skip-link/); assert.match(css, /:focus-visible/); assert.match(source, /<fieldset class=\"question\"><legend>/); assert.doesNotMatch(source, /<div[^>]+onclick=/i);
});
test("AC45 responsive mobile rules cover all multi-column controls", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 760px\)/); assert.match(css, /\.hero, \.family-grid, \.form-grid, \.compare-grid, \.path-grid \{ grid-template-columns: 1fr; \}/); assert.match(css, /question \{ grid-template-columns: 1fr/);
});
test("AC46 result views expose sources, version and retrieval date", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /Data retrieved \$\{META\.retrievalDate\}/); assert.match(source, /sourceLine\("User-entered estimates/); assert.match(source, /sourceLine\(state\.pathway/);
});
test("AC47 frontend source has no backend request, debug mode or secret", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|debug\s*[:=]\s*true|secret(_key)?\s*[:=]/i);
});
test("AC48 scope excludes diagnosis, DIY, account, climate, upload and barcode UI", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8"); const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(html + source, /type=["']file["']|barcode scanner|create account|climate comparison|repair instructions/i);
  assert.match(source, /Does not diagnose faults or provide DIY instructions/);
});

test("AC49 no authentication or user profile can be created or stored", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const markup = html + source;
  assert.doesNotMatch(markup, /type=["']password["']|autocomplete=["'](?:email|username|current-password|new-password)["']/i);
  assert.doesNotMatch(markup, /name=["'](?:email|username|password|profile|user_id)["']/i);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon|indexedDB\.|localStorage\.|sessionStorage\.|document\.cookie/i);
  assert.doesNotMatch(source, /\/auth\/|\/login|\/register|\/profile/i);
  assert.match(source, /does not require login and does not create or store a user profile/i);
});
