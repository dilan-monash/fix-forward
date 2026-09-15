// TEST SUITE: Checks reviewed-price validation and matching without querying live retailers or a database.
// Each test name describes its expected behavior; fixtures are invented test inputs.
import test from "node:test";
import assert from "node:assert/strict";
import { automaticCostContext, matchPriceExamples, validPriceRow, validRepairFee, validatePricePayload, loadPriceCatalogue } from "../src/price-catalogue.js";
import { PRICE_SNAPSHOT } from "../src/price-snapshot.js";

const today = new Date("2026-09-14T10:00:00Z");
// Create an invented price row and its API-shaped wrapper; these are never retail evidence.
const row = (overrides = {}) => ({ id: "fixture-a", categoryCode: "kettle", brand: "Example", model: "ABC-123", productName: "Synthetic test kettle", retailer: "The Good Guys", priceAud: 49.95, currency: "AUD", sourceUrl: "https://www.thegoodguys.com.au/test-only", observedAt: "2026-09-11", priceKind: "advertised", availability: "not-verified", notes: "Synthetic test only", ...overrides });
const payload = (prices = [row()]) => ({ meta: { source: "reviewed-price-snapshot", currency: "AUD" }, prices });
const fee = (overrides = {}) => ({ id: "fee-a", provider: "National Appliance Repairs", label: "Synthetic inspection", amount: 99, note: "Synthetic fixture; parts extra.", url: "https://www.nationalappliancerepairs.com.au/pricing/", retrieved: "2026-09-11", ...overrides });

test("matching requires the whole brand and model, never a partial identifier", () => {
  const rows = [row(), row({ id: "b", model: "ABC-1234" }), row({ id: "c", brand: "Other" }), row({ id: "d", categoryCode: "toaster" })];
  const matches = matchPriceExamples(rows, { categoryCode: "kettle", brand: "EXAMPLE", model: "abc 123" }, { today });
  assert.deepEqual(matches.map((item) => [item.id, item.match]), [["fixture-a", "exact"], ["b", "brand"], ["c", "type"]]);
  assert.ok(matchPriceExamples(rows, { categoryCode: "kettle", model: "ABC123" }, { today }).every((item) => item.match === "type"));
  assert.deepEqual(matchPriceExamples(rows, { categoryCode: "blender" }, { today }), []);
});

test("unsafe links, impossible dates and non-AUD or malformed amounts are rejected", () => {
  for (const patch of [{ priceAud: NaN }, { priceAud: "29" }, { priceAud: -2 }, { priceAud: 0 }, { currency: "USD" }, { observedAt: "2026-02-30" }, { observedAt: "2026-09-15" }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://thegoodguys.com.au.example.com/x" }, { retailer: "JB Hi-Fi" }, { sourceUrl: "https://user:secret@www.thegoodguys.com.au/x" }]) assert.equal(validPriceRow(row(patch), today), false, JSON.stringify(patch));
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

test("an ended promotion remains visible as evidence but cannot drive automatic comparison", () => {
  const ended = row({ offerEndsAt: "2026-09-13" });
  const matches = matchPriceExamples([ended], { categoryCode: "kettle" }, { today });
  assert.equal(matches[0].offerExpired, true);
  assert.equal(automaticCostContext([ended], [fee()], { categoryCode: "kettle" }, { today }).reason, "replacement-unavailable");
});

test("automatic comparison uses the strongest current product match and sourced service fees", () => {
  const prices = [row(), row({ id: "brand", model: "OTHER", priceAud: 79 }), row({ id: "type", brand: "Other", priceAud: 39 })];
  const exact = automaticCostContext(prices, [fee(), fee({ id: "fee-b", amount: 129 })], { categoryCode: "kettle", brand: "Example", model: "ABC-123" }, { today });
  assert.equal(exact.available, true);
  assert.equal(exact.match, "exact");
  assert.equal(exact.replacementMin, 49.95);
  assert.deepEqual([exact.repairMin, exact.repairMax], [99, 129]);
  const category = automaticCostContext(prices, [fee()], { categoryCode: "kettle" }, { today });
  assert.equal(category.match, "type");
  assert.equal(category.replacementMin, 39);
  assert.equal(category.replacementMax, 79);
});

test("automatic comparison stays unavailable without both kinds of evidence", () => {
  assert.equal(automaticCostContext([], [fee()], { categoryCode: "kettle" }, { today }).reason, "replacement-unavailable");
  assert.equal(automaticCostContext([row()], [], { categoryCode: "kettle" }, { today }).reason, "repair-context-unavailable");
  assert.equal(validRepairFee(fee({ url: "https://example.com/fee" }), today), false);
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
