# Step 3: Database schema (what each table is for)

## Files

| File | Purpose |
|------|---------|
| `data/scripts/schema.sql` | SQL that **defines** the five public tables |
| `data/scripts/apply_schema.py` | Python script that **runs** schema.sql against Neon |

## The five tables (public data only)

| Table | What it stores | Used by |
|-------|----------------|---------|
| `data_sources` | Licence, URL, retrieval date, limitations for each dataset | Every screen that shows source evidence |
| `recalls` | ACCC recall index (title, date, official link, match keywords) | US2.1 Recall check |
| `repair_statistics` | Category repair benchmarks (counts, sample size, geography) | US4.1 "Why this pathway?" |
| `repair_barriers` | Common barriers to repair by category | US4.1 "Why this pathway?" |
| `locations` | Repair services (OSM) and recycling sites (DataVic) | US4.1 and US4.2 |

**We deliberately do NOT have** a table for user answers, costs, suburb, or appliance selections.

## Apply the schema

```bash
cd fix-forward
source .venv/bin/activate
python data/scripts/apply_schema.py
```

## Say this to your mentor

> "schema.sql is version-controlled SQL that defines our public data model. apply_schema.py connects to Neon and creates five empty tables. No user data is stored — only open datasets that power recalls, repair evidence, and location pathways."
