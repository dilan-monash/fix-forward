-- FixForward migration 003 — separate source provenance from facility verification
--
-- Every locations.verification_url currently holds a *dataset* URL: the DataVic
-- package page (663 rows) or the OpenStreetMap copyright page (66 rows). A
-- dataset URL records where a row was imported from. It confirms nothing about
-- an individual facility. Storing it in verification_url lets the product claim
-- "100% verified" when nothing has actually been checked.
--
-- After this migration the two ideas have separate homes:
--   source_url / source_retrieved_at  -> where the record came from
--   verification_url / last_verified_at -> facility-specific evidence
--   verification_status / verification_notes -> what was confirmed, and what was not
--
-- Script 06_fix_location_verification.py moves the existing values.

ALTER TABLE locations ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS source_retrieved_at DATE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Audit existing data before constraining it, so a violation reports itself
-- instead of surfacing as an opaque constraint error.
DO $$
DECLARE
    bad INTEGER;
    sample TEXT;
BEGIN
    SELECT COUNT(*) INTO bad
      FROM locations
     WHERE verification_status NOT IN ('unverified', 'partially_verified', 'verified');
    IF bad > 0 THEN
        RAISE EXCEPTION 'migration 003: % locations rows hold an unknown verification_status', bad;
    END IF;

    SELECT COUNT(*), string_agg(DISTINCT provider_type, ', ')
      INTO bad, sample
      FROM locations
     WHERE provider_type IS NOT NULL
       AND provider_type NOT IN (
           'recycling_facility', 'transfer_station', 'e_waste_reprocessor',
           'electronics_repair', 'electronics_shop_repair', 'repair_cafe', 'repair_service'
       );
    IF bad > 0 THEN
        RAISE EXCEPTION 'migration 003: % locations rows hold an unlisted provider_type (%)', bad, sample;
    END IF;
END $$;

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_verification_status_check;
ALTER TABLE locations
    ADD CONSTRAINT locations_verification_status_check
    CHECK (verification_status IN ('unverified', 'partially_verified', 'verified'));

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_provider_type_check;
ALTER TABLE locations
    ADD CONSTRAINT locations_provider_type_check
    CHECK (provider_type IS NULL OR provider_type IN (
        'recycling_facility', 'transfer_station', 'e_waste_reprocessor',
        'electronics_repair', 'electronics_shop_repair', 'repair_cafe', 'repair_service'
    ));

-- Anything claiming to be verified must carry facility-level evidence.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_verification_evidence_check;
ALTER TABLE locations
    ADD CONSTRAINT locations_verification_evidence_check
    CHECK (
        verification_status = 'unverified'
        OR (verification_url IS NOT NULL AND last_verified_at IS NOT NULL)
    );

-- Eligibility becomes a derived view in migration 009. A stored boolean can be
-- set TRUE by any careless UPDATE; a view cannot.
DROP INDEX IF EXISTS idx_locations_recommendation_eligible;
ALTER TABLE locations DROP COLUMN IF EXISTS recommendation_eligible;

CREATE INDEX IF NOT EXISTS idx_locations_verification_status
    ON locations (verification_status);
