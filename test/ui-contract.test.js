import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const data = await readFile(new URL("../src/data.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const backendInit = await readFile(new URL("../backend/__init__.py", import.meta.url), "utf8");

// Release 1.4 focuses on goal-first usability while preserving the safety
// controls established in the v1.3 redesign.
test("UX01 immediate loading UI exists before public-data await", () => {
  assert.match(app, /renderLoading\(\);/);
  assert.doesNotMatch(app, /const publicData = await loadPublicData/);
});

test("UX02 landing page starts with user goals instead of a forced assessment", () => {
  assert.match(app, /What would you like to do\?/);
  assert.match(data, /I want to repair it/);
  assert.match(data, /I want to compare costs/);
  assert.match(data, /I want to recycle it/);
  assert.match(data, /I’m not sure/);
  assert.doesNotMatch(app, /Start a 3–5 minute assessment/);
});

test("UX03 recall language explains the idea in plain English", () => {
  assert.match(app, /What is a product recall\?/);
  assert.match(app, /Your model may be affected by a product recall/);
  assert.match(app, /This does not prove there is no recall/);
});

test("UX04 recall outage still allows the static safety check", () => {
  assert.match(app, /You can still complete the safety questions below/);
  assert.match(app, /Quick safety check/);
});

test("UX05 serious warning never routes to a community Repair Cafe", () => {
  assert.match(app, /Stop using this appliance for now/);
  assert.match(app, /safer next step than a community repair event/);
  assert.doesNotMatch(app, /high.*Repair Café.*data-action="repair"/s);
});

test("UX06 current location and in-app map are part of the service experience", () => {
  assert.match(app, /Use my current location/);
  assert.match(app, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(app, /services-map/);
  assert.match(app, /tile\.openstreetmap\.org/);
  assert.match(app, /Nearest first/);
});

test("UX07 location privacy is browser-local and not persistent", () => {
  assert.match(app, /does not save your exact coordinates/i);
  assert.match(app, /Nearby sorting is calculated in your browser/i);
  assert.doesNotMatch(html + app, /localStorage|sessionStorage|document\.cookie/i);
  assert.match(backendInit, /geolocation=\(self\)/);
});

test("UX08 service cards prioritise contact, directions and call-before-visiting", () => {
  assert.match(app, /Call before visiting/);
  assert.match(app, /Directions/);
  assert.match(app, /href="tel:/);
  assert.match(app, /About this listing/);
  assert.match(app, /Show on map/);
  assert.doesNotMatch(app, /class="verification/);
});

test("UX09 smart cost prototype never invents a price", () => {
  assert.match(app, /Automatic prices are not ready in this prototype yet/);
  assert.match(app, /Product-name matching never creates the price/);
  assert.match(app, /instead of guessing/);
});

test("UX10 browser back, restart confirmation and accessible live results remain", () => {
  assert.match(app, /popstate/);
  assert.match(html, /restart-dialog/);
  assert.match(app, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(css, /:focus-visible/);
});

test("UX11 no account, upload, password or saved journey functionality was introduced", () => {
  assert.doesNotMatch(html + app, /type=["']file["']|type=["']password["']/i);
  assert.match(app, /No account needed/);
});

test("UX12 chosen Repair, Compare and Recycle goals route directly after a clear gate", () => {
  assert.match(app, /state\.intent === "repair"[\s\S]*navigate\("services"\)/);
  assert.match(app, /state\.intent === "recycle"[\s\S]*navigate\("services"\)/);
  assert.match(app, /state\.intent === "compare"[\s\S]*navigate\("cost"\)/);
  assert.match(app, /blockedBySafety/);
  assert.match(app, /blockedByRecall/);
});

test("UX13 map dependencies are lazy-loaded, pinned and privacy headers support the map", () => {
  assert.doesNotMatch(html, /unpkg\.com\/leaflet/i);
  assert.match(app, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
  assert.match(app, /sha256-20nQCchB9co0qIjJZRGuk2\/Z9VM\+kNiyxNV1lvTlZBo=/);
  assert.match(app, /https:\/\/tile\.openstreetmap\.org\/{z}\/{x}\/{y}\.png/);
  assert.match(backendInit, /strict-origin-when-cross-origin/);
});
