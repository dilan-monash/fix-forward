// Read and rank dated public replacement-price examples for the adult cost screen.
// This catalogue is separate from Neon safety/service data and from the user's repair quote.
// A validated saved copy can cover a price-service outage, with its fallback status shown in app.js.
// Retail prices are dated observations, never a diagnosis or a buying recommendation.
// Build a comparison key for a recorded brand/model without changing the displayed text.
const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
const retailerHosts = {
  "The Good Guys": "thegoodguys.com.au", "JB Hi-Fi": "jbhifi.com.au",
  "Harvey Norman": "harveynorman.com.au", "Bing Lee": "binglee.com.au",
  "Kmart": "kmart.com.au", "BIG W": "bigw.com.au", "Officeworks": "officeworks.com.au",
  "Myer": "myer.com.au", "Amazon AU": "amazon.com.au"
};
const serviceProviderHosts = {
  "National Appliance Repairs": "nationalappliancerepairs.com.au",
  "One Touch Appliance Repairs": "1touchappliancerepairs.com.au"
};

// Validate one sourced service-fee observation. It is cost context, not a complete repair quote.
export function validRepairFee(row, today = new Date()) {
  if (!row || typeof row !== "object" || !["id", "provider", "label", "note", "url", "retrieved"].every((key) => typeof row[key] === "string" && row[key].trim())) return false;
  if (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount <= 0 || row.amount > 100000) return false;
  if (Math.abs(row.amount * 100 - Math.round(row.amount * 100)) > 0.000001 || !/^\d{4}-\d{2}-\d{2}$/.test(row.retrieved)) return false;
  const observed = new Date(`${row.retrieved}T00:00:00Z`);
  if (!Number.isFinite(observed.getTime()) || observed.toISOString().slice(0, 10) !== row.retrieved || row.retrieved > today.toISOString().slice(0, 10)) return false;
  try {
    const url = new URL(row.url);
    const host = serviceProviderHosts[row.provider];
    return Boolean(host && url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && url.pathname !== "/" && (url.hostname === host || url.hostname === `www.${host}`));
  } catch { return false; }
}

// Check a dated AUD observation, its fields and an approved retailer's source URL.
// Return false for impossible amounts/dates or a source address that does not match the named retailer.
export function validPriceRow(row, today = new Date()) {
  if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id.trim()) return false;
  if (!["categoryCode", "brand", "model", "productName"].every((key) => typeof row[key] === "string" && row[key].trim())) return false;
  if (row.currency !== "AUD" || typeof row.priceAud !== "number" || !Number.isFinite(row.priceAud) || row.priceAud <= 0 || row.priceAud > 100000) return false;
  if (Math.abs(row.priceAud * 100 - Math.round(row.priceAud * 100)) > 0.000001) return false;
  if (row.priceKind !== "advertised" || !["not-verified", "in-stock", "out-of-stock"].includes(row.availability)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.observedAt)) return false;
  const date = new Date(`${row.observedAt}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.observedAt || row.observedAt > today.toISOString().slice(0, 10)) return false;
  if (row.offerEndsAt !== undefined) {
    if (typeof row.offerEndsAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.offerEndsAt)) return false;
    const offerEnd = new Date(`${row.offerEndsAt}T00:00:00Z`);
    if (!Number.isFinite(offerEnd.getTime()) || offerEnd.toISOString().slice(0, 10) !== row.offerEndsAt || row.offerEndsAt < row.observedAt) return false;
  }
  try {
    const url = new URL(row.sourceUrl);
    const host = retailerHosts[row.retailer];
    return Boolean(host && url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && url.pathname !== "/" && (url.hostname === host || url.hostname === `www.${host}`));
  } catch { return false; }
}

// Accept a complete reviewed-price payload with unique valid rows, or throw an error.
export function validatePricePayload(payload, today = new Date()) {
  if (payload?.meta?.source !== "reviewed-price-snapshot" || payload?.meta?.currency !== "AUD" || !Array.isArray(payload.prices)) throw new Error("Invalid price catalogue");
  const ids = new Set();
  for (const row of payload.prices) {
    if (!validPriceRow(row, today) || ids.has(row.id)) throw new Error("Invalid price observation");
    ids.add(row.id);
  }
  const repairFees = payload.repairFees === undefined ? [] : payload.repairFees;
  if (!Array.isArray(repairFees)) throw new Error("Invalid repair fee catalogue");
  const feeIds = new Set();
  for (const row of repairFees) {
    if (!validRepairFee(row, today) || feeIds.has(row.id)) throw new Error("Invalid repair fee observation");
    feeIds.add(row.id);
  }
  return payload;
}

// Find same-category records, keep the newest observation per product/retailer, and rank matches.
// Only complete brand and model equality counts as exact; older-than-90-day rows are marked stale.
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
      return { ...row, match: exact ? "exact" : brandMatch ? "brand" : "type", stale: today.getTime() - new Date(`${row.observedAt}T00:00:00Z`).getTime() > 90 * 86400000, offerExpired: Boolean(row.offerEndsAt && row.offerEndsAt < today.toISOString().slice(0, 10)) };
    })
    .sort((a, b) => ({ exact: 0, brand: 1, type: 2 }[a.match] - { exact: 0, brand: 1, type: 2 }[b.match]) || b.observedAt.localeCompare(a.observedAt) || a.productName.localeCompare(b.productName) || a.retailer.localeCompare(b.retailer))
    .slice(0, Math.max(0, limit));
}

// Build an immediate database-backed comparison without pretending that a starting fee is a full repair quote.
// The strongest available replacement match is used: exact product, then brand, then appliance type.
export function automaticCostContext(prices, repairFees, appliance, { today = new Date() } = {}) {
  const current = matchPriceExamples(prices, appliance, { today, limit: 100 })
    .filter((row) => !row.stale && !row.offerExpired && row.availability !== "out-of-stock");
  if (!current.length) return { available: false, reason: "replacement-unavailable", replacementRows: [], repairFees: [] };
  const bestMatch = current.some((row) => row.match === "exact") ? "exact" : current.some((row) => row.match === "brand") ? "brand" : "type";
  const replacementRows = current.filter((row) => row.match === bestMatch);
  const fees = (Array.isArray(repairFees) ? repairFees : []).filter((row) => validRepairFee(row, today));
  if (!fees.length) return { available: false, reason: "repair-context-unavailable", replacementRows, repairFees: [] };
  const replacementAmounts = replacementRows.map((row) => row.priceAud).sort((a, b) => a - b);
  const repairAmounts = fees.map((row) => row.amount).sort((a, b) => a - b);
  return {
    available: true,
    match: bestMatch,
    replacementRows,
    repairFees: fees,
    replacementMin: replacementAmounts[0],
    replacementMax: replacementAmounts.at(-1),
    repairMin: repairAmounts[0],
    repairMax: repairAmounts.at(-1)
  };
}

// Request the price API with a bounded wait, then use only a validated saved copy if it fails.
// Return an empty unavailable catalogue if neither source is valid; never invent an amount.
export async function loadPriceCatalogue(snapshot, { fetchImpl = globalThis.fetch, timeoutMs = 5000, today = new Date() } = {}) {
  let timer;
  const controller = new AbortController();
  try {
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Price request timed out")); }, timeoutMs); });
    // Fetch and validate together so a late or malformed response cannot bypass the deadline/fallback.
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

// Return authored questions for a repairer based on a description topic, not a diagnosed fault.
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
