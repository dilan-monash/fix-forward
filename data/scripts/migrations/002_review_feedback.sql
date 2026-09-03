-- FixForward migration 002 — review feedback completion (NON-DESTRUCTIVE)

-- Location recommendation flag (TRUE only when acceptance + public access confirmed)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS recommendation_eligible BOOLEAN NOT NULL DEFAULT FALSE;

-- Suburb provenance link
ALTER TABLE suburb_postcodes ADD COLUMN IF NOT EXISTS data_source_id INTEGER REFERENCES data_sources (id);

-- Recall feed window metadata (per row = same snapshot window for I1 RSS)
ALTER TABLE recalls ADD COLUMN IF NOT EXISTS feed_retrieved_at DATE;
ALTER TABLE recalls ADD COLUMN IF NOT EXISTS feed_window_start DATE;
ALTER TABLE recalls ADD COLUMN IF NOT EXISTS feed_window_end DATE;

-- Single-row style meta also kept on ACCC data_sources.version via load script

-- Safe CHECK constraints (drop first if re-running with same names)
ALTER TABLE safety_rules DROP CONSTRAINT IF EXISTS safety_rules_severity_check;
ALTER TABLE safety_rules
    ADD CONSTRAINT safety_rules_severity_check
    CHECK (severity IN ('high', 'medium'));

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_location_type_check;
ALTER TABLE locations
    ADD CONSTRAINT locations_location_type_check
    CHECK (location_type IN ('repair', 'recycling'));

CREATE INDEX IF NOT EXISTS idx_locations_recommendation_eligible
    ON locations (recommendation_eligible)
    WHERE recommendation_eligible = TRUE;
