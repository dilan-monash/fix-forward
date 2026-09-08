# FixForward v1.6 usability-lab prototype — Integration Notes

This candidate builds on v1.5 but changes several behaviors requested during the latest usability review. It is intentionally **not the final assessed scope**.

## Main changes from v1.5

- **Not sure no longer ends the safety questionnaire.** The user answers the remaining relevant questions from what they already know.
- The separate **I'm not able to check this safely** control remains the explicit early-exit path.
- Any critical Yes still wins over mixed No/Not sure answers.
- Serious-warning results now include a controlled recycling/disposal-planning option with a warning not to transport hot, smoking, leaking or actively damaged appliances.
- Clear Repair flow now opens a hub with **Find repair options** and **Estimate & compare costs**.
- Manual location search now provides postcode/suburb autocomplete; typing a prefix such as `312` can suggest matching postcode/suburb pairs.
- Autocomplete supports keyboard selection and ARIA active-option state.
- The in-app map now has an eight-second dependency timeout so a stalled CDN cannot leave users staring at “Loading map…” indefinitely.
- Brand/model/problem/location/money inputs have explicit length/character/sanity validation.
- The smart cost screen follows a low-friction repair-or-replace pattern, but it does not claim unsupported AI/model-price capability.
- A typed model is labelled **not price-verified** until a governed product catalogue exists.
- Published repair-service fees are shown as **separate examples**, not combined into an artificial `$99–$229` repair range.
- Replacement pricing remains unavailable until a trustworthy current model/comparable-product source is approved.

## Data compatibility

No new user-data table is introduced.

Existing public datasets still provide:

- recall records/identifiers;
- repair evidence;
- service locations and coordinates;
- source metadata.

`src/suburbs.js` is a client-side lookup index generated from the project's cleaned Victorian suburb/postcode data and restricted to the prototype Melbourne-area scope. It powers autocomplete and approximate selected-area coordinates without sending partial user queries to an external geocoding service.

The browser does **not** send device coordinates, safety answers, problem descriptions or cost values to Neon in the current design.

## Smart cost integration boundary

v1.6 does not call an external AI or live retailer search service. The current automatic result uses only:

- validated appliance details;
- deterministic fault grouping;
- two source-linked published repair-service pricing examples;
- an explicit “not enough verified replacement-price evidence” fallback.

A future live cost engine would require new adapters/contracts for:

- approved product identity catalogue;
- repair cost/quote evidence;
- replacement retail prices;
- optional AI/entity-resolution service;
- source freshness/licence/permission controls.

The project's no-web-scraping boundary remains unless formally changed.

## Scope compatibility warning

Earlier Iteration-1 artefacts documented a fixed journey and manual suburb selection. The following v1.6 behaviors are **experiments**, not silently approved requirements:

- goal-first landing/shortcuts;
- browser geolocation;
- different safety depth by goal/product;
- Not sure continuation behavior;
- caution-level cost planning;
- serious-warning recycling/disposal planning;
- smart cost check with commercial pricing examples;
- postcode/suburb autocomplete.

Before final I1 merge, BA/team/mentor must approve, defer or reject each change and update LeanKit, user stories, acceptance criteria, threat model, privacy notes and data-governance artefacts.

## External map dependency

Leaflet 1.9.4 is pinned with SRI hashes. OpenStreetMap tile requests occur only when a map is created for actual results. If the script fails or does not load within eight seconds, the map area falls back while the service-card list remains usable.

Production-scale use still needs a tile-provider/traffic/policy decision.

## Merge gate

Use `docs/DEPLOYMENT_CHECKLIST_V1.6.md`. Do not merge directly into `main` before:

- all 73 Node checks pass;
- complete Flask/backend suite passes in the team's `.venv`;
- local Neon readiness is verified;
- recall/safety mixed-answer scenarios are exercised;
- autocomplete mouse + keyboard behavior is checked;
- geolocation Allow/Deny/timeout is checked on HTTPS;
- map failure fallback is verified;
- smart cost source wording and all validation boundaries are checked;
- mobile/zoom/keyboard/screen-reader checks are completed;
- BA/mentor scope decisions are recorded.
