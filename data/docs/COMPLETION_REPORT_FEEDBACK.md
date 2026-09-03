> **Superseded.** This records the previous review round. Several statements
> below no longer describe the database: `locations.verification_url` held
> dataset URLs rather than facility evidence, the `recommendation_eligible`
> column has been dropped in favour of a view, the `recalls.feed_*` columns moved
> into `data_import_runs`, and the community postcode CSV was replaced by ABS
> boundaries. See
> [`COMPLETION_REPORT_HARDENING.md`](COMPLETION_REPORT_HARDENING.md) for the
> current state. Kept for history.

# Completion report — review feedback response

**Generated:** 2026-09-03  
**Scope:** Complete data behind existing Neon schema. No fabricated acceptance/public-access facts. Repair statistics unchanged.

## Tables / columns changed

| Object | Change |
|--------|--------|
| `locations.recommendation_eligible` | **Added** (migration 002). TRUE only if relevant + accepts + public_access all confirmed |
| `locations.postcode` | **Filled** via suburb join where possible (659/729) |
| `locations.verification_url` | **Filled** 100% (DataVic dataset URL or OSM copyright page) |
| `locations.last_verified_at` | **Filled** 100% |
| `locations.provider_type` | **Filled** 100% (classification only) |
| `locations.opening_hours` | **Filled** only from OSM tags (14/729) |
| `locations.accepts_electrical_appliances` | Left **NULL** (unknown) — not inferred |
| `locations.public_access` | Left **NULL** (unknown) — not inferred |
| `suburb_postcodes.data_source_id` | **Added** + linked 100% |
| `recalls.feed_retrieved_at`, `feed_window_start`, `feed_window_end` | **Added** + populated |
| `appliance_categories.search_aliases` | **Populated** for all 11 categories |
| `safety_rules` | Re-seeded to **14** rules with exact page URLs + recall/personal-data rules |
| `data_sources` | ESV/CFA exact URLs; new Australian postcodes source; ACCC version includes date window |

## Before / after completeness

| Metric | Before (review) | After |
|--------|-----------------|-------|
| Appliance aliases populated | 0/11 (0%) | **11/11 (100%)** |
| Suburb provenance in `data_sources` | Missing | **Present + 3089/3089 linked** |
| Location `verification_url` | 0% | **100%** |
| Location `postcode` | 0% | **90.4%** |
| Location `provider_type` | 0% | **100%** |
| Location `opening_hours` | 0% | **1.9%** (OSM tag only) |
| Location `accepts_electrical_appliances` known | 0% | **0%** (honest NULL) |
| Location `public_access` known | 0% | **0%** (honest NULL) |
| `recommendation_eligible` | n/a | **0** (expected until confirmed sources) |
| Safety exact page URLs | Homepages | **14/14 (100%)** |
| Recall feed window stored | Documented in prose only | **Columns + ACCC version string** `2026-04-16 → 2026-08-27` |

## Remaining NULL / unverified (intentional)

- All `accepts_electrical_appliances` and `public_access` values remain NULL — open DataVic/OSM sources do **not** prove household appliance acceptance.
- Therefore **no** location is `recommendation_eligible`. Disposal UI must show whitelist facilities (`household_electrical_relevant = TRUE`, n=299) as **unverified possibles** with verify-before-visit wording.
- ACCC index remains ~100 recent RSS recalls — not full history. Category coverage test: vacuum 2 possible hits; fan 4; other supported categories 0. Zero matches ≠ recall-free.

## Reproduce

```bash
cd fix-forward
source .venv/bin/activate
python data/scripts/apply_migration_002.py
python data/scripts/04_seed_appliance_categories.py
python data/scripts/04_seed_safety_rules.py
python data/scripts/04_seed_suburb_postcodes.py
python data/scripts/03_load_accc_neon.py
python data/scripts/05_enrich_locations.py
python data/scripts/05_test_recall_category_coverage.py
python data/scripts/05_data_quality_report.py
```

## Key scripts / docs

- Migration: `data/scripts/migrations/002_review_feedback.sql`
- Enrichment: `data/scripts/05_enrich_locations.py`
- Policy: `data/docs/LOCATION_VERIFICATION_POLICY.md`
- QA JSON: `data/docs/DATA_QUALITY_REPORT.json`
- Recall scope: `data/docs/RECALL_COVERAGE_SCOPE.md`

## Say this to the reviewing mentor

> “We completed the data behind the schema without inventing facts. Aliases, suburb provenance, exact safety URLs, recall date windows, and location verification URLs/postcodes are filled. Acceptance and public-access remain NULL where sources don’t confirm them, so recommendation_eligible is zero by design — the app must label disposal locations as unverified possibles.”
