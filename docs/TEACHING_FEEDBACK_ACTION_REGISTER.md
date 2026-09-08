# FixForward Iteration 1 — Teaching & Usability Feedback Action Register

Version: **1.6.0 usability-lab prototype**  
Status: **prototype — requires live verification and formal scope decisions**

## Release principle

Feedback is not treated as closed merely because code or wording changed. An item becomes **Closed** only after the named evidence is captured against the exact deployed commit/release.

## Teaching-team feedback

| ID | Feedback | v1.6 decision / implementation | Status | Evidence to capture |
|---|---|---|---|---|
| T01 | Add comments to code | Data loading, recall logic, safety rules, validation, map timeout and privacy logic contain intent comments. | Implemented | Git diff / code review |
| T02 | Pair programming observations | Pair-programming observation template included. | Process action | Completed observations / PR review |
| T03 | Clickable dataset links | Source/about panels expose original links when the source register provides them. | Implemented | Live About/source screenshot |
| T04 | Detailed data wrangling | Cannot reconstruct missing historical ETL evidence from UI code alone; data owner must document real pipeline. | Open | Wrangling document + reproducible scripts |
| T05 | Which function uses each dataset | Architecture/API docs map browser functions to public endpoints and source types. | Implemented in docs | Architecture review |
| T06 | Backup and recovery detail | Deployment checklist keeps Neon backup/restore evidence as a release gate. | Open | Neon backup/restore screenshots/tests |
| T07 | Move DMP to Data Governance | External PGP structure must be changed by team. | PGP action | PGP folder screenshot |
| T08 | Architecture difficult to read | Separate system, safety, location and cost flows are documented. | Implemented in docs | Exported diagram/PDF |
| T09 | New architecture per iteration | Historical v1.3–v1.5 docs are kept; v1.6 is a new candidate rather than overwriting history. | Implemented process | Versioned artefacts |
| T10 | Secure Architecture section | Updated `SECURE_ARCHITECTURE_I1.md` for v1.6 trust boundaries. | Implemented in docs | Security review |
| T11 | Existing controls vs improvements | Security document separates current controls from pre-release verification. | Partially implemented | Signed security-test evidence |
| T12 | Small penetration tests on real site | Safe pentest log template + preview checklist included. No destructive testing. | Ready for execution | Tool/test/result capture |
| T13 | Proper landing page | Goal-first Repair / Compare / Recycle / I'm not sure landing with plain value statement. | Implemented in prototype | Desktop/mobile screenshots + human retest |
| T14 | Alphabetical devices | Categories are sorted inside selected family. | Implemented | UI screenshot |
| T15 | Back from questionnaire | Dedicated Back controls + browser history/popstate. | Implemented | E2E/video |
| T16 | Lock category until family | Category stays locked until family selected. | Implemented | UI screenshot |
| T17 | Spaces/slashes/exact model | Normalisation handles formatting; UI asks for full model and explains where to find it. | Implemented | R02/R04 tests |
| T18 | Family-dependent safety | Product-specific applicability/priority rules; battery/water/heat questions only where relevant. | Implemented foundation | Safety-rule review |
| T19 | Safety answers too obvious | Critical/caution/uncertain outcomes are differentiated; each question has an explanation/help visual. | Implemented | Human usability retest |
| T20 | Auto suburb from location | Optional geolocation sorts public services locally; exact coordinates stay browser-memory only; manual search remains. Older I1 manual-only rule means approval is still required. | Experimental | Network/storage proof + scope decision |
| T21 | Melbourne-only location scope | Melbourne-focused UI; generated Melbourne-area suburb/postcode index supports manual lookup. | Implemented in prototype | Dataset/scope review |
| T22 | Recommendations inside FixForward | In-app result cards + map; address/phone/hours/actions first, provenance expandable. | Implemented | Live service/map test |
| T23 | User friendliness weak | Human-first hierarchy, short copy, goal-first path, practical actions before evidence. | Implemented | Human usability retest |
| T24 | Missing model character | Near/one-character model never becomes exact recall match. | Implemented | R04 test |
| T25 | “Strong possible match” wording | Plain wording: “Your model may be affected by a product recall”, with recall explanation. | Implemented | Recall screenshot |
| T26 | Add images | Purpose-built illustration/iconography and safety pictograms; no unnecessary trackers. | Implemented | Screenshot |
| T27 | Explain “arcing” | Technical term removed from main journey; “shock, sparks or damaged wires” + help example. | Implemented | Safety screenshot |
| T28 | Review “any Yes = high” | Critical Yes = serious stop-use; caution signs use a distinct assessment route. A critical Yes wins even when other answers are No. | Implemented | S01/S02/mixed-answer tests |
| T29 | Inconsistent official guidance | Recall uses Product Safety/ACCC official notice; electrical safety route links to Energy Safe Victoria. | Implemented | Link audit |
| T30 | Bland / more engaging | Responsive green/cream UI, visual goal cards, stacked evidence chart and map/result experience. | Implemented | Mentor review |
| T31 | Repair evidence static | Horizontal stacked outcome visual with counts/percentages below practical repair actions. | Implemented | Repair-hub screenshot |
| T32 | Choose action on landing | Repair / Compare / Recycle / I'm not sure are primary entry points; redundant later “choose” screen removed for direct intents. | Implemented in prototype | Goal-first E2E test |
| T33 | Identify → Educate → Action | v1.6 retains identify + quick education/safety but starts with user intent and ends at practical action. | Experimental refinement | Mentor/usability decision |
| T34 | Input character limits | Brand 60, model 50, problem 300, area 50, money field 10 chars plus logic bounds. | Implemented | V/C tests + manual boundary checks |
| T35 | Emphasise repair/recycle | Repair and recycling are first-class landing actions and post-cost actions. | Implemented | UI walkthrough |
| T36 | Persona pivot | No silent persona change; remains metro-Melbourne household audience unless research/mentor approves otherwise. | Decision required | Mentor minutes |
| T37 | LeanKit specificity/ownership | v1.6 user stories/AC are supplied for board alignment; actual LeanKit update remains team action. | Process action | LeanKit export/screenshot |

