# Known Limitations - FixForward v1.3 redesign

These are deliberate truthfulness boundaries, not hidden defects.

1. **Recall coverage is limited.** The architecture supports exact-model screening, but the curated reviewed index is not a complete Australian recall database. ACCC remains authoritative.
2. **No professional repair directory.** Hazardous/uncertain appliances therefore receive guidance rather than an unverified community Repair Cafe card.
3. **Melbourne location matching is exact suburb/postcode text matching, not nearest-distance search.** The current location schema does not include coordinates.
4. **Automatic geolocation is not implemented.** Browser geolocation is intentionally disabled until the data/privacy design can convert coordinates to an approved locality without adding unnecessary tracking or an unapproved third-party service.
5. **No saved history.** I1 intentionally stores no assessment history. Adding history would change the privacy/security scope.
6. **Cost comparison remains a manual fallback.** The supplied repository does not contain a governed, diverse replacement-price dataset sufficient for a defensible market benchmark.
7. **Repair evidence is category-level and self-selected.** It is descriptive historical evidence, not a personal repairability prediction.
8. **Some repair-evidence category mappings are broad.** The UI now labels broad mappings rather than presenting them as exact evidence.
9. **Live reliability still needs deployment evidence.** Local unit/contract tests do not prove Render/Neon production behavior.
