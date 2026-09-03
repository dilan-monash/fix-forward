"""
Review unreviewed recall_category_matches against the official ACCC notice.

A candidate is a possible match, never a confirmation. Leaving a row
unreviewed is intentional until a named person compares it with the notice
and records the decision.

Usage:
    python data/scripts/06_review_recall_match.py --list
    python data/scripts/06_review_recall_match.py

Interactive mode prompts for confirm / reject / skip, a reviewer name, and
notes. Non-interactive sessions (no TTY) always list and never write.

Run from fix-forward repo root.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))


def list_candidates(cur) -> list[tuple]:
    cur.execute(
        """
        SELECT m.recall_id, m.category_code, m.matched_pattern, m.matched_text,
               m.matched_field, m.match_confidence, m.review_status,
               r.title, r.summary, r.official_url, r.published_date
        FROM recall_category_matches m
        JOIN recalls r ON r.id = m.recall_id
        WHERE m.review_status = 'unreviewed'
        ORDER BY r.published_date DESC NULLS LAST, r.title;
        """
    )
    return cur.fetchall()


def print_candidate(row: tuple) -> None:
    (
        recall_id,
        category,
        pattern,
        matched_text,
        matched_field,
        confidence,
        status,
        title,
        summary,
        url,
        published,
    ) = row
    print("-" * 72)
    print(f"  recall_id:      {recall_id}")
    print(f"  title:          {title}")
    print(f"  published:      {published}")
    print(f"  category:       {category}")
    print(f"  matched_field:  {matched_field}")
    print(f"  pattern:        {pattern!r}")
    print(f"  matched_text:   {matched_text!r}")
    print(f"  confidence:     {confidence}")
    print(f"  review_status:  {status}")
    print(f"  official_url:   {url}")
    print()
    print("  summary:")
    print(f"    {(summary or '')[:800]}")
    print()
    print("  Open the official notice, then decide confirm / reject / skip.")
    print("  confirm = this is a genuine appliance recall for that category")
    print("  reject  = false positive")
    print("  skip    = leave unreviewed")


def prompt(label: str) -> str:
    try:
        return input(label).strip()
    except EOFError:
        return ""


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--list",
        action="store_true",
        help="Print unreviewed candidates and exit without writing.",
    )
    args = parser.parse_args(argv)

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

    interactive = sys.stdin.isatty() and not args.list

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            rows = list_candidates(cur)
            if not rows:
                print("No unreviewed recall candidates.")
                return 0

            print(f"Unreviewed recall candidates: {len(rows)}")
            print()
            for row in rows:
                print_candidate(row)
                if not interactive:
                    continue

                decision = prompt("  Decision [confirm/reject/skip]: ").lower()
                if decision in ("s", "skip", ""):
                    print("  skipped (still unreviewed)")
                    continue
                if decision in ("c", "confirm", "confirmed"):
                    status = "confirmed"
                elif decision in ("r", "reject", "false_positive", "false-positive"):
                    status = "false_positive"
                else:
                    print(f"  unrecognised '{decision}', skipped")
                    continue

                reviewer = prompt("  Reviewer name: ")
                if not reviewer:
                    print("  skipped: a named reviewer is required")
                    continue
                notes = prompt("  Notes (optional): ") or None
                cur.execute(
                    """
                    UPDATE recall_category_matches
                    SET review_status = %s,
                        reviewed_by = %s,
                        reviewed_at = %s,
                        review_notes = %s
                    WHERE recall_id = %s AND category_code = %s;
                    """,
                    (
                        status,
                        reviewer,
                        datetime.now(timezone.utc),
                        notes,
                        row[0],
                        row[1],
                    ),
                )
                print(f"  recorded {status} by {reviewer}")
        conn.commit()

    if not interactive:
        print()
        print("Listing only. Re-run without --list in a terminal to record a decision.")
        print("Leaving a candidate unreviewed is valid until a named person signs it off.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
