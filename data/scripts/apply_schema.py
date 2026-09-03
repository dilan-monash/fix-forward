"""
Step 3: Create the five Iteration 1 public tables in Neon.

Run from fix-forward repo root (with .venv activated):
    python data/scripts/apply_schema.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")
load_dotenv(os.path.join(REPO_ROOT, ".env"))

EXPECTED_TABLES = (
    "data_sources",
    "recalls",
    "repair_statistics",
    "repair_barriers",
    "locations",
)


def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "USER:PASSWORD" in database_url:
        print("ERROR: Set DATABASE_URL in fix-forward/.env first.")
        return 1

    try:
        import psycopg
    except ImportError:
        print("ERROR: Run pip install -r requirements-data.txt")
        return 1

    with open(SCHEMA_PATH, encoding="utf-8") as f:
        schema_sql = f.read()

    print("Applying schema to Neon...")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name;
                """
            )
            tables = [row[0] for row in cur.fetchall()]
        conn.commit()

    print("SUCCESS: Schema applied.")
    print()
    print("Tables in your Neon database:")
    for name in tables:
        marker = "  ✓" if name in EXPECTED_TABLES else "  ·"
        print(f"{marker} {name}")

    missing = [t for t in EXPECTED_TABLES if t not in tables]
    if missing:
        print()
        print("WARNING: Expected tables missing:", ", ".join(missing))
        return 1

    print()
    print("All five Iteration 1 tables are ready (empty).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
