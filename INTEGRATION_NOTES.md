# FixForward v1.4 goal-first prototype — integration notes

This candidate builds on the v1.3 safety/reliability redesign and explores a stronger ordinary-household experience. It is intentionally **not final scope**.

## What changed from v1.3

- Landing page starts with user goals: Repair / Compare / Recycle / I'm not sure.
- Repair/Compare/Recycle go directly to the requested tool after a clear safety/recall gate.
- The safety/recall gate still overrides convenience when a serious warning or possible recall exists.
- “Product recall” is explained in simple language rather than assumed knowledge.
- Optional current-location mode calculates nearby results in the browser.
- In-app Leaflet/OpenStreetMap map shows service positions.
- Service cards lead with practical fields (distance/address/phone/hours/call/directions) rather than provenance labels.
- Verification/source detail is still available under `About this listing`.
- Repair-history context is visual and secondary to the service finder.
- Smart-cost UX is demonstrated without inventing automatic prices.

## Data compatibility

No new user-data table is introduced. Existing location columns already support latitude/longitude and optional provider/opening-hour fields through the existing migration set. `/api/locations` exposes those public fields so distance can be calculated locally.

The browser **does not send device coordinates to Flask or Neon**.

## Scope compatibility warning

The earlier I1 source-of-truth documented manual suburb selection/no device geolocation. v1.4 implements geolocation as an experimental response to teaching feedback and subsequent usability thinking. Before final I1 merge, record one of these decisions:

1. approve it for I1 and update LeanKit/AC/threat model/privacy evidence;
2. defer it to I2 and retain manual location in the final I1 branch;
3. reject it with documented rationale.

Do not let prototype code silently redefine the assessed scope.

## External map dependency

Leaflet 1.9.4 is pinned to the stable CDN release with official SRI hashes. OpenStreetMap tile images are requested only when the map is displayed. The response policy is `strict-origin-when-cross-origin` so browser tile requests can include the origin Referer expected by the OSM tile service. The text service list remains the functional fallback if the map fails.

For a production-grade handover, consider self-hosting the pinned Leaflet release and selecting a map tile service appropriate for expected usage.

## Test/merge gate

Use `docs/DEPLOYMENT_CHECKLIST_V1.4.md`. Do not merge directly into `main` before:

- full backend suite passes in the team `.venv`;
- Neon development branch contract is checked;
- geolocation allow/deny and network privacy are verified;
- map/CDN failure is tested;
- mobile/keyboard/browser Back are checked;
- BA/mentor scope decision is recorded.
