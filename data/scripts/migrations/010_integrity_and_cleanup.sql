-- FixForward migration 010 — remaining integrity and schema cleanup
--
-- Schema phase. matched_field is added nullable here; 011 sets NOT NULL after
-- 06_match_recalls.py backfills it from title/summary matching.

-- ---------------------------------------------------------------------------
-- 1. Acceptance rows must reference a real appliance category
-- ---------------------------------------------------------------------------
ALTER TABLE location_appliance_acceptance
    DROP CONSTRAINT IF EXISTS location_appliance_acceptance_category_fk;
ALTER TABLE location_appliance_acceptance
    ADD CONSTRAINT location_appliance_acceptance_category_fk
    FOREIGN KEY (category_code) REFERENCES appliance_categories (category_code);

-- ---------------------------------------------------------------------------
-- 2. Record which recall field matched, and who reviewed a candidate
-- ---------------------------------------------------------------------------
ALTER TABLE recall_category_matches
    ADD COLUMN IF NOT EXISTS matched_field TEXT;
ALTER TABLE recall_category_matches
    ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE recall_category_matches
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE recall_category_matches
    DROP CONSTRAINT IF EXISTS recall_category_matches_matched_field_check;
ALTER TABLE recall_category_matches
    ADD CONSTRAINT recall_category_matches_matched_field_check
    CHECK (matched_field IS NULL OR matched_field IN ('title', 'summary'));

-- A confirmed or false-positive decision must name the reviewer and the date.
-- unreviewed candidates are allowed to have neither.
ALTER TABLE recall_category_matches
    DROP CONSTRAINT IF EXISTS recall_category_matches_review_attribution_check;
ALTER TABLE recall_category_matches
    ADD CONSTRAINT recall_category_matches_review_attribution_check
    CHECK (
        review_status = 'unreviewed'
        OR (
            reviewed_by IS NOT NULL AND btrim(reviewed_by) <> ''
            AND reviewed_at IS NOT NULL
        )
    );

-- ---------------------------------------------------------------------------
-- 3. Location provenance is complete; drop the superseded coarse flags
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    n_url INTEGER;
    n_retrieved INTEGER;
    n_provider INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_url FROM locations WHERE source_url IS NULL OR btrim(source_url) = '';
    SELECT COUNT(*) INTO n_retrieved FROM locations WHERE source_retrieved_at IS NULL;
    SELECT COUNT(*) INTO n_provider FROM locations WHERE provider_type IS NULL OR btrim(provider_type) = '';
    IF n_url + n_retrieved + n_provider > 0 THEN
        RAISE EXCEPTION
            'migration 010: locations provenance incomplete (null source_url %, null source_retrieved_at %, null provider_type %). Run 05_enrich_locations.py and 06_fix_location_verification.py first.',
            n_url, n_retrieved, n_provider;
    END IF;
END $$;

ALTER TABLE locations ALTER COLUMN source_url SET NOT NULL;
ALTER TABLE locations ALTER COLUMN source_retrieved_at SET NOT NULL;
ALTER TABLE locations ALTER COLUMN provider_type SET NOT NULL;

-- Tightened now that NULL is no longer allowed.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_provider_type_check;
ALTER TABLE locations
    ADD CONSTRAINT locations_provider_type_check
    CHECK (provider_type IN (
        'recycling_facility', 'transfer_station', 'e_waste_reprocessor',
        'electronics_repair', 'electronics_shop_repair', 'repair_cafe', 'repair_service'
    ));

-- These location-level booleans are superseded by location_appliance_acceptance.
-- They were 100% NULL and a trap for anyone querying locations directly.
ALTER TABLE locations DROP COLUMN IF EXISTS accepts_electrical_appliances;
ALTER TABLE locations DROP COLUMN IF EXISTS public_access;
