# FixForward — Iteration 1 v1.6 usability-lab prototype

**Updated 11 September 2026:** FixForward now requires a shared website password through its Flask server. The update also includes a favicon, page-specific browser titles and a reviewed AUD retail-price catalogue. “Not sure” retains repair-contact, cost-comparison and recycling exploration while safety warnings stay visible. See the [website access guide](docs/WEBSITE_ACCESS.md), [current branch verification report](docs/PASSWORD_BRANCH_VERIFICATION_2026-09-11.md), [catalogue verification report](docs/PRICE_CATALOGUE_VERIFICATION_2026-09-11.md) and [usability review](docs/USABILITY_REVIEW_2026-09-11.md).

FixForward is a decision-support web application for metropolitan Melbourne households with a faulty portable appliance. Visitors enter the shared website password without creating an account. Appliance choices and answers stay in browser memory. This is a **non-final usability-lab candidate**. It is designed around the question an ordinary household user is most likely to have:

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
2. **Compare repair and replacement costs** — a direct comparison using the user's repair quote and replacement price, with optional recorded retail and inspection-fee examples.

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

**Scope note:** optional geolocation extends the earlier manual-suburb baseline. Its behavior, privacy limits and accessibility still need checking on the deployed website and with real participants.

## Recorded retail prices and cost comparison

The user asked for an experience inspired by fast repair-or-replace tools: enter appliance details, describe the problem briefly, and receive useful cost context without filling in a long form.

FixForward shows source-linked examples and compares amounts the user chooses. It does not diagnose a fault or decide whether the user should repair or replace an appliance.

### Current behavior

- Brand/model/problem input is validated.
- **Recorded retail examples** show AUD amounts, retailer, model, source link and review date. The [initial source notes](data/catalogue/SOURCES.md) and [additional source notes](data/catalogue/ADDITIONAL_SOURCES.md) document the evidence, cached pages and exclusions.
- An exact retail match requires the complete normalised brand and model within the chosen appliance type. The interface distinguishes **Same brand and model**, **Same brand · different model** and **Same appliance type**. A partial model or a different brand is not an exact match.
- No match leaves the manual comparison available; an unrelated appliance is never substituted. A match is still an example: compare the variant, capacity and features on the retailer page.
- Choosing a card's **Use … in comparison** button fills only the replacement amount, preserves the repair quote and identifies the source. Editing that replacement amount removes its retailer attribution. Observations older than 90 days or recorded as out of stock cannot be inserted with this button.
- Optional problem descriptions are grouped into power, heat, noise, water or battery topics to help prepare questions for a repairer. Descriptions do not alter the recorded prices or create a diagnosis.
- Inspection-fee examples recorded on 7 September 2026 remain separate because they represent different service models:
  - National Appliance Repairs: $99 drop-off inspection and $198 pick-up inspection, with additional labour/parts quoted separately.
  - One Touch Appliance Repairs: $129 call-out and a stated $229 labour cap including call-out, with parts separate.
- These figures are **not combined into one repair-cost range** and are not presented as the user's repair quote.
- The catalogue is a small reviewed snapshot, **not a live price feed, a complete market survey or a price-history trend**. Review dates do not guarantee today's price or stock; delivery and other costs may be extra.
- The manual comparison validates the selected amounts and shows the lower upfront price neutrally. A confirmed free repair quote can be entered as zero.

### Inspiration versus implementation

Earlier design work used Appliance911.ai as UX inspiration. The implemented FixForward catalogue consists of its own reviewed public price observations; it does not copy another product's proprietary database or claim its capabilities.

The mentor's permission to create a database supports this local catalogue implementation. Broader market estimates or a live feed would still need suitable source coverage, permitted collection methods, product comparability and refresh rules. **Dollar values must come from source observations or user-entered amounts.**

See `docs/SMART_COST_ENGINE_DESIGN.md`.

## Input validation

The prototype treats user input as untrusted and gives plain field-level errors:

- brand: optional, max 60 characters, must contain a letter if supplied, restricted to common brand punctuation;
- model: optional, max 50 characters, realistic model punctuation only;
- problem description: optional; when supplied, 5–300 characters with meaningful words;
- suburb/postcode: max 50 characters, final postcode must be four digits, suburb must be plausible text;
- cost fields: nonnegative repair quote and positive replacement price, max two decimal places, sanity cap of AUD 100,000, max 24 typed characters; common Australian currency formatting is accepted;
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
  ├── GET public reference data ──> Flask API ── parameterised SELECT ──> Neon PostgreSQL
  │                                  ├─ /api/health  process liveness
  │                                  └─ /api/ready   Neon database readiness
  └── GET replacement prices ─────> Flask API ── read-only ──> public SQLite price snapshot
       └─ labelled saved copy if price service is unavailable
