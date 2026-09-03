"""
Report recall candidate coverage per appliance category.

Reads recall_category_matches, which is produced by 06_match_recalls.py from
the reviewed pattern table. This script no longer does its own substring
search: the old ILIKE '%term%' approach reported four infant products as fans
and a vacuum-insulated food jar as a vacuum cleaner.

Reports only. Never invents or confirms a match.

Run from fix-forward repo root:
    python data/scripts/05_test_recall_category_coverage.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

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

    print("Recall candidate coverage by appliance category")
    print("=" * 72)
    print(
        "Zero candidates does NOT mean recall-free. FixForward checks a limited\n"
        f"ACCC snapshot only. Official search: {OFFICIAL_SEARCH}"
    )
    print()

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.coverage_start, r.coverage_end, r.record_count, r.retrieved_at::date
                FROM data_import_runs r
                JOIN data_sources ds ON ds.id = r.data_source_id
                WHERE ds.name ILIKE '%ACCC%'
                ORDER BY r.retrieved_at DESC
                LIMIT 1;
                """
            )
            run = cur.fetchone()
            if run:
                start, end, count, retrieved = run
                print(f"Snapshot coverage: {start} to {end}")
                print(f"Recalls in snapshot: {count} (retrieved {retrieved})")
            else:
                print("No ACCC import run recorded. Run 03_load_accc_neon.py.")
            print()

            cur.execute(
                """
                SELECT c.category_name,
                       c.category_code,
                       (SELECT COUNT(*) FROM recall_category_matches m
                         WHERE m.category_code = c.category_code
                           AND m.review_status <> 'false_positive'),
                       (SELECT COUNT(*) FROM recall_category_matches m
                         WHERE m.category_code = c.category_code
                           AND m.review_status = 'confirmed'),
                       (SELECT COUNT(*) FROM recall_category_matches m
                         WHERE m.category_code = c.category_code
                           AND m.review_status = 'false_positive'),
                       (SELECT COUNT(*) FROM appliance_recall_patterns p
                         WHERE p.category_code = c.category_code AND p.active)
                FROM appliance_categories c
                WHERE c.active
                ORDER BY c.display_order;
                """
            )
            rows = cur.fetchall()

            print(f"  {'category':45s} {'patterns':>9s} {'candidates':>11s} {'confirmed':>10s} {'false+':>7s}")
            total_candidates = 0
            for name, _code, candidates, confirmed, false_pos, patterns in rows:
                total_candidates += candidates
                print(f"  {name:45s} {patterns:9d} {candidates:11d} {confirmed:10d} {false_pos:7d}")

            cur.execute(
                """
                SELECT m.matched_pattern, m.matched_text, m.matched_field,
                       m.match_confidence, m.review_status, r.title
                FROM recall_category_matches m
                JOIN recalls r ON r.id = m.recall_id
                ORDER BY m.category_code, r.title;
                """
            )
            detail = cur.fetchall()

    print()
    print(f"  total candidates: {total_candidates}")
    print()
    if detail:
        print("  Why each candidate matched:")
        for pattern, matched, field, confidence, status, title in detail:
            print(f"    {title[:70]}")
            print(
                f"      [{field}] pattern {pattern!r} matched {matched!r} "
                f"({confidence}, {status})"
            )
    else:
        print("  No candidates in this snapshot.")
    print()
    print("  The app must label every candidate as a POSSIBLE match only.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
