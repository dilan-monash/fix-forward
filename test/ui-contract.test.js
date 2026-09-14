// TEST SUITE: Checks source/UI contracts that preserve adult usability and safety wording.
// Each test name describes its expected behavior; fixtures are invented test inputs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const data = await readFile(new URL("../src/data.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const backendInit = await readFile(new URL("../backend/__init__.py", import.meta.url), "utf8");
const backendApi = await readFile(new URL("../backend/api.py", import.meta.url), "utf8");

// v1.6 usability-lab contracts: goal-first journeys, complete short safety checks,
// postcode/suburb autocomplete, repair-hub choice, evidence-led smart cost context,
// strict input validation and controlled recycling after serious warnings.
test("UX01 landing renders immediately while public data loads in the background", () => {
  assert.match(app, /let publicData = getStaticSnapshot\(\)/);
  assert.match(app, /renderLanding\(\);\s*reloadPublicData\(\{ showLoading: false \}\)/s);
  assert.doesNotMatch(app, /renderLoading\(\);\s*if \(!historyReady\)/s);
});

test("UX02 repair, compare, recycle and help-me-decide actions are available in the hero", () => {
  assert.match(app, /hero-quick-actions/);
  assert.match(app, /What do you want to do\?/);
  assert.match(data, /I want to repair it/);
  assert.match(data, /I want to compare costs/);
  assert.match(data, /I want to recycle it/);
  assert.match(data, /I’m not sure/);
  assert.doesNotMatch(app, /Start a 3–5 minute assessment/);
});

test("UX03 recall language teaches the term instead of assuming users know it", () => {
  assert.match(app, /What is a product recall\?/);
  assert.match(app, /Your model may be affected by a product recall/);
  assert.match(app, /This does not prove there is no recall/);
});

test("UX04 recall outage does not block the safety route", () => {
  assert.match(app, /You can still complete the safety questions/);
  assert.match(app, /Open official recall search/);
});

test("UX05 safety questions have on-demand plain-language help and visual cues", () => {
  assert.match(app, /What does this mean\?/);
  assert.match(app, /question-info/);
  assert.match(app, /safety-visual/);
  assert.match(data, /pictogram/);
  assert.match(data, /Do not switch on a wet appliance/);
});

test("UX06 Not sure is a valid answer but does not prematurely end the remaining short check", () => {
  assert.match(app, /I’m still not sure — keep this answer/);
  assert.match(app, /I’m not able to check this safely/);
  assert.match(app, /Not sure is okay\. Keep going with the remaining questions/);
  assert.match(app, /Please answer the remaining/);
  assert.doesNotMatch(app, /I’m still not sure — show a safer next step/);
});

