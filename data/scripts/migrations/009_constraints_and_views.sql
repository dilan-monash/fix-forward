-- FixForward migration 009 — remaining constraints and the derived eligibility views
--
-- Run AFTER the import and fix scripts. Each constraint audits existing data
-- first so a failure names the problem instead of raising a bare violation.

DO $$
DECLARE
    n_alias   INTEGER;
    n_catord  INTEGER;
    n_ruleord INTEGER;
    n_loc     INTEGER;
    n_recall  INTEGER;
    n_stats   INTEGER;
    n_barrier INTEGER;
    s_postcode INTEGER;
    s_lat      INTEGER;
    s_lon      INTEGER;
    s_state    INTEGER;
    s_source   INTEGER;
    s_dup      INTEGER;
BEGIN
    -- Suburb data must be replaced by 06_load_abs_suburbs.py before this runs.
    SELECT COUNT(*) INTO s_postcode FROM suburb_postcodes WHERE postcode !~ '^[0-9]{4}$';
    SELECT COUNT(*) INTO s_lat FROM suburb_postcodes WHERE latitude NOT BETWEEN -90 AND 90;
    SELECT COUNT(*) INTO s_lon FROM suburb_postcodes WHERE longitude NOT BETWEEN -180 AND 180;
    SELECT COUNT(*) INTO s_state FROM suburb_postcodes WHERE state <> 'VIC';
    SELECT COUNT(*) INTO s_source FROM suburb_postcodes WHERE data_source_id IS NULL;
    SELECT COUNT(*) INTO s_dup FROM (
        SELECT lower(suburb) AS s, postcode FROM suburb_postcodes
        GROUP BY 1, 2 HAVING COUNT(*) > 1
    ) d;

    IF s_postcode + s_lat + s_lon + s_state + s_source + s_dup > 0 THEN
        RAISE EXCEPTION
            'migration 009: suburb_postcodes fails audit (bad postcode %, bad latitude %, bad longitude %, non-VIC %, missing data_source_id %, case-insensitive duplicates %). Run 06_load_abs_suburbs.py first.',
            s_postcode, s_lat, s_lon, s_state, s_source, s_dup;
    END IF;

    SELECT COUNT(*) INTO n_alias FROM appliance_categories
     WHERE active AND (search_aliases IS NULL OR btrim(search_aliases) = '');

    SELECT COUNT(*) INTO n_catord FROM (
        SELECT display_order FROM appliance_categories WHERE active
        GROUP BY 1 HAVING COUNT(*) > 1
    ) d;

    SELECT COUNT(*) INTO n_ruleord FROM (
        SELECT display_order FROM safety_rules WHERE active
        GROUP BY 1 HAVING COUNT(*) > 1
    ) d;

    SELECT COUNT(*) INTO n_loc     FROM locations          WHERE data_source_id IS NULL;
    SELECT COUNT(*) INTO n_recall  FROM recalls            WHERE data_source_id IS NULL;
    SELECT COUNT(*) INTO n_stats   FROM repair_statistics  WHERE data_source_id IS NULL;
    SELECT COUNT(*) INTO n_barrier FROM repair_barriers    WHERE data_source_id IS NULL;

    IF n_alias + n_catord + n_ruleord + n_loc + n_recall + n_stats + n_barrier > 0 THEN
        RAISE EXCEPTION
            'migration 009 audit failed: active categories without aliases %, duplicate active category display_order %, duplicate active rule display_order %, locations without data_source_id %, recalls %, repair_statistics %, repair_barriers %',
            n_alias, n_catord, n_ruleord, n_loc, n_recall, n_stats, n_barrier;
    END IF;
END $$;

-- Suburb validation. Coordinates here are approximate centroids, so the range
-- checks guard against import errors rather than certifying precision.
ALTER TABLE suburb_postcodes DROP CONSTRAINT IF EXISTS suburb_postcodes_postcode_check;
ALTER TABLE suburb_postcodes
    ADD CONSTRAINT suburb_postcodes_postcode_check CHECK (postcode ~ '^[0-9]{4}$');

ALTER TABLE suburb_postcodes DROP CONSTRAINT IF EXISTS suburb_postcodes_latitude_check;
ALTER TABLE suburb_postcodes
    ADD CONSTRAINT suburb_postcodes_latitude_check CHECK (latitude BETWEEN -90 AND 90);

ALTER TABLE suburb_postcodes DROP CONSTRAINT IF EXISTS suburb_postcodes_longitude_check;
ALTER TABLE suburb_postcodes
    ADD CONSTRAINT suburb_postcodes_longitude_check CHECK (longitude BETWEEN -180 AND 180);

