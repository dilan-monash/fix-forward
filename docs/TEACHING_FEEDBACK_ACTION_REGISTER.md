# FixForward Iteration 1 - Teaching & Usability Feedback Action Register

Version: 1.5.0-human-first prototype
Status: usability prototype - requires scope decision and live Render/Neon verification

## Release principle

Feedback is not treated as closed merely because text or code changed. A feedback item is **Closed** only after the named evidence is captured against the deployed release.

## Teaching-team feedback

| ID | Feedback | Decision / implementation | Status | Evidence to capture |
|---|---|---|---|---|
| T01 | Add comments to code | New data loading, recall logic, safety rules, liveness/readiness and privacy logic include intent comments. | Implemented | Git diff / code review |
| T02 | Pair programming observations | Added pair-programming observation template. | Process action | Completed observation sheets / PR reviews |
| T03 | Clickable dataset links | Sources dialog presents clickable source links when provided by the governed source register. | Implemented | Live Sources dialog screenshot |
| T04 | Detailed data wrangling | Not enough raw ETL scripts/data were present in this ZIP to reconstruct wrangling honestly. Requires data owner completion. | Open | Data wrangling document + scripts |
| T05 | Which function uses each dataset | Architecture document maps dataset -> backend query -> endpoint -> UI function. | Implemented in docs | Architecture review |
| T06 | Backup and recovery detail | Deployment checklist identifies Neon backup/restore evidence still required. | Open | Neon screenshot + tested restore/rollback procedure |
| T07 | Move DMP into Data Governance | Repository packaging cannot move an external PGP artefact not present in the ZIP. | PGP action | PGP folder screenshot |
| T08 | Architecture difficult to read | New per-iteration architecture document uses separate system/data/security views. | Implemented in docs | Exported diagram/PDF |
| T09 | New architecture per iteration | I1 architecture version created; copy/version for I2/I3 rather than overwriting. | Implemented process | I1/I2/I3 files |
| T10 | Secure Architecture section/diagram | Added `SECURE_ARCHITECTURE_I1.md`. | Implemented in docs | Security review |
| T11 | Show scores and controlled vs improvable | Security document should record current control and residual improvement separately; action register reinforces this. | Partially implemented | Updated security testing document |
| T12 | Small penetration tests on real site | Added safe pentest log template and live-release checklist. Do not run destructive tests. | Ready for execution | Tool/test/result captures |
| T13 | Proper landing page | Goal-first landing page starts with Repair / Compare / Recycle / I'm not sure and explains the value before asking for appliance details. | Implemented in prototype | Desktop/mobile screenshots + usability retest |
| T14 | Alphabetical devices | Categories sort alphabetically inside the selected family. | Implemented | UI screenshot |
| T15 | Back from questionnaire | Dedicated Back buttons + browser history/popstate support. | Implemented | E2E test/video |
| T16 | Lock category until family | Category panel is visibly locked until a family is selected. | Implemented | UI screenshot |
| T17 | Model spaces/slashes/exact matching | Identifier normalisation ignores formatting; UI says complete model identifier is required. | Implemented | Unit tests R02/R04 |
| T18 | Family-dependent safety questions | Applicability rules remove battery/water/heat prompts where they are not relevant. | Implemented foundation | Product-owner review of rule table |
| T19 | Safety questions too obvious | Added short plain-language explanation for *why* each warning matters; critical vs caution severity prevents binary oversimplification. | Implemented | Usability retest |
| T20 | Auto suburb from location | v1.5 prototype uses browser geolocation and existing service coordinates. Coordinates remain in browser memory; manual suburb/postcode remains available. This conflicts with the earlier manual-only I1 baseline, so formal approval is still required. | Experimental | Network/privacy evidence + mentor/BA scope decision |
| T21 | State Melbourne-only location scope | Service screen says Melbourne-focused. Manual search is area-based; current-location mode sorts by straight-line distance. | Implemented in prototype | UI screenshot |
| T22 | Show recommendations in FixForward | In-app map + service cards show location, distance, phone/hours when present, Call, Directions and Website. Provenance is moved into an expandable detail. | Implemented in prototype | Live map/service test |
| T23 | User friendliness weak | Redesigned visual hierarchy, landing page, shorter copy, status chips, cards, contextual guidance. | Implemented | Usability retest |
| T24 | Missing model character behavior | One-character differences are never promoted to exact recall match; UI warns user to re-check label. | Implemented | R04 test |
| T25 | 'Strong possible match' wording | Main user wording is now 'Your model may be affected by a product recall' and explains what a recall means. Technical match detail is secondary. | Implemented | Recall screenshot |
| T26 | Add images | Added purpose-built visual decision-loop illustration and richer iconographic pathway cards without external trackers/assets. | Implemented | Landing screenshot |
| T27 | Explain terminology like arcing | Removed the jargon from the main question. The user sees 'shock, sparks or damaged wires' and can open a plain-language example panel. | Implemented | Safety screenshot |
| T28 | Any Yes => high risk | Uses a differentiated severity model: serious signs (including burning, shock/sparks, badly damaged plug/cord, water ingress and damaged battery where relevant) stop the ordinary route; heat/power warnings use cautious assessment guidance. Not every Yes is identical. | Implemented | S01/S02 tests |
| T29 | Inconsistent official guidance | Recall result uses official ACCC notice/search; professional safety uses Energy Safe Victoria/ACCC. | Implemented | Link audit |
| T30 | Bland / more engaging | Full green/cream visual system, visual landing hero, cards, status UI and responsive layout. | Implemented | Mentor review |
| T31 | Repair evidence static | Added a horizontal stacked outcome visual with counts/percentages, placed after the map/service results; source/sample limitations remain expandable. | Implemented | Repair-path screenshot |
| T32 | Choose next action on landing | Landing page now makes Repair / Compare / Recycle / I'm not sure the primary entry points. After a clear safety gate, Repair/Compare/Recycle route directly to the requested tool. | Implemented in prototype | Goal-first E2E test |
| T33 | Identify -> Educate -> Action | v1.5 keeps identify + education/safety, but starts with user intent and reduces the progress model to Your appliance -> Quick safety check -> Your options. | Experimental refinement | Mentor/usability review |
| T34 | Repair quote character limits | Cost fields use maxlength=12 and numeric validation/upper sanity bound. | Implemented | Validation test |
| T35 | Emphasise repair/recycle | Landing, impact band and pathway cards make repair/recycling primary product value. | Implemented | UI walkthrough |
| T36 | Persona pivot | Not a code decision. Keep metropolitan Melbourne households unless mentor formally approves a scope/persona change. | Decision required | Mentor minutes |
| T37 | LeanKit epic ownership/specificity | Requires LeanKit update outside this ZIP. Architecture/journey wording can now be copied directly into epics/AC. | Process action | LeanKit screenshot/export |

