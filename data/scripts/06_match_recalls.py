"""
Match ACCC recalls to appliance categories using the reviewed pattern table.

Every stored candidate records the pattern that produced it and the text that
pattern matched, so any result can be audited or overturned.

Human review decisions in recall_category_matches.review_status are preserved
across runs. Candidates that no longer match are removed.

Idempotent: safe to run repeatedly.

Run from fix-forward repo root:
    python data/scripts/06_match_recalls.py
"""

from __future__ import annotations

import os
import sys
from collections import Counter

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.insert(0, SCRIPT_DIR)

from recall_matching import Pattern, best_matches  # noqa: E402

OFFICIAL_SEARCH = "https://www.productsafety.gov.au/recalls"


def main() -> int:
    load_dotenv(os.path.join(REPO_ROOT, ".env"))
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "USER:PASSWORD" in database_url:
        print("ERROR: Set DATABASE_URL in fix-forward/.env")
        return 1

    try:
        import psycopg
    except ImportError:
        print("ERROR: pip install -r requirements-data.txt")
        return 1

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT category_code, pattern, pattern_type,
                       confidence, required_context, excluded_context, notes
                FROM appliance_recall_patterns
                WHERE active
                ORDER BY category_code, pattern;
                """
            )
            patterns = [
                Pattern(
                    category_code=r[0],
                    pattern=r[1],
                    pattern_type=r[2],
                    confidence=r[3],
                    required_context=r[4],
                    excluded_context=r[5],
                    notes=r[6],
                )
                for r in cur.fetchall()
            ]
            if not patterns:
                print("ERROR: No active patterns. Run 06_build_recall_patterns.py first.")
                return 1

            cur.execute("SELECT id, title, summary FROM recalls ORDER BY id;")
            recalls = cur.fetchall()

            # Keep any human review already recorded, including attribution.
            cur.execute(
                """
                SELECT recall_id, category_code, review_status, review_notes,
                       reviewed_by, reviewed_at
                FROM recall_category_matches;
                """
            )
            reviewed = {
                (r[0], r[1]): (r[2], r[3], r[4], r[5])
                for r in cur.fetchall()
                if r[2] != "unreviewed"
            }

            found: set[tuple[int, str]] = set()
            per_category: Counter[str] = Counter()
            per_confidence: Counter[str] = Counter()
            examples: list[tuple[str, str, str, str, str]] = []

            for recall_id, title, summary in recalls:
                for category_code, hit in best_matches(title, summary, patterns).items():
                    found.add((recall_id, category_code))
                    per_category[category_code] += 1
                    per_confidence[hit["confidence"]] += 1
                    examples.append(
                        (
                            category_code,
                            title or "",
                            hit["pattern"],
                            hit["matched_text"],
                            hit["matched_field"],
                        )
                    )

                    status, notes, reviewed_by, reviewed_at = reviewed.get(
                        (recall_id, category_code), ("unreviewed", None, None, None)
                    )
                    cur.execute(
                        """
                        INSERT INTO recall_category_matches (
                            recall_id, category_code, matched_pattern, matched_text,
                            matched_field, match_confidence, review_status,
                            review_notes, reviewed_by, reviewed_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (recall_id, category_code) DO UPDATE SET
                            matched_pattern = EXCLUDED.matched_pattern,
                            matched_text = EXCLUDED.matched_text,
                            matched_field = EXCLUDED.matched_field,
                            match_confidence = EXCLUDED.match_confidence;
                        """,
                        (
                            recall_id,
                            category_code,
                            hit["pattern"],
                            hit["matched_text"],
                            hit["matched_field"],
                            hit["confidence"],
                            status,
                            notes,
                            reviewed_by,
                            reviewed_at,
                        ),
                    )

            # Drop candidates the corrected patterns no longer support.
            cur.execute("SELECT recall_id, category_code FROM recall_category_matches;")
            stale = [pair for pair in cur.fetchall() if tuple(pair) not in found]
            for recall_id, category_code in stale:
                cur.execute(
                    """
                    DELETE FROM recall_category_matches
                    WHERE recall_id = %s AND category_code = %s;
                    """,
                    (recall_id, category_code),
                )

            cur.execute("SELECT COUNT(*) FROM recall_category_matches;")
            stored = cur.fetchone()[0]
        conn.commit()

    print("Recall candidate matching")
    print("=" * 72)
    print(f"  recalls scanned:      {len(recalls)}")
    print(f"  active patterns:      {len(patterns)}")
    print(f"  candidates stored:    {stored}")
    print(f"  stale candidates removed: {len(stale)}")
    print()

    if examples:
        print("  Candidates (category | field | pattern | matched text | recall):")
        for category_code, title, pattern, matched, field in sorted(examples):
            print(f"    {category_code:42s} [{field}] {pattern!r} -> {matched!r}")
            print(f"      {title[:88]}")
    else:
        print("  No candidates in this snapshot.")
    print()
    print(
        "  confidence: "
        f"high={per_confidence['high']} "
        f"medium={per_confidence['medium']} "
        f"low={per_confidence['low']}"
    )
    print()
    print("  A candidate is a POSSIBLE match, never a confirmation.")
    print("  No match does NOT prove the appliance is recall-free: this is a limited")
    print(f"  ACCC snapshot. Official search: {OFFICIAL_SEARCH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
