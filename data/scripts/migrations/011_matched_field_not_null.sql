-- FixForward migration 011 — matched_field is required on every candidate
--
-- Validate phase. Run AFTER 06_match_recalls.py has backfilled matched_field.

DO $$
DECLARE
    n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n
      FROM recall_category_matches
     WHERE matched_field IS NULL;
    IF n > 0 THEN
        RAISE EXCEPTION
            'migration 011: % recall_category_matches rows have no matched_field. Run 06_match_recalls.py first.',
            n;
    END IF;
END $$;

ALTER TABLE recall_category_matches
    ALTER COLUMN matched_field SET NOT NULL;

ALTER TABLE recall_category_matches
    DROP CONSTRAINT IF EXISTS recall_category_matches_matched_field_check;
ALTER TABLE recall_category_matches
    ADD CONSTRAINT recall_category_matches_matched_field_check
    CHECK (matched_field IN ('title', 'summary'));
