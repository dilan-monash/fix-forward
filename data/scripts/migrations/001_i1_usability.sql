-- FixForward Iteration 1 usability migration (NON-DESTRUCTIVE)
-- Adds catalogue, safety rules, suburb lookup, and location enrichment columns.
-- Does NOT drop existing public evidence tables.

-- ---------------------------------------------------------------------------
-- Appliance catalogue (stable UI labels from GOV-11 mapping)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appliance_categories (
    id              SERIAL PRIMARY KEY,
    family_code     TEXT NOT NULL,
    family_name     TEXT NOT NULL,
    category_code   TEXT NOT NULL,
    category_name   TEXT NOT NULL,
    ora_product_category TEXT,
    display_order   INTEGER NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    search_aliases  TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (family_code, category_code)
);

-- ---------------------------------------------------------------------------
-- Safety screening rules (version-controlled content; no user answers stored)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS safety_rules (
    id                              SERIAL PRIMARY KEY,
    appliance_family                TEXT,              -- NULL = applies to all families
    hazard_code                     TEXT NOT NULL UNIQUE,
    question_text                   TEXT NOT NULL,
    explanation                     TEXT NOT NULL,
    severity                        TEXT NOT NULL,     -- high | medium
    stop_use_required               BOOLEAN NOT NULL DEFAULT FALSE,
    professional_assessment_required BOOLEAN NOT NULL DEFAULT FALSE,
    guidance_text                   TEXT NOT NULL,
    source_name                     TEXT NOT NULL,
    source_url                      TEXT NOT NULL,
    last_reviewed_at                DATE NOT NULL,
    active                          BOOLEAN NOT NULL DEFAULT TRUE,
    display_order                   INTEGER NOT NULL DEFAULT 0,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Suburb / postcode centroids for manual location search (no browser GPS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suburb_postcodes (
    id              SERIAL PRIMARY KEY,
    suburb          TEXT NOT NULL,
    postcode        TEXT NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    state           TEXT NOT NULL DEFAULT 'VIC',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (suburb, postcode)
);

CREATE INDEX IF NOT EXISTS idx_suburb_postcodes_suburb
    ON suburb_postcodes (lower(suburb));
CREATE INDEX IF NOT EXISTS idx_suburb_postcodes_postcode
    ON suburb_postcodes (postcode);

-- ---------------------------------------------------------------------------
-- Location enrichment + recycling eligibility (nullable until sourced)
-- ---------------------------------------------------------------------------
ALTER TABLE locations ADD COLUMN IF NOT EXISTS household_electrical_relevant BOOLEAN;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS accepts_electrical_appliances BOOLEAN;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS public_access BOOLEAN;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS verification_url TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS last_verified_at DATE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS provider_type TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS postcode TEXT;

CREATE INDEX IF NOT EXISTS idx_locations_household_electrical
    ON locations (household_electrical_relevant)
    WHERE location_type = 'recycling';

-- ---------------------------------------------------------------------------
-- Official safety guidance sources (provenance only — not scraped content)
-- ---------------------------------------------------------------------------
INSERT INTO data_sources (name, url, licence, retrieval_date, version, limitations)
VALUES
(
    'Energy Safe Victoria — Using Electricity Safely',
    'https://www.energysafe.vic.gov.au/',
    'Crown copyright — official regulator guidance (link only)',
    CURRENT_DATE,
    'I1 reference',
    'Referenced for safety screening wording only. FixForward does not diagnose faults or certify safety.'
),
(
    'CFA Victoria — home fire safety guidance',
    'https://www.cfa.vic.gov.au/',
    'Crown copyright — official emergency service guidance (link only)',
    CURRENT_DATE,
    'I1 reference',
    'Referenced for fire/smoke hazard awareness. Not a substitute for emergency services (call 000).'
)
ON CONFLICT (name) DO UPDATE SET
    url = EXCLUDED.url,
    licence = EXCLUDED.licence,
    retrieval_date = EXCLUDED.retrieval_date,
    version = EXCLUDED.version,
    limitations = EXCLUDED.limitations;
