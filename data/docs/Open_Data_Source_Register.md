# Open Data Source Register — Iteration 1

Every dataset below is publicly available and carries stated reuse terms. Exact
URLs, licences, versions and retrieval dates are also held in the `data_sources`
table, and each import is logged in `data_import_runs` with its record count and,
where the source is a downloadable file, a SHA-256 checksum.

## Datasets

| Source | URL | Licence | Version / retrieved | Used for | Limitations |
|---|---|---|---|---|---|
| Open Repair Alliance aggregate | https://openrepair.org/open-data/downloads/ | CC BY-SA 4.0 | 202507 aggregate | `repair_statistics`, `repair_barriers` | Self-selected Repair Café sample. Category benchmarks only, never model-level predictions. n≥30 rule with a labelled global fallback. |
| ACCC Product Safety Recalls RSS | https://www.productsafety.gov.au/rss/feed.xml/psa_recall | Australian Government open data (ACCC Product Safety) | Rolling window 2026-04-16 to 2026-08-27, 100 records, retrieved 2026-09-03 | `recalls` | **Not the full recall history.** A rolling RSS window only. Candidates are possible matches, never confirmation. No match does not prove a product is recall-free. Official search: https://www.productsafety.gov.au/recalls |
| Victoria waste and resource recovery infrastructure (DataVic) | https://discover.data.vic.gov.au/dataset/victoria-s-waste-and-resource-recovery-infrastructure-map-data | CC BY 4.0 | October 2025 snapshot | `locations` (recycling, 663 rows) | Ten fields only: name, owner, facility type, infrastructure type, address, suburb, LGA, coordinates. Publishes **no** accepted-materials, opening-hours, fee or public-access data, so it cannot establish appliance acceptance or public drop-off. |
| OpenStreetMap repair POIs (Victoria) | https://www.openstreetmap.org/copyright | ODbL 1.0, © OpenStreetMap contributors | Overpass API snapshot, 70 elements | `locations` (repair, 66 rows) | Volunteer-maintained and may be stale. Suburb and phone often missing. `opening_hours` present on 14 elements; one element carries a `repair=` tag; no `recycling:*` tags. |
| ABS ASGS Edition 3 — Suburbs and Localities (SAL) and Postal Areas (POA) 2021 | https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files | **CC BY 4.0** | `SAL_2021_AUST_GDA2020_SHP.zip`, `POA_2021_AUST_GDA2020_SHP.zip`, retrieved 2026-09-03 | `suburb_postcodes` (2944 rows) | Coordinates are area-weighted polygon centroids, **never** addresses or exact locations. ABS states Postal Areas approximate postcodes from Mesh Blocks and are not official Australia Post boundaries. A suburb spanning several postcodes is reduced to the postcode containing its centroid. 2021 vintage. |
| Energy Safe Victoria — Using electricity safely | https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely | Crown copyright, Victorian Government. Linked only, no content copied. | Checked 2026-09-03 | `safety_rules`, `safety_rule_sources` | Regulator guidance for consumers. FixForward paraphrases it and does not diagnose faults or certify safety. |
| CFA Victoria — Electrical safety factsheet | https://www.cfa.vic.gov.au/ArticleDocuments/372/Factsheet%20Electrical.pdf.aspx | Crown copyright, Victorian Government. Linked only. | Checked 2026-09-03 | `safety_rules`, `safety_rule_sources` | Fire service factsheet. Not a substitute for emergency services: call 000. |
| CFA Victoria — lithium-ion battery fire risks | https://news.cfa.vic.gov.au/news/victorian-fire-agencies-and-regulator-urge-caution-over-lithium-ion-battery-fire-risks | Crown copyright, Victorian Government. Linked only. | Checked 2026-09-03 | `safety_rules` (swollen battery) | Public safety warning. Not a repair or disposal manual for any specific product. |
| ACCC Product Safety — Recalls (official search) | https://www.productsafety.gov.au/recalls | Australian Government open data | Checked 2026-09-03 | `safety_rules` (possible recall) | The official notice governs. A FixForward candidate is never confirmation. |
| OAIC — Tips to protect your privacy | https://www.oaic.gov.au/privacy/your-privacy-rights/ways-to-protect-your-privacy/tips-to-protect-your-privacy | Crown copyright, Commonwealth of Australia. Linked only. | Checked 2026-09-03 | `safety_rules` (personal data on device) | General consumer guidance. Not legal advice, and it does not confirm data has been erased from any device. |

Every URL above was requested during the last run of
`06_seed_safety_rule_sources.py --strict-urls` and returned HTTP 200.

## Removed source

**Australian postcodes (schappim community CSV)**,
`https://github.com/schappim/australian-postcodes`, previously supplied 3089
`suburb_postcodes` rows described as a "community open dataset".

The repository has **no licence file** — the GitHub API returns `license: null`
— so no reuse rights were ever granted, and "community open dataset" was not a
licence. It has been replaced by the ABS ASGS boundaries above, and its
`data_sources` row was deleted once nothing referenced it.

## Reproducing the ABS import

`06_load_abs_suburbs.py` downloads both zips into the gitignored
`data/raw/suburbs/abs/`, records their SHA-256 checksums in `data_import_runs`,
computes an area-weighted polygon centroid for each Victorian SAL, and resolves
the postcode by testing which POA polygon contains that centroid. Where a
centroid falls outside its own concave boundary, a representative interior point
is used instead. The derived output is committed as
`data/clean/suburb_postcodes.csv`.

Checksums of the exact snapshots used for Iteration 1:

- `OpenRepairData_v0.3_aggregate_202507.csv` — `364d741b39b40ce955a5a9f83adf9776b3f40f2f857cc2cd96b6ae1818aabe82`
- `accc_recalls_2026-08-31.xml` — `a68ef67e503133e7ec44c5be18a6a7eeac4360babd461305b5297c401f162994`
- `waste_infrastructure_2025-10.json` — `12ca88d371f6da33f1c180db0bcbb241c91fbe02f4dbd6cfde6d6c67c63f93ed`
- `victoria_repair_pois.json` — `d4a0e74c532431a949512d5291f76499ed775da9b4c38eb359a46768bd6507ef`
- `SAL_2021_AUST_GDA2020_SHP.zip` — `1284f6aa4a5eedbe6d0b8c71099494f634d59f1500532c1944b8227b4d1474ca`
- `POA_2021_AUST_GDA2020_SHP.zip` — `92182d5e491a2dc0d49bd282283722701eef8a347ae072c04c344b4aeac2c49a`

The ACCC, DataVic and OSM snapshots are committed under `data/raw/` so a rebuild
is deterministic. The ORA CSV is 56 MB and email-gated; place it at
`data/raw/ora/OpenRepairData_v0.3_aggregate_202507.csv` and run
`python data/scripts/00_fetch_ora.py` to verify the checksum. ABS zips are
re-downloaded by `06_load_abs_suburbs.py` and hashed on import.

## Attribution required in the app

- OpenStreetMap: "© OpenStreetMap contributors", ODbL.
- DataVic and ABS: CC BY 4.0 attribution to the State of Victoria and the
  Australian Bureau of Statistics respectively.
- Open Repair Alliance: CC BY-SA 4.0.

## Privacy note

No user assessment answers, brands, models, chosen suburbs or prices are stored
in Neon. The database holds public open data only.
