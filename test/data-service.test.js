import test from "node:test";
import assert from "node:assert/strict";
import { loadPublicData, getStaticSnapshot } from "../src/data-service.js";

const endpoints = { recalls: "/api/recalls", sources: "/api/sources", repairEvidence: "/api/repair-evidence", locations: "/api/locations" };

function ok(payload) { return { ok: true, status: 200, json: async () => payload }; }

test("API01 datasets load independently", async () => {
  const fetchMock = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/locations") return { ok: false, status: 503, json: async () => ({}) };
    if (path === "/api/recalls") return ok({ meta: { releaseVersion: "r1" }, recalls: [{ id: "r" }] });
    if (path === "/api/sources") return ok({ sources: [{ name: "source" }] });
    return ok({ evidence: [{ categoryCode: "kettle" }] });
  };
  const data = await loadPublicData({ enabled: true, baseUrl: "https://example.test", timeoutMs: 1000, endpoints }, fetchMock);
  assert.equal(data.availability.recalls, true);
  assert.equal(data.availability.repairEvidence, true);
  assert.equal(data.availability.locations, false);
  assert.equal(data.mode, "partial");
});

test("API02 total endpoint failure keeps static safety/UI definitions available", async () => {
  const data = await loadPublicData({ enabled: true, baseUrl: "", timeoutMs: 1000, endpoints }, async () => ({ ok: false, status: 503 }));
  assert.equal(data.families.length, 6);
  assert.equal(data.safetySigns.length > 0, true);
  assert.equal(data.availability.recalls, false);
  assert.equal(data.availability.locations, false);
});

test("API03 disabled API makes no request", async () => {
  let calls = 0;
  const data = await loadPublicData({ enabled: false }, async () => { calls += 1; });
  assert.equal(calls, 0);
  assert.equal(data.mode, "static");
});


test("API04 static snapshot makes the first screen usable before backend data arrives", () => {
  const data = getStaticSnapshot();
  assert.equal(data.families.length, 6);
  assert.ok(data.safetySigns.length > 0);
  assert.equal(data.availability.recalls, false);
});