ALTER TABLE suburb_postcodes DROP CONSTRAINT IF EXISTS suburb_postcodes_state_check;
ALTER TABLE suburb_postcodes
    ADD CONSTRAINT suburb_postcodes_state_check CHECK (state = 'VIC');

ALTER TABLE suburb_postcodes ALTER COLUMN data_source_id SET NOT NULL;

DROP INDEX IF EXISTS uq_suburb_postcodes_ci;
CREATE UNIQUE INDEX uq_suburb_postcodes_ci
    ON suburb_postcodes (lower(suburb), postcode);

-- An active category the user can pick must be searchable.
ALTER TABLE appliance_categories DROP CONSTRAINT IF EXISTS appliance_categories_active_aliases_check;
ALTER TABLE appliance_categories
    ADD CONSTRAINT appliance_categories_active_aliases_check
    CHECK (NOT active OR (search_aliases IS NOT NULL AND btrim(search_aliases) <> ''));

DROP INDEX IF EXISTS uq_appliance_categories_active_order;
CREATE UNIQUE INDEX uq_appliance_categories_active_order
    ON appliance_categories (display_order) WHERE active;

DROP INDEX IF EXISTS uq_safety_rules_active_order;
CREATE UNIQUE INDEX uq_safety_rules_active_order
    ON safety_rules (display_order) WHERE active;

-- Every imported record must say where it came from.
ALTER TABLE locations         ALTER COLUMN data_source_id SET NOT NULL;
ALTER TABLE recalls           ALTER COLUMN data_source_id SET NOT NULL;
ALTER TABLE repair_statistics ALTER COLUMN data_source_id SET NOT NULL;
ALTER TABLE repair_barriers   ALTER COLUMN data_source_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Eligibility is derived, never stored. A location reaches this view only when
-- the specific appliance category is confirmed accepted, public access is
-- confirmed, and facility-level evidence exists with a date it was checked.
-- ---------------------------------------------------------------------------
-- Dropped in dependency order: unverified_location_candidates is defined in
-- terms of verified_location_recommendations, so it goes first.
DROP VIEW IF EXISTS unverified_location_candidates;
DROP VIEW IF EXISTS verified_location_recommendations;
CREATE VIEW verified_location_recommendations AS
SELECT
    l.id,
    l.location_type,
    l.name,
    l.facility_type,
    l.provider_type,
    l.address,
    l.suburb,
    l.postcode,
    l.lga,
    l.latitude,
    l.longitude,
    l.phone,
    l.website,
    l.opening_hours,
    l.verification_url,
    l.last_verified_at,
    l.verification_status,
    l.verification_notes,
    l.source_url,
    l.source_retrieved_at,
    l.data_source_id,
    a.category_code,
    a.accepted_item_notes,
    a.evidence_url      AS acceptance_evidence_url,
    a.verified_at       AS acceptance_verified_at
FROM locations l
JOIN location_appliance_acceptance a ON a.location_id = l.id
WHERE l.household_electrical_relevant IS TRUE
  AND a.acceptance_status = 'confirmed'
  AND a.public_access IS TRUE
  AND l.verification_url IS NOT NULL
  AND l.last_verified_at IS NOT NULL
  AND l.verification_status <> 'unverified';

COMMENT ON VIEW verified_location_recommendations IS
    'Locations the app may present as a recommendation. Empty is a valid and correct result when no facility-level evidence has been gathered.';

-- Everything else may still be shown, but only with the honest label.
DROP VIEW IF EXISTS unverified_location_candidates;
CREATE VIEW unverified_location_candidates AS
SELECT
    l.id,
    l.location_type,
    l.name,
    l.facility_type,
    l.provider_type,
    l.address,
    l.suburb,
    l.postcode,
    l.lga,
    l.latitude,
    l.longitude,
    l.phone,
    l.website,
    l.opening_hours,
    l.verification_status,
    l.verification_notes,
    l.source_url,
    l.source_retrieved_at,
    l.data_source_id,
    'Potential nearby service. Acceptance and public access have not been verified. Check before visiting.'::text
        AS display_disclaimer
FROM locations l
WHERE NOT EXISTS (
    SELECT 1 FROM verified_location_recommendations v WHERE v.id = l.id
);

COMMENT ON VIEW unverified_location_candidates IS
    'Locations that must carry the unverified disclaimer. Never present these as confirmed drop-off or repair options.';
