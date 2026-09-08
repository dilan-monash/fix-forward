# FixForward — Iteration 1 v1.6 usability-lab prototype

FixForward is an anonymous decision-support web application for metropolitan Melbourne households with a faulty portable appliance. This is a **non-final usability-lab candidate**. It is designed around the question an ordinary household user is most likely to have:

> **What do you want to do with the appliance?**

The landing page offers **Repair it**, **Compare costs**, **Recycle it**, or **I'm not sure**. The chosen path still passes through a short, appliance-relevant safety and recall gate so convenience cannot become false reassurance.

## Human-first journey

```text
HOME
  ├─ Repair it ───────┐
  ├─ Compare costs ───┤
  ├─ Recycle it ──────┤→ identify appliance → quick product-specific safety check
  └─ I'm not sure ────┘                         │
                                                 ├─ critical warning → stop-use guidance
                                                 │                    + controlled disposal planning
                                                 ├─ possible recall → official recall instructions first
                                                 ├─ uncertain answer → cautious assessment route
                                                 ├─ caution answer → assessment/cost planning without community-cafe reassurance
                                                 └─ clear route → requested Repair / Cost / Recycle tool
```

### Plain language first

The main journey avoids terms such as *dataset*, *provenance*, *identifier* and *confidence level*. When “product recall” first appears, FixForward explains it in everyday language. Technical evidence remains available under expandable **About the information**, **About this listing** and **How was this worked out?** panels.

## Safety behavior

Safety questions are adapted to the appliance and the selected goal. Repair uses up to four questions, Compare up to three, Recycle up to two, and **I'm not sure** can use up to five.

- A kettle does not receive a battery question; a rechargeable shaver can.
- Every question has **What does this mean?** help with a simple pictogram, concrete example and a warning not to turn on/open/test the appliance just to answer.
- **Not sure is a valid answer and does not end the questionnaire.** The user can answer the remaining relevant questions from what they already know.
- A separate **I'm not able to check this safely** action lets the user stop inspecting without pretending the appliance is safe.
- One critical **Yes** is enough for the serious-warning route even if other answers are No.
- Caution-only signs such as unusual heat or repeated power trips are not presented as identical to smoke, shock, exposed wiring, water ingress or damaged batteries.
- A serious warning blocks ordinary cost/community-repair routes. If the user wants to dispose of the appliance, FixForward can still show a controlled recycling/disposal planning route with an explicit warning not to transport an appliance that is hot, smoking, leaking or actively damaged.

## Recall integrity

Recall matching remains conservative:

| Situation | Behavior |
|---|---|
| Category only / no model | Explain that there is not enough product detail for a product-specific check |
| Exact normalised model in selected category | “Your model may be affected by a product recall” + official notice |
| Exact model but brand differs | Preserve the model match and explain the brand difference |
| One-character/near model | Ask the user to re-check the label; never silently turn it into an exact match |
| No match | State that the exact model was not found in the current limited list; never claim “not recalled” |
| Recall API unavailable | Keep static safety guidance available and link to the official Australian recall search |
| Possible recall | Official notice takes priority over ordinary repair/cost/recycling choices |

## Repair experience

After a clear Repair safety gate, the user sees a small **Repair hub** with two practical choices:

1. **Find repair options** — map/list, current location or suburb/postcode, filters and contact/directions actions.
2. **Estimate & compare costs** — source-linked cost context plus a direct comparison when the user has real prices.

Repair history is supporting evidence, not the first screen. Open Repair Alliance outcomes are shown as a horizontal stacked visual for **fixed during the event**, **repairable with more work** and **other recorded outcomes**, with counts and percentages. Detailed sample/source limitations are expandable below the action-oriented content.

## Location experience

The v1.6 prototype keeps both manual and optional current-location modes.

### Suburb/postcode autocomplete

The manual search supports partial input. For example, typing `312` can show matching Melbourne-area entries such as `3121 — Richmond`, `3122 — Hawthorn` and other matching postcode/suburb pairs from the project's cleaned suburb index.

