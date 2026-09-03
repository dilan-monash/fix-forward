// The backend and frontend are served from the same origin in Iteration 1.
export const DATA_API_CONFIG = Object.freeze({
  // The Flask server hosts both the frontend and these same-origin endpoints.
  enabled: true,
  baseUrl: "",
  timeoutMs: 6000,
  endpoints: Object.freeze({
    recalls: "/api/recalls",
    sources: "/api/sources",
    repairEvidence: "/api/repair-evidence",
    locations: "/api/locations"
  })
});
