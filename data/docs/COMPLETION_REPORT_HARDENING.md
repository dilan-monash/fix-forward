# Database hardening — completion report

Generated against the live Neon database on 2026-09-03, then updated the same
day to close the remaining 9/10 review items.

This round was about making the database represent the available evidence
truthfully, then making that result reproducible. Several headline numbers went
**down**, and that is the point: the previous figures counted things that had
not actually been established.

## Before and after

| Measure | First load | After honesty pass | After 10/10 pass |
|---|---|---|---|
| Locations claiming a `verification_url` | 729 | 0 | 0 |
| Locations with source provenance | 0 | 729 | 729, columns now NOT NULL |
| Facility-level verification | reported as 729 | 0 | 0 |
| Recall matches reported | 6 | 1 | 1, with `matched_field=title` |
| Recall false positives | 5 | 0 | 0 |
| Active recall patterns | inline aliases | 83 | 81 (2 microwave patterns deactivated) |
| Suburb rows / licence | 3089 / none | 2944 / CC BY 4.0 | unchanged |
| Import checksums | none | ABS only | ACCC, ORA, DataVic, OSM, ABS |
| `location_appliance_acceptance.category_code` FK | n/a | missing | present |
| Location-level `accepts_electrical_appliances` / `public_access` | NULL | NULL | **dropped** |
| Regression tests | 0 | 34 | 48, all passing |
| Public repo contents | README + gitignore | same | full pipeline, snapshots, docs |

## Answers to the eight remaining review items

### 1. Confirm the recall candidate — tooling ready, sign-off left human

The Mistral Barrel Cyclonic Vacuum Cleaner is a genuine-looking appliance
recall: pattern `vacuum cleaner` matched the title text `Vacuum Cleaner`
(`matched_field = title`, confidence `high`). Official notice:
https://www.productsafety.gov.au/search-consumer-product-recalls/mistral-barrel-cyclonic-vacuum-cleaner-%E2%80%93-sold-at-bunnings

`review_status` is still `unreviewed` **on purpose**. Confirming it requires a
named person to open that notice and record the decision. The database now
rejects `confirmed` or `false_positive` without `reviewed_by` and
`reviewed_at`.

```bash
python data/scripts/06_review_recall_match.py --list
python data/scripts/06_review_recall_match.py   # records a named decision
```

This is the single outstanding manual action.

### 2. Resolve the microwave decision — removed, not split

ORA v0.3 has no microwave, oven or fryer product category. A separate
microwave category would have no honest repair evidence, which is the same
problem as showing air-fryer / small-kitchen-item statistics beside a
microwave recall.

Microwave aliases were removed from `appliance_families.csv`. The two
microwave patterns were deactivated (not left active) and a regression test
fails if they return. Deep fryers stay in `air_fryer_and_other_complex_kitchen`.

### 3. Missing category foreign key — added

Migration `010_integrity_and_cleanup.sql` adds
`location_appliance_acceptance_category_fk`. The regression suite inserts an
unknown `category_code` and asserts a foreign-key violation.

### 4. Store the recall match field — added

`recall_category_matches.matched_field` is `title` or `summary`, NOT NULL
after migration 011. Title is preferred when confidence is equal. The stored
Mistral candidate is `title`.

### 5. Commit the deliverables — see git history

Migrations 001–011, import and matching scripts, 48 regression tests, the
data-quality report, verification policy, this report, the ABS-derived suburb
CSV, the small ACCC/DataVic/OSM snapshots, and the rebuild instructions in
`README.md` are in the project repository. `.env` stays gitignored.

### 6. Clean rebuild — see REBUILD_VERIFICATION.md

A throwaway Neon database is rebuilt from a fresh clone using only committed
artefacts, then compared with production. Evidence is in
[`REBUILD_VERIFICATION.md`](REBUILD_VERIFICATION.md).

### 7. Remaining import provenance — checksums recorded

Each of the five data imports now stores a SHA-256 of the exact snapshot:

| Snapshot | SHA-256 |
|---|---|
| `accc_recalls_2026-08-31.xml` | `a68ef67e503133e7ec44c5be18a6a7eeac4360babd461305b5297c401f162994` |
| `OpenRepairData_v0.3_aggregate_202507.csv` | `364d741b39b40ce955a5a9f83adf9776b3f40f2f857cc2cd96b6ae1818aabe82` |
| `waste_infrastructure_2025-10.json` | `12ca88d371f6da33f1c180db0bcbb241c91fbe02f4dbd6cfde6d6c67c63f93ed` |
| `victoria_repair_pois.json` | `d4a0e74c532431a949512d5291f76499ed775da9b4c38eb359a46768bd6507ef` |
| `SAL_2021_AUST_GDA2020_SHP.zip` | `1284f6aa4a5eedbe6d0b8c71099494f634d59f1500532c1944b8227b4d1474ca` |
| `POA_2021_AUST_GDA2020_SHP.zip` | `92182d5e491a2dc0d49bd282283722701eef8a347ae072c04c344b4aeac2c49a` |

`00_fetch_ora.py` refuses to proceed if the ORA file is missing or the digest
differs. ACCC, DataVic and OSM snapshots are committed so a rebuild does not
depend on a rolling feed.

### 8. Minor schema cleanup — done

`locations.source_url`, `source_retrieved_at` and `provider_type` are NOT NULL.
`locations.accepts_electrical_appliances` and `locations.public_access` have
been dropped. The only public-access column left is on
`location_appliance_acceptance`.

## Current production counts

| Object | Count |
|---|---|
| locations | 729 (all `unverified`) |
| verified_location_recommendations | 0 |
| unverified_location_candidates | 729 |
| location_appliance_acceptance | 0 |
| recalls | 100 (2026-04-16 to 2026-08-27) |
| active recall patterns | 81 |
| recall candidates | 1, unreviewed |
| suburb_postcodes | 2944 |
| safety_rules / citations | 14 / 19 |
| data_import_runs with checksums | 5 of 5 |

## Remaining unknowns (honest, not defects)

1. Facility verification is 0% on all 729 locations.
2. Appliance acceptance is unknown for every location and category pair.
3. Public access is unknown. It is not inferred from facility type.
4. 51 locations have no postcode (suburb name does not match an ABS locality).
5. Recall coverage is a rolling snapshot, not full ACCC history.
6. The Mistral candidate is unreviewed until a named person signs it off.
7. Microwaves are out of Iteration 1 scope.
8. Suburb coordinates are approximate centroids.
9. ABS boundaries are 2021 vintage.
10. OpenStreetMap repair data is thin and volunteer-maintained.

## Not done, deliberately

- No location was marked verified to improve a percentage.
- No acceptance or public-access value was inferred from facility type.
- No recall was matched on a bare term to raise coverage.
- The Mistral candidate was not auto-confirmed.
- No personal information is collected or stored.
