# FixForward — Iteration 1

An anonymous, mobile-first e-waste decision aid for Victorian households. The V2.2 journey follows the approved order: manual family/category identification → recall status → safety warning check → repair/disposal pathway → repair-versus-replacement cost comparison when the user has a quote.

## Preview locally

Use VS Code Live Server, or run any static file server from this directory. For example:

```sh
python -m http.server 4173
```

Open `http://127.0.0.1:4173`. This command only serves static frontend files for local preview; it is not the FixForward backend.

## Frontend

The UI and browser-side decision rules live in this directory. `src/data.js` contains clearly marked UI fixtures so every conditional screen can be reviewed before the live Neon data is connected. A disabled API adapter is included for later backend connection; while disabled it makes zero network requests.

### Test

```sh
npm test
npm run check
```

The automated suite covers appliance validation, the recall UI fixture, no-match and unavailable-data fallbacks, all safety decision branches, invalid/missing/equal cost cases, no-location fallbacks, privacy controls, accessibility markup and responsive rules.

To exercise the frontend data-error state, open `http://127.0.0.1:4173/?mock-data-error=1`. To exercise the category-level recall screen, select **Heating and simple cooking → Kettle**. Iteration 1 does not collect brand or model.

### Privacy and scope

- Journey answers, appliance details, costs and area selection live only in JavaScript memory and clear on refresh or Restart.
- No login is required, and no user profile is created or stored.
- The frontend makes no network request for journey data. There are no cookies, analytics, localStorage records, user tables or accounts.
- There is no image upload, image recognition, barcode scanning, automatic diagnosis, DIY repair guidance, climate comparison, login or geolocation.
- Recall results are screening results. Users must verify identifying details on the official ACCC notice.

### Code map

- `index.html` — application shell, progress and privacy/source dialog
- `styles.css` — responsive design system and accessibility states
- `src/app.js` — UI state machine and screen transitions
- `src/logic.js` — pure validation, recall, safety, cost and location rules
- `src/data.js` — temporary frontend-only fixture data and six-family mapping
- `src/config.js` — one-switch backend connection configuration (disabled by default)
- `src/data-service.js` — public-data API adapter with automatic static fallback
- `API_CONTRACT.md` — response shapes required from the future backend
- `test/` — acceptance-oriented frontend logic and static UI tests

### Connect the future backend

1. Implement the four read-only endpoints in `API_CONTRACT.md`.
2. Set `baseUrl` in `src/config.js` if the API is not same-origin.
3. Change `enabled` from `false` to `true`.

If the backend is unavailable or returns an invalid response, the UI automatically continues with static fixtures. The adapter never sends appliance details, safety answers, costs, area selections or profile information.

The included recall fixture mirrors the official ACCC KitchenAid 1.7 L kettle notice published 21 February 2018 solely to exercise the Recall UI. The location fixtures route users to search directories instead of claiming a provider is open or accepts a product. These fixtures must be replaced by the Neon-backed API before production use.

## Data layer

Public open data lives in **Neon PostgreSQL**. No user assessments, sessions or personal information are stored.

### Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-data.txt
cp .env.example .env   # then set DATABASE_URL from Neon Console
python data/scripts/test_neon_connection.py
```

### Rebuild from a clean checkout

Migrations run in two phases. The validation migrations audit real rows and
refuse to constrain data that would violate them, so they run after the imports.

Use the **committed** ACCC, DataVic and OSM snapshots. Do not re-download them
unless you intentionally want a newer window: the ACCC RSS feed is a rolling
100-item list, so a fresh download will not match production counts.

The ORA aggregate is email-gated. Place
`data/raw/ora/OpenRepairData_v0.3_aggregate_202507.csv` first and verify it.

```bash
# ORA snapshot (manual, checksum-verified)
python data/scripts/00_fetch_ora.py

# Phase 1: schema (010 is safe here because the location loaders write
# source_url, source_retrieved_at and provider_type on insert)
python data/scripts/apply_schema.py
python data/scripts/apply_migration.py 001 002 003 004 005 006 007 008 010

# Phase 2: data — committed snapshots, not live re-downloads
python data/scripts/01_clean_accc.py
python data/scripts/03_load_accc_neon.py
python data/scripts/01_clean_datavic.py
python data/scripts/03_load_datavic_neon.py
python data/scripts/01_clean_osm.py
python data/scripts/03_load_osm_neon.py
python data/scripts/01_clean_ora.py && python data/scripts/02_build_ora_stats.py
python data/scripts/03_load_ora_neon.py