```

Public datasets load independently with `Promise.allSettled()`. A location failure cannot masquerade as a recall failure, and a recall failure does not prevent the static safety questions from working.

The server checks website access before serving the SPA, its JavaScript modules or the reference-data APIs. `/api/health` remains public for hosting liveness checks. Sign-in and sign-out use CSRF-protected POST forms. The signed access cookie lasts at most four hours from sign-in and does not contain appliance details or journey answers. A static file server cannot enforce this gate; use Flask locally or the Render Python service when sharing the protected website.

The price catalogue is explicitly separate. The build script validates `data/catalogue/*-observations.json` and generates `data/catalogue/replacement-prices.sqlite` plus `src/price-snapshot.js`. Flask opens SQLite read-only; brand/model matching happens in the browser. No user answers are stored there. Neon remains the source for recalls, repair evidence, sources and locations; it never silently switches to SQLite. Displaying recorded prices is not proof that Neon is connected.

## API endpoints

- `GET /api/health` — public process liveness
- `GET /api/ready`
- `GET /api/recalls`
- `GET /api/sources`
- `GET /api/repair-evidence`
- `GET /api/locations`
- `GET /api/replacement-prices` — public-source price snapshot, independent of Neon readiness

All listed endpoints except `/api/health` require a valid website-access session. The access form additionally uses `GET`/`POST /login` and `GET`/`POST /logout`; these do not write journey data or database records.

See `API_CONTRACT.md`.

## Security/privacy highlights

- shared server-side website password, with no individual accounts, payments, uploads or saved journey history;
- password and cookie-signing key supplied through private environment settings, never frontend code;
- signed, HttpOnly, SameSite=Lax access cookie; Secure by default on HTTPS; four-hour absolute sign-in limit;
- CSRF protection for sign-in and sign-out; protected responses use `private, no-store` caching;
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

Requirements: Python 3.11+ and Node.js 20+. The main reference-data routes additionally need a PostgreSQL/Neon connection string for the application's read-only role. The public price catalogue needs no database URL.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python data/scripts/build_price_catalogue.py
```

This workspace has a private, Git-ignored `.env` with `DATABASE_URL=` left blank and local website-access settings configured. Put the real database URL immediately after `DATABASE_URL=`, save, and restart Flask. In a fresh checkout, copy `.env.example` to `.env`, set `SITE_PASSWORD` privately, and generate a random `SECRET_KEY` of at least 32 characters. Set `SESSION_COOKIE_SECURE=false` only for local HTTP testing at `127.0.0.1:5000`; keep it true on HTTPS hosting. Existing shell/hosting environment variables take precedence. Never put real credentials in frontend code, Git, documentation, screenshots or chat. See [website access setup](docs/WEBSITE_ACCESS.md).

```powershell
$env:RELEASE_VERSION = "iteration-1-v1.6.0-usability-lab"
python -m flask --app app run --debug
```

Open `http://127.0.0.1:5000` and enter the shared website password. Without valid `SITE_PASSWORD` and `SECRET_KEY` settings, the server returns an access-unavailable page instead of exposing the application.

Run `python -m backend.check_database` to test the main PostgreSQL connection and dataset routes without printing credentials. See the [database guide](docs/DATABASE_CONNECTION_CHECK.md) for this machine's interpreter path and diagnostic outcomes. The in-process diagnostic bypasses the visitor gate only for its internal test application. A static `:5500` preview or GitHub Pages deployment cannot protect application files with this server-side password and cannot prove that Flask or Neon is running.

## Validation

```powershell
npm test
npm run check
python -m compileall -q backend app.py test_backend
python -m unittest discover -s test_backend -v
```

The [current branch verification report](docs/PASSWORD_BRANCH_VERIFICATION_2026-09-11.md) records the password-gate and integrated checks. The [catalogue verification report](docs/PRICE_CATALOGUE_VERIFICATION_2026-09-11.md) and [usability review](docs/USABILITY_REVIEW_2026-09-11.md) record the earlier snapshots and their then-current environment limits. Automated DOM tests and expert walkthroughs are **not human-participant usability evidence**.

Rerun the complete Flask suite in the deployment's dependency environment, then verify the exact deployed site and its dataset routes. Local catalogue validation, local Flask tests and live Neon connectivity are separate results. Use the [deployment checklist](docs/DEPLOYMENT_CHECKLIST_V1.6.md) alongside the current verification report; older packaging totals in archived reports describe earlier snapshots.

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
4. Geolocation, safety questions, cautious planning and hazard-disposal guidance require real-user and deployed-site checks before being described as fully validated.
5. OpenStreetMap tiles and the Leaflet CDN are third-party dependencies; production usage must respect their policies and availability limits.
6. Inspection fees and recorded retail prices are examples, not a market benchmark, personalised repair quote or guarantee of an equivalent replacement.
7. The local price catalogue is connected; a live retailer feed, historical price trend and external AI service are not implemented.
8. No saved history is introduced.
9. Live Render/Neon behavior remains a release gate.

Do not “complete” these features by inventing provider details, recall outcomes, qualification, appliance acceptance or prices.
