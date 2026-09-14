-- Optional PostgreSQL schema for moving the reviewed repair-service fee snapshot later.
-- Do not run this against shared Neon until the team confirms a separate Iteration 2 target.

BEGIN;

CREATE TABLE IF NOT EXISTS repair_service_fee_observations (
    id text PRIMARY KEY,
    provider text NOT NULL CHECK (length(trim(provider)) > 0),
    label text NOT NULL CHECK (length(trim(label)) > 0),
    amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 10000000),
    note text NOT NULL CHECK (length(trim(note)) > 0),
    source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
    retrieved_at date NOT NULL
);

CREATE INDEX IF NOT EXISTS repair_service_fees_provider_date
    ON repair_service_fee_observations (provider, retrieved_at DESC);

REVOKE ALL ON repair_service_fee_observations FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fixforward_runtime') THEN
        GRANT SELECT ON repair_service_fee_observations TO fixforward_runtime;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fixforward_app') THEN
        GRANT SELECT ON repair_service_fee_observations TO fixforward_app;
    END IF;
END
$$;

COMMIT;
