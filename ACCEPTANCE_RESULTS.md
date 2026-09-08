# FixForward Iteration 1 v1.6 usability-lab prototype — Test Status

Build date: 8 September 2026  
Release label: `iteration-1-v1.6.0-usability-lab`  
Status: **prototype candidate — not production/security acceptance**

## Automated checks completed in the packaging environment

| Check | Command | Result |
|---|---|---|
| Frontend decision/data/UX/security tests | `npm test` | **66 passed, 0 failed** |
| JavaScript syntax + complete Node suite | `npm run check` | **Passed** |
| Python compile check | `python -m compileall -q backend app.py test_backend` | **Passed** |
| Pure backend transformation tests | `python -m unittest test_backend.test_transform -v` | **4 passed, 0 failed** |
| Complete Flask backend suite | `python -m unittest discover -s test_backend -v` | **Must be rerun in the team's Windows `.venv`** because Flask/psycopg are not installed in this packaging environment |

Previous candidates were successfully exercised in the project's normal Windows environment with the full 10-test Flask/backend suite. That does not automatically prove v1.6; the suite must be rerun on this exact candidate before commit/preview deployment.

## v1.6 automated coverage

### Public-data reliability

- datasets load independently;
- static landing/safety definitions are usable before backend completion;
- total endpoint failure does not erase static safety guidance;
- disabled API performs no request;
- recall, repair-evidence and location availability remain independent.

### Recall integrity

- category-only input never produces recall clearance;
- punctuation/formatting differences do not block an exact reviewed model match;
- exact model remains visible when brand text differs, with a conflict warning;
- one-character model differences are suggestions only;
- recall outage remains explicit;
- no-match wording never means “not recalled”.

### Safety decision logic

- one critical Yes creates a serious/high result even when all other answers are No;
- caution-only Yes is distinct from immediate danger;
- Not sure remains uncertain after other questions are completed;
- critical Yes takes priority over Not sure;
- all-Yes critical scenarios produce the serious result;
- battery questions are hidden for a kettle and available for a shaver;
- direct Repair/Compare/Recycle plans are short and product-relevant;
- guided “I'm not sure” can ask a fuller set;
- water ingress remains a serious stop-use sign under the conservative baseline;
- high risk blocks ordinary cost and community-repair routes;
- caution may retain planning/cost context but blocks community Repair Café reassurance;
- recall outage does not remove ordinary options after a clear safety check.

### Input validation

- normal brand names such as `Fisher & Paykel` are accepted;
- numeric-only brand is rejected;
- brand >60 characters is rejected;
- realistic model punctuation is accepted;
- model >50 characters is rejected;
- problem descriptions containing only numbers/symbols are rejected;
- problem >300 characters is rejected;
- partial postcode is accepted for suggestions only;
- final postcode must be four digits;
- one-letter suburb input is rejected;
- postcode-prefix and suburb-name autocomplete return appropriate matches;
- money input rejects words, values above the sanity limit and >2 decimals;
- missing prices produce field-specific errors.

### Repair/location experience

- Repair path exposes both **Find repair options** and **Estimate & compare costs**;
- repair evidence is a stacked outcome visual below practical actions;
- current-location and manual suburb/postcode modes both exist;
- partial postcode/suburb suggestions are available;
- final manual location input is validated before searching;
- caution/hazard repair results exclude community Repair Cafés;
- hazard recycling does not falsely display “quick check passed”;
- service cards prioritise address/contact/directions/actions;
- in-app map is lazy-loaded and the service list survives map failure;
- exact device coordinates remain optional and are not persisted;
- autocomplete supports Arrow Up/Down, Enter, Escape and selected-option ARIA state;
- map dependency has an eight-second timeout to the service-list fallback.

### Cost experience

- smart cost check starts from validated appliance details + problem description;
- National Appliance Repairs and One Touch published examples are source-linked;
- unlike service models are shown as separate price signals rather than one fake market range;
- entered brand/model is explicitly **not price-verified** and falls back instead of claiming an exact price match;
- replacement price is not invented when no governed model-level feed exists;
- manual quote/replacement fields have browser and logic limits;
- lower upfront price is reported neutrally rather than as a recommendation.

### UX/accessibility/security contracts

- goal-first landing with Repair / Compare / Recycle / I'm not sure;
- plain-language explanation of product recall;
- appliance-specific safety help panels and pictograms;
- Not sure does not prematurely stop remaining safety questions;
- separate **I'm not able to check this safely** escape route;
- controlled recycling/disposal option after serious warning;
- caution and uncertain results have different wording from serious danger;
- model-label help does not encourage opening the appliance;
- Back/history/restart contracts remain;
- no account/password/upload/saved-journey feature introduced;
- unexpected API failure handler does not deliberately attach tracebacks;
- release identifier matches v1.6 in browser/backend/config contracts.

## Browser-flow heuristic audit

A browser-flow harness was used during v1.6 development to exercise **27 end-to-end usability assertions**, including:

- landing clarity and four goal choices;
- near-model recall behavior;
- repair hub and repair-evidence placement;
- suburb/postcode autocomplete;
- service-card practical actions;
- problem/cost validation;
- serious mixed Yes/No safety behavior;
- controlled hazard recycling and transport warning;
- Not sure continuation;
- distinct uncertain result;
- exact recall priority;
- invalid brand/model handling;
- mobile horizontal-overflow check.

This is **automated/heuristic evidence only**. It is not a claim that 27 people were tested or that real participant usability testing has been completed.

The final packaged candidate could not be re-driven through a local Chromium URL in this packaging environment because local/file URLs are blocked by environment policy. The Windows/Chrome manual walkthrough below is therefore still required before preview deployment.

## Manual/live gates still required

Before preview deployment or any final-I1 merge:

1. Run `python -m unittest discover -s test_backend -v` in the team's existing Windows `.venv` and require all tests to pass.
2. Run local Flask against the Neon development/read-only connection.
3. Confirm `/api/health` and `/api/ready` return the v1.6 release label and expected status.
4. Re-test BVC 160, BVC 161, missing-model and recall-outage flows.
5. Test all four landing intents from a fresh session.
6. Test mixed safety answers: one critical Yes + several No; caution Yes + No; Not sure + remaining answers; all Yes; and unable-to-check.
7. Confirm serious warning cannot reach community Repair Café or normal cost comparison.
8. Confirm serious-warning recycling shows the no-transport warning for hot/smoking/leaking/actively damaged appliances.
9. Test postcode prefix `312`, suburb prefixes, mouse selection and keyboard autocomplete selection.
10. Test geolocation Allow, Deny, timeout and manual fallback over HTTPS.
11. Force map/CDN failure and confirm the service-card list remains usable after the timeout.
12. Inspect browser Network/Storage and confirm appliance details, safety answers, problem text, cost values and exact device coordinates are not stored in cookies/localStorage/sessionStorage or sent to FixForward data APIs.
13. Verify published cost-source links and wording; do not call the examples an exact repair quote or market range.
14. Verify manual money validation with blank, text, negative, zero, excessive decimals and very large values.
15. Test mobile widths 360/390/768, desktop 1280+, 200% zoom, keyboard-only navigation and a screen-reader spot check.
16. Record BA/mentor approval/deferral for goal-first routing, geolocation, goal-specific safety depth, caution-cost planning, hazard-disposal planning and the experimental cost interface.
17. Run a safe preview-site security check and attach evidence to the exact commit/release.

Do not mark the candidate **final**, **production ready**, **security accepted**, or **AI cost estimator complete** solely from these automated results.
