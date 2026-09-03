"""
Flag recycling locations that may appear on the responsible-disposal pathway.

PDF whitelist (exact facility_type strings in our DataVic clean data):
  - 'Reprocessor — E-waste recycling'
  - 'Resource Recovery Centre — Transfer station'

All other recycling rows are marked false so Flask can filter safely.

Run from fix-forward repo root:
    python data/scripts/04_flag_recycling_eligibility.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

WHITELIST = (
    "Reprocessor — E-waste recycling",
    "Resource Recovery Centre — Transfer station",
)


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

    print("Flagging recycling eligibility on locations...")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # Repair locations are not disposal destinations
            cur.execute(
                """
                UPDATE locations
                SET household_electrical_relevant = FALSE
                WHERE location_type = 'repair';
                """
            )

            cur.execute(
                """
                UPDATE locations
                SET household_electrical_relevant = FALSE
                WHERE location_type = 'recycling';
                """
            )

            cur.execute(
                """
                UPDATE locations
                SET household_electrical_relevant = TRUE
                WHERE location_type = 'recycling'
                  AND facility_type = ANY(%s);
                """,
                (list(WHITELIST),),
            )

            cur.execute(
                """
                SELECT facility_type, COUNT(*)
                FROM locations
                WHERE location_type = 'recycling'
                  AND household_electrical_relevant = TRUE
                GROUP BY facility_type
                ORDER BY COUNT(*) DESC;
                """
            )
            eligible = cur.fetchall()

            cur.execute(
                """
                SELECT COUNT(*) FROM locations
                WHERE location_type = 'recycling'
                  AND household_electrical_relevant = TRUE;
                """
            )
            eligible_total = cur.fetchone()[0]

            cur.execute(
                """
                SELECT COUNT(*) FROM locations
                WHERE location_type = 'recycling'
                  AND COALESCE(household_electrical_relevant, FALSE) = FALSE;
                """
            )
            excluded = cur.fetchone()[0]

        conn.commit()

    print("SUCCESS: Recycling eligibility flagged.")
    print(f"  Eligible for disposal pathway: {eligible_total}")
    for facility_type, count in eligible:
        print(f"    - {count:4d}  {facility_type}")
    print(f"  Excluded recycling rows:       {excluded}")
    print()
    print("App should still warn: confirm acceptance before visiting.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