## Usability-test feedback

| ID | Observation | Response |
|---|---|---|
| U01 | Site failed before Safety page | Immediate loading state + independent dataset loading; recall failure no longer blocks static safety screening. |
| U02 | Homepage confusing | Goal-first landing explains FixForward in one sentence and lets the user immediately choose Repair / Compare / Recycle / I'm not sure. |
| U03 | Need onboarding | Landing's four decision cards act as lightweight onboarding; a forced tour was avoided to reduce journey length. |
| U04 | Recall looked identical across categories | Category-scoped model matching remains enforced; exact model matching is model-first within chosen category. |
| U05 | User does not know model location | Added 'Where can I find it?' guidance without telling user to open the appliance. |
| U06 | ACCC redirect confusing | Recall page explains why official verification is required and labels ACCC as authoritative. |
| U07 | Back navigation unclear | Dedicated Back buttons + browser Back support. |
| U08 | Recalled item continuing | Recall banner/pathway remains priority; ordinary cost path is hidden when a possible recall is active. |
| U09 | Safety logic unclear | Critical vs caution severity + explanations + tailored applicability. |
| U10 | 'Choose next action' unclear | Removed as a redundant step for users who already selected Repair/Compare/Recycle on the homepage. Only the “I'm not sure” journey uses the options screen. |
| U11 | Previous-result history requested | Deferred to future scope because I1's privacy contract intentionally stores no journey history. Do not silently introduce persistence. |
| U12 | Journey too wordy | Shorter cards and summaries; detailed evidence moved into expandable `<details>`. |
| U13 | Manual cost comparison low value | v1.5 shows the planned smart product-resolution/evidence flow and keeps manual comparison only as a fallback. It explicitly refuses AI-invented dollar values until governed price evidence exists. |

## Highest-priority live verification before mentor demo

1. Deploy this candidate to a **non-production** Render preview from a dedicated v1.5 preview branch such as `feature/i1-human-first-v1.5`.
2. Confirm the human-first landing appears immediately on a cold start while public data loads in the background.
3. Test all four landing choices: Repair, Compare, Recycle and I'm not sure.
4. Verify BVC 160 produces a possible recall and BVC 161 is never promoted to an exact match.
5. Simulate/observe recall-data failure and verify the plain-language safety check still works.
6. Verify a burning/smoke/shock/sparks/water-ingress/other serious result can **never** show a community Repair Cafe or cost comparison.
7. With explicit permission, test **Use my current location** on HTTPS; confirm nearest sorting, 5/10/25/50 km filters and map pins.
8. Deny location permission and confirm manual suburb/postcode search remains fully usable.
9. In browser Network/Storage tools, confirm exact coordinates, appliance answers, safety answers and costs are not written to cookies/localStorage/sessionStorage or sent to FixForward APIs.
10. Confirm service cards show practical details first (address, available phone/hours, Call, Directions, Website) and technical provenance only under **About this listing**.
11. Verify the map failure fallback leaves the service list usable if Leaflet/OpenStreetMap cannot load.
12. Confirm the Compare page never invents automatic dollar values and clearly labels the smart cost engine as a prototype until governed price evidence is approved.
13. Verify browser Back and dedicated Back across every route; confirm Start again asks before clearing progress.
14. Verify mobile at 360 px, 390 px and 768 px and desktop at 1280+ px.
15. Complete keyboard-only, focus/error and screen-reader/live-region checks.
16. Record the **scope decision** for device geolocation, goal-specific safety depth, early-stop behavior and cautious recycling before calling them accepted Iteration 1 requirements. Keep the conservative serious-warning baseline aligned with the approved safety criteria.
17. Capture evidence and only then mark the corresponding register rows **Closed**.
