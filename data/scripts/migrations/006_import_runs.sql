-- FixForward migration 006 — normalise import metadata into import runs
--
-- feed_retrieved_at, feed_window_start and feed_window_end were repeated
-- identically on all 100 recall rows. That is snapshot metadata, not a property
-- of an individual recall, and it had no home for the other datasets at all.
-- One row per import run replaces it and covers every source.

CREATE TABLE IF NOT EXISTS data_import_runs (
    id              BIGSERIAL PRIMARY KEY,
    data_source_id  INTEGER NOT NULL REFERENCES data_sources (id) ON DELETE CASCADE,
    retrieved_at    TIMESTAMPTZ NOT NULL,
    coverage_start  DATE,
    coverage_end    DATE,
    record_count    INTEGER NOT NULL,
    source_version  TEXT,
    source_file_url TEXT,
    checksum        TEXT,
    import_status   TEXT NOT NULL DEFAULT 'succeeded'
        CHECK (import_status IN ('succeeded', 'partial', 'failed')),
    limitations     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (data_source_id, retrieved_at)
);

ALTER TABLE data_import_runs DROP CONSTRAINT IF EXISTS data_import_runs_coverage_order_check;
ALTER TABLE data_import_runs
    ADD CONSTRAINT data_import_runs_coverage_order_check
    CHECK (coverage_start IS NULL OR coverage_end IS NULL OR coverage_start <= coverage_end);

ALTER TABLE data_import_runs DROP CONSTRAINT IF EXISTS data_import_runs_record_count_check;
ALTER TABLE data_import_runs
    ADD CONSTRAINT data_import_runs_record_count_check
    CHECK (record_count >= 0);

-- Backfill the ACCC snapshot from the per-recall columns before dropping them.
-- Guarded and executed dynamically so this migration stays re-runnable: once
-- the columns are gone there is nothing to backfill, and a static reference to
-- them would fail to parse.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'recalls'
          AND column_name = 'feed_retrieved_at'
    ) THEN
        EXECUTE $backfill$
            INSERT INTO data_import_runs (
                data_source_id, retrieved_at, coverage_start, coverage_end,
                record_count, source_version, source_file_url, import_status, limitations
            )
            SELECT
                r.data_source_id,
                MIN(r.feed_retrieved_at)::timestamptz,
                MIN(r.feed_window_start),
                MAX(r.feed_window_end),
                COUNT(*),
                ds.version,
                ds.url,
                'succeeded',
                ds.limitations
            FROM recalls r
            JOIN data_sources ds ON ds.id = r.data_source_id
            WHERE r.data_source_id IS NOT NULL
              AND r.feed_retrieved_at IS NOT NULL
            GROUP BY r.data_source_id, ds.version, ds.url, ds.limitations
            ON CONFLICT (data_source_id, retrieved_at) DO NOTHING;
        $backfill$;
    END IF;
END $$;

-- Backfill a run for every other loaded dataset from its data_sources entry.
INSERT INTO data_import_runs (
    data_source_id, retrieved_at, record_count,
    source_version, source_file_url, import_status, limitations
)
SELECT ds.id, ds.retrieval_date::timestamptz, counts.n, ds.version, ds.url, 'succeeded', ds.limitations
FROM data_sources ds
JOIN (
    SELECT data_source_id, COUNT(*) AS n FROM locations WHERE data_source_id IS NOT NULL GROUP BY 1
    UNION ALL
    SELECT data_source_id, COUNT(*) FROM repair_statistics WHERE data_source_id IS NOT NULL GROUP BY 1
) AS counts ON counts.data_source_id = ds.id
ON CONFLICT (data_source_id, retrieved_at) DO NOTHING;

-- Snapshot metadata now lives in data_import_runs, not on every recall row.
ALTER TABLE recalls DROP COLUMN IF EXISTS feed_retrieved_at;
ALTER TABLE recalls DROP COLUMN IF EXISTS feed_window_start;
ALTER TABLE recalls DROP COLUMN IF EXISTS feed_window_end;

CREATE INDEX IF NOT EXISTS idx_data_import_runs_source
    ON data_import_runs (data_source_id, retrieved_at DESC);