## Usability-test feedback and v1.6 follow-up

| ID | Observation | v1.6 response |
|---|---|---|
| U01 | Site failed before Safety | Static first screen + independent dataset loading; recall failure does not block safety. |
| U02 | Homepage confusing | Goal-first landing explains the job in one sentence. |
| U03 | Need onboarding | Four goal cards are lightweight onboarding; no forced tour. |
| U04 | Recall appeared generic | Category-scoped exact-model logic + conservative no-match. |
| U05 | User cannot find model number | “Where can I find it?” guidance without opening/removing screws. |
| U06 | ACCC redirect confusing | Explain why official verification is needed and what a recall means. |
| U07 | Back navigation unclear | Dedicated Back + browser Back. |
| U08 | Recalled item continuing | Recall takes priority over ordinary cost/repair/recycling. |
| U09 | Safety logic unclear | Appliance-specific questions, help/pictograms, critical/caution/uncertain states. |
| U10 | “Choose next action” redundant | Direct intents skip the redundant choice screen; guided intent retains options. |
| U11 | Previous-result history requested | Deferred to preserve I1 no-history privacy design. |
| U12 | Journey too wordy | Short action copy; evidence/provenance in expandable detail. |
| U13 | Manual cost comparison low value | Smart-cost interaction added, with source-linked published examples and manual real-price comparison fallback. No invented model price. |
| U14 | Repair evidence looks like research report | Stacked visualization moved below repair-location/cost actions. |
| U15 | “Not sure” stopped too early | **Fixed in v1.6:** Not sure does not stop remaining questions; explicit unable-to-check remains separate. |
| U16 | Mixed Yes/No gave confusing same message | Critical Yes always triggers serious route; caution Yes has different wording; Not sure without critical Yes becomes uncertain. |
| U17 | Serious result becomes dead end | Controlled recycling/disposal planning added with strong active-damage transport caution. |
| U18 | Repair user also wants cost | Repair hub offers **Find repair options** and **Estimate & compare costs** after a clear check. |
| U19 | Location typing should suggest areas | Local postcode/suburb autocomplete; `312` prefix can show matching postcode/suburb pairs. |
| U20 | Keyboard user cannot operate autocomplete | Arrow Up/Down, Enter, Escape, `aria-activedescendant`, selected option state. |
| U21 | Map can hang on loading | Eight-second dependency timeout; service list remains usable. |
| U22 | Inputs can accept nonsense/huge values | Added brand/model/problem/area/money validation and length/sanity limits. |
| U23 | Automatic quote should feel fast | Smart-cost screen uses short problem description + evidence level, inspired by low-friction repair/replace tools. Exact model is not falsely price-verified. |
| U24 | Published fees could look like one market range | **Fixed:** different provider/service models are displayed as separate price examples, not a combined `$99–$229` repair estimate. |

## Highest-priority live verification before mentor demo

1. Deploy only to a **non-production preview** branch such as `feature/i1-usability-lab-v1.6`.
2. Confirm cold-start landing appears immediately while public data loads in background.
3. Exercise Repair / Compare / Recycle / I'm not sure from a fresh session.
4. Verify BVC 160 possible recall; BVC 161 remains near/no exact match.
5. Simulate recall-data failure and verify safety still works.
6. Test critical Yes + multiple No; caution Yes + No; Not sure + remaining questions; all Yes; unable-to-check.
7. Verify critical result can never show community Repair Café or normal cost comparison.
8. Verify critical-result recycling shows the active-damage no-transport warning.
9. Type `312` and suburb prefixes; test autocomplete by mouse and keyboard.
10. Test Use my current location Allow/Deny/timeout; confirm manual fallback.
11. Inspect Network/Storage for exact coordinates and journey answers.
12. Confirm map failure/hang falls back after bounded wait without losing service cards.
13. Verify service cards put practical address/contact/directions before provenance.
14. Verify smart cost examples are two separate source-linked signals and no replacement price is invented.
15. Boundary-test brand/model/problem/area/money fields.
16. Test mobile 360/390/768, desktop 1280+, 200% zoom, keyboard-only and screen-reader spot checks.
17. Record formal scope decisions for geolocation, goal-specific safety depth, caution-cost planning, hazard-disposal planning, autocomplete and smart-cost data use.
18. Capture evidence against the exact commit before marking any row Closed.