python data/scripts/04_seed_appliance_categories.py
python data/scripts/04_flag_recycling_eligibility.py
python data/scripts/04_seed_safety_rules.py
python data/scripts/06_load_abs_suburbs.py
python data/scripts/05_enrich_locations.py
python data/scripts/06_fix_location_verification.py
python data/scripts/06_build_recall_patterns.py
python data/scripts/06_match_recalls.py
python data/scripts/06_seed_safety_rule_sources.py --strict-urls

# Phase 3: validate
python data/scripts/apply_migration.py 009 011
python data/scripts/06_regression_tests.py
python data/scripts/05_data_quality_report.py
python data/scripts/06_review_recall_match.py --list
```

Every script is idempotent, so any of them can be re-run.

The Mistral vacuum candidate stays `unreviewed` until a named person runs
`python data/scripts/06_review_recall_match.py` and records a decision.

### Checks

| Script | Purpose |
|---|---|
| `06_regression_tests.py` | 48 assertions covering false-positive, eligibility, FK, checksum and microwave-scope cases. Non-zero exit on failure. |
| `05_data_quality_report.py` | Writes `data/docs/DATA_QUALITY_REPORT.json`. Non-zero exit when an invariant breaks. |
| `05_test_recall_category_coverage.py` | Recall candidates per category, including matched field. |
| `06_review_recall_match.py` | Lists or records a named review of unreviewed candidates. |
| `qa_neon_counts.py` | Row counts for demos. |

### Tables for the app team

| Table or view | Use |
|---|---|
| `appliance_categories` | Six families and their categories (US1.1) |
| `safety_rules`, `safety_rule_sources` | Screening questions and citations (US2.2). Answers stay in the browser. |
| `recalls`, `appliance_recall_patterns`, `recall_category_matches` | Possible ACCC matches, each recording the pattern that fired |
| `repair_statistics`, `repair_barriers` | Category evidence |
| `locations` | Repair and recycling places |
| `location_appliance_acceptance` | Acceptance per location and per appliance category |
| `verified_location_recommendations` | The only view safe to present as a recommendation |
| `unverified_location_candidates` | Everything else, with the required disclaimer |
| `suburb_postcodes` | ABS suburb centroids for map centring |
| `data_sources`, `data_import_runs` | Licence, provenance, coverage and checksums |

Read [`data/docs/TEAM_API_CONTRACT.md`](data/docs/TEAM_API_CONTRACT.md) before
querying `locations` directly.

### Docs

- [`data/docs/Open_Data_Source_Register.md`](data/docs/Open_Data_Source_Register.md)
- [`data/docs/data_dictionary.md`](data/docs/data_dictionary.md)
- [`data/docs/TEAM_API_CONTRACT.md`](data/docs/TEAM_API_CONTRACT.md)
- [`data/docs/LOCATION_VERIFICATION_POLICY.md`](data/docs/LOCATION_VERIFICATION_POLICY.md)
- [`data/docs/RECALL_COVERAGE_SCOPE.md`](data/docs/RECALL_COVERAGE_SCOPE.md)
- [`data/docs/COMPLETION_REPORT_HARDENING.md`](data/docs/COMPLETION_REPORT_HARDENING.md)
- [`data/docs/REBUILD_VERIFICATION.md`](data/docs/REBUILD_VERIFICATION.md)

### Known limitations

- **Recalls** are a rolling ACCC RSS window (coverage recorded in
  `data_import_runs`), not the full history. No match does **not** prove a
  product is recall-free. Always offer
  https://www.productsafety.gov.au/recalls
- **Repair statistics** are category benchmarks, never model-level predictions.
- **Facility verification is 0%.** All 729 locations are `unverified`. A dataset
  URL lives in `source_url` and is never treated as facility verification.
- **Appliance acceptance and public access are unknown** on every location.
  `NULL` means unknown, never "no", and is never inferred from facility type or
  coordinates.
- **`verified_location_recommendations` returns 0 rows**, which is correct.
  Show other locations only with: "Potential nearby service. Acceptance and
  public access have not been verified. Check before visiting."
- **Suburb coordinates** are ABS polygon centroids, not exact locations. A
  suburb spanning several postcodes gets the one containing its centroid.
- **The Mistral vacuum candidate is unreviewed** until a named person signs it
  off with `06_review_recall_match.py`.
- **Microwaves are out of scope** for Iteration 1. ORA has no microwave
  category, so there is no repair evidence to show beside a microwave recall.
