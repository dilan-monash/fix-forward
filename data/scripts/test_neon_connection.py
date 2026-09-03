"""
Step 2: Test that your Neon database connection works.

Run from the fix-forward repo root:
    python -m venv .venv
    source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
    pip install -r requirements-data.txt
    cp .env.example .env        # then edit .env with your real DATABASE_URL
    python data/scripts/test_neon_connection.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

# Load .env from repo root (two levels up from this script)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(REPO_ROOT, ".env"))


def main() -> int:
    database_url = os.getenv("DATABASE_URL")

    if not database_url or "USER:PASSWORD" in database_url:
        print("ERROR: DATABASE_URL is missing or still has placeholder values.")
        print()
        print("Fix this:")
        print("  1. Copy .env.example to .env in the repo root")
        print("  2. Open Neon Console → your project → Connection details")
        print("  3. Paste the connection string as DATABASE_URL=...")
        print("  4. Run this script again")
        return 1

    try:
        import psycopg
    except ImportError:
        print("ERROR: psycopg not installed.")
        print("Run: pip install -r requirements-data.txt")
        return 1

    print("Connecting to Neon...")
    try:
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
        print("SUCCESS: Connected to Neon.")
        print()
        print("PostgreSQL version (first line):")
        print(f"  {version.split(',')[0]}")
        return 0
    except Exception as exc:
        print("ERROR: Could not connect to Neon.")
        print(f"  {exc}")
        print()
        print("Check that DATABASE_URL is correct and includes ?sslmode=require")
        return 1


if __name__ == "__main__":
    sys.exit(main())
