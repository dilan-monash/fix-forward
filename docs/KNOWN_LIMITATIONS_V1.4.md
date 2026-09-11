# Known limitations — FixForward v1.4 goal-first prototype

These are deliberate truthfulness boundaries.

1. **Recall coverage is not complete.** Exact-model logic exists, but the reviewed product index is intentionally small. Official Product Safety information remains authoritative.
2. **A no-match is not safety clearance.** The UI always says the current list did not contain an exact match; it does not say “not recalled” or “safe.”
3. **Service listings are leads, not guarantees.** Provider details may be incomplete or out of date. Qualification, opening status and appliance acceptance must not be inferred when the source does not prove them.
4. **Current location is experimental.** It is implemented browser-locally for usability testing but conflicts with the earlier manual-location I1 baseline. Mentor/BA/security approval is required before final inclusion. Exact coordinates are not sent to FixForward/Neon, but OpenStreetMap receives map-tile requests for the area displayed.
5. **Distance is straight-line distance.** It is not travel time or road distance.
6. **Map availability depends on third parties.** Leaflet 1.9.4 is loaded from a pinned CDN and map tiles come from OpenStreetMap. The service list still works if the map cannot load. The final deployment must continue to satisfy the OSM tile usage/attribution rules.
7. **No genuine service photos are included.** The current open data does not provide a governed photo source. FixForward does not scrape or invent photos.
8. **Automatic model-level cost estimates are not enabled.** The available category retail snapshot is too small/concentrated and does not provide model-level repair pricing.
9. **AI/fuzzy matching must not become a price generator.** It may eventually help resolve a misspelled product identity; a dollar result still needs evidence.
10. **Repair history is category-level and self-selected.** It is descriptive evidence, not a personal prediction.
11. **No saved history.** Journey state disappears with the tab/restart and is not persisted to accounts, cookies or local storage.
12. **Live deployment remains a gate.** Automated tests do not prove Render cold-start behavior, external map loading, browser geolocation permissions or live Neon reliability.
