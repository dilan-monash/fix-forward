# FixForward Iteration 1 — Acceptance Results

Run date: 1 September 2026  
Command: `npm.cmd run check`  
Result: **49 frontend checks passed, 0 failed**

Scope: frontend UI, browser-side decision rules and static error pages only. Backend, database, live-data integration and deployment are deferred.

## Plan acceptance criteria

| Story | Scenarios verified | Result |
|---|---|---|
| US1.1 Manual Appliance Selection | Exactly six families and mapped categories; no Brand or Model fields | Pass |
| US2.1 Recall Check | Possible official match; no match with limitation; insufficient identifying details; banner carried forward | Pass |
| US2.2 Safety Warning Assessment | Ten plain-language warning topics; High Risk; all No; Not Sure; recall notification retained | Pass |
| US2.3 Safety & Recall Guidance | Recall + High Risk; recall + no warning; no recall + High Risk; no recall + no warning; safety limitation | Pass |
| US3.1 Cost Input | Both valid; missing repair quote; missing replacement estimate; negative/non-numeric/zero invalid | Pass |
| US3.2 Cost Comparison | Side-by-side result; repair lower; replacement lower; equal; transparent formula | Pass |
| US4.1 Professional Assessment & Repair | Safety hard stop; repair pathway; no-local-data wider-search fallback | Pass |
| US4.2 Replacement & Disposal | Replacement path; user-chosen disposal; disposal not forced; recall guidance precedes disposal | Pass |

## Required branch inputs

| Branch | Test input | Expected result | Result |
|---|---|---|---|
| Recall | Heating and simple cooking → Kettle; KitchenAid; 5KEK1722AER | Possible match, official notice, persistent banner, no cost route | Pass |
| High Risk | Any listed sign = Yes | Stop use, professional assessment, no cost route | Pass |
| Not Sure | Any listed sign = Not sure and none = Yes | Uncertain, professional assessment, no cost route | Pass |
| No Match | Family/category with no indexed category match | Approved limitation wording; safety continues | Pass |
| Category-only recall | Heating and simple cooking → Kettle | Possible category-level match; official verification required | Pass |
| Recall data unavailable | `/?mock-data-error=1` | Frontend mock error shows official-search fallback and blocks the journey | Pass |
| No local service data | Area = Other / no local data | No invented provider; wider official/current search | Pass |
| Error input | Missing, negative, non-numeric, zero or >2-decimal cost | Clear inline error; no calculation | Pass |
| Cost outcomes | 180/320; 500/320; 250/250 | Repair lower; replacement lower; equal | Pass |

## Privacy, security and accessibility checks

- No file/image controls, barcode controls, account/login UI, geolocation, analytics, cookies or storage API calls.
- No authentication fields, auth routes or user-profile data structures; no profile is created or stored.
- The backend adapter is disabled by default, makes zero requests in static mode, uses GET without request bodies when enabled, and falls back to fixtures on failure.
- The current frontend performs no API request. Appliance details, safety answers, costs and area remain in page memory.
- Restart recreates an empty in-memory state; refresh naturally clears the module state.
- Native form controls, fieldsets/legends, labels, skip link, visible focus styles, 48 px controls, reduced-motion support and mobile single-column rules are present.
- Responsive CSS, source labels, conditional ordering and frontend scope boundaries pass static tests.
- Friendly 404 and non-sensitive 500 page designs are included; HTTP status behavior belongs to the future backend/hosting layer.

## Environment note

The in-app browser connection was unavailable in this environment. Mobile/desktop layout and keyboard accessibility were therefore verified by automated source-level checks, not an interactive browser screenshot pass. The app can be previewed with VS Code Live Server or `python -m http.server 4173`.
