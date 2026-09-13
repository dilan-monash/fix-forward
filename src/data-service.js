// Read the adult app's public reference datasets from the Flask API.
// data.js supplies the static questionnaire and empty operational fallback lists.
// Return separate availability flags so one failed dataset cannot impersonate an empty successful result.
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
const RETRYABLE_STATUSES = new Set([408, 502, 503, 504]);
const RETRY_DELAY_MS = 250;

// Carry a safe request message plus status/retry information for loadPublicData.
// Server response bodies are not copied into user-facing error messages.
class PublicDataRequestError extends Error {
  // Keep the safe message and the information needed to decide whether a retry can help.
  constructor(message, { status = null, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

// Return the static screen definitions and explicit unavailable flags for operational data.
// Empty recall, repair and location lists are placeholders, not successful no-match answers.
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
    accessRequired: false,
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

// Join the configured API base with one endpoint path without a duplicate slash.
function apiUrl(baseUrl, endpoint) {
  return `${String(baseUrl || "").replace(/\/$/, "")}${endpoint}`;
}

// Read one JSON endpoint with a shared deadline and at most one transient-error retry.
// Authentication/configuration failures and malformed data are not silently retried as ordinary outages.
async function getJson(fetchImpl, url, signal) {
  let abortListener;
  // Bound both the network request and JSON body reading. The extra race also
  // handles a fetch adapter that fails to honour AbortSignal itself.
  const aborted = new Promise((_, reject) => {
    // Reject the deadline race even if a fetch adapter ignores the abort signal.
    abortListener = () => reject(new Error("Public data request timed out"));
    if (signal.aborted) abortListener();
    else signal.addEventListener("abort", abortListener, { once: true });
  });
  try {
    // Start the request/retry work now; the outer deadline race also bounds JSON body reading.
    const request = (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          let response;
          try {
            response = await fetchImpl(url, {
              method: "GET",
              headers: { Accept: "application/json" },
              credentials: "same-origin",
              cache: "no-cache",
              signal
            });
          } catch (error) {
            throw new PublicDataRequestError("Public data could not be reached", {
              retryable: !signal.aborted && error?.name !== "AbortError"
            });
          }
          if (!response.ok) {
            // Access configuration failures require server attention, while an
            // expired session needs a fresh visit to /login. Retrying either
            // cannot restore access. Do not expose server error details.
            let accessUnavailable = false;
            if (response.status === 503 && typeof response.json === "function") {
              try { accessUnavailable = (await response.json())?.error?.code === "access_unavailable"; } catch { /* An upstream error may have no JSON body. */ }
            }
            throw new PublicDataRequestError(`Public data request failed (${response.status})`, {
              status: response.status,
              retryable: RETRYABLE_STATUSES.has(response.status) && !accessUnavailable
            });
          }
          // Malformed JSON/data is not a transient transport failure.
          return await response.json();
        } catch (error) {
          if (attempt > 0 || !error?.retryable || signal.aborted) throw error;
          await waitForRetry(signal);
        }
      }
    })();
    return await Promise.race([request, aborted]);
  } finally {
    signal.removeEventListener("abort", abortListener);
  }
}

// Wait briefly before a retry, but stop immediately if the overall request has been cancelled.
function waitForRetry(signal) {
  return new Promise((resolve, reject) => {
    // Cancel the short retry wait and remove its listener when the shared deadline expires.
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Public data request timed out"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, RETRY_DELAY_MS);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

// Start the four independent dataset reads and return them under stable dataset names.
function endpointTasks(config, fetchImpl, signal) {
  const e = config.endpoints;
  return {
    recalls: getJson(fetchImpl, apiUrl(config.baseUrl, e.recalls), signal),
    sources: getJson(fetchImpl, apiUrl(config.baseUrl, e.sources), signal),
    repairEvidence: getJson(fetchImpl, apiUrl(config.baseUrl, e.repairEvidence), signal),
    locations: getJson(fetchImpl, apiUrl(config.baseUrl, e.locations), signal)
  };
}

// Small row-shape helpers distinguish objects, nonempty text and supported record IDs.
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validId(value) {
  return hasText(value) || (typeof value === "number" && Number.isFinite(value));
}

// Check each dataset's required fields before the UI can rely on a row.
// Repair outcome counts must add up to their recorded sample size.
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

// Extract a complete validated dataset and metadata, or reject the whole response.
// Dropping only a malformed recall row could hide a match, so partial row filtering is unsafe.
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
// Load public datasets independently and return values, source metadata and per-dataset status.
// A failed recall request leaves recall checking unavailable while static safety questions still work.
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
    // Keep each dataset's success/failure instead of failing the whole page together.
    const results = await Promise.allSettled(DATASET_NAMES.map((name) => tasks[name]));
    const output = { ...base, mode: "backend", errors: {}, availability: { ...base.availability }, apiAvailability: { ...base.apiAvailability }, datasetMeta: { ...base.datasetMeta } };

    DATASET_NAMES.forEach((name, index) => {
      const result = results[index];
      if (result.status === "rejected") {
        output.errors[name] = result.reason instanceof Error ? result.reason.message : "Unavailable";
        // A 401 needs sign-in recovery; it must not appear as a successfully empty dataset.
        if (result.reason?.status === 401) output.accessRequired = true;
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
