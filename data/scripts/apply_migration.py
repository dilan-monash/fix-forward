"""
Apply one or more numbered migrations from data/scripts/migrations.

Migrations are idempotent, so re-running is safe.

The hardening migrations run in two phases, because the validation migrations
audit real data and refuse to constrain rows that would violate them:

    Phase 1 (schema):     python data/scripts/apply_migration.py 001 002 003 004 005 006 007 008 010
    Phase 2 (data):       run the import, enrich, pattern and match scripts
    Phase 3 (validate):   python data/scripts/apply_migration.py 009 011

    010 can run in the schema phase because the location loaders write
    source_url, source_retrieved_at and provider_type on insert. 011 has to
    wait until 06_match_recalls.py has filled matched_field.

Run with no arguments to apply every migration in numeric order.

Run from fix-forward repo root:
    python data/scripts/apply_migration.py 003
"""

from __future__ import annotations

import glob
import os
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
MIGRATIONS_DIR = os.path.join(SCRIPT_DIR, "migrations")


def resolve(prefixes: list[str]) -> list[str]:
    """Map '003' or a filename to a migration path, preserving argument order."""
    available = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    if not prefixes:
        return available

    paths: list[str] = []
    for prefix in prefixes:
        matches = [p for p in available if os.path.basename(p).startswith(prefix)]
        if not matches:
            print(f"ERROR: No migration matches '{prefix}' in {MIGRATIONS_DIR}")
            return []
        if len(matches) > 1:
            names = ", ".join(os.path.basename(m) for m in matches)
            print(f"ERROR: '{prefix}' is ambiguous ({names})")
            return []
        paths.append(matches[0])
    return paths


def main(argv: list[str]) -> int:
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

    paths = resolve(argv)
    if not paths:
        return 1

    for path in paths:
        name = os.path.basename(path)
        with open(path, encoding="utf-8") as f:
            sql = f.read()

        print(f"Applying {name}...")
        try:
            with psycopg.connect(database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                conn.commit()
        except Exception as exc:
            print(f"FAILED: {name}")
            print(f"  {exc}")
            return 1
        print(f"  ok: {name}")

    print()
    print(f"SUCCESS: applied {len(paths)} migration(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
