"""
Seed appliance_categories from the team-approved mapping CSV.

Run from fix-forward repo root:
    python data/scripts/04_seed_appliance_categories.py
"""

from __future__ import annotations

import csv
import os
import re
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
MAPPING_PATH = os.path.join(SCRIPT_DIR, "..", "mapping", "appliance_families.csv")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


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

    with open(MAPPING_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"Seeding appliance_categories from {len(rows)} mapping rows...")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # Upsert only. Deleting would cascade into recall patterns and
            # matches via foreign keys and would wipe human review decisions.
            for i, row in enumerate(rows, start=1):
                family = row["family"].strip()
                category = row["category"].strip()
                cur.execute(
                    """
                    INSERT INTO appliance_categories (
                        family_code, family_name, category_code, category_name,
                        ora_product_category, display_order, active, search_aliases, notes
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (family_code, category_code) DO UPDATE SET
                        family_name = EXCLUDED.family_name,
                        category_name = EXCLUDED.category_name,
                        ora_product_category = EXCLUDED.ora_product_category,
                        display_order = EXCLUDED.display_order,
                        active = EXCLUDED.active,
                        search_aliases = EXCLUDED.search_aliases,
                        notes = EXCLUDED.notes;
                    """,
                    (
                        slugify(family),
                        family,
                        slugify(category),
                        category,
                        row["ora_product_category"].strip(),
                        i,
                        row["in_scope"].strip() in ("yes", "partial"),
                        (row.get("search_aliases") or "").strip() or None,
                        row.get("notes", "").strip() or None,
                    ),
                )
            cur.execute("SELECT COUNT(*) FROM appliance_categories;")
            count = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(DISTINCT family_name) FROM appliance_categories WHERE active;"
            )
            families = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM appliance_categories
                WHERE active AND search_aliases IS NOT NULL AND search_aliases <> '';
                """
            )
            with_aliases = cur.fetchone()[0]
        conn.commit()

    print("SUCCESS: appliance_categories seeded.")
    print(f"  categories:     {count}")
    print(f"  families:       {families}")
    print(f"  with aliases:   {with_aliases}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
