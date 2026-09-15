"""Apply the reviewed price catalogue only to one explicitly named Neon endpoint.

This is intentionally separate from normal app startup and general migrations.
It refuses a connection whose hostname does not exactly match --expected-host.
"""

import argparse
import os
from pathlib import Path
from urllib.parse import urlsplit

import psycopg


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SQL_FILES = (
    PROJECT_ROOT / "database" / "003_replacement_price_catalogue.sql",
    PROJECT_ROOT / "database" / "004_repair_service_fee_catalogue.sql",
    PROJECT_ROOT / "database" / "005_import_reviewed_price_catalogue.sql",
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-host", required=True)
    args = parser.parse_args()
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("ERROR: DATABASE_URL is not set")
    parsed = urlsplit(database_url)
    if parsed.hostname != args.expected_host or parsed.path != "/neondb":
        raise SystemExit("ERROR: Refusing unexpected database endpoint or database name")
    for path in SQL_FILES:
        if not path.is_file():
            raise SystemExit(f"ERROR: Missing SQL file: {path.name}")

    with psycopg.connect(database_url, connect_timeout=10) as connection:
        for path in SQL_FILES:
            with connection.cursor() as cursor:
                cursor.execute(path.read_text(encoding="utf-8"))
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT sum(per_category) AS prices,
                    count(DISTINCT category_code) AS categories,
                    min(per_category) AS minimum_per_category
                FROM (
                    SELECT category_code, count(*) AS per_category
                    FROM replacement_price_observations GROUP BY category_code
                ) counts
            """)
            total, categories, minimum = cursor.fetchone()
            cursor.execute("SELECT count(*) FROM repair_service_fee_observations")
            fees = cursor.fetchone()[0]
            cursor.execute("SELECT value FROM replacement_price_catalogue_meta WHERE key = 'storage'")
            storage = cursor.fetchone()[0]
    with psycopg.connect(database_url, connect_timeout=10) as connection:
        connection.read_only = True
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM replacement_price_observations")
            read_only_total = cursor.fetchone()[0]
    if (total, read_only_total, categories, minimum, fees, storage) != (57, 57, 19, 3, 4, '"neon-postgresql"'):
        raise SystemExit("ERROR: Post-import verification failed")
    print("Verified isolated Neon catalogue: 57 prices, 19 categories, minimum 3 per category, 4 service fees.")


if __name__ == "__main__":
    main()