test("UX07 direct goals use a short product-specific safety plan", () => {
  assert.match(app, /safetyPlanFor\(state\.appliance\.category, state\.intent/);
  assert.match(data, /SAFETY_PLAN_LIMITS/);
  assert.match(data, /repair: 4, compare: 3, recycle: 2, guide: 5/);
  assert.match(data, /"Shaver": Object\.freeze\(\["battery", "water", "power"\]\)/);
});

test("UX08 serious warning never routes to a community Repair Cafe", () => {
  assert.match(app, /Stop using this appliance for now/);
  assert.match(app, /safer next step than a community repair event/);
  assert.doesNotMatch(app, /high[\s\S]{0,800}data-action="repair"/);
});

test("UX09 uncertain recycling can continue only as a contact-first cautious pathway", () => {
  assert.match(app, /Find recycling places to contact/);
  assert.match(app, /serviceSafetyMode = "caution"/);
  assert.match(app, /Contact the facility before moving this appliance/);
});

test("UX10 repair history is a stacked outcome visual placed after map and service results", () => {
  assert.match(app, /outcome-chart/);
  assert.match(app, /Fixed at event/);
  assert.match(app, /Repairable with more work/);
  assert.match(app, /Other recorded outcomes/);
  assert.ok(app.indexOf('class="repair-intel-after-map"') > app.indexOf('class="map-and-list"'));
  assert.match(css, /\.outcome-bar/);
});

test("UX11 service cards prioritise practical contact and direction actions", () => {
  assert.match(app, /Call before visiting/);
  assert.match(app, /Directions/);
  assert.match(app, /href="tel:/);
  assert.match(app, /Show on map/);
  assert.match(app, /About this listing/);
});

test("UX12 current location is optional, browser-local and not persisted", () => {
  assert.match(app, /Use my current location/);
  assert.match(app, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(app, /does not save your exact coordinates/i);
  assert.doesNotMatch(html + app, /localStorage|sessionStorage|document\.cookie/i);
  assert.match(backendInit, /geolocation=\(self\)/);
});

test("UX13 map is in-app, lazy-loaded and the list remains usable if map loading fails", () => {
  assert.match(app, /services-map/);
  assert.match(app, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
  assert.match(app, /The map could not load\. The service list still works/);
  assert.match(app, /tile\.openstreetmap\.org/);
});

test("UX14 cost examples describe their limits and avoid promising a personalised estimate", () => {
  assert.match(app, /Start with what you know/);
  assert.match(app, /Automatic database comparison/);
  assert.match(app, /Starting figures found/);
  assert.match(app, /does not label either choice cheaper/);
  assert.match(app, /Repair fees explained/);
  assert.match(app, /What is the appliance doing\?/);
  assert.match(app, /Inspection-fee examples — not your repair quote/);
  assert.match(app, /Recorded retail examples/);
  assert.match(app, /not a market-wide comparison or a recommendation to replace/);
  assert.match(app, /The same examples appear for different appliances/);
  assert.match(app, /Compare these prices/);
});

test("UX15 model-number help includes a visible example label and tells users not to open the appliance", () => {
  assert.match(app, /model-label-demo/);
  assert.match(app, /Model: ABC-123/);
  assert.match(app, /Do not open the appliance or remove screws/);
});

test("UX16 clear Repair goes to a repair hub while Compare and Recycle go to their selected goals", () => {
  assert.match(app, /state\.intent === "repair"[\s\S]*navigate\("repair-hub"\)/);
  assert.match(app, /state\.intent === "recycle"[\s\S]*navigate\("services"\)/);
  assert.match(app, /state\.intent === "compare"[\s\S]*navigate\("cost"\)/);
  assert.match(app, /What would help you most now\?/);
  assert.match(app, /Find a repair option/);
  assert.match(app, /Compare repair and replacement costs/);
  assert.match(app, /blockedBySafety/);
  assert.match(app, /blockedByRecall/);
});

test("UX17 back labels reflect whether the user came directly or through guided options", () => {
  assert.match(app, /state\.intent === "guide" \? "Back to my options" : "Back to quick check"/);
  assert.match(app, /Back to safety guidance/);
});

test("UX18 browser back, restart confirmation, keyboard focus and live results remain", () => {
  assert.match(app, /popstate/);
  assert.match(html, /restart-dialog/);
  assert.match(app, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(css, /:focus-visible/);
});

test("UX19 the appliance journey contains no account, upload or password-collection form", () => {
  assert.doesNotMatch(html + app, /type=["']file["']|type=["']password["']/i);
  assert.doesNotMatch(html + app, /No account needed|Lock website|id="release-label"/);
});

test("UX20 the map does not load third-party map code before a useful search result exists", () => {
  const emptyCheck = app.indexOf('if (result.mode === "empty")');
  const leafletLoad = app.indexOf('const loaded = await ensureLeaflet()');
  assert.ok(emptyCheck >= 0 && leafletLoad > emptyCheck);
  assert.match(app, /Use your location or search a suburb to show places on the map/);
});

test("UX21 changing appliance details invalidates stale dependent results", () => {
  assert.match(app, /state\.safetyResult = null/);
  assert.match(app, /state\.decision = null/);
  assert.match(app, /state\.comparison = null/);
  assert.match(app, /state\.costs = \{ repair: "", replacement: "" \}/);
});

test("UX22 safety help has a programmatic focus target and ordinary-language high-risk guidance", () => {
  assert.match(app, /<h3 tabindex="-1">/);
  assert.match(app, /qualified appliance repairer or electrician/);
  assert.match(app, /SAFETY_HELP\[id\]\?\.question/);
});


test("UX23 unexpected API failures do not deliberately write exception tracebacks to routine logs", () => {
  assert.doesNotMatch(backendApi, /logger\.exception\(/);
  assert.match(backendApi, /logger\.error\(/);
  assert.match(backendApi, /type\(error\)\.__name__/);
});


test("UX24 serious safety guidance offers controlled recycling planning without declaring disposal mandatory", () => {
  assert.match(app, /Need to get rid of it\?/);
  assert.match(app, /Plan recycling \/ disposal/);
  assert.match(app, /do not transport it while it is hot, smoking, leaking or actively damaged/i);
  assert.doesNotMatch(app, /you need to recycle/i);
});

test("UX25 mixed safety answers have distinct high, caution and uncertain outcomes", () => {
  assert.match(app, /safety\.status === "high"/);
  assert.match(app, /safety\.status === "caution"/);
  assert.match(app, /safety\.status === "uncertain"/);
  assert.match(app, /Ask a repairer to check it before using it again/);
  assert.match(app, /Some uncertainty remains/);
});

test("UX26 suburb and postcode search is an accessible autocomplete with keyboard support", () => {
  assert.match(app, /role="combobox"/);
  assert.match(app, /aria-autocomplete="list"/);
  assert.match(app, /role="listbox"/);
  assert.match(app, /Start typing, e\.g\. 312 or Richmond/);
  assert.match(app, /findSuburbSuggestions/);
  assert.match(app, /resolveAreaInput/);
  assert.match(app, /ArrowDown/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /event\.key === "Escape"/);
});

test("UX27 manual suburb selection becomes a nearby search centre with distance filters", () => {
  assert.match(app, /state\.areaSelection/);
  assert.match(app, /getNearbyLocations\(state\.areaSelection/);
  assert.match(app, /Nearest to/);
  assert.match(app, /nearby results, not exact-address tracking/);
});

test("UX28 brand, model, location, problem and cost inputs have explicit length limits", () => {
  assert.match(app, /productField\("brand", "Brand", 60/);
  assert.match(app, /productField\("model", "Model number", 50/);
  assert.match(app, /name="area" maxlength="50"/);
  assert.match(app, /name="problem"[\s\S]*maxlength="300"/);
  assert.match(app, /name="repair"[\s\S]*maxlength="24"/);
  assert.match(app, /name="replacement"[\s\S]*maxlength="24"/);
});

test("UX29 field-level validation focuses the first bad identity, location, problem or cost input", () => {
  assert.match(app, /validateBrand/);
  assert.match(app, /validateModel/);
  assert.match(app, /validateProblem/);
  assert.match(app, /resolveAreaInput/);
  assert.match(app, /firstInvalid\[1\]\?\.focus/);
  assert.match(app, /problemInput\?\.focus/);
  assert.match(app, /input\?\.focus\(\)/);
});

test("UX30 published repair-fee examples remain separate instead of being merged into a fake range", () => {
  assert.match(data, /National Appliance Repairs/);
  assert.match(data, /One Touch Appliance Repairs/);
  assert.match(data, /Workshop drop-off inspection/);
  assert.match(data, /Melbourne mobile call-out/);
  assert.doesNotMatch(app, /\$99\s*[–-]\s*\$229/);
});

test("UX31 repair history sits below the two practical Repair choices", () => {
  const hub = app.indexOf('class="repair-hub-grid"');
  const evidence = app.indexOf('class="repair-hub-evidence"');
  assert.ok(hub >= 0 && evidence > hub);
  assert.match(css, /\.repair-hub-grid/);
});

test("UX32 map loading has a bounded failure timeout and selected suburbs can centre the map", () => {
  assert.match(app, /setTimeout\(\(\) => finish\(false\), 8000\)/);
  assert.match(app, /Selected area:/);
  assert.match(app, /state\.areaSelection\.latitude/);
});
