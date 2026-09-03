# Data dictionary — Iteration 1 (Neon)

Public open data only. No user answers, sessions or personal information are
stored anywhere in this schema.

## Provenance

### `data_sources`
One row per dataset. `id`, `name` (unique), `url`, `licence`, `retrieval_date`,
`version`, `limitations`, `created_at`.

`licence` must state real reuse terms. The regression suite fails if any row is
blank or says "community open dataset".

### `data_import_runs`
One row per import, so snapshot metadata is not repeated on every record.
`id`, `data_source_id`, `retrieved_at`, `coverage_start`, `coverage_end`,
`record_count`, `source_version`, `source_file_url`, `checksum`,
`import_status` (`succeeded` / `partial` / `failed`), `limitations`,
`created_at`. Unique on `(data_source_id, retrieved_at)`;
`coverage_start <= coverage_end`.

## Public evidence tables

### `recalls`
ACCC snapshot. `id`, `title`, `published_date`, `summary`, `official_url`
(unique), `match_keywords`, `data_source_id` (NOT NULL), `created_at`.

`match_keywords` is a sorted, de-duplicated bag of words. It has no word order,
so **never phrase-match against it**. The snapshot window lives in
`data_import_runs`, not here.

### `appliance_recall_patterns`
Reviewed matching rules. `id`, `category_code` (FK), `pattern`, `pattern_type`
(`exact_phrase` / `word_regex`), `required_context`, `excluded_context`,
`confidence` (`high` / `medium` / `low`), `active`, `notes`, `created_at`.
Unique on `(category_code, pattern)`.

Patterns are Python `re` syntax as evaluated by `recall_matching.py`. The
Postgres equivalent of `\b` is `\y` if one is ever run in SQL.

### `recall_category_matches`
Candidates, one per recall and category. `recall_id`, `category_code`,
`matched_pattern`, `matched_text`, `matched_field` (`title` / `summary`,
NOT NULL), `match_confidence`, `review_status` (`unreviewed` /
`confirmed` / `false_positive`), `review_notes`, `reviewed_by`,
`reviewed_at`, `created_at`. Primary key `(recall_id, category_code)`.

`matched_pattern`, `matched_text` and `matched_field` mean every candidate
can explain itself, including whether the hit came from the recall title or
the summary. A title hit is preferred when confidence is equal.

`review_status` survives re-matching, so human decisions are not overwritten.
A status other than `unreviewed` requires `reviewed_by` and `reviewed_at`.
Unreviewed is a valid state until a named person compares the candidate with
the official ACCC notice (`06_review_recall_match.py`).

### `repair_statistics`
Category benchmarks. `id`, `appliance_family`, `appliance_category`,
`geography`, `sample_size`, `fixed_count`, `repairable_count`,
`end_of_life_count`, `insufficient_evidence`, `confidence_level`,
`limitations`, `data_source_id` (NOT NULL), `created_at`.

### `repair_barriers`
`id`, `appliance_family`, `appliance_category`, `barrier`, `occurrence_count`,
`geography`, `data_source_id` (NOT NULL), `created_at`.

### `locations`
Repair and recycling places. `id`, `location_type` (`repair` / `recycling`),
`name`, `facility_type`, `address`, `suburb`, `postcode`, `lga`, `latitude`,
`longitude`, `phone`, `website`, `opening_hours`, `source_notes`,
`data_source_id` (NOT NULL), `created_at`.

Provenance, meaning where the row came from:

| Column | Meaning |
|---|---|
| `source_url` | The dataset this row was imported from. **NOT NULL.** |
| `source_retrieved_at` | When that dataset was downloaded. **NOT NULL.** |

Verification, meaning what was checked about **this facility**:

| Column | Meaning |
|---|---|
| `verification_url` | A facility-specific page that was actually checked |
| `last_verified_at` | The date it was checked |
| `verification_status` | `unverified` / `partially_verified` / `verified` |
| `verification_notes` | What the source establishes and what it does not |

A status other than `unverified` requires both `verification_url` and
`last_verified_at` (`locations_verification_evidence_check`). All 729 rows are
currently `unverified`.

Classification and unknowns:

