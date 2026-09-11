# FixForward v1.6 usability-lab prototype — Deployment / Preview Checklist

Use this checklist against the **exact commit** proposed for a non-production preview. Do not infer a pass from an older branch.

## A. Branch and secret safety

- [ ] Work is on `feature/i1-usability-lab-v1.6` or another dedicated preview branch, not `main`.
- [ ] v1.5 is already committed/pushed as a recoverable checkpoint.
- [ ] `git status` shows only intended v1.6 changes.
- [ ] `.env`, `.venv`, `node_modules` and credentials are not staged.
- [ ] `.env.example` contains placeholder credentials only.
- [ ] `RELEASE_VERSION=iteration-1-v1.6.0-usability-lab` in `.env.example`, backend default and Render preview config.
- [ ] `git diff --check` and `git diff --cached --check` have no content errors.

## B. Automated tests

- [ ] `npm test` → **66 passed, 0 failed**.
- [ ] `npm run check` → syntax checks + all Node tests pass.
- [ ] `python -m compileall -q backend app.py test_backend` → no errors.
- [ ] `python -m unittest discover -s test_backend -v` → complete backend suite passes in team `.venv`.
- [ ] Test output/screenshots are saved against the commit hash.

## C. Local Flask/Neon

- [ ] `DATABASE_URL` is loaded from a secret environment variable, not source code.
- [ ] Direct `SELECT 1` using the intended application/read-only connection works.
- [ ] `/api/health` returns status OK without depending on DB readiness.
- [ ] `/api/ready` returns database available.
- [ ] health/ready show `iteration-1-v1.6.0-usability-lab`.
- [ ] `/api/recalls`, `/api/sources`, `/api/repair-evidence`, `/api/locations` return expected schemas.
- [ ] DB effective permissions are documented/read-only for application access.

## D. Landing and navigation

- [ ] Cold load shows a useful landing page before Neon/public-data completion.
- [ ] Repair / Compare / Recycle / I'm not sure are immediately understandable without project explanation.
- [ ] Home, dedicated Back and browser Back behave consistently.
- [ ] Start again asks before clearing a started journey.
- [ ] Changing appliance family/category clears stale downstream results.
- [ ] Brand/model edits invalidate stale cost/result context.

## E. Recall

- [ ] Cleaning → Vacuum cleaner → Mistral → BVC 160 gives **possible recall**, not “confirmed recalled”.
- [ ] BVC 165 behaves according to the reviewed identifiers.
- [ ] BVC 161 is never silently changed into BVC 160.
- [ ] Brand conflict keeps exact model match visible but explains the mismatch.
- [ ] Category-only does not claim no recall.
- [ ] Recall endpoint failure says unavailable and keeps static safety questions usable.
- [ ] Official Product Safety link is correct and opens safely.

## F. Safety scenarios

- [ ] Product-specific question set is sensible for kettle, vacuum, shaver, microwave and heater.
- [ ] Every question has useful **What does this mean?** help.
- [ ] Help never asks the user to power on, open, touch exposed parts or test the appliance.
- [ ] Not sure records uncertainty **and the questionnaire continues**.
- [ ] **I'm not able to check this safely** stops inspection and produces the uncertain/cautious route.
- [ ] Critical Yes + all other No → serious stop-use result.
- [ ] Critical Yes + Not sure → serious result wins.
- [ ] Caution Yes only → distinct attention-needed result, not the same screen as smoke/shock.
- [ ] All Yes → serious stop-use result.
- [ ] Clear result never says “safe”.
- [ ] Possible recall remains priority even if no immediate warning is reported.

## G. Serious-warning disposal planning

- [ ] Serious result does not show community Repair Café.
- [ ] Serious result does not show ordinary cost comparison.
- [ ] User can open controlled recycling/disposal planning.
- [ ] Recycling screen says not to transport a hot, smoking, leaking or actively damaged appliance.
- [ ] Facility listing does not claim acceptance unless data proves it.
- [ ] Possible recall instructions remain ahead of disposal instructions.

## H. Repair hub and repair evidence

- [ ] Clear Repair intent opens **Find repair options** and **Estimate & compare costs**.
- [ ] Practical action cards appear before repair-history research.
- [ ] Repair evidence chart shows Fixed / Repairable with more work / Other outcomes.
- [ ] Chart counts and percentages reproduce API evidence values.
- [ ] Category/broader mapping and source limitations are expandable.
- [ ] Chart is not described as model-specific repair probability.

## I. Location autocomplete

