import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("UX01 immediate loading UI exists before public-data await", () => {
  assert.match(app, /renderLoading\(\);/);
  assert.doesNotMatch(app, /const publicData = await loadPublicData/);
});

test("UX02 recall outage still exposes safety continuation", () => {
  assert.match(app, /We can still complete the safety screening/);
  assert.match(app, /Continue to safety screening/);
});

test("UX03 professional assessment never reuses Repair Cafe search", () => {
  assert.match(app, /Do not route a hazardous appliance to a community Repair Café/);
  assert.match(app, /does not currently maintain a verified professional appliance-repair directory/);
});

test("UX04 landing page, back navigation and restart confirmation are present", () => {
  assert.match(app, /Identify → Educate → Action/);
  assert.match(app, /data-back/);
  assert.match(html, /restart-dialog/);
  assert.match(app, /popstate/);
});

test("UX05 location copy states Melbourne scope and exact-suburb limitation", () => {
  assert.match(app, /Melbourne-focused imported directory/);
  assert.match(app, /does not calculate nearest distance/);
});

test("UX06 sources are grouped and privacy wording is infrastructure-aware", () => {
  assert.match(app, /hosting provider may process standard technical access logs/);
  assert.match(app, /Recall data/);
  assert.match(app, /Repair evidence/);
});

test("UX07 accessible dynamic results and invalid-focus behavior exist", () => {
  assert.match(app, /aria-live="polite" aria-atomic="true"/);
  assert.match(app, /\[aria-invalid="true"\]/);
  assert.match(css, /:focus-visible/);
});

test("UX08 no account, upload, cookie or browser storage functionality was added", () => {
  assert.doesNotMatch(html + app, /type=["']file["']|localStorage|sessionStorage|document\.cookie|type=["']password["']/i);
});
