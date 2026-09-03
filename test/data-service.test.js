import test from "node:test";
import assert from "node:assert/strict";
import { loadPublicData } from "../src/data-service.js";

const endpoints = {
  recalls: "/api/recalls",
  sources: "/api/sources",
  repairEvidence: "/api/repair-evidence",
  locations: "/api/locations"
};

test("API01 disabled API uses static data without making a request", async () => {
  let calls = 0;
  const data = await loadPublicData({ enabled: false }, async () => { calls += 1; throw new Error("must not be called"); });
  assert.equal(data.mode, "static");
  assert.equal(calls, 0);
  assert.equal(data.families.length, 6);
  assert.ok(data.recalls.length);
});

test("API02 enabled API accepts the documented read-only response contract", async () => {
  const calls = [];
  const payloadByPath = {
    "/api/recalls": { recalls: [{ id: "backend-recall" }] },
    "/api/sources": { meta: { releaseVersion: "backend", dataVersion: "db-1", retrievalDate: "today" }, sources: [{ name: "Backend source" }] },
    "/api/repair-evidence": { evidence: { status: "available", statistics: [{ applianceCategory: "Kettle", sampleSize: 10 }], barriers: [], context: { sampleSize: 10 } } },
    "/api/locations": { locations: [{ name: "Backend location", verified: true }] }
  };
  const fetchMock = async (url, options) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    return { ok: true, status: 200, json: async () => payloadByPath[path] };
  };
  const data = await loadPublicData({ enabled: true, baseUrl: "http://localhost:5000", timeoutMs: 1000, endpoints }, fetchMock);
  assert.equal(data.mode, "backend");
  assert.equal(data.meta.dataVersion, "db-1");
  assert.equal(data.recalls[0].id, "backend-recall");
  assert.equal(data.repairEvidence.statistics[0].sampleSize, 10);
  assert.equal(data.locations[0].verified, true);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ options }) => options.method === "GET" && !("body" in options)));
});

test("API04 incomplete repair evidence responses fall back safely", async () => {
  const payloadByPath = {
    "/api/recalls": { recalls: [] },
    "/api/sources": { sources: [] },
    "/api/repair-evidence": { evidence: { sample: "legacy shape" } },
    "/api/locations": { locations: [] }
  };
  const data = await loadPublicData({ enabled: true, baseUrl: "http://localhost:5000", timeoutMs: 1000, endpoints }, async (url) => ({
    ok: true,
    status: 200,
    json: async () => payloadByPath[new URL(url).pathname]
  }));
  assert.equal(data.mode, "fallback");
  assert.match(data.error, /repair evidence/i);
});

test("API03 request or response failure falls back to static data", async () => {
  const data = await loadPublicData({ enabled: true, baseUrl: "", timeoutMs: 1000, endpoints }, async () => ({ ok: false, status: 503 }));
  assert.equal(data.mode, "fallback");
  assert.match(data.error, /503/);
  assert.equal(data.families.length, 6);
  assert.ok(data.recalls.length);
});
