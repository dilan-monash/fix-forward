# FixForward Iteration 1 — Acceptance Results

Run date: 4 September 2026

Command: `npm run check`

Result: **55 frontend checks passed, 0 failed**

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
| US4.1 Professional Assessment & Repair | Safety hard stop; repair pathway; category evidence; insufficient-evidence fallback; no-verified-location wider-search fallback | Pass |
| US4.2 Replacement & Disposal | Replacement path; user-chosen disposal; disposal not forced; recall guidance precedes disposal | Pass |

## Required branch inputs

| Branch | Test input | Expected result | Result |
|---|---|---|---|
| Recall | Heating and simple cooking → Kettle | Possible category-level match, official notice, persistent banner, no cost route | Pass |
| High Risk | Any listed sign = Yes | Stop use, professional assessment, no cost route | Pass |
| Not Sure | Any listed sign = Not sure and none = Yes | Uncertain, professional assessment, no cost route | Pass |
| No Match | Family/category with no indexed category match | Approved limitation wording; safety continues | Pass |
| Category-only recall | Heating and simple cooking → Kettle | Possible category-level match; official verification required | Pass |
| Recall data unavailable | `/?mock-data-error=1` | Frontend mock error shows official-search fallback and blocks the journey | Pass |
| Repair evidence unavailable | Any category without approved mapped statistics | No invented outcome or percentage; insufficient-evidence wording and source limitations | Pass |
| No verified local service data | Brunswick, Footscray or Other | No unverified candidate presented as a recommendation; wider official/current directory | Pass |
| Error input | Missing, negative, non-numeric, zero or >2-decimal cost | A distinct inline explanation identifies the exact problem; no calculation | Pass |
| Cost outcomes | 180/320; 500/320; 250/250 | Repair lower; replacement lower; equal | Pass |

## Privacy, security and accessibility checks

- No file/image controls, barcode controls, account/login UI, geolocation, analytics, cookies or storage API calls.
- No authentication fields, auth routes or user-profile data structures; no profile is created or stored.
- The backend adapter is disabled by default, makes zero requests in static mode, uses GET without request bodies when enabled, and falls back to fixtures on failure.
- The current frontend performs no API request. Appliance details, safety answers, costs and area remain in page memory.
- Repair outcomes and barriers use raw counts only. Missing category mappings show an insufficient-evidence state and never generate a repairability score or quote.
- Location results require an explicit verified flag; the current unverified directory candidates are not shown as recommendations.
- Restart recreates an empty in-memory state; refresh naturally clears the module state.
- Native form controls, fieldsets/legends, labels, skip link, visible focus styles, 48 px controls, reduced-motion support and mobile single-column rules are present.
- Responsive CSS, source labels, conditional ordering and frontend scope boundaries pass static tests.
- Friendly 404 and non-sensitive 500 page designs are included; HTTP status behavior belongs to the future backend/hosting layer.

## Environment note

The No Match → all No → Explore Repair journey was interactively verified on localhost in the in-app browser. The repair evidence card, insufficient-evidence state and no-verified-location fallback were checked at desktop and 390 px mobile widths. No browser console warnings or errors were reported. The app can be previewed with VS Code Live Server or `python -m http.server 4173`.
