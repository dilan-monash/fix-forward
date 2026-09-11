import test from "node:test";
import assert from "node:assert/strict";
import { matchPriceExamples, validPriceRow, validatePricePayload, loadPriceCatalogue } from "../src/price-catalogue.js";
import { PRICE_SNAPSHOT } from "../src/price-snapshot.js";

const today = new Date("2026-09-11T10:00:00Z");
const row = (overrides = {}) => ({ id: "fixture-a", categoryCode: "kettle", brand: "Example", model: "ABC-123", productName: "Synthetic test kettle", retailer: "The Good Guys", priceAud: 49.95, currency: "AUD", sourceUrl: "https://www.thegoodguys.com.au/test-only", observedAt: "2026-09-11", priceKind: "advertised", availability: "not-verified", notes: "Synthetic test only", ...overrides });
const payload = (prices = [row()]) => ({ meta: { source: "reviewed-price-snapshot", currency: "AUD" }, prices });

test("matching requires the whole brand and model, never a partial identifier", () => {
  const rows = [row(), row({ id: "b", model: "ABC-1234" }), row({ id: "c", brand: "Other" }), row({ id: "d", categoryCode: "toaster" })];
  const matches = matchPriceExamples(rows, { categoryCode: "kettle", brand: "EXAMPLE", model: "abc 123" }, { today });
  assert.deepEqual(matches.map((item) => [item.id, item.match]), [["fixture-a", "exact"], ["b", "brand"], ["c", "type"]]);
  assert.ok(matchPriceExamples(rows, { categoryCode: "kettle", model: "ABC123" }, { today }).every((item) => item.match === "type"));
  assert.deepEqual(matchPriceExamples(rows, { categoryCode: "blender" }, { today }), []);
});

test("unsafe links, impossible dates and non-AUD or malformed amounts are rejected", () => {
  for (const patch of [{ priceAud: NaN }, { priceAud: "29" }, { priceAud: -2 }, { priceAud: 0 }, { currency: "USD" }, { observedAt: "2026-02-30" }, { observedAt: "2026-09-12" }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://thegoodguys.com.au.example.com/x" }, { retailer: "JB Hi-Fi" }, { sourceUrl: "https://user:secret@www.thegoodguys.com.au/x" }]) assert.equal(validPriceRow(row(patch), today), false, JSON.stringify(patch));
  assert.throws(() => validatePricePayload(payload([row(), row()]), today));
});

test("older observations remain labelled historical context rather than fresh prices", () => {
  const matches = matchPriceExamples([row({ observedAt: "2025-01-01" })], { categoryCode: "kettle" }, { today });
  assert.equal(matches[0].stale, true);
});

test("older prices for the same retailer and model never displace the latest observation", () => {
  const matches = matchPriceExamples([row({ id: "old", observedAt: "2026-08-01", priceAud: 9 }), row()], { categoryCode: "kettle" }, { today });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].priceAud, 49.95);
});

test("successful price API is distinct from the saved price copy", async () => {
  const result = await loadPriceCatalogue(payload(), { today, fetchImpl: async () => ({ ok: true, json: async () => payload([row({ priceAud: 89 })]) }) });
  assert.equal(result.mode, "database");
  assert.equal(result.prices[0].priceAud, 89);
});

test("HTTP, JSON and validation failures explicitly use the saved price copy", async () => {
  for (const fetchImpl of [async () => ({ ok: false }), async () => { throw new Error("offline"); }, async () => ({ ok: true, json: async () => ({}) })]) {
    const result = await loadPriceCatalogue(payload(), { today, fetchImpl });
    assert.equal(result.mode, "saved-copy");
  }
  const missing = await loadPriceCatalogue({}, { today, fetchImpl: async () => ({ ok: false }) });
  assert.equal(missing.mode, "unavailable");
  assert.deepEqual(missing.prices, []);
});

test("a stalled JSON body cannot leave the price catalogue waiting indefinitely", async () => {
  const result = await loadPriceCatalogue(payload(), { today, timeoutMs: 10, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  assert.equal(result.mode, "saved-copy");
});

test("the bundled public catalogue passes the same trust validation as the API", () => {
  assert.equal(validatePricePayload(PRICE_SNAPSHOT, today), PRICE_SNAPSHOT);
  assert.ok(PRICE_SNAPSHOT.prices.length >= 18);
});
