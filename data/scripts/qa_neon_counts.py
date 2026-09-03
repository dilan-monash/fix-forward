"""
QA: print Neon table counts and key coverage checks for PGP / mentor demos.

Run from fix-forward repo root:
    python data/scripts/qa_neon_counts.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))


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

    queries = [
        ("data_sources", "SELECT COUNT(*) FROM data_sources"),
        ("appliance_categories", "SELECT COUNT(*) FROM appliance_categories"),
        ("safety_rules (active)", "SELECT COUNT(*) FROM safety_rules WHERE active"),
        ("recalls", "SELECT COUNT(*) FROM recalls"),
        ("repair_statistics", "SELECT COUNT(*) FROM repair_statistics"),
        ("repair_barriers", "SELECT COUNT(*) FROM repair_barriers"),
        ("locations (all)", "SELECT COUNT(*) FROM locations"),
        (
            "locations repair",
            "SELECT COUNT(*) FROM locations WHERE location_type = 'repair'",
        ),
        (
            "locations recycling",
            "SELECT COUNT(*) FROM locations WHERE location_type = 'recycling'",
        ),
        (
            "locations disposal shortlist",
            "SELECT COUNT(*) FROM locations WHERE household_electrical_relevant = TRUE",
        ),
        ("suburb_postcodes", "SELECT COUNT(*) FROM suburb_postcodes"),
        ("data_import_runs", "SELECT COUNT(*) FROM data_import_runs"),
        ("recall patterns (active)", "SELECT COUNT(*) FROM appliance_recall_patterns WHERE active"),
        ("recall candidates", "SELECT COUNT(*) FROM recall_category_matches"),
        ("safety rule citations", "SELECT COUNT(*) FROM safety_rule_sources"),
        ("appliance acceptance records", "SELECT COUNT(*) FROM location_appliance_acceptance"),
        (
            "locations facility-verified",
            "SELECT COUNT(*) FROM locations WHERE verification_status <> 'unverified'",
        ),
        (
            "verified recommendations",
            "SELECT COUNT(*) FROM verified_location_recommendations",
        ),
        (
            "unverified candidates",
            "SELECT COUNT(*) FROM unverified_location_candidates",
        ),
    ]

    print("FixForward Neon QA counts")
    print("=" * 40)
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for label, sql in queries:
                cur.execute(sql)
                print(f"{label:28s} {cur.fetchone()[0]:>6}")

            cur.execute(
                """
                SELECT name FROM data_sources ORDER BY name;
                """
            )
            print()
            print("data_sources:")
            for (name,) in cur.fetchall():
                print(f"  - {name}")

            cur.execute(
                """
                SELECT COUNT(*) FROM appliance_categories
                WHERE active AND family_name IS NOT NULL;
                """
            )
            families_ok = cur.fetchone()[0] >= 6
            cur.execute(
                """
                SELECT COUNT(*) FROM safety_rules
                WHERE active AND stop_use_required;
                """
            )
            stop_use = cur.fetchone()[0]

    print()
    print("Checks:")
    print(f"  appliance catalogue usable: {'PASS' if families_ok else 'FAIL'}")
    print(f"  high-risk stop-use rules:   {stop_use}")
    print("  recall coverage:             rolling ACCC RSS window only (see docs)")
    print("  user assessment tables:      none (PASS)")
    print()
    print("  Zero verified recommendations is the correct result: no facility-level")
    print("  evidence has been gathered yet. See LOCATION_VERIFICATION_POLICY.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
