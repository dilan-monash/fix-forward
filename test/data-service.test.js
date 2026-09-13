import test from "node:test";
import assert from "node:assert/strict";
import { loadPublicData, getStaticSnapshot } from "../src/data-service.js";
import { matchRecall } from "../src/logic.js";

const endpoints = { recalls: "/api/recalls", sources: "/api/sources", repairEvidence: "/api/repair-evidence", locations: "/api/locations" };

function ok(payload) { return { ok: true, status: 200, json: async () => payload }; }

const validRecall = { id: "r", categoryCodes: ["kettle"], identifiers: [{ type: "model", value: "K100" }] };
const validEvidence = { categoryCode: "kettle", sampleSize: 10, fixedCount: 5, repairableCount: 2, endOfLifeCount: 2, unclassifiedCount: 1 };
const validLocation = { id: "l", name: "Example repairer", pathway: "repair", latitude: -37.8, longitude: 144.9 };
const payloads = {
  "/api/recalls": { recalls: [validRecall] },
  "/api/sources": { sources: [{ name: "Example source" }] },
  "/api/repair-evidence": { evidence: [validEvidence] },
  "/api/locations": { locations: [validLocation] }
};
const config = { enabled: true, baseUrl: "https://example.test", timeoutMs: 1000, endpoints };

test("API01 datasets load independently", async () => {
  const fetchMock = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/locations") return { ok: false, status: 503, json: async () => ({}) };
    if (path === "/api/recalls") return ok({ meta: { releaseVersion: "r1" }, recalls: [validRecall] });
    if (path === "/api/sources") return ok({ sources: [{ name: "source" }] });
    return ok({ evidence: [validEvidence] });
  };
  const data = await loadPublicData({ enabled: true, baseUrl: "https://example.test", timeoutMs: 1000, endpoints }, fetchMock);
  assert.equal(data.availability.recalls, true);
  assert.equal(data.availability.repairEvidence, true);
  assert.equal(data.availability.locations, false);
  assert.equal(data.availability.sources, true);
  assert.equal(data.apiAvailability.sources, true);
  assert.equal(data.mode, "partial");
});

test("API02 total endpoint failure keeps static safety/UI definitions available", async () => {
  const data = await loadPublicData({ enabled: true, baseUrl: "", timeoutMs: 1000, endpoints }, async () => ({ ok: false, status: 503 }));
  assert.equal(data.families.length, 6);
  assert.equal(data.safetySigns.length > 0, true);
  assert.equal(data.availability.recalls, false);
  assert.equal(data.availability.locations, false);
  assert.equal(data.availability.sources, true);
  assert.equal(data.apiAvailability.sources, false);
  assert.equal(data.sources.length > 0, true);
  assert.equal(data.mode, "fallback");
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

test("API05 malformed rows fail only their dataset and cannot produce recall reassurance", async () => {
  for (const malformed of [
    null,
    "not a record",
    {},
    { id: "r", categoryCodes: "kettle", identifiers: [] },
    { ...validRecall, identifiers: [null] },
    { ...validRecall, identifiers: [{ type: "model", value: "K100", normalizedValue: {} }] }
  ]) {
    const data = await loadPublicData(config, async (url) => {
      const path = new URL(url).pathname;
      return ok(path === "/api/recalls" ? { recalls: [validRecall, malformed] } : payloads[path]);
    });
    assert.equal(data.availability.recalls, false, JSON.stringify(malformed));
    assert.equal(data.apiAvailability.locations, true);
    assert.equal(data.mode, "partial");
    assert.deepEqual(data.recalls, []);
    assert.equal(matchRecall({ categoryCode: "kettle", model: "K100" }, data.recalls, data.availability.recalls).status, "unavailable");
  }
});

test("API06 invalid source/location rows and impossible evidence counts remain unavailable", async () => {
  const data = await loadPublicData(config, async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/sources") return ok({ sources: [null] });
    if (path === "/api/locations") return ok({ locations: [{ ...validLocation, pathway: "unknown" }] });
    if (path === "/api/repair-evidence") return ok({ evidence: [{ ...validEvidence, fixedCount: 500 }] });
    return ok(payloads[path]);
  });
  assert.equal(data.apiAvailability.recalls, true);
  assert.equal(data.apiAvailability.sources, false);
  assert.equal(data.apiAvailability.locations, false);
  assert.equal(data.apiAvailability.repairEvidence, false);
  assert.equal(data.sources.length > 0, true);
  assert.deepEqual(data.locations, []);
  assert.deepEqual(data.repairEvidence, []);
});

test("API07 a stalled endpoint times out without losing successful independent datasets", async () => {
  let requestSignal;
  const data = await loadPublicData({ ...config, timeoutMs: 15 }, async (url, options) => {
    requestSignal = options.signal;
    const path = new URL(url).pathname;
    if (path === "/api/locations") return new Promise(() => {});
    return ok(payloads[path]);
  });
  assert.equal(requestSignal.aborted, true);
  assert.equal(data.apiAvailability.locations, false);
  assert.match(data.errors.locations, /timed out/);
  assert.equal(data.apiAvailability.recalls, true);
  assert.equal(data.mode, "partial");
});

test("API08 invalid JSON and stalled JSON bodies have the same independent failure boundary", async () => {
  const data = await loadPublicData({ ...config, timeoutMs: 15 }, async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/recalls") return { ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } };
    if (path === "/api/locations") return { ok: true, json: () => new Promise(() => {}) };
    return ok(payloads[path]);
  });
  assert.equal(data.availability.recalls, false);
  assert.equal(data.availability.locations, false);
  assert.equal(data.availability.repairEvidence, true);
  assert.match(data.errors.locations, /timed out/);
});

