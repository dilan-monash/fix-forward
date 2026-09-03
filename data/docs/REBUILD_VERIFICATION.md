# Rebuild verification

Performed 2026-09-03 against commit `e3d1306` on GitHub
(`https://github.com/dilan-monash/fix-forward`).

## Method

1. `CREATE DATABASE fixforward_rebuild_test` on the same Neon project as
   production (`neondb`).
2. `git clone` of the committed repository into `/tmp/fixforward-rebuild`.
3. Place the two unpublished snapshots the README requires, then verify them:
   - ORA CSV, checksum-checked by `00_fetch_ora.py`
   - ABS SAL and POA zips (too large to commit; hashed on import)
4. Point `DATABASE_URL` at `fixforward_rebuild_test`.
5. Run the README rebuild sequence: schema, migrations 001–008 and 010,
   loaders from committed ACCC/DataVic/OSM snapshots, ORA clean/load, seeds,
   ABS suburbs, enrich, verification fix, recall patterns and match, safety
   sources, migrations 009 and 011.
6. Run `06_regression_tests.py` (48/48) and `05_data_quality_report.py` (pass).
7. Compare row counts and latest-run checksums with production.
8. `DROP DATABASE fixforward_rebuild_test`.

No live ACCC/DataVic/OSM re-download was used. Those snapshots are committed.

## Count comparison

| Measure | Production | Rebuild | Match |
|---|---|---|---|
| locations | 729 | 729 | yes |
| repair / recycling | 66 / 663 | 66 / 663 | yes |
| locations with postcode | 676 | 676 | yes |
| unverified locations | 729 | 729 | yes |
| verified_location_recommendations | 0 | 0 | yes |
| unverified_location_candidates | 729 | 729 | yes |
| location_appliance_acceptance | 0 | 0 | yes |
| recalls | 100 | 100 | yes |
| active recall patterns | 81 | 81 | yes |
| inactive recall patterns | 2 | 0 | see below |
| recall candidates (title, unreviewed) | 1 | 1 | yes |
| repair_statistics / repair_barriers | 11 / 56 | 11 / 56 | yes |
| suburb_postcodes | 2944 | 2944 | yes |
| safety_rules / citations | 14 / 19 | 14 / 19 | yes |
| appliance_categories | 11 | 11 | yes |
| data_sources | 10 | 10 | yes |
| data_import_runs with checksum | 5 / 5 | 5 / 5 | yes |

## Checksums (identical)

| Snapshot | SHA-256 |
|---|---|
| `accc_recalls_2026-08-31.xml` | `a68ef67e503133e7ec44c5be18a6a7eeac4360babd461305b5297c401f162994` |
| `OpenRepairData_v0.3_aggregate_202507.csv` | `364d741b39b40ce955a5a9f83adf9776b3f40f2f857cc2cd96b6ae1818aabe82` |
| `waste_infrastructure_2025-10.json` | `12ca88d371f6da33f1c180db0bcbb241c91fbe02f4dbd6cfde6d6c67c63f93ed` |
| `victoria_repair_pois.json` | `d4a0e74c532431a949512d5291f76499ed775da9b4c38eb359a46768bd6507ef` |
| `SAL_2021_AUST_GDA2020_SHP.zip` | `1284f6aa4a5eedbe6d0b8c71099494f634d59f1500532c1944b8227b4d1474ca` |
| `POA_2021_AUST_GDA2020_SHP.zip` | `92182d5e491a2dc0d49bd282283722701eef8a347ae072c04c344b4aeac2c49a` |

## Differences, and why they are legitimate

**Inactive recall patterns (2 vs 0).** Production previously contained two
microwave patterns. They were deactivated when microwaves were taken out of
scope, and kept as an audit trail. A clean rebuild never inserts them, so it
has 81 active patterns and 0 inactive. Active behaviour is identical.

**Two stale postcodes, since cleared.** The first rebuild comparison showed
production with 678 postcodes and the rebuild with 676. The extras were
`Ballarat Transfer Station` (`Ballarat` / `3350`) and `Banyule Waste Recovery
Centre` (`Bellfield` / `3381`). ABS has no locality named exactly `Ballarat`
or `Bellfield` — it uses `Ballarat Central` and disambiguated Bellfields —
so the rebuild correctly left them NULL. The production values were leftovers
from the unlicensed community postcode CSV: enrichment filled them, then ABS
replaced `suburb_postcodes` without clearing unmatched location postcodes.
`3381` is the Northern Grampians Bellfield, not Banyule's `3081`.

`05_enrich_locations.py` now clears postcodes that no longer match an ABS
locality. Re-running it on production removed those two rows. Both databases
now report **676 / 729**.

## Tests

Rebuild database: 48 passed, 0 failed. Data-quality report: passed. Production
after the postcode cleanup: the same 48 tests pass.

## Outstanding manual action (unchanged by the rebuild)

The Mistral vacuum candidate remains `unreviewed` on both databases until a
named person runs `06_review_recall_match.py`.
