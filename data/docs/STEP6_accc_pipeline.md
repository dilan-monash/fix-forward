# Step 6: ACCC recall pipeline

## Scripts (run in order)

| Step | Script | What it does |
|------|--------|----------------|
| 6a | `00_download_accc.py` | Downloads official RSS XML to `data/raw/accc/` |
| 6b | `01_clean_accc.py` | Parses RSS → `data/clean/recalls.csv` |
| 6c | `03_load_accc_neon.py` | Loads into Neon `recalls` + `data_sources` |

```bash
cd fix-forward
source .venv/bin/activate
pip install -r requirements-data.txt
python data/scripts/00_download_accc.py
python data/scripts/01_clean_accc.py
python data/scripts/03_load_accc_neon.py
```

## Important limitations (US2.1)

- RSS feed contains the **most recent ~100 recalls** (not all historical recalls).
- App must say **"possible recall match"** — never "confirmed recall".
- No match does **not** mean recall-free.
- Official fallback search: https://www.productsafety.gov.au/recalls

## Columns in `recalls.csv`

| Column | Purpose |
|--------|---------|
| `title` | Recall title from ACCC |
| `published_date` | Publication date |
| `summary` | Plain-text summary (HTML stripped) |
| `official_url` | Link to official ACCC notice |
| `rss_category` | ACCC product category from RSS |
| `match_keywords` | Lowercase tokens for possible matching in the app |
| `likely_appliance_recall` | Helper flag (`yes` / `maybe`) — Sunny/Haochen use for UI hints |

## Say this to your mentor

> "We download the official ACCC recall RSS, save the raw XML as evidence, parse it into a clean CSV, and load an index into Neon. Matching is cautious — possible matches only, with a link to the official notice. The RSS window is limited, so we document the official search fallback."