test("API09 empty valid datasets count as loaded and invalid metadata is not merged into the UI", async () => {
  const empty = await loadPublicData(config, async (url) => {
    const path = new URL(url).pathname;
    const field = path === "/api/repair-evidence" ? "evidence" : path.split("/").at(-1);
    return ok({ [field]: [] });
  });
  assert.equal(empty.mode, "backend");
  assert.equal(Object.values(empty.apiAvailability).every(Boolean), true);
  const badMetadata = await loadPublicData(config, async (url) => ok({ ...payloads[new URL(url).pathname], meta: "bad metadata" }));
  assert.equal(badMetadata.mode, "fallback");
  assert.equal(badMetadata.meta.releaseVersion, getStaticSnapshot().meta.releaseVersion);
});

test("API10 expired website access is explicit and does not enter a retry loop", async () => {
  const calls = new Map();
  const data = await loadPublicData(config, async (url) => {
    const path = new URL(url).pathname;
    calls.set(path, (calls.get(path) || 0) + 1);
    return { ok: false, status: 401, json: async () => ({ error: { code: "access_required" } }) };
  });
  assert.equal(data.accessRequired, true);
  assert.equal(data.mode, "fallback");
  assert.equal(data.availability.recalls, false);
  assert.deepEqual([...calls.values()], [1, 1, 1, 1]);
  const recovered = await loadPublicData(config, async (url) => ok(payloads[new URL(url).pathname]));
  assert.equal(recovered.accessRequired, false);
  assert.equal(recovered.mode, "backend");
});

test("API11 a transient connection failure recovers once without repeating successful requests", async () => {
  const calls = new Map();
  const data = await loadPublicData(config, async (url) => {
    const path = new URL(url).pathname;
    calls.set(path, (calls.get(path) || 0) + 1);
    if (path === "/api/recalls" && calls.get(path) === 1) throw new TypeError("Failed to fetch");
    if (path === "/api/locations" && calls.get(path) === 1) return { ok: false, status: 503 };
    return ok(payloads[path]);
  });
  assert.equal(data.mode, "backend");
  assert.equal(data.accessRequired, false);
  assert.equal(calls.get("/api/recalls"), 2);
  assert.equal(calls.get("/api/locations"), 2);
  assert.equal(calls.get("/api/sources"), 1);
  assert.equal(calls.get("/api/repair-evidence"), 1);
  assert.deepEqual(data.errors, {});
});

test("API12 persistent temporary failure stops after one retry and keeps recall checks available", async () => {
  let locationCalls = 0;
  const data = await loadPublicData(config, async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/locations") { locationCalls += 1; return { ok: false, status: 502 }; }
    return ok(payloads[path]);
  });
  assert.equal(locationCalls, 2);
  assert.equal(data.mode, "partial");
  assert.equal(data.availability.recalls, true);
  assert.equal(data.availability.locations, false);
  assert.match(data.errors.locations, /502/);
});

test("API13 configuration, permission, schema and JSON errors are not retried", async () => {
  const calls = new Map();
  const data = await loadPublicData(config, async (url) => {
    const path = new URL(url).pathname;
    calls.set(path, (calls.get(path) || 0) + 1);
    if (path === "/api/recalls") return { ok: false, status: 503, json: async () => ({ error: { code: "access_unavailable" } }) };
    if (path === "/api/sources") return { ok: false, status: 403 };
    if (path === "/api/locations") return ok({ locations: [null] });
    return { ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } };
  });
  assert.equal(data.mode, "fallback");
  assert.equal(data.accessRequired, false);
  assert.deepEqual([...calls.values()], [1, 1, 1, 1]);
});

test("API14 the existing deadline also cancels a pending retry", async () => {
  let locationCalls = 0;
  const data = await loadPublicData({ ...config, timeoutMs: 15 }, async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/locations") { locationCalls += 1; return { ok: false, status: 504 }; }
    return ok(payloads[path]);
  });
  assert.equal(data.mode, "partial");
  assert.equal(data.availability.recalls, true);
  assert.match(data.errors.locations, /timed out/);
  await new Promise((resolve) => setTimeout(resolve, 275));
  assert.equal(locationCalls, 1, "No delayed request runs after the load has timed out");
});
