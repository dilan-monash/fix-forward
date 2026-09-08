# FixForward Iteration 1 v1.5 human-first prototype — Test Status

Build date: 7 September 2026
Status: **prototype candidate — not evidence of production acceptance**

## Automated checks completed in the packaging environment

| Check | Command | Result |
|---|---|---|
| Frontend decision/data/UX tests | `npm test` | **46 passed, 0 failed** |
| JavaScript syntax + test suite | `npm run check` | **Passed** |
| Python compile check | `python -m compileall -q backend app.py test_backend` | **Passed** |
| Pure backend transformation tests | `python -m unittest test_backend.test_transform -v` | **4 passed, 0 failed** |
| Complete Flask backend suite | `python -m unittest discover -s test_backend -v` | **Not executed in packaging environment** — Flask/psycopg are not installed there |

The project team previously ran the preceding local candidate with its complete 10-test backend suite passing. v1.5 still requires the complete suite to be rerun in the team's normal `.venv` because the release/config/frontend contract changed.

## v1.5 automated coverage includes

- independent API availability;
- usable static first screen before backend response;
- category-only recall limitation;
- exact model matching and brand conflict;
- near model not promoted to exact match;
- critical vs caution safety outcomes;
- appliance-specific battery applicability;
- goal-specific safety plans (Repair 4 / Compare 3 / Recycle 2 / Guide 5 max);
- high-risk cost/community-repair blocking;
- manual cost validation;
- area and nearby location search;
- distance/radius/provider filtering;
- hero goal shortcuts;
- plain-language recall explanation;
- on-demand safety help + visual cues;
- early stop for Yes/Not sure and unable-to-check path;
- cautious uncertain-recycling path;
- repair-evidence stacked visual after service map/list;
- contact/directions-first service cards;
- current-location privacy contract;
- lazy pinned map dependency + list fallback;
- no AI-invented automatic price;
- model-number example/help;
- direct goal routing;
- context-aware Back labels;
- restart/keyboard/live-results contracts;
- no account/upload/password/persistent journey storage;
- unexpected API error logging avoids deliberate traceback attachment.

## Manual/live gates still required

- Run full Python suite in the user's existing `.venv`.
- Run local app against the Neon development branch.
- Confirm `/api/health` and `/api/ready`.
- Test BVC 160 / BVC 161 / no-model / recall-outage flows.
- Test direct Repair / Compare / Recycle and guided paths.
- Test first Yes answer early-stop and first Not sure early-stop.
- Test “I'm not able to check this safely”.
- Test uncertain recycling contact-first route.
- Test geolocation Allow / Deny / timeout and DevTools network behavior.
- Test map load and map-failure fallback.
- Test service data cold-start auto-refresh.
- Test mobile, keyboard, 200% zoom and screen-reader announcements.
- Validate chart values against actual `/api/repair-evidence` output.
- Record BA/mentor decision on goal-first flow, geolocation and goal-specific safety depth.

Do not mark this prototype “final”, “production ready”, or “security accepted” solely from these automated results.