The autocomplete supports:

- mouse/touch selection;
- Arrow Up / Arrow Down navigation;
- Enter to select;
- Escape to close;
- `aria-activedescendant` and selected-option state for keyboard/screen-reader use;
- final validation before a location search is run.

### Current location

The browser asks permission only after the user chooses **Use my current location**.

- Latitude/longitude remain in JavaScript memory.
- Exact device coordinates are not sent to the FixForward API or Neon.
- Nearby distance is calculated in the browser using public service coordinates already loaded.
- Results can be filtered by radius and provider type.
- Leaflet renders the in-app map with OpenStreetMap tiles only when there are useful results to plot.
- If the map dependency does not load within eight seconds, the text/service-card list remains usable.

**Scope note:** the earlier I1 baseline used manual suburb selection. Device geolocation is therefore an **experimental scope change** requiring BA/mentor/security/privacy approval before it can be called final assessed scope.

## Smart cost check — v1.6 boundary

The user asked for an experience inspired by fast repair-or-replace tools: enter appliance details, describe the problem briefly, and receive useful cost context without filling in a long form.

FixForward v1.6 implements the **interaction pattern**, not a fabricated exact quote.

### Current behavior

- Brand/model/problem input is validated.
- The problem description is grouped into a simple fault class such as power/electrical, heat/temperature, noise/movement, water/leak or battery/charging.
- If brand + model are entered, the UI explicitly says the model is **not price-verified** because FixForward does not yet have a governed product-price catalogue. It falls back to brand + appliance-type context instead of pretending the model was found.
- Published repair-service pricing examples are shown **separately**, because they represent different service models:
  - National Appliance Repairs publishes a $99 drop-off inspection and $198 pick-up inspection for standard small appliances, with additional labour/parts quoted separately.
  - One Touch Appliance Repairs publishes a $129 Melbourne mobile call-out and says labour including call-out is capped at $229, with parts separate.
- These figures are **not combined into one repair-cost range** and are not presented as the user's repair quote.
- A model-level replacement-price feed is not connected, so FixForward deliberately says there is not enough verified replacement-price evidence instead of inventing a value.
- If the user already has a real repair quote and a comparable replacement price, the manual comparison validates the amounts and shows the lower upfront price neutrally.

### Inspiration versus implementation

Appliance911.ai demonstrates a low-friction repair-or-replace experience using appliance identification and cost/reliability information. FixForward uses that as UX inspiration only. It does **not** copy Appliance911's proprietary model database, photo-recognition workflow or claimed model-level cost capability.

A future approved FixForward cost engine would require permitted price/repair data adapters, source dates, model/entity resolution, retailer/provider diversity and explicit evidence levels. AI may help resolve messy product names or classify a fault description, but **AI must never invent the dollar values**.

See `docs/SMART_COST_ENGINE_DESIGN.md`.

## Input validation

The prototype treats user input as untrusted and gives plain field-level errors:

- brand: optional, max 60 characters, must contain a letter if supplied, restricted to common brand punctuation;
- model: optional, max 50 characters, realistic model punctuation only;
- problem description: 5–300 characters, requires meaningful words rather than number/symbol junk;
- suburb/postcode: max 50 characters, final postcode must be four digits, suburb must be plausible text;
- cost fields: positive numeric amounts only, max two decimal places, sanity cap of AUD 100,000, max 10 typed characters;
- family/category: must come from the approved six-family mapping.

The model validator intentionally permits numeric models because some real product identifiers are numeric; validation should not reject a legitimate model merely because it contains no letters.

## Architecture

```text
Browser SPA
  │
  ├─ user goal / appliance / safety answers / problem / costs: memory only
  ├─ optional device latitude/longitude: memory only
  ├─ local validation, product-safe decision rules, autocomplete and distance filtering
  ├─ Leaflet + OpenStreetMap map when useful
  │
  └── GET public reference data ──> Flask API ── parameterised SELECT ──> Neon PostgreSQL
                                   │
                                   ├─ /api/health  process liveness
                                   └─ /api/ready   database readiness
```

