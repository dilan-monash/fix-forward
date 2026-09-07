import test from "node:test";
import assert from "node:assert/strict";
import { loadPublicData } from "../src/data-service.js";

const endpoints = { recalls: "/api/recalls", sources: "/api/sources", repairEvidence: "/api/repair-evidence", locations: "/api/locations" };

test("API01 disabled API uses safe static UI data without making a request", async () => {
  let calls = 0;
  const data = await loadPublicData({ enabled: false }, async () => { calls += 1; throw new Error("must not be called"); });
  assert.equal(data.mode, "static");
  assert.equal(calls, 0);
  assert.equal(data.families.length, 6);
  assert.deepEqual(data.recalls, []);
  assert.equal(data.availability.recalls, false);
});

test("API02 enabled API accepts the documented read-only response contract", async () => {
  const calls = [];
  const payloadByPath = {
    "/api/recalls": { meta: { releaseVersion: "backend", dataVersion: "recall-db-1", retrievalDate: "today" }, recalls: [{ id: "backend-recall" }] },
    "/api/sources": { meta: { releaseVersion: "backend" }, sources: [{ name: "Backend source" }] },
    "/api/repair-evidence": { evidence: [{ categoryCode: "kettle" }] },
    "/api/locations": { locations: [{ name: "Backend location" }] }
  };
  const fetchMock = async (url, options) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    return { ok: true, status: 200, json: async () => payloadByPath[path] };
  };
  const data = await loadPublicData({ enabled: true, baseUrl: "http://localhost:5000", timeoutMs: 1000, endpoints }, fetchMock);
  assert.equal(data.mode, "backend");
  assert.equal(data.meta.dataVersion, "recall-db-1");
  assert.equal(data.recalls[0].id, "backend-recall");
  assert.equal(data.repairEvidence[0].categoryCode, "kettle");
  assert.equal(data.availability.recalls, true);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ options }) => options.method === "GET" && !("body" in options)));
});

test("API03 failure removes public fixtures and marks data unavailable", async () => {
  const data = await loadPublicData({ enabled: true, baseUrl: "", timeoutMs: 1000, endpoints }, async () => ({ ok: false, status: 503 }));
  assert.equal(data.mode, "fallback");
  assert.match(data.error, /503/);
  assert.equal(data.families.length, 6);
  assert.deepEqual(data.recalls, []);
  assert.deepEqual(data.repairEvidence, []);
  assert.deepEqual(data.locations, []);
  assert.equal(data.availability.recalls, false);
});
