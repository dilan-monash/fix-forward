import {
  META as STATIC_META,
  FAMILIES,
  RECALLS,
  SAFETY_SIGNS,
  SAFETY_GROUPS,
  SAFETY_RULES,
  SOURCES,
  REPAIR_EVIDENCE,
  LOCATIONS
} from "./data.js";
import { DATA_API_CONFIG } from "./config.js";

const DATASET_NAMES = ["recalls", "sources", "repairEvidence", "locations"];

export function getStaticSnapshot() {
  return {
    meta: STATIC_META,
    families: FAMILIES,
    recalls: RECALLS,
    safetySigns: SAFETY_SIGNS,
    safetyGroups: SAFETY_GROUPS,
    safetyRules: SAFETY_RULES,
    sources: SOURCES,
    repairEvidence: REPAIR_EVIDENCE,
    locations: LOCATIONS,
    availability: { recalls: false, sources: true, repairEvidence: false, locations: false },
    apiAvailability: { recalls: false, sources: false, repairEvidence: false, locations: false },
    errors: {},
    datasetMeta: {
      recalls: STATIC_META,
      sources: STATIC_META,
      repairEvidence: STATIC_META,
      locations: STATIC_META
    },
    mode: "static"
  };
}

function apiUrl(baseUrl, endpoint) {
  return `${String(baseUrl || "").replace(/\/$/, "")}${endpoint}`;
}

async function getJson(fetchImpl, url, signal) {
  let abortListener;
  // Bound both the network request and JSON body reading. The extra race also
  // handles a fetch adapter that fails to honour AbortSignal itself.
  const aborted = new Promise((_, reject) => {
    abortListener = () => reject(new Error("Public data request timed out"));
    if (signal.aborted) abortListener();
    else signal.addEventListener("abort", abortListener, { once: true });
  });
  try {
    const request = (async () => {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-cache",
        signal
      });
      if (!response.ok) throw new Error(`Public data request failed (${response.status})`);
      return response.json();
    })();
    return await Promise.race([request, aborted]);
  } finally {
    signal.removeEventListener("abort", abortListener);
  }
}

function endpointTasks(config, fetchImpl, signal) {
  const e = config.endpoints;
  return {
    recalls: getJson(fetchImpl, apiUrl(config.baseUrl, e.recalls), signal),
    sources: getJson(fetchImpl, apiUrl(config.baseUrl, e.sources), signal),
    repairEvidence: getJson(fetchImpl, apiUrl(config.baseUrl, e.repairEvidence), signal),
    locations: getJson(fetchImpl, apiUrl(config.baseUrl, e.locations), signal)
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validId(value) {
  return hasText(value) || (typeof value === "number" && Number.isFinite(value));
}

function validDatasetRow(name, row) {
  if (!isRecord(row)) return false;
  if (name === "recalls") {
    return validId(row.id)
      && Array.isArray(row.categoryCodes) && row.categoryCodes.length > 0 && row.categoryCodes.every(hasText)
      && Array.isArray(row.identifiers)
      && row.identifiers.every((identifier) => isRecord(identifier) && hasText(identifier.type)
        && (identifier.value === undefined || hasText(identifier.value))
        && (identifier.normalizedValue === undefined || hasText(identifier.normalizedValue))
        && (hasText(identifier.value) || hasText(identifier.normalizedValue)));
  }
  if (name === "sources") return hasText(row.name);
  if (name === "locations") return validId(row.id) && hasText(row.name) && ["repair", "dispose"].includes(row.pathway);
  if (name === "repairEvidence") {
    const counts = [row.sampleSize, row.fixedCount, row.repairableCount, row.endOfLifeCount, row.unclassifiedCount];
    return hasText(row.categoryCode)
      && counts.every((value) => Number.isSafeInteger(value) && value >= 0)
      && counts.slice(1).reduce((sum, value) => sum + value, 0) === row.sampleSize;
  }
  return false;
}

function extractDataset(name, payload) {
  const field = name === "repairEvidence" ? "evidence" : name;
  const rows = payload?.[field];
  if (!isRecord(payload) || !Array.isArray(rows) || !rows.every((row) => validDatasetRow(name, row))) {
    // Do not silently discard an invalid recall record: that could hide a
    // possible match and incorrectly tell a household that no match was found.
    throw new Error(`Invalid ${name} response`);
  }
  if (payload.meta !== undefined && !isRecord(payload.meta)) throw new Error(`Invalid ${name} metadata`);
  return { value: rows, meta: payload.meta || {} };
}

/**
 * Load each public dataset independently.
 * A location outage must never masquerade as a recall outage, and a recall
 * outage must never prevent the static safety questionnaire from rendering.
 */
export async function loadPublicData(config = DATA_API_CONFIG, fetchImpl = globalThis.fetch) {
  const suppliedConfig = config && typeof config === "object" ? config : DATA_API_CONFIG;
  const safeConfig = { ...DATA_API_CONFIG, ...suppliedConfig, endpoints: { ...DATA_API_CONFIG.endpoints, ...suppliedConfig.endpoints } };
  const safeFetchImpl = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  const base = getStaticSnapshot();
  if (!safeConfig.enabled) return { ...base, mode: "static" };

  const controller = new AbortController();
  const requestedTimeout = Number(safeConfig.timeoutMs);
  const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0 ? Math.min(requestedTimeout, 2147483647) : 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const tasks = endpointTasks(safeConfig, safeFetchImpl, controller.signal);
    const results = await Promise.allSettled(DATASET_NAMES.map((name) => tasks[name]));
    const output = { ...base, mode: "backend", errors: {}, availability: { ...base.availability }, apiAvailability: { ...base.apiAvailability }, datasetMeta: { ...base.datasetMeta } };

    DATASET_NAMES.forEach((name, index) => {
      const result = results[index];
      if (result.status === "rejected") {
        output.errors[name] = result.reason instanceof Error ? result.reason.message : "Unavailable";
        return;
      }
      try {
        const extracted = extractDataset(name, result.value);
        output[name] = extracted.value;
        output.datasetMeta[name] = extracted.meta;
        output.availability[name] = true;
        output.apiAvailability[name] = true;
        if (name === "recalls") output.meta = { ...STATIC_META, ...extracted.meta };
      } catch (error) {
        output.errors[name] = error instanceof Error ? error.message : "Invalid response";
      }
    });

    if (!Object.values(output.apiAvailability).some(Boolean)) output.mode = "fallback";
    else if (Object.values(output.apiAvailability).some((value) => value === false)) output.mode = "partial";
    return output;
  } finally {
    clearTimeout(timeout);
  }
}
