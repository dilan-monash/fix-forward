# Step 7: DataVic recycling / disposal locations

## Scripts (run in order)

| Step | Script | What it does |
|------|--------|----------------|
| 7a | `00_download_datavic.py` | Fetches October 2025 facilities via official DataVic API |
| 7b | `01_clean_datavic.py` | Normalises fields → `data/clean/locations_recycling.csv` |
| 7c | `03_load_datavic_neon.py` | Loads into Neon `locations` (`location_type = recycling`) |

```bash
cd fix-forward
source .venv/bin/activate
python data/scripts/00_download_datavic.py
python data/scripts/01_clean_datavic.py
python data/scripts/03_load_datavic_neon.py
```

## Raw columns (from DataVic)

| DataVic field | Our field |
|---------------|-----------|
| Facility Name | `name` |
| Facility Type + Infrastructure Type | `facility_type` |
| Address | `address` |
| Suburb | `suburb` |
| LGA | `lga` |
| Latitude / Longitude | `latitude` / `longitude` |

## US4.2 rules we follow

- User selects suburb manually (no GPS).
- Tell user to **confirm acceptance** before visiting.
- Do not claim a facility takes e-waste unless the dataset proves it.

## Say this to your mentor

> "We pull Victoria's waste infrastructure from the official DataVic datastore API, clean it into a standard locations file, and load recycling-type facilities into Neon. The app filters by suburb and always warns users to confirm acceptance — the open data does not guarantee every site takes household appliances."
