# Migration 001 — what this step does

## Why

The PDF asked for database gaps beyond the four evidence tables we already loaded.
This migration is **additive only** — it does not delete ORA/ACCC/DataVic/OSM data.

## What it adds

| Object | Purpose |
|--------|---------|
| `appliance_categories` | Stable catalogue for US1.1 (six families + categories) |
| `safety_rules` | Reviewed Yes/No/Unsure screening questions (US2.2) |
| `suburb_postcodes` | Manual suburb/postcode → map centre (no GPS) |
| New `locations` columns | Recycling eligibility flag + nullable enrichment fields |
| ESV + CFA in `data_sources` | Provenance for safety content |

## How to run

```bash
cd fix-forward
source .venv/bin/activate
python data/scripts/apply_migration_001.py
```

## Say this to your mentor

> "We used a non-destructive migration so existing public open data stays intact. New tables support appliance selection, safety screening, and suburb search. Safety sources are registered as official links only — we do not invent DIY repair advice."
