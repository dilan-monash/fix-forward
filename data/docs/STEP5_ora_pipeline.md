# Step 5: ORA pipeline (clean → stats → Neon)

## Scripts (run in order)

| Step | Script | What it does |
|------|--------|----------------|
| 5a | `00_fetch_ora.py` | Verifies the manually placed ORA CSV against the recorded SHA-256 |
| 5b | `01_clean_ora.py` | Filters ORA to mapped categories; adds `appliance_family` / `appliance_category` |
| 5c | `02_build_ora_stats.py` | Counts Fixed / Repairable / End of life; applies n≥30 rule |
| 5d | `03_load_ora_neon.py` | Inserts into `data_sources`, `repair_statistics`, `repair_barriers`, `data_import_runs` |

```bash
cd fix-forward
source .venv/bin/activate
python data/scripts/00_fetch_ora.py
python data/scripts/01_clean_ora.py
python data/scripts/02_build_ora_stats.py
python data/scripts/03_load_ora_neon.py
```

## Outputs

| File / table | Rows (first run) |
|--------------|------------------|
| `data/clean/ora_clean_mapped.csv` | 115,007 |
| `data/clean/repair_statistics.csv` | 11 |
| `data/clean/repair_barriers.csv` | 56 |
| Neon `repair_statistics` | 11 |
| Neon `repair_barriers` | 56 |

## n≥30 rule (how it works)

1. If **Australian** records ≥ 30 → `geography = AU`, `confidence_level = high`
2. Else if **global** records ≥ 30 → `geography = global_fallback`, `confidence_level = low`
3. Else → `insufficient_evidence = true`, `confidence_level = insufficient`

## Say this to your mentor

> "We have a reproducible three-script pipeline: clean maps ORA categories to our approved families, stats applies the n≥30 rule with labelled global fallbacks, and load pushes only public benchmarks into Neon. No raw repair events or user data are stored in the database — only aggregated category statistics and barriers."
