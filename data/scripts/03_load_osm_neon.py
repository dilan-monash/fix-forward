"""
Step 8c: Load OSM repair locations into Neon.

Reads:
  - data/clean/locations_repair.csv

Run from fix-forward repo root:
    python data/scripts/03_load_osm_neon.py
"""

from __future__ import annotations

import csv
import os
import sys
from datetime import date

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.insert(0, SCRIPT_DIR)

from import_utils import checksum_label, upsert_import_run  # noqa: E402

LOCATIONS_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "locations_repair.csv")
OSM_RAW_PATH = os.path.join(SCRIPT_DIR, "..", "raw", "osm", "victoria_repair_pois.json")

OSM_SOURCE = {
    "name": "OpenStreetMap repair POIs (Victoria extract)",
    "url": "https://www.openstreetmap.org/copyright",
    "licence": "ODbL 1.0 (OpenStreetMap contributors)",
    "retrieval_date": date.today().isoformat(),
    "version": "Overpass snapshot",
    "limitations": (
        "Community-mapped data; coverage and contact details may be missing or outdated. "
        "Users must contact providers before travelling. Not a list of qualified electricians."
    ),
}


def main() -> int:
    load_dotenv(os.path.join(REPO_ROOT, ".env"))
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "USER:PASSWORD" in database_url:
        print("ERROR: Set DATABASE_URL in fix-forward/.env")
        return 1

    if not os.path.exists(LOCATIONS_PATH):
        print("ERROR: Run 00_download_osm.py and 01_clean_osm.py first.")
        return 1
    if not os.path.exists(OSM_RAW_PATH):
        print("ERROR: Missing OSM snapshot at data/raw/osm/victoria_repair_pois.json")
        return 1

    snapshot_checksum = checksum_label(OSM_RAW_PATH)

    try:
        import psycopg
    except ImportError:
        print("ERROR: pip install -r requirements-data.txt")
        return 1

    with open(LOCATIONS_PATH, newline="", encoding="utf-8") as f:
        locations = list(csv.DictReader(f))

    print("Loading OSM repair locations into Neon...")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM locations WHERE location_type = 'repair';")

            cur.execute(
                """
                INSERT INTO data_sources (name, url, licence, retrieval_date, version, limitations)
                VALUES (%(name)s, %(url)s, %(licence)s, %(retrieval_date)s, %(version)s, %(limitations)s)
                ON CONFLICT (name) DO UPDATE SET
                    url = EXCLUDED.url,
                    licence = EXCLUDED.licence,
                    retrieval_date = EXCLUDED.retrieval_date,
                    version = EXCLUDED.version,
                    limitations = EXCLUDED.limitations
                RETURNING id;
                """,
                OSM_SOURCE,
            )
            source_id = cur.fetchone()[0]

            for row in locations:
                lat = float(row["latitude"]) if row["latitude"] else None
                lon = float(row["longitude"]) if row["longitude"] else None
                cur.execute(
                    """
                    INSERT INTO locations (
                        location_type, name, facility_type, address, suburb, lga,
                        latitude, longitude, phone, website, source_notes, data_source_id,
                        provider_type, source_url, source_retrieved_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        row["location_type"],
                        row["name"],
                        row["facility_type"],
                        row["address"] or None,
                        row["suburb"] or None,
                        row["lga"] or None,
                        lat,
                        lon,
                        row["phone"] or None,
                        row["website"] or None,
                        row["source_notes"],
                        source_id,
                        "repair_service",
                        OSM_SOURCE["url"],
                        OSM_SOURCE["retrieval_date"],
                    ),
                )

            cur.execute(
                "SELECT COUNT(*) FROM locations WHERE location_type = 'repair';"
            )
            repair_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM locations WHERE location_type = 'recycling';")
            recycling_count = cur.fetchone()[0]

            upsert_import_run(
                cur,
                data_source_id=source_id,
                retrieved_at=OSM_SOURCE["retrieval_date"],
                record_count=repair_count,
                source_version=OSM_SOURCE["version"],
                source_file_url=OSM_SOURCE["url"],
                checksum=snapshot_checksum,
                limitations=OSM_SOURCE["limitations"],
            )

        conn.commit()

    print("SUCCESS: OSM repair locations loaded into Neon.")
    print(f"  repair locations:     {repair_count} rows")
    print(f"  recycling locations:  {recycling_count} rows (unchanged)")
    print(f"  snapshot checksum:    {snapshot_checksum}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
