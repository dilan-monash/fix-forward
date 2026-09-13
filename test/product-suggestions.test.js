import test from "node:test";
import assert from "node:assert/strict";
import { productSuggestions } from "../src/product-suggestions.js";

const prices = [
  { categoryCode: "kettle", brand: "Example", model: "ABC-100" },
  { categoryCode: "kettle", brand: "EXAMPLE", model: "abc 100" },
  { categoryCode: "kettle", brand: "Example", model: "ABC-200" },
  { categoryCode: "kettle", brand: "Example Plus", model: "PLUS-1" },
  { categoryCode: "toaster", brand: "Toaster Only", model: "ABC-100" }
];
const recalls = [
  { categoryCodes: ["kettle"], brand: "Example", identifiers: [
    { type: "model", value: "ABC-100" },
    { type: "model", normalizedValue: "12345" },
    { type: "serial", value: "SERIAL-1" },
    { type: "sku", value: "SHOP-2" },
    { type: "barcode", value: "9300000000001" }
  ] },
  { categoryCodes: ["vacuum-cleaner"], brand: "Vacuum Only", identifiers: [{ type: "model", value: "VAC-1" }] }
];

test("product suggestions stay inside the selected category and require a category", () => {
  assert.deepEqual(productSuggestions({}, prices, recalls), { brands: [], models: [] });
  assert.deepEqual(productSuggestions({ categoryCode: "kettle" }, prices, recalls).brands, ["Example", "Example Plus"]);
  assert.deepEqual(productSuggestions({ categoryCode: "fan" }, prices, recalls), { brands: [], models: [] });
});

test("partial brand search helps typing without selecting an ambiguous brand or model", () => {
  const result = productSuggestions({ categoryCode: "kettle", brand: "amp" }, prices, recalls);
  assert.deepEqual(result.brands, ["Example", "Example Plus"]);
  assert.deepEqual(result.models, []);
  assert.equal(Object.hasOwn(result, "selectedModel"), false);
});

test("unknown brands and models keep free-text entry independent of catalogue coverage", () => {
  const appliance = Object.freeze({ categoryCode: "kettle", brand: "Unlisted Brand", model: "CUSTOM-123" });
  assert.deepEqual(productSuggestions(appliance, prices, recalls), { brands: [], models: [] });
  assert.equal(appliance.model, "CUSTOM-123");
  assert.deepEqual(productSuggestions({ categoryCode: "kettle", brand: "Example", model: "CUSTOM-123" }, prices, recalls).models, []);
});

test("model suggestions deduplicate formatting and preserve recall provenance", () => {
  const result = productSuggestions({ categoryCode: "kettle", brand: " eXaMpLe " }, prices, recalls);
  assert.deepEqual(result.models, [
    { brand: "Example", model: "12345", source: "recall notice" },
    { brand: "Example", model: "ABC-100", source: "recall notice" },
    { brand: "Example", model: "ABC-200", source: "recorded product" }
  ]);
  assert.ok(result.models.every((row) => !/SERIAL|SHOP|9300000000001|PLUS|VAC/.test(row.model)));
});

test("model search accepts formatting differences and ranks prefixes before other matches", () => {
  const extra = [...prices, { categoryCode: "kettle", brand: "Example", model: "XABC-20" }];
  const result = productSuggestions({ categoryCode: "kettle", brand: "Example", model: "aBc 2" }, extra, recalls);
  assert.deepEqual(result.models.map((row) => row.model), ["ABC-200", "XABC-20"]);
});

test("brand and model lists are bounded while exact-brand model lookup uses the complete index", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ categoryCode: "kettle", brand: `Brand ${i}`, model: `M-${i}` }));
  assert.equal(productSuggestions({ categoryCode: "kettle" }, rows).brands.length, 8);
  assert.equal(productSuggestions({ categoryCode: "kettle", brand: "Brand 11" }, rows).models[0].model, "M-11");
  assert.equal(productSuggestions({ categoryCode: "kettle", brand: "One Brand" }, rows.map((row) => ({ ...row, brand: "One Brand" }))).models.length, 8);
});

test("malformed optional datasets do not interrupt manual identification", () => {
  assert.deepEqual(productSuggestions(null, null, null), { brands: [], models: [] });
  assert.deepEqual(productSuggestions({ categoryCode: "kettle" }, [null, {}, { categoryCode: "kettle", brand: {}, model: 123 }], [null, { categoryCodes: "kettle" }, { categoryCodes: ["kettle"], identifiers: [null] }]), { brands: [], models: [] });
});
