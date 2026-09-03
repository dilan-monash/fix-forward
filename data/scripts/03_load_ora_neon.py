"""
Step 5d: Load ORA repair statistics and barriers into Neon.

Reads:
  - data/clean/repair_statistics.csv
  - data/clean/repair_barriers.csv

Run from fix-forward repo root:
    python data/scripts/03_load_ora_neon.py
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

STATS_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "repair_statistics.csv")
BARRIERS_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "repair_barriers.csv")
ORA_RAW_PATH = os.path.join(
    SCRIPT_DIR, "..", "raw", "ora", "OpenRepairData_v0.3_aggregate_202507.csv"
)

ORA_SOURCE = {
    "name": "Open Repair Alliance aggregate dataset",
    "url": "https://openrepair.org/open-data/downloads/",
    "licence": "CC BY-SA 4.0",
    "retrieval_date": date.today().isoformat(),
    "version": "202507 aggregate (data to end of July 2025)",
    "limitations": (
        "Community repair event data; self-selected sample. Category benchmarks only — "
        "not model-specific repair probabilities. Some categories share ORA buckets."
    ),
}


def load_csv(path: str) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    load_dotenv(os.path.join(REPO_ROOT, ".env"))
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "USER:PASSWORD" in database_url:
        print("ERROR: Set DATABASE_URL in fix-forward/.env")
        return 1

    if not os.path.exists(STATS_PATH) or not os.path.exists(BARRIERS_PATH):
        print("ERROR: Run 01_clean_ora.py and 02_build_ora_stats.py first.")
        return 1
    if not os.path.exists(ORA_RAW_PATH):
        print("ERROR: ORA snapshot missing. Run python data/scripts/00_fetch_ora.py")
        return 1

    snapshot_checksum = checksum_label(ORA_RAW_PATH)

    try:
        import psycopg
    except ImportError:
        print("ERROR: pip install -r requirements-data.txt")
        return 1

    stats = load_csv(STATS_PATH)
    barriers = load_csv(BARRIERS_PATH)

    print("Loading ORA data into Neon...")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # Refresh ORA repair tables (other sources not loaded yet)
            cur.execute("DELETE FROM repair_barriers;")
            cur.execute("DELETE FROM repair_statistics;")

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
                ORA_SOURCE,
            )
            source_id = cur.fetchone()[0]

            for row in stats:
                cur.execute(
                    """
                    INSERT INTO repair_statistics (
                        appliance_family, appliance_category, geography, sample_size,
                        fixed_count, repairable_count, end_of_life_count,
                        insufficient_evidence, confidence_level, limitations, data_source_id
                    ) VALUES (
                        %(appliance_family)s, %(appliance_category)s, %(geography)s, %(sample_size)s,
                        %(fixed_count)s, %(repairable_count)s, %(end_of_life_count)s,
                        %(insufficient_evidence)s, %(confidence_level)s, %(limitations)s, %(data_source_id)s
                    )
                    ON CONFLICT (appliance_family, appliance_category, geography) DO UPDATE SET
                        sample_size = EXCLUDED.sample_size,
                        fixed_count = EXCLUDED.fixed_count,
                        repairable_count = EXCLUDED.repairable_count,
                        end_of_life_count = EXCLUDED.end_of_life_count,
                        insufficient_evidence = EXCLUDED.insufficient_evidence,
                        confidence_level = EXCLUDED.confidence_level,
                        limitations = EXCLUDED.limitations,
                        data_source_id = EXCLUDED.data_source_id;
                    """,
                    {**row, "data_source_id": source_id},
                )

            for row in barriers:
                cur.execute(
                    """
                    INSERT INTO repair_barriers (
                        appliance_family, appliance_category, barrier,
                        occurrence_count, geography, data_source_id
                    ) VALUES (
                        %(appliance_family)s, %(appliance_category)s, %(barrier)s,
                        %(occurrence_count)s, %(geography)s, %(data_source_id)s
                    );
                    """,
                    {**row, "data_source_id": source_id},
                )

            cur.execute("SELECT COUNT(*) FROM repair_statistics;")
            stats_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM repair_barriers;")
            barriers_count = cur.fetchone()[0]

            upsert_import_run(
                cur,
                data_source_id=source_id,
                retrieved_at=ORA_SOURCE["retrieval_date"],
                record_count=stats_count + barriers_count,
                source_version=ORA_SOURCE["version"],
                source_file_url=ORA_SOURCE["url"],
                checksum=snapshot_checksum,
                limitations=ORA_SOURCE["limitations"],
            )

        conn.commit()

    print("SUCCESS: ORA data loaded into Neon.")
    print(f"  repair_statistics: {stats_count} rows")
    print(f"  repair_barriers:   {barriers_count} rows")
    print(f"  snapshot checksum: {snapshot_checksum}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
