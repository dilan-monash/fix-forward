// These are optional identity suggestions from the project's limited records.
// A suggestion is not a recall result, a diagnosis, or a complete product list.
const LIMIT = 8;
const text = (value) => typeof value === "string" ? value.trim() : "";
const brandKey = (value) => text(value).normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ");
const modelKey = (value) => text(value).normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
const compare = (left, right) => left.localeCompare(right, "en", { sensitivity: "base", numeric: true });

export function productSuggestions(appliance = {}, prices = [], recalls = []) {
  const categoryCode = text(appliance?.categoryCode);
  if (!categoryCode) return { brands: [], models: [] };
  const products = new Map();
  const addProduct = (brandValue, modelValue, source) => {
    const brand = text(brandValue);
    const model = text(modelValue);
    const normalizedBrand = brandKey(brand);
    const normalizedModel = modelKey(model);
    if (!normalizedBrand || !normalizedModel) return;
    const key = `${normalizedBrand}|${normalizedModel}`;
    // Keep recall provenance visible if the same product also has a price row.
    if (!products.has(key) || source === "recall notice") products.set(key, { brand, model, source });
  };

  for (const row of Array.isArray(prices) ? prices : []) {
    if (row?.categoryCode === categoryCode) addProduct(row.brand, row.model, "recorded product");
  }
  for (const recall of Array.isArray(recalls) ? recalls : []) {
    if (!Array.isArray(recall?.categoryCodes) || !recall.categoryCodes.includes(categoryCode)) continue;
    for (const identifier of Array.isArray(recall.identifiers) ? recall.identifiers : []) {
      // Serial numbers, SKUs and barcodes must not be relabelled as model numbers.
      if (identifier?.type === "model") addProduct(recall.brand, text(identifier.value) || identifier.normalizedValue, "recall notice");
    }
  }

  const brandQuery = brandKey(appliance?.brand);
  const modelQuery = modelKey(appliance?.model);
  const brandsByKey = new Map();
  for (const product of products.values()) {
    const key = brandKey(product.brand);
    if (!brandsByKey.has(key)) brandsByKey.set(key, product.brand);
  }
  const brands = [...brandsByKey]
    .filter(([key]) => key.includes(brandQuery))
    .sort(([leftKey, left], [rightKey, right]) => Number(!leftKey.startsWith(brandQuery)) - Number(!rightKey.startsWith(brandQuery)) || compare(left, right))
    .slice(0, LIMIT)
    .map(([, brand]) => brand);

  // Require the complete brand before suggesting models. A partial or unknown
  // brand must not silently select a different product or overwrite free text.
  const models = brandQuery && brandsByKey.has(brandQuery)
    ? [...products.values()]
      .filter((product) => brandKey(product.brand) === brandQuery && modelKey(product.model).includes(modelQuery))
      .sort((left, right) => Number(!modelKey(left.model).startsWith(modelQuery)) - Number(!modelKey(right.model).startsWith(modelQuery)) || compare(left.model, right.model))
      .slice(0, LIMIT)
    : [];

  return { brands, models };
}
