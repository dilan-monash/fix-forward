# FixForward — Iteration 1 v1.4 goal-first prototype

FixForward is an anonymous decision-support web application for metropolitan Melbourne households with a faulty portable appliance. This **non-final prototype** explores a simpler product question:

> **What do you want to do with the appliance?**

The user can start with **Repair it**, **Compare costs**, **Recycle it**, or **I'm not sure**. FixForward then runs a short, appliance-relevant safety check and a cautious recall check before allowing the requested pathway.

This candidate keeps the safety/reliability controls proved in v1.3 and changes the information architecture to reduce effort and technical language.

## User experience

```text
HOME
  ├─ Repair it ───────┐
  ├─ Compare costs ───┤
  ├─ Recycle it ──────┤→ identify appliance → quick safety + recall gate
  └─ I'm not sure ────┘                         │
                                                 ├─ serious warning → stop-use guidance
                                                 ├─ possible recall → official recall instructions
                                                 ├─ chosen goal → go straight to that tool
                                                 └─ unsure goal → show repair / compare / recycle choices
```

### Plain-language design

The main journey avoids terms such as *dataset*, *provenance*, *identifier* and *confidence level*. When “product recall” first appears, FixForward explains it in everyday language. Detailed evidence remains available under **About the information** or expandable evidence sections.

### Goal-first shortcuts

If the safety/recall gate does not override the journey:

- **Repair it** goes directly to the repair map/service finder.
- **Compare costs** goes directly to the cost tool.
- **Recycle it** goes directly to recycling locations.
- **I'm not sure** shows the three options with repair-history context.

A user does not need to repeat a generic “choose next action” screen after already stating their goal.

## Location experience

The v1.4 prototype adds an **optional browser geolocation experiment** requested in teaching feedback/usability discussion.

- The browser asks permission only after the user selects **Use my current location**.
- Latitude/longitude stay in JavaScript memory and are **not sent to the FixForward API or Neon**. When the map is shown, OpenStreetMap still receives ordinary tile requests for the map area being viewed; FixForward does not claim otherwise.
- Distances are calculated in the browser using service coordinates already returned by `/api/locations`.
- Results can be filtered by radius and repair-provider type.
- Leaflet renders the map in FixForward using OpenStreetMap tiles.
- Service cards prioritise name, distance, address, phone, opening-hours data (when present), Call, Directions and Website.
- Dataset/verification detail is moved into **About this listing** instead of dominating the user-facing card.

**Scope note:** the previously approved I1 baseline used manual suburb entry. Therefore device geolocation is an **experimental scope change, not automatically an approved final-I1 feature**. It should be reviewed with the BA/mentor and security/privacy owners before final release. Manual suburb/postcode search remains available.

## Recall and safety integrity

Recall matching remains conservative:

| Situation | User-facing behavior |
|---|---|
| Category only / no model | Explain that there is not enough product detail for a product-specific check |
| Exact normalised model in selected category | “Your model may be affected by a product recall” + official notice |
| Exact model but brand differs | Preserve possible model match and warn that the entered brand differs |
| Near / one-character-different model | Ask user to re-check the label; never promote to an exact recall match |
| No match | “We did not find your exact model in our current list” + explicitly state this does not prove no recall |
| Recall API unavailable | Keep safety questions available and link to the official Australian recall search |
| Serious warning | Stop-use guidance; community Repair Café pathway is not offered |
| Caution / Not sure | Recommend appropriate assessment before ordinary cost/community repair pathways |

Safety questions are adapted to the appliance category. A kettle does not receive a battery question; a battery-powered shaver can.

## Repair evidence

Open Repair Alliance category history is translated into plain language such as:

> **73 of 169 recorded community repair attempts were fixed during the event.**

The detailed sample, geography, broader-category mapping and limitations remain available in an expandable panel. FixForward does not present category history as a model-specific success probability.

## Smart cost finder — prototype boundary

The UI demonstrates the intended product-resolution hierarchy:

