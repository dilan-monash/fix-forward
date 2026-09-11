// Retail prices are dated observations, never a diagnosis or a buying recommendation.
const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
const retailerHosts = {
  "The Good Guys": "thegoodguys.com.au", "JB Hi-Fi": "jbhifi.com.au",
  "Harvey Norman": "harveynorman.com.au", "Bing Lee": "binglee.com.au",
  "Kmart": "kmart.com.au", "BIG W": "bigw.com.au", "Officeworks": "officeworks.com.au",
  "Myer": "myer.com.au", "Amazon AU": "amazon.com.au"
};

export function validPriceRow(row, today = new Date()) {
  if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id.trim()) return false;
  if (!["categoryCode", "brand", "model", "productName"].every((key) => typeof row[key] === "string" && row[key].trim())) return false;
  if (row.currency !== "AUD" || typeof row.priceAud !== "number" || !Number.isFinite(row.priceAud) || row.priceAud <= 0 || row.priceAud > 100000) return false;
  if (Math.abs(row.priceAud * 100 - Math.round(row.priceAud * 100)) > 0.000001) return false;
  if (row.priceKind !== "advertised" || !["not-verified", "in-stock", "out-of-stock"].includes(row.availability)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.observedAt)) return false;
  const date = new Date(`${row.observedAt}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.observedAt || row.observedAt > today.toISOString().slice(0, 10)) return false;
  try {
    const url = new URL(row.sourceUrl);
    const host = retailerHosts[row.retailer];
    return Boolean(host && url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && url.pathname !== "/" && (url.hostname === host || url.hostname === `www.${host}`));
  } catch { return false; }
}

export function validatePricePayload(payload, today = new Date()) {
  if (payload?.meta?.source !== "reviewed-price-snapshot" || payload?.meta?.currency !== "AUD" || !Array.isArray(payload.prices)) throw new Error("Invalid price catalogue");
  const ids = new Set();
  for (const row of payload.prices) {
    if (!validPriceRow(row, today) || ids.has(row.id)) throw new Error("Invalid price observation");
    ids.add(row.id);
  }
  return payload;
}

export function matchPriceExamples(prices, appliance, { today = new Date(), limit = 6 } = {}) {
  const brand = normalize(appliance.brand);
  const model = normalize(appliance.model);
  const latest = new Map();
  for (const row of Array.isArray(prices) ? prices : []) {
    if (!validPriceRow(row, today) || row.categoryCode !== appliance.categoryCode) continue;
    const key = [row.categoryCode, normalize(row.brand), normalize(row.model), row.retailer].join("|");
    if (!latest.has(key) || latest.get(key).observedAt < row.observedAt) latest.set(key, row);
  }
  return [...latest.values()]
    .map((row) => {
      const brandMatch = Boolean(brand && normalize(row.brand) === brand);
      const exact = Boolean(brandMatch && model && normalize(row.model) === model);
      return { ...row, match: exact ? "exact" : brandMatch ? "brand" : "type", stale: today.getTime() - new Date(`${row.observedAt}T00:00:00Z`).getTime() > 90 * 86400000 };
    })
    .sort((a, b) => ({ exact: 0, brand: 1, type: 2 }[a.match] - { exact: 0, brand: 1, type: 2 }[b.match]) || b.observedAt.localeCompare(a.observedAt) || a.productName.localeCompare(b.productName) || a.retailer.localeCompare(b.retailer))
    .slice(0, Math.max(0, limit));
}

export async function loadPriceCatalogue(snapshot, { fetchImpl = globalThis.fetch, timeoutMs = 5000, today = new Date() } = {}) {
  let timer;
  const controller = new AbortController();
  try {
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Price request timed out")); }, timeoutMs); });
    const request = (async () => {
      const response = await fetchImpl("/api/replacement-prices", { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Price service unavailable");
      return validatePricePayload(await response.json(), today);
    })();
    return { ...await Promise.race([request, timeout]), mode: "database" };
  } catch {
    try { return { ...validatePricePayload(snapshot, today), mode: "saved-copy" }; }
    catch { return { prices: [], meta: {}, mode: "unavailable" }; }
  } finally { clearTimeout(timer); }
}

export function problemQuestions(code) {
  return ({
    battery: "Tell the repairer whether it would not charge or lost charge quickly, and whether you noticed damage or swelling. Ask whether they handle this battery type.",
    water: "Tell the repairer where you noticed the leak and when it happened. Ask whether they inspect this appliance type and what the inspection includes.",
    heat: "Tell the repairer whether it was not heating, became unusually hot or stopped during use. Ask what is included in their assessment.",
    noise: "Describe the sound or loss of performance you already noticed and when it started. Ask whether parts are available for your model.",
    power: "Describe what happened before the power problem and any error message you already saw. Ask whether the repairer handles this model.",
    general: "Tell the repairer what changed, when it started and the brand and model if you know them. Ask for an itemised quote before agreeing to work."
  })[code] || "Ask the repairer what the inspection includes and whether parts are available for your model.";
}
