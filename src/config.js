// Keep disabled until the FixForward backend and public database are ready.
// Switching `enabled` to true is the only frontend configuration change needed.
export const DATA_API_CONFIG = Object.freeze({
  enabled: false,
  baseUrl: "",
  timeoutMs: 6000,
  endpoints: Object.freeze({
    recalls: "/api/recalls",
    sources: "/api/sources",
    repairEvidence: "/api/repair-evidence",
    locations: "/api/locations"
  })
});
