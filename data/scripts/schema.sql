-- FixForward Victoria — Iteration 1 public data schema (PostgreSQL / Neon)
-- Public open data only. No user answers, sessions, or personal data.

-- Drop existing I1 tables if re-running during development (order matters for FKs)
DROP TABLE IF EXISTS repair_barriers CASCADE;
DROP TABLE IF EXISTS repair_statistics CASCADE;
DROP TABLE IF EXISTS recalls CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;

-- Metadata for every open dataset we use
CREATE TABLE data_sources (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    url             TEXT NOT NULL,
    licence         TEXT NOT NULL,
    retrieval_date  DATE NOT NULL,
    version         TEXT,
    limitations     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ACCC recall index (possible matches only — not confirmed recalls)
CREATE TABLE recalls (
    id                  SERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    published_date      DATE,
    summary             TEXT,
    official_url        TEXT NOT NULL UNIQUE,
    match_keywords      TEXT,
    data_source_id      INTEGER REFERENCES data_sources (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Category-level repair benchmarks (not model-specific predictions)
CREATE TABLE repair_statistics (
    id                  SERIAL PRIMARY KEY,
    appliance_family    TEXT NOT NULL,
    appliance_category  TEXT NOT NULL,
    geography           TEXT NOT NULL,          -- e.g. 'AU', 'global_fallback'
    sample_size         INTEGER NOT NULL,
    fixed_count         INTEGER,
    repairable_count    INTEGER,
    end_of_life_count   INTEGER,
    insufficient_evidence BOOLEAN NOT NULL DEFAULT FALSE,
    confidence_level    TEXT NOT NULL,          -- e.g. 'high', 'low', 'insufficient'
    limitations         TEXT NOT NULL,
    data_source_id      INTEGER REFERENCES data_sources (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (appliance_family, appliance_category, geography)
);

-- Common repair barriers by category (for "Why this pathway?")
CREATE TABLE repair_barriers (
    id                  SERIAL PRIMARY KEY,
    appliance_family    TEXT NOT NULL,
    appliance_category  TEXT NOT NULL,
    barrier             TEXT NOT NULL,
    occurrence_count    INTEGER,
    geography           TEXT NOT NULL DEFAULT 'AU',
    data_source_id      INTEGER REFERENCES data_sources (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repair services (OSM) and recycling facilities (DataVic)
CREATE TABLE locations (
    id                  SERIAL PRIMARY KEY,
    location_type       TEXT NOT NULL,          -- 'repair' or 'recycling'
    name                TEXT NOT NULL,
    facility_type       TEXT,
    address             TEXT,
    suburb              TEXT,
    lga                 TEXT,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    phone               TEXT,
    website             TEXT,
    source_notes        TEXT,                 -- e.g. contact before travelling
    data_source_id      INTEGER REFERENCES data_sources (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recalls_keywords ON recalls (match_keywords);
CREATE INDEX idx_repair_stats_category ON repair_statistics (appliance_family, appliance_category);
CREATE INDEX idx_locations_suburb_type ON locations (suburb, location_type);