Public datasets load independently with `Promise.allSettled()`. A location failure cannot masquerade as a recall failure, and a recall failure does not prevent the static safety questions from working.

## API endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/recalls`
- `GET /api/sources`
- `GET /api/repair-evidence`
- `GET /api/locations`

See `API_CONTRACT.md`.

## Security/privacy highlights

- no accounts, passwords, payments, uploads or saved journey history;
- no journey-answer POST endpoint;
- read-only application database design;
- parameterised SQL;
- dynamic user/data text escaped before HTML insertion;
- recall notice URLs restricted to official Product Safety hosts by the backend;
- CSP and other response security headers;
- pinned Leaflet 1.9.4 CDN assets with Subresource Integrity;
- geolocation permission only after an explicit user action;
- exact coordinates not persisted or sent to Neon;
- high-risk state cannot route to community Repair Cafés or ordinary cost comparison;
- stale appliance state is cleared when appliance details change;
- technical/API failure never becomes “safe” or “not recalled” reassurance;
- unexpected API errors are logged generically rather than deliberately attaching a traceback to application logs.

See `docs/SECURE_ARCHITECTURE_I1.md`.

## Local setup

Requirements: Python 3.11+, Node.js 20+, and a PostgreSQL/Neon connection string for the application's read-only role.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Set `DATABASE_URL` in the shell/environment only. Never paste the real connection string into Git, documentation, screenshots or chat messages.

```powershell
$env:RELEASE_VERSION = "iteration-1-v1.6.0-usability-lab"
python -m flask --app app run --debug
```

Open `http://127.0.0.1:5000`.

## Tests completed while packaging

```powershell
npm test
npm run check
python -m compileall -q backend app.py test_backend
python -m unittest test_backend.test_transform -v
```

Packaging-environment result for this candidate:

- **66 Node decision/data/UX/security contract tests passed; 0 failed**.
- JavaScript syntax checks passed.
- Python compilation passed.
- **4/4 pure backend transformation tests passed**.
- A browser-flow heuristic harness had previously exercised 27 end-to-end usability assertions across landing, recall, repair, map/list, cost, safety, recycling, validation and mobile layout. It is an automated/heuristic audit, **not human-participant usability evidence**.
- The final packaged candidate could not be re-driven through a local Chromium URL in this packaging environment because local/file URLs are blocked by environment policy; the Windows/Chrome walkthrough in `docs/DEPLOYMENT_CHECKLIST_V1.6.md` remains a release gate.
- The complete Flask suite must still be rerun in the team's normal Windows `.venv` because Flask/psycopg are not installed in the packaging environment. Earlier candidates were successfully run there with the 10-test backend suite.

See `ACCEPTANCE_RESULTS.md` and `docs/DEPLOYMENT_CHECKLIST_V1.6.md`.

## Demonstration recall case

The narrow reviewed example remains:

- Family: Cleaning
- Category: Vacuum cleaner
- Brand: Mistral
- Model: BVC 160 or BVC 165

Expected: **possible recall match** with official verification required. It is not complete Australian recall coverage.

## Important prototype limits

1. Recall coverage remains deliberately limited; no indexed match is not clearance.
2. Repair/service locations can be incomplete or out of date; call/check before travelling.
3. Provider qualification, opening status or appliance acceptance is not claimed unless the source proves it.
4. Geolocation, goal-specific safety depth, caution-cost planning and controlled hazard-disposal planning are scope experiments requiring formal project approval.
5. OpenStreetMap tiles and the Leaflet CDN are third-party dependencies; production usage must respect their policies and availability limits.
6. Current published cost examples are service-fee signals, not a market benchmark, model repair quote or replacement quote.
7. No live model-level product/retail price source or AI service is connected in v1.6.
8. No saved history is introduced.
9. Live Render/Neon behavior remains a release gate.

Do not “complete” these features by inventing provider details, recall outcomes, qualification, appliance acceptance or prices.
