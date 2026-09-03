-- FixForward migration 005 — pattern-based recall matching
--
-- The previous approach compared category aliases to recall text with
-- ILIKE '%term%'. With no word boundaries this produced obvious nonsense:
-- the alias "fan" matched four infant products ("babies and infants",
-- "Pull String Interactive Toys", "5-in-1 nursery center", "Joolz Aer2 car
-- seat adapter") and the alias "vacuum" matched a vacuum-insulated food jar.
-- Of six reported matches only one, the Mistral Barrel Cyclonic Vacuum
-- Cleaner, was a real appliance recall.
--
-- Patterns now live in a table so they can be reviewed and corrected without
-- a code change, and every stored match records the pattern that produced it.

CREATE TABLE IF NOT EXISTS appliance_recall_patterns (
    id               BIGSERIAL PRIMARY KEY,
    category_code    TEXT NOT NULL REFERENCES appliance_categories (category_code) ON DELETE CASCADE,
    pattern          TEXT NOT NULL,
    pattern_type     TEXT NOT NULL
        CHECK (pattern_type IN ('exact_phrase', 'word_regex')),
    required_context TEXT,
    excluded_context TEXT,
    confidence       TEXT NOT NULL DEFAULT 'medium'
        CHECK (confidence IN ('high', 'medium', 'low')),
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_code, pattern)
);

CREATE INDEX IF NOT EXISTS idx_recall_patterns_active
    ON appliance_recall_patterns (category_code)
    WHERE active;

-- Candidate matches. review_status lets a human mark a false positive without
-- deleting the evidence trail of why the matcher fired.
CREATE TABLE IF NOT EXISTS recall_category_matches (
    recall_id        INTEGER NOT NULL REFERENCES recalls (id) ON DELETE CASCADE,
    category_code    TEXT NOT NULL REFERENCES appliance_categories (category_code) ON DELETE CASCADE,
    matched_pattern  TEXT NOT NULL,
    matched_text     TEXT,
    match_confidence TEXT NOT NULL
        CHECK (match_confidence IN ('high', 'medium', 'low')),
    review_status    TEXT NOT NULL DEFAULT 'unreviewed'
        CHECK (review_status IN ('unreviewed', 'confirmed', 'false_positive')),
    review_notes     TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (recall_id, category_code)
);

CREATE INDEX IF NOT EXISTS idx_recall_matches_category
    ON recall_category_matches (category_code, review_status);
