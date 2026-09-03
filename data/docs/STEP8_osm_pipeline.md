# Step 8: OpenStreetMap repair locations

## Scripts (run in order)

| Step | Script | What it does |
|------|--------|----------------|
| 8a | `00_download_osm.py` | Queries Overpass API for Victoria repair POIs |
| 8b | `01_clean_osm.py` | Normalises OSM tags → `data/clean/locations_repair.csv` |
| 8c | `03_load_osm_neon.py` | Loads into Neon `locations` (`location_type = repair`) |

```bash
cd fix-forward
source .venv/bin/activate
python data/scripts/00_download_osm.py
python data/scripts/01_clean_osm.py
python data/scripts/03_load_osm_neon.py
```

## OSM tags we search for

- `craft=electronics_repair`
- `shop=repair`
- `shop=electronics` + `repair=yes`
- `amenity=repair_cafe`
- Names containing "Repair Cafe" / "Repair Café"

## US4.1 rules we follow

- Manual suburb selection in the app (no GPS).
- Contact before travelling.
- Do not claim providers are qualified unless verified.
- Repair cafés are not the main option for hazardous appliances (Sunny's safety logic).

## Attribution

OpenStreetMap data is © OpenStreetMap contributors, licensed under ODbL. Include attribution in the app and PGP.

## Say this to your mentor

> "We query OpenStreetMap through the Overpass API for repair-related points of interest in Victoria, clean the tags into a standard locations format, and load them as repair-type rows in Neon. The data is community-sourced and incomplete, so the app always tells users to contact providers before travelling."
