// API connection settings read by data-service.js; app.js does not build its own dataset URLs.
// The empty baseUrl means the page and Flask endpoints share the same origin and access session.
// enabled selects API loading; timeoutMs bounds the batch; endpoints maps dataset names to GET routes.
// The backend and frontend are served from the same origin in Iteration 1.
export const DATA_API_CONFIG = Object.freeze({
  // The Flask server hosts both the frontend and these same-origin endpoints.
  enabled: true,
  baseUrl: "",
  timeoutMs: 30000,
  endpoints: Object.freeze({
    recalls: "/api/recalls",
    sources: "/api/sources",
    repairEvidence: "/api/repair-evidence",
    locations: "/api/locations"
  })
});