| Column | Meaning |
|---|---|
| `household_electrical_relevant` | On the disposal browse shortlist. Not a claim that anything is accepted. |
| `provider_type` | Constrained to seven values: `recycling_facility`, `transfer_station`, `e_waste_reprocessor`, `electronics_repair`, `electronics_shop_repair`, `repair_cafe`, `repair_service`. **NOT NULL.** |

There is no `recommendation_eligible` column. Eligibility is derived by a view.

There are no location-level `accepts_electrical_appliances` or `public_access`
columns. Those were 100% NULL and have been dropped. Do not query them, and do
not infer either fact from `facility_type`, `provider_type` or coordinates.
Use `location_appliance_acceptance` only.

### `location_appliance_acceptance`
Acceptance per location **and** per appliance category. `id`, `location_id`
(FK, cascade), `category_code` (FK to `appliance_categories.category_code`),
`acceptance_status` (`confirmed` / `not_accepted` / `unknown`),
`public_access`, `accepted_item_notes`, `evidence_url`, `verified_at`,
`data_source_id`, `created_at`. Unique on `(location_id, category_code)`.

A missing row means **unknown**. Both `confirmed` and `not_accepted` are
rejected unless they carry `evidence_url` and `verified_at`; `confirmed` also
requires `data_source_id`. The table is currently empty because no free open
source states which household appliances a Victorian facility accepts.

## Catalogue, screening and location search

### `appliance_categories`
`id`, `family_code`, `family_name`, `category_code` (unique), `category_name`,
`ora_product_category`, `display_order`, `active`, `search_aliases`, `notes`,
`created_at`. Unique on `(family_code, category_code)`.

An `active` row must have non-empty `search_aliases`, and `display_order` is
unique among active rows.

### `safety_rules`
`id`, `appliance_family`, `hazard_code` (unique), `question_text`,
`explanation`, `severity` (`high` / `medium`), `stop_use_required`,
`professional_assessment_required`, `guidance_text`, `source_name`,
`source_url`, `last_reviewed_at`, `active`, `display_order`, `created_at`.
`display_order` is unique among active rows. **Never stores user answers.**

`source_name` and `source_url` mirror the primary row in `safety_rule_sources`.

### `safety_rule_sources`
Full citations, since a rule can rest on more than one source. `id`,
`safety_rule_id` (FK, cascade), `source_name`, `source_url`, `publisher`,
`supports`, `retrieved_at`, `is_primary`, `data_source_id`, `created_at`.
Unique on `(safety_rule_id, source_url)`, with at most one primary per rule.

`supports` states what that specific source backs up, so a reviewer can check
the claim against the citation. `source_url` must be a specific page, not a bare
domain.

### `suburb_postcodes`
`id`, `suburb`, `postcode`, `latitude`, `longitude`, `state`,
`data_source_id` (NOT NULL), `abs_code`, `centroid_method`, `is_approximate`,
`created_at`.

Checks: `postcode ~ '^[0-9]{4}$'`, latitude within ±90, longitude within ±180,
`state = 'VIC'`, and a case-insensitive unique index on
`(lower(suburb), postcode)`.

`latitude` and `longitude` are ABS polygon centroids. `is_approximate` is `TRUE`
on every row and these are never exact locations.

## Views

### `verified_location_recommendations`
Locations the app may present as a recommendation. A row appears only when the
facility is household-electrical relevant, the specific category is `confirmed`
accepted, public access is `TRUE`, `verification_url` and `last_verified_at`
are set, and `verification_status` is not `unverified`.

**Currently returns 0 rows, which is the correct result.**

### `unverified_location_candidates`
Everything not in the view above, with a `display_disclaimer` column that must
be rendered alongside the row:

> Potential nearby service. Acceptance and public access have not been verified.
> Check before visiting.

## Joins the app should use

- `*.data_source_id = data_sources.id`
- `data_import_runs.data_source_id = data_sources.id` for coverage and limits
- `recall_category_matches.recall_id = recalls.id`
- `recall_category_matches.category_code = appliance_categories.category_code`
- `safety_rule_sources.safety_rule_id = safety_rules.id`
- `repair_statistics.(appliance_family, appliance_category)` joins
  `repair_barriers` on the same pair
- Disposal browse: `locations.location_type = 'recycling' AND household_electrical_relevant = TRUE`
