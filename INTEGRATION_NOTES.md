# FixForward v1.5 human-first prototype — integration notes

This candidate builds on the v1.4 goal-first prototype and applies another usability pass focused on ordinary household users. It is intentionally **not final assessed scope**.

## What changed from v1.4

- Repair / Compare / Recycle / Help me decide are visible immediately in the hero.
- Static landing and appliance definitions render immediately; public data loads in the background.
- Direct routes ask a short goal- and appliance-specific safety plan: Repair up to 4, Compare up to 3, Recycle up to 2; guided Help me decide up to 5.
- A Yes/Not sure answer can end the check early; users are not forced to inspect the appliance further.
- Added **I'm not able to check this safely**.
- Every safety question has plain-language help, a pictogram, a concrete example and a do-not-test warning.
- Water/moisture ingress remains a serious stop-use result under the conservative I1 safety baseline; heat/power warnings remain differentiated caution cases.
- Repair history is a stacked outcome visual shown after practical map/list results.
- Service cards lead with useful fields and actions; provenance remains under **About this listing**.
- The map/CDN is not loaded until there are useful results to plot.
- Uncertain recycling can continue to contact-first facility listings, while serious/high-risk cases still cannot enter ordinary service/cost routes.
- Appliance changes clear stale safety/decision/cost-result state.
- The cost page leads with the usable manual comparison and does not invent automatic model prices.

## Data compatibility

No new user-data table is introduced. Existing location columns support latitude/longitude and optional provider/opening-hour fields. `/api/locations` exposes those public fields so distance can be calculated locally.

The browser **does not send device coordinates to Flask or Neon**. Safety answers, typed costs and appliance selections also remain client-side in the current design.

## Scope compatibility warning

The earlier I1 source of truth documented manual suburb selection/no device geolocation and a fixed safety flow. v1.5 contains prototype scope changes based on teaching feedback and usability reasoning:

- goal-first shortcuts;
- browser geolocation;
- different safety depth by goal/product;
- early stop after a decisive Yes/Not sure;
- cautious contact-first recycling after uncertainty.

Before final I1 merge, the BA/team/mentor must explicitly approve, defer or reject these changes and update LeanKit, acceptance criteria, threat model and privacy evidence. Prototype code must not silently redefine assessed scope.

## External map dependency

Leaflet 1.9.4 is pinned with SRI hashes. OpenStreetMap tile requests occur only when a result map is actually created. The service list remains the functional fallback if the map/CDN fails.

For production-scale use, review tile-provider terms/expected traffic and consider self-hosting the pinned Leaflet files or using an appropriate managed tile service.

## Test/merge gate

Use `docs/DEPLOYMENT_CHECKLIST_V1.5.md`. Do not merge directly into `main` before:

- all JavaScript checks pass;
- complete backend suite passes in the team's `.venv`;
- Neon development branch contract is checked;
- direct and guided safety routes are manually exercised;
- BVC 160 / BVC 161 / recall-outage behavior is retested;
- geolocation Allow/Deny/timeout and browser network/storage behavior are verified;
- map load and forced map failure are tested;
- mobile, 200% zoom, keyboard, screen-reader spot checks and browser Back are completed;
- BA/mentor scope decisions are recorded.