- [ ] Typing `312` opens matching postcode/suburb suggestions.
- [ ] Typing suburb prefix such as `rich` produces appropriate suggestions.
- [ ] Mouse/touch selection fills the input correctly.
- [ ] Arrow Down / Arrow Up changes the active option.
- [ ] Enter selects active option.
- [ ] Escape closes the list.
- [ ] Screen-reader/keyboard selected state uses correct ARIA semantics.
- [ ] Final search rejects 3-digit postcode such as `312` until a full suggestion/4-digit postcode is selected.
- [ ] Long/invalid location input produces a field error rather than a search.

## J. Current location and map

- [ ] On HTTPS, **Use my current location** asks permission only after click.
- [ ] Allow → nearby results sorted by distance.
- [ ] Deny → manual suburb/postcode remains usable.
- [ ] Browser geolocation timeout/error → understandable fallback.
- [ ] Radius filters 5/10/25/50 km behave as expected.
- [ ] Provider type filter behaves as expected.
- [ ] Map pin/card relationship is understandable.
- [ ] Call / Directions / Website actions work when data exists.
- [ ] Missing phone/hours are not invented.
- [ ] Block Leaflet/CDN: after bounded wait, service list remains usable and map fallback text appears.
- [ ] OpenStreetMap attribution is visible when map renders.

## K. Smart cost check

- [ ] Brand max 60; numeric-only brand rejected.
- [ ] Model max 50; realistic all-numeric or alphanumeric identifiers remain possible.
- [ ] Problem description 5–300 and meaningful-word validation works.
- [ ] Entered brand+model is labelled **model not price-verified** unless a governed price catalogue is actually connected.
- [ ] Fault grouping is described as grouping/context, not diagnosis.
- [ ] National small-appliance workshop price example links to the published source.
- [ ] One Touch Melbourne service price example links to the published source.
- [ ] Two different service models are not shown as one fake market range.
- [ ] UI explicitly says exact repair quote depends on inspection/fault/parts/labour.
- [ ] Replacement card says not enough verified evidence instead of inventing a price.
- [ ] No external AI request is made in v1.6.

## L. Manual cost comparison

Test repair and replacement fields with:

- [ ] blank;
- [ ] letters such as `free`;
- [ ] negative value;
- [ ] zero;
- [ ] `100.123`;
- [ ] very large value >100,000;
- [ ] normal integer values;
- [ ] two-decimal values.

Then verify:

- [ ] repair lower arithmetic;
- [ ] replacement lower arithmetic;
- [ ] equal prices;
- [ ] difference amount;
- [ ] lower upfront price is not described as automatically better.

## M. Privacy and browser storage

Using DevTools:

- [ ] no appliance answer POST body to FixForward API;
- [ ] no safety answer POST body;
- [ ] no problem/cost POST body;
- [ ] exact geolocation coordinates are not sent to FixForward/Neon;
- [ ] no journey data in localStorage;
- [ ] no journey data in sessionStorage;
- [ ] no journey data in application cookies;
- [ ] privacy wording acknowledges normal hosting/map provider network metadata.

## N. Accessibility / responsive

- [ ] keyboard-only from landing to result;
- [ ] visible focus states;
- [ ] invalid field receives focus;
- [ ] radio groups and help buttons have meaningful labels;
- [ ] autocomplete keyboard behavior and ARIA state checked;
- [ ] 200% browser zoom;
- [ ] 360 px mobile;
- [ ] 390 px mobile;
- [ ] 768 px tablet;
- [ ] 1280+ desktop;
- [ ] no horizontal clipping;
- [ ] reduced-motion preference checked;
- [ ] screen-reader live-region spot check does not repeatedly announce noise.

## O. Security / production preview

- [ ] debug disabled in preview/production.
- [ ] Gunicorn start command used.
- [ ] CSP, HSTS on HTTPS, X-Content-Type-Options and frame protection verified.
- [ ] Leaflet SRI hashes intact.
- [ ] allowed external domains match documented need.
- [ ] unsupported/private backend source paths are not exposed.
- [ ] generic 404/500 behavior.
- [ ] unexpected API failure does not expose DB secrets/traceback to user.
- [ ] safe small pentest checklist/log completed; no destructive tests.

## P. Governance acceptance

Before calling v1.6 final, record **Keep / Modify / Defer** for:

- [ ] goal-first routing;
- [ ] browser geolocation;
- [ ] product/goal-specific safety depth;
- [ ] Not sure continuation behavior;
- [ ] caution-cost planning;
- [ ] serious-warning disposal planning;
- [ ] postcode/suburb autocomplete;
- [ ] smart cost check;
- [ ] use of commercial published fee examples;
- [ ] future AI/product resolver.

Update LeanKit, user stories, acceptance criteria, architecture, threat model, DMP/data governance and ePortfolio/PGP evidence to match the accepted build.
