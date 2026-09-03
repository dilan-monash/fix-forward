# Team API contract notes (database → Flask)

Haochen: suggested **read-only** queries. Do not create POST endpoints for
assessment answers. Keep user answers in browser memory only.

## Appliance catalogue

```sql
SELECT family_name, category_name, category_code, display_order
FROM appliance_categories
WHERE active
ORDER BY display_order;
```

## Recall candidates

Read from `recall_category_matches`. Do not run your own `LIKE` search over
recall text: that is exactly what produced four infant products as "fans".

```sql
SELECT r.title, r.published_date, r.official_url,
       m.matched_pattern, m.matched_text, m.matched_field,
       m.match_confidence, m.review_status
FROM recall_category_matches m
JOIN recalls r ON r.id = m.recall_id
WHERE m.category_code = %s
  AND m.review_status <> 'false_positive'
ORDER BY r.published_date DESC;
```

Snapshot limits to display alongside any result, matched or not:

```sql
SELECT r.coverage_start, r.coverage_end, r.record_count, r.limitations
FROM data_import_runs r
JOIN data_sources ds ON ds.id = r.data_source_id
WHERE ds.name ILIKE '%ACCC%'
ORDER BY r.retrieved_at DESC
LIMIT 1;
```

Required wording, whether or not there is a match:

> FixForward checks a limited ACCC data snapshot. No match does not prove that
> the product is recall-free.

Always link `official_url` for a match, and
https://www.productsafety.gov.au/recalls either way.

## Repair evidence

```sql
SELECT * FROM repair_statistics
WHERE appliance_family = %s AND appliance_category = %s;

SELECT barrier, occurrence_count FROM repair_barriers
WHERE appliance_family = %s AND appliance_category = %s
ORDER BY occurrence_count DESC;
```

Show sample size, geography, confidence and limitations. Prefer AU before the
labelled global fallback.

## Safety questions

```sql
SELECT hazard_code, question_text, severity, stop_use_required,
       professional_assessment_required, guidance_text, source_name, source_url
FROM safety_rules
WHERE active
ORDER BY display_order;
```

Full citations, where a rule rests on more than one source:

```sql
SELECT source_name, source_url, publisher, supports, is_primary
FROM safety_rule_sources
WHERE safety_rule_id = %s
ORDER BY is_primary DESC;
```

Never describe screening as a diagnosis or as certifying that an appliance is
safe.

## Locations

**Two queries, two very different meanings.** Do not mix them.

Recommendable locations, which have confirmed acceptance for the chosen
category, confirmed public access and checked facility evidence:

```sql
SELECT * FROM verified_location_recommendations
WHERE category_code = %s;
```

This currently returns **zero rows**, and that is correct. Do not work around it
by falling back to `locations` and presenting the result as a recommendation.

Everything else, which may be shown only with its disclaimer:

```sql
SELECT * FROM unverified_location_candidates
WHERE location_type = %s;
```

Each row carries `display_disclaimer`, which must be rendered with it:

> Potential nearby service. Acceptance and public access have not been verified.
> Check before visiting.

For the disposal browse list, filter
`location_type = 'recycling' AND household_electrical_relevant = TRUE`. That
flag means "worth browsing", not "accepts your appliance".

`location_appliance_acceptance` is the only place appliance acceptance and
public access are recorded. The location-level columns
`accepts_electrical_appliances` and `public_access` have been **dropped**.
Do not query `locations` for them, and never infer a value from
`facility_type`, `provider_type` or coordinates. A missing acceptance row
means unknown, not "no".

## Suburb lookup

```sql
SELECT suburb, postcode, latitude, longitude
FROM suburb_postcodes
WHERE lower(suburb) = lower(%s) OR postcode = %s;
```

Coordinates are ABS polygon centroids. Use them for approximate distance
sorting only, and never label them as an exact location. A suburb spanning
several postcodes is recorded with the one containing its centroid.

## Provenance for any "where did this come from?" UI

```sql
SELECT ds.name, ds.url, ds.licence, r.retrieved_at, r.coverage_start,
       r.coverage_end, r.record_count, r.checksum, r.limitations
FROM data_import_runs r
JOIN data_sources ds ON ds.id = r.data_source_id
ORDER BY r.retrieved_at DESC;
```

Attribution is required for OpenStreetMap (ODbL, "© OpenStreetMap
contributors"), DataVic and ABS (CC BY 4.0), and Open Repair Alliance
(CC BY-SA 4.0).

## Security

- Parameterised SQL only.
- Never expose `DATABASE_URL` to the browser.
- No INSERT, UPDATE or DELETE of assessment data.
- No personal information is collected or stored anywhere in this schema.
