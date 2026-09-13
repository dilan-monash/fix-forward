-- OPTIONAL DATABASE-WRITING schema for future PostgreSQL price storage.
-- The current runtime reads local SQLite via backend/price_catalogue.py; this table is not used by that reader.
-- This file is not part of the Render build command or automatic Flask startup.

-- OPTIONAL future PostgreSQL storage for the public replacement-price catalogue.
-- This migration is NOT required by the explicit local SQLite snapshot and has
-- NOT been run on Neon. Applying it does not change the application's reader.
-- No user answers, locations, email addresses or credentials belong here.

BEGIN;

CREATE TABLE IF NOT EXISTS replacement_price_observations (
    id text PRIMARY KEY,
    category_code text NOT NULL,
    brand text NOT NULL CHECK (length(trim(brand)) > 0),
    model text NOT NULL CHECK (length(trim(model)) > 0),
    product_name text NOT NULL CHECK (length(trim(product_name)) > 0),
    retailer text NOT NULL CHECK (retailer IN (
        'JB Hi-Fi', 'Harvey Norman', 'The Good Guys', 'Kmart', 'BIG W',
        'Officeworks', 'Bing Lee', 'Myer', 'Amazon AU'
    )),
    price_cents bigint NOT NULL CHECK (price_cents > 0 AND price_cents <= 10000000),
    currency text NOT NULL DEFAULT 'AUD' CHECK (currency = 'AUD'),
    source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
    observed_at date NOT NULL,
    price_kind text NOT NULL DEFAULT 'advertised' CHECK (price_kind = 'advertised'),
    availability text NOT NULL DEFAULT 'not-verified'
        CHECK (availability IN ('not-verified', 'in-stock', 'out-of-stock')),
    notes text NOT NULL DEFAULT '',
    UNIQUE (source_url, observed_at, model)
);

CREATE INDEX IF NOT EXISTS replacement_prices_category_brand_model
    ON replacement_price_observations (category_code, brand, model);
CREATE INDEX IF NOT EXISTS replacement_prices_observed_at
    ON replacement_price_observations (observed_at);

CREATE TABLE IF NOT EXISTS replacement_price_catalogue_meta (
    key text PRIMARY KEY,
    value text NOT NULL
);

-- Runtime is read-only. Use a separate import credential for any future loader.
REVOKE ALL ON replacement_price_observations, replacement_price_catalogue_meta FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fixforward_runtime') THEN
        GRANT SELECT ON replacement_price_observations, replacement_price_catalogue_meta
            TO fixforward_runtime;
    END IF;
END
$$;

COMMIT;
