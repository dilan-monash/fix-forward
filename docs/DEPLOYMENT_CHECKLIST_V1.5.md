# FixForward v1.5 human-first prototype — deployment checklist

**Purpose:** pre-commit / preview-deploy gate. This does not grant final security or product acceptance.

## Release and repository

- [ ] Work is on a dedicated prototype branch (recommended: `feature/i1-human-first-v1.5`), not `main`.
- [ ] `RELEASE_VERSION=iteration-1-v1.5.0-human-first` in `.env.example`, backend default and Render config.
- [ ] No `.env`, Neon credential, API key or local `.venv` is staged.
- [ ] `git diff --check` passes.
- [ ] Scope-change decision is recorded for goal-first routes, geolocation, goal-specific safety depth, early stop and cautious recycling.

## Automated tests

- [ ] `npm test` passes with no failures.
- [ ] `npm run check` passes.
- [ ] `python -m compileall -q backend app.py test_backend` passes.
- [ ] `python -m unittest discover -s test_backend -v` passes in the team's `.venv`.

## Backend / Neon

- [ ] `/api/health` returns `status: ok` without querying Neon.
- [ ] `/api/ready` returns `database: available` against the development database.
- [ ] Public endpoints return generic failure messages with no credential/infrastructure leakage.
- [ ] Application DB access is read-only / least privilege.

## Recall and safety regression

- [ ] Category only never says “not recalled”.
- [ ] `Mistral + BVC 160` produces a possible match and official notice route.
- [ ] `Mistral Australia + BVC 160` keeps exact model match and displays brand conflict.
- [ ] `BVC 161` is not promoted to exact match.
- [ ] Recall endpoint outage still permits the static quick safety check.
- [ ] Burning/smoke, shock/sparks, badly damaged plug/cord, damaged battery (where applicable) and water ingress produce the intended serious stop-use route.
- [ ] Heat/power-only warning is differentiated from immediate danger but still blocks normal cost/community-repair shortcut under current rules.
- [ ] A first Yes or Not sure allows early stop without forcing remaining questions.
- [ ] “I'm not able to check this safely” routes to cautious guidance.
- [ ] Serious warning never displays a community Repair Café.

## Goal-first usability

- [ ] Landing purpose is understandable within ~5 seconds without knowing “product recall”.
- [ ] Repair / Compare / Recycle / Help me decide are visible without scrolling on common desktop and mobile sizes.
- [ ] Category is unavailable until a family is chosen; categories are readable and ordered consistently.
- [ ] Model-number help is understandable and does not tell users to open/remove screws.
- [ ] Each safety question has understandable help and the help receives keyboard focus when opened.
- [ ] Direct routes go straight to the selected tool after a clear gate.
- [ ] Browser Back labels/behavior make sense after direct and guided routes.
- [ ] Editing/changing an appliance does not show a stale result from the previous appliance.

## Repair/recycling finder

- [ ] Service data loading updates without requiring full restart.
- [ ] Manual suburb/postcode works with geolocation denied.
- [ ] Geolocation Allow / Deny / timeout all have usable outcomes.
- [ ] DevTools shows no coordinate POST/write to FixForward/Neon.
- [ ] Leaflet/map resources are not requested before there are useful results to plot.
- [ ] Map/list linkage works; map failure leaves list usable.
- [ ] Phone/hours are shown only when data actually contains them.
- [ ] Cards prioritise address/contact/directions; source detail is secondary.
- [ ] Repair evidence chart values equal the API counts and appear after practical service results.
- [ ] Uncertain recycling shows contact-first transport warning; serious risk does not.

## Cost

- [ ] Manual comparison validates missing, non-numeric, zero, precision and implausibly large values.
- [ ] Result math is correct and neutral.
- [ ] No fabricated automatic repair/replacement price is shown.
- [ ] Editing appliance identity invalidates any stale displayed comparison result.

## Accessibility / responsive / browser

- [ ] Keyboard-only journey works; visible focus is present.
- [ ] 200% zoom has no clipped controls or horizontal task-breaking overflow.
- [ ] Mobile portrait layout tested.
- [ ] Screen-reader spot check: headings, question groups, help panels, live service results and cost result are understandable.
- [ ] Global app container is not an over-broad live region.
- [ ] Restart confirmation works and clears journey state.

## Preview deployment decision

- [ ] Team records test date, browser, tester, release commit and evidence screenshots/logs.
- [ ] Preview can be shared only as a prototype; do not call it final/production/security accepted until remaining acceptance evidence is complete.
