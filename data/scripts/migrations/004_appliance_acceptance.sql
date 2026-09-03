-- FixForward migration 004 — per-appliance acceptance at each location
--
-- locations.accepts_electrical_appliances is a single boolean for the whole
-- facility, which cannot express the common real case: a transfer station that
-- takes kettles and toasters but refuses anything with a damaged lithium
-- battery. This table records acceptance per location per appliance category.
--
-- The absence of a row means "unknown". It never means "not accepted".

CREATE TABLE IF NOT EXISTS location_appliance_acceptance (
    id                  BIGSERIAL PRIMARY KEY,
    location_id         INTEGER NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
    category_code       TEXT NOT NULL,
    acceptance_status   TEXT NOT NULL
        CHECK (acceptance_status IN ('confirmed', 'not_accepted', 'unknown')),
    public_access       BOOLEAN,
    accepted_item_notes TEXT,
    evidence_url        TEXT,
    verified_at         DATE,
    data_source_id      INTEGER REFERENCES data_sources (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (location_id, category_code)
);

-- 'confirmed' is a claim about the real world, so it has to cite something.
ALTER TABLE location_appliance_acceptance
    DROP CONSTRAINT IF EXISTS location_acceptance_confirmed_needs_evidence;
ALTER TABLE location_appliance_acceptance
    ADD CONSTRAINT location_acceptance_confirmed_needs_evidence
    CHECK (
        acceptance_status <> 'confirmed'
        OR (evidence_url IS NOT NULL AND verified_at IS NOT NULL AND data_source_id IS NOT NULL)
    );

-- 'not_accepted' is equally a claim about the real world.
ALTER TABLE location_appliance_acceptance
    DROP CONSTRAINT IF EXISTS location_acceptance_refusal_needs_evidence;
ALTER TABLE location_appliance_acceptance
    ADD CONSTRAINT location_acceptance_refusal_needs_evidence
    CHECK (
        acceptance_status <> 'not_accepted'
        OR (evidence_url IS NOT NULL AND verified_at IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_location_acceptance_lookup
    ON location_appliance_acceptance (category_code, acceptance_status);

-- category_code values come from appliance_categories. They are already
-- distinct, so a unique index lets later migrations reference them.
CREATE UNIQUE INDEX IF NOT EXISTS uq_appliance_categories_category_code
    ON appliance_categories (category_code);
