import {
  META as STATIC_META,
  FAMILIES,
  RECALLS,
  SAFETY_SIGNS,
  SAFETY_GROUPS,
  SOURCES,
  REPAIR_EVIDENCE,
  LOCATIONS
} from "./data.js";
import { DATA_API_CONFIG } from "./config.js";

const staticData = Object.freeze({
  meta: STATIC_META,
  families: FAMILIES,
  recalls: RECALLS,
  safetySigns: SAFETY_SIGNS,
  safetyGroups: SAFETY_GROUPS,
  sources: SOURCES,
  repairEvidence: REPAIR_EVIDENCE,
  locations: LOCATIONS
});

function apiUrl(baseUrl, endpoint) {
  return `${String(baseUrl || "").replace(/\/$/, "")}${endpoint}`;
}

async function getJson(fetchImpl, url, signal) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error(`Public data request failed (${response.status})`);
  return response.json();
}

function validateBackendData(payloads) {
  const [recallPayload, sourcePayload, evidencePayload, locationPayload] = payloads;
  if (!Array.isArray(recallPayload?.recalls)) throw new Error("Invalid recalls response");
  if (!Array.isArray(sourcePayload?.sources)) throw new Error("Invalid sources response");
  if (!evidencePayload?.evidence || typeof evidencePayload.evidence !== "object") throw new Error("Invalid repair evidence response");
  if (!Array.isArray(evidencePayload.evidence.statistics) || !Array.isArray(evidencePayload.evidence.barriers)) throw new Error("Invalid repair evidence collections");
  if (!evidencePayload.evidence.context || typeof evidencePayload.evidence.context !== "object") throw new Error("Invalid repair evidence context");
  if (!Array.isArray(locationPayload?.locations)) throw new Error("Invalid locations response");
  return {
    meta: sourcePayload.meta || recallPayload.meta || STATIC_META,
    families: FAMILIES,
    recalls: recallPayload.recalls,
    safetySigns: SAFETY_SIGNS,
    safetyGroups: SAFETY_GROUPS,
    sources: sourcePayload.sources,
    repairEvidence: evidencePayload.evidence,
    locations: locationPayload.locations
  };
}

export async function loadPublicData(config = DATA_API_CONFIG, fetchImpl = globalThis.fetch) {
  if (!config.enabled) return { ...staticData, mode: "static", error: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const endpoints = config.endpoints;
    const payloads = await Promise.all([
      getJson(fetchImpl, apiUrl(config.baseUrl, endpoints.recalls), controller.signal),
      getJson(fetchImpl, apiUrl(config.baseUrl, endpoints.sources), controller.signal),
      getJson(fetchImpl, apiUrl(config.baseUrl, endpoints.repairEvidence), controller.signal),
      getJson(fetchImpl, apiUrl(config.baseUrl, endpoints.locations), controller.signal)
    ]);
    return { ...validateBackendData(payloads), mode: "backend", error: null };
  } catch (error) {
    return { ...staticData, mode: "fallback", error: error instanceof Error ? error.message : "Public data unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