1. exact brand + model;
2. brand + appliance type;
3. appliance type only.

A future resolver may use fuzzy/AI-assisted identification to understand misspelled product names, but **AI must not invent repair or replacement prices**. Dollar values must come from governed evidence.

The repository/audit previously contained a weak category-price snapshot (57 observations across 19 categories, three observations per category). It is deliberately **not promoted to a trustworthy automatic market benchmark** in this prototype because the sample is too concentrated and does not establish model-level repair prices.

A manual two-value comparison remains as a fallback for users who already have a repair quote and replacement price.

## Architecture

```text
Browser SPA
  │
  ├─ user goal, appliance, safety answers, cost values: memory only
  ├─ optional device latitude/longitude: memory only
  ├─ local distance/filter logic
  ├─ Leaflet map + OpenStreetMap tiles
  │
  └── GET public data ──> Flask API ── SELECT only ──> Neon PostgreSQL
                         │
                         ├─ /api/health  process liveness
                         └─ /api/ready   database readiness
```

Public datasets are loaded independently with `Promise.allSettled()`. A location failure does not disable recall screening, and a recall-data failure does not prevent static safety guidance.

## API endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/recalls`
- `GET /api/sources`
- `GET /api/repair-evidence`
- `GET /api/locations`

See `API_CONTRACT.md`.

## Security/privacy highlights

- No user account, password, payment or saved-journey feature.
- No journey-answer POST endpoint.
- Application database access is read-only.
- Dynamic text is HTML-escaped.
- Recall notice URLs are restricted to official Product Safety hosts by the backend.
- Content Security Policy is present.
- Referrer policy is `strict-origin-when-cross-origin`, preserving origin-only Referer information required by the OpenStreetMap web tile service without exposing the full FixForward page URL.
- Leaflet 1.9.4 CDN files are pinned with official Subresource Integrity hashes.
- Geolocation is allowed only for the same-origin page and only after browser permission.
- Exact user coordinates are not persisted or sent to Neon.
- High-risk safety state cannot route to community repair results.
- Technical failure is not presented as reassurance.

See `docs/SECURE_ARCHITECTURE_I1.md` and `docs/V1.4_GOAL_FIRST_PROTOTYPE.md`.

## Local setup

Requirements: Python 3.11+, Node.js 20+, and a PostgreSQL/Neon connection string for the application's read-only role.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Set `DATABASE_URL` as an environment variable. Do **not** paste it into documentation, screenshots or Git.

```powershell
$env:RELEASE_VERSION = "iteration-1-v1.4.0-goal-first"
python -m flask --app app run --debug
```

Open `http://127.0.0.1:5000`.

## Tests

Frontend/decision/UX tests:

```powershell
npm test
npm run check
```

Backend tests after Python dependencies are installed:

```powershell
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py test_backend
```

In the build environment used to package this prototype, all **30 Node tests passed** and Python compilation passed. The complete Flask test module could not be executed there because external package installation was unavailable; run it in the project's normal `.venv` before committing. The prior v1.3 candidate was separately run by the project team with its backend suite passing.

## Demonstration recall case

The narrow reviewed example remains:

- Family: Cleaning
- Category: Vacuum cleaner
- Brand: Mistral
- Model: BVC 160 or BVC 165

Expected: **possible recall match** with official verification required. It is not complete Australian recall coverage.

## Important prototype limits

1. Recall coverage remains deliberately limited.
2. Location records may be incomplete/out of date; call/check before travelling.
3. Facility-level qualification/appliance acceptance cannot be claimed unless the source proves it.
4. Current-location mode is experimental and needs scope/privacy approval before final I1.
5. OpenStreetMap tile service and the Leaflet CDN are third-party dependencies; production usage should be reviewed against their policies and availability requirements.
6. Automatic model-level repair/replacement prices are not enabled until a stronger governed source exists.
7. No saved assessment history is introduced.
8. Live Render/Neon behavior remains a deployment release gate.

Do not “complete” these features by inventing provider details, appliance acceptance, recall results or prices.
