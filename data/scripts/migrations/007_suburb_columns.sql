-- FixForward migration 007 — suburb provenance columns (schema phase)
--
-- Columns only, so 06_load_abs_suburbs.py has somewhere to write. The matching
-- validation constraints live in migration 009, which runs after the data has
-- been replaced and can therefore audit real rows.
--
-- is_approximate defaults TRUE because every coordinate here is a polygon
-- centroid. Nothing in this table is an address or an exact position.

ALTER TABLE suburb_postcodes ADD COLUMN IF NOT EXISTS abs_code TEXT;
ALTER TABLE suburb_postcodes ADD COLUMN IF NOT EXISTS centroid_method TEXT;
ALTER TABLE suburb_postcodes ADD COLUMN IF NOT EXISTS is_approximate BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN suburb_postcodes.latitude IS
    'Approximate suburb centroid. Never an address or an exact location.';
COMMENT ON COLUMN suburb_postcodes.longitude IS
    'Approximate suburb centroid. Never an address or an exact location.';
