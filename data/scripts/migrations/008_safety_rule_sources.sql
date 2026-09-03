-- FixForward migration 008 — allow a safety rule to cite more than one source
--
-- safety_rules.source_url holds a single URL, which forced compromises: the
-- swollen-battery rule cited a general CFA electricity factsheet because there
-- was nowhere to put both the lithium-ion guidance and the electrical guidance.
-- The single-URL columns stay for backwards compatibility with existing reads;
-- this table is the fuller record.

CREATE TABLE IF NOT EXISTS safety_rule_sources (
    id              BIGSERIAL PRIMARY KEY,
    safety_rule_id  INTEGER NOT NULL REFERENCES safety_rules (id) ON DELETE CASCADE,
    source_name     TEXT NOT NULL,
    source_url      TEXT NOT NULL,
    publisher       TEXT NOT NULL,
    supports        TEXT NOT NULL,   -- what this specific source backs up
    retrieved_at    DATE NOT NULL,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    data_source_id  INTEGER REFERENCES data_sources (id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (safety_rule_id, source_url)
);

-- A citation has to point at a specific page, not a bare homepage.
ALTER TABLE safety_rule_sources DROP CONSTRAINT IF EXISTS safety_rule_sources_specific_url_check;
ALTER TABLE safety_rule_sources
    ADD CONSTRAINT safety_rule_sources_specific_url_check
    CHECK (source_url ~ '^https://[^/]+/.+');

CREATE INDEX IF NOT EXISTS idx_safety_rule_sources_rule
    ON safety_rule_sources (safety_rule_id);

-- Exactly one primary source per rule keeps the single-URL column meaningful.
DROP INDEX IF EXISTS uq_safety_rule_primary_source;
CREATE UNIQUE INDEX uq_safety_rule_primary_source
    ON safety_rule_sources (safety_rule_id)
    WHERE is_primary;
