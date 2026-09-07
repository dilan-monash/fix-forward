# FixForward Iteration 1 v1.4 goal-first prototype — Test Status

Build date: 7 September 2026
Status: **prototype candidate — not evidence of production acceptance**

## Automated checks completed in the packaging environment

| Check | Command | Result |
|---|---|---|
| Frontend decision/data/UX tests | `npm test` | **30 passed, 0 failed** |
| JavaScript syntax + test suite | `npm run check` | **Passed** |
| Python compile check | `python -m compileall -q backend app.py test_backend` | **Passed** |
| Pure transformation tests | part of backend unittest discovery | transform tests passed before Flask import dependency stopped the complete suite |
| Complete Flask backend suite | `python -m unittest discover -s test_backend -v` | **Not executed to completion in packaging environment** — Flask is not installed and external package download is unavailable |

The project team previously ran the v1.3 candidate locally with its complete backend suite passing. Because v1.4 changes the location contract and security headers, **the v1.4 backend suite must be rerun in the team's normal `.venv` before commit/deploy.**

## v1.4 automated frontend coverage

The 30 Node tests include:

- independent API availability;
- static safety fallback during API outage;
- category-only recall limitation;
- normalised exact model matching;
- brand-conflict preservation;
- one-character near model not promoted to recall match;
- critical vs caution safety severity;
- appliance-adaptive battery question;
- high-risk cost/community-repair blocking;
- cost validation;
- manual area search;
- distance calculation;
- nearby sort/radius/provider filtering;
- immediate loading UI;
- goal-first landing choices;
- plain-language recall explanation;
- recall outage safety continuation;
- high-risk no-Repair-Café behavior;
- browser geolocation + in-app map contract;
- memory-only location privacy contract;
- service contact/directions-first cards;
- no AI-invented price contract;
- browser Back/restart/accessibility contract;
- no account/upload/password/persistent journey storage.

## Manual/live gates still required

- Run full Python suite in the user's existing `.venv`.
- Run local app against the Neon development branch.
- Confirm `/api/health` and `/api/ready`.
- Confirm `/api/locations` returns coordinates/provider fields against the actual schema.
- Test geolocation allow and deny flows in Chrome over localhost and HTTPS preview.
- Inspect DevTools Network: user coordinates must not be sent to Flask/Neon.
- Test Leaflet/OSM load and map fallback.
- Test Repair/Compare/Recycle landing shortcuts after clear safety gate.
- Test BVC 160, BVC 161, recall outage, serious warning and uncertain warning.
- Test mobile, keyboard, zoom and screen-reader announcements.
- Record BA/mentor decision on whether geolocation/goal-first flow is accepted for final I1.

Do not mark this prototype “final” or “security accepted” solely from automated results.
