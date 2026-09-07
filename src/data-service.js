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

function safeStaticSnapshot() {
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
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-cache",
    signal
  });
  if (!response.ok) throw new Error(`Public data request failed (${response.status})`);
  return response.json();
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

function extractDataset(name, payload) {
  if (name === "recalls") {
    if (!Array.isArray(payload?.recalls)) throw new Error("Invalid recalls response");
    return { value: payload.recalls, meta: payload.meta || {} };
  }
  if (name === "sources") {
    if (!Array.isArray(payload?.sources)) throw new Error("Invalid sources response");
    return { value: payload.sources, meta: payload.meta || {} };
  }
  if (name === "repairEvidence") {
    if (!Array.isArray(payload?.evidence)) throw new Error("Invalid repair evidence response");
    return { value: payload.evidence, meta: payload.meta || {} };
  }
  if (name === "locations") {
    if (!Array.isArray(payload?.locations)) throw new Error("Invalid locations response");
    return { value: payload.locations, meta: payload.meta || {} };
  }
  throw new Error("Unknown dataset");
}

/**
 * Load each public dataset independently.
 * A location outage must never masquerade as a recall outage, and a recall
 * outage must never prevent the static safety questionnaire from rendering.
 */
export async function loadPublicData(config = DATA_API_CONFIG, fetchImpl = globalThis.fetch) {
  const base = safeStaticSnapshot();
  if (!config.enabled) return { ...base, mode: "static" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const tasks = endpointTasks(config, fetchImpl, controller.signal);
    const results = await Promise.allSettled(DATASET_NAMES.map((name) => tasks[name]));
    const output = { ...base, mode: "backend", errors: {}, availability: { ...base.availability }, datasetMeta: { ...base.datasetMeta } };

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
        if (name === "recalls") output.meta = { ...STATIC_META, ...extracted.meta };
      } catch (error) {
        output.errors[name] = error instanceof Error ? error.message : "Invalid response";
      }
    });

    if (!Object.values(output.availability).some(Boolean)) output.mode = "fallback";
    else if (Object.values(output.availability).some((value) => value === false)) output.mode = "partial";
    return output;
  } finally {
    clearTimeout(timeout);
  }
}
