# FixForward Iteration 1 - Teaching & Usability Feedback Action Register

Version: 1.3.0-redesign
Status: implementation candidate - requires live Render/Neon verification

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
| T13 | Proper landing page | Completely redesigned landing page explains value, environment, privacy, coverage and journey before the form. | Implemented | Desktop/mobile screenshots |
| T14 | Alphabetical devices | Categories sort alphabetically inside the selected family. | Implemented | UI screenshot |
| T15 | Back from questionnaire | Dedicated Back buttons + browser history/popstate support. | Implemented | E2E test/video |
| T16 | Lock category until family | Category panel is visibly locked until a family is selected. | Implemented | UI screenshot |
| T17 | Model spaces/slashes/exact matching | Identifier normalisation ignores formatting; UI says complete model identifier is required. | Implemented | Unit tests R02/R04 |
| T18 | Family-dependent safety questions | Applicability rules remove battery/water/heat prompts where they are not relevant. | Implemented foundation | Product-owner review of rule table |
| T19 | Safety questions too obvious | Added short plain-language explanation for *why* each warning matters; critical vs caution severity prevents binary oversimplification. | Implemented | Usability retest |
| T20 | Auto suburb from location | Deferred: current DB has no coordinates and geolocation is intentionally disabled. Do not fake nearby results. | Deferred | I2 story with privacy/design approval |
| T21 | State Melbourne-only location scope | Location screen says Melbourne-focused and exact suburb/postcode matching. | Implemented | UI screenshot |
| T22 | Show recommendations in FixForward | Matching location cards are rendered inside FixForward rather than only redirecting. | Implemented | Live location test |
| T23 | User friendliness weak | Redesigned visual hierarchy, landing page, shorter copy, status chips, cards, contextual guidance. | Implemented | Usability retest |
| T24 | Missing model character behavior | One-character differences are never promoted to exact recall match; UI warns user to re-check label. | Implemented | R04 test |
| T25 | 'Strong possible match' wording | Replaced with 'Exact model identifier found' + plain-language 'may match a reviewed recall notice'. | Implemented | Recall screenshot |
| T26 | Add images | Added purpose-built visual decision-loop illustration and richer iconographic pathway cards without external trackers/assets. | Implemented | Landing screenshot |
| T27 | Explain terminology like arcing | Safety label defines arcing and each question has an explanation. | Implemented | Safety screenshot |
| T28 | Any Yes => high risk | Replaced with severity model: critical Yes => high; caution Yes / Unsure => assessment recommended. | Implemented | S01/S02 tests |
| T29 | Inconsistent official guidance | Recall result uses official ACCC notice/search; professional safety uses Energy Safe Victoria/ACCC. | Implemented | Link audit |
| T30 | Bland / more engaging | Full green/cream visual system, visual landing hero, cards, status UI and responsive layout. | Implemented | Mentor review |
| T31 | Repair evidence static | Added plain-language outcome summary, metric cards and expandable detail/limitations. | Implemented | Repair-path screenshot |
| T32 | Choose next action on landing | Landing page previews the full decision journey. | Implemented | Landing screenshot |
| T33 | Identify -> Educate -> Action | Adopted as the product story; progress uses Identify -> Understand -> Act -> Compare. | Implemented | Journey trace |
| T34 | Repair quote character limits | Cost fields use maxlength=12 and numeric validation/upper sanity bound. | Implemented | Validation test |
| T35 | Emphasise repair/recycle | Landing, impact band and pathway cards make repair/recycling primary product value. | Implemented | UI walkthrough |
| T36 | Persona pivot | Not a code decision. Keep metropolitan Melbourne households unless mentor formally approves a scope/persona change. | Decision required | Mentor minutes |
| T37 | LeanKit epic ownership/specificity | Requires LeanKit update outside this ZIP. Architecture/journey wording can now be copied directly into epics/AC. | Process action | LeanKit screenshot/export |

## Usability-test feedback

| ID | Observation | Response |
|---|---|---|
| U01 | Site failed before Safety page | Immediate loading state + independent dataset loading; recall failure no longer blocks static safety screening. |
| U02 | Homepage confusing | New landing page explains what FixForward is, how it helps, environmental purpose and supported coverage before starting. |
| U03 | Need onboarding | Landing's four decision cards act as lightweight onboarding; a forced tour was avoided to reduce journey length. |
| U04 | Recall looked identical across categories | Category-scoped model matching remains enforced; exact model matching is model-first within chosen category. |
| U05 | User does not know model location | Added 'Where can I find it?' guidance without telling user to open the appliance. |
| U06 | ACCC redirect confusing | Recall page explains why official verification is required and labels ACCC as authoritative. |
| U07 | Back navigation unclear | Dedicated Back buttons + browser Back support. |
| U08 | Recalled item continuing | Recall banner/pathway remains priority; ordinary cost path is hidden when a possible recall is active. |
| U09 | Safety logic unclear | Critical vs caution severity + explanations + tailored applicability. |
| U10 | 'Choose next action' unclear | Rewritten to explicit pathway cards with reason, safety constraint and next action. |
| U11 | Previous-result history requested | Deferred to future scope because I1's privacy contract intentionally stores no journey history. Do not silently introduce persistence. |
| U12 | Journey too wordy | Shorter cards and summaries; detailed evidence moved into expandable `<details>`. |
| U13 | Manual cost comparison low value | UI now explicitly calls this a fallback and refuses to pretend a weak retail sample is an automatic market benchmark. Automatic price benchmarking remains a data-governance task. |

## Highest-priority live verification before mentor demo

1. Deploy this candidate to a non-production Render preview or feature branch.
2. Confirm the landing/loading state appears immediately on a cold start.
3. Simulate/observe one failed endpoint and verify other datasets still work.
4. Verify recall-unavailable still allows safety questions.
5. Verify a burning/smoke result can **never** produce a Repair Cafe card.
6. Verify BVC 160 exact match and BVC 161 near-match behavior.
7. Verify browser Back and dedicated Back across every screen.
8. Verify mobile at 360 px, 390 px and 768 px.
9. Verify keyboard-only flow, focus on errors, and dynamic location announcements.
10. Capture evidence and only then mark the corresponding register rows Closed.
