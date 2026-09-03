# FixForward — Iteration 1 v1.2.0

FixForward is an anonymous decision-support application for Victorian households with a broken small appliance. Its journey is:

1. Identify the appliance, with optional brand and model.
2. Screen a limited, manually reviewed recall index.
3. Check ten observable safety warning signs.
4. Explore professional repair/disposal pathways or compare user-entered costs.

The application is guidance only. It does not diagnose a fault, confirm that a product is recalled, certify safety, or give DIY repair instructions.

## Current architecture

```text
Browser UI ──GET public data──> Flask API ──SELECT only──> Neon PostgreSQL
    │
    └── appliance, safety, suburb and cost inputs remain in page memory
```

The frontend and API are served by the same Flask application. There are no POST endpoints, accounts, cookies, analytics, user tables, uploads, geolocation requests or journey-data logs.

## Recall rule

Family/category is never treated as a recall match. The browser compares an entered model against structured identifiers that were manually reviewed against the official ACCC notice.

| Input | Result |
|---|---|
| Category only | Insufficient information |
| Brand only | Show possible notices; request model |
| Exact model, optionally narrowed by brand | Strong possible match; verify official notice |
| No exact match | No match in the limited dataset—not “not recalled” |
| API/database unavailable | Stop the indexed check; link to official search |
| Serious warning sign | Stop-use guidance overrides the normal journey |

The imported `recalls` table is unstructured discovery data. Only rows represented in `recall_products`, `recall_category_links` and `recall_identifiers` with `manually_reviewed = true` are exposed for matching.

## Local setup

Requirements: Python 3.11+, Node.js 20+, and a PostgreSQL/Neon connection string for a SELECT-only application role.

```sh
python -m venv .venv
```

Activate the environment:

- macOS/Linux: `source .venv/bin/activate`
- Windows PowerShell: `.venv\Scripts\Activate.ps1`

Then:

```sh
python -m pip install -r requirements.txt
```

Set `DATABASE_URL` in your terminal or copy `.env.example` to an ignored local `.env` and load it with your preferred environment tool. The application does not read `.env` by itself. Never paste a real password into source files, screenshots, LeanKit or the PGP.

Run the database scripts in order on a Neon development branch:

1. `database/001_i1_recall_matching.sql`
2. `database/002_seed_verified_mistral_vacuum.sql`

Start the integrated application:

```sh
flask --app app run --debug
```

Open `http://127.0.0.1:5000`. Use `/?mock-data-error=1` to demonstrate the fail-closed recall state.

## Demonstration case

The seed script adds one verified example from the team's imported ACCC snapshot:

- Family: Cleaning
- Category: Vacuum cleaner
- Brand: Mistral
- Model: BVC 160 or BVC 165

Expected result: strong possible match with an official notice link. It is deliberately one narrow demonstration record, not full Australian recall coverage. For a rice cooker, category alone returns insufficient information; the current recent RSS snapshot contains no reviewed rice-cooker identifier.

## Tests

```sh
npm run check
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py
```

The Node suite covers recall branches, safety precedence, cost validation, local area filtering, privacy constraints and static accessibility/responsive checks. The Python suite covers API contracts, safe failure responses, security headers, protected backend files and data transformations without requiring Neon.

The integrated v1.2.0 release also preserves the latest GitHub snapshot's clearer cost-validation messages and expanded category-level repair-evidence presentation. The original unsafe category-only recall fixture was not retained.

Live Neon connectivity, migration execution, interactive browser testing and deployed security-header checks remain manual release gates. See `ACCEPTANCE_RESULTS.md`.

## Deployment

`render.yaml` defines a Render web service using Gunicorn. Before deployment:

1. Rotate any owner credential that has been shared in chat or screenshots.
2. Create a separate SELECT-only database role using SQL—not Neon's Console Add role action, which creates a privileged role.
3. Run both migrations on a Neon development branch and verify the seed result.
4. Add the pooled read-only `DATABASE_URL` as a protected hosting secret.
5. Deploy, then test `/api/health`, every API response, the complete user journey and security headers.

## Project map

- `app.py` — Gunicorn/Flask entry point
- `backend/` — application factory, routes, SQL repository and safe transformations
- `database/` — idempotent Iteration 1 recall schema and verified seed
- `data/` — the team's existing source snapshots, cleaning/import scripts, migrations and data-quality evidence
- `src/app.js` — UI screens and in-memory journey state
- `src/logic.js` — pure recall, safety, cost and location rules
- `src/data-service.js` — four GET requests and fail-closed fallback
- `src/data.js` — static UI taxonomy, safety questions and category mappings
- `test/` — frontend/decision tests
- `test_backend/` — backend contract and transformation tests
- `API_CONTRACT.md` — exact API response shapes
- `LEARNING_GUIDE.md` — plain-language walkthrough and mentor questions
- `AI_USE_ACKNOWLEDGEMENT.md` — disclosure draft requiring student review
- `ACCEPTANCE_RESULTS.md` — executed checks and remaining manual gates

## Existing data pipeline

The `data/` directory is preserved from the latest team GitHub snapshot. It contains committed ACCC, DataVic and OSM source snapshots, cleaning/import scripts, the ORA aggregation workflow and the earlier database migrations. Do not rerun downloads or rebuild production data merely to start the Flask app.

For data-pipeline details, use:

- `data/docs/REBUILD_VERIFICATION.md`
- `data/docs/TEAM_API_CONTRACT.md`
- `data/docs/data_dictionary.md`
- `data/docs/RECALL_COVERAGE_SCOPE.md`

The two scripts under `database/` are the additional, narrow application migrations already applied to the Neon development branch. They create the UI-category mapping and the manually reviewed identifier layer used by the Flask API.

## Important data limitations

- Recall coverage is the team's recent ACCC RSS snapshot, not complete recall history.
- Only manually reviewed structured product identifiers are matchable.
- Repair evidence describes self-selected community repair records and is not model-specific.
- Location records are imported directory records and are currently marked unverified.
- “No match” never means “not recalled,” and “no warning reported” never means “safe.”
