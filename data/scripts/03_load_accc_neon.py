"""
Step 6c: Load ACCC recalls into Neon and record the snapshot as an import run.

The RSS feed is a rolling window, not the full ACCC history. That window is
recorded once in data_import_runs rather than repeated on every recall row, and
the app must always show the limitation alongside any result.

Reads:
  - data/clean/recalls.csv

Run from fix-forward repo root:
    python data/scripts/03_load_accc_neon.py
"""

from __future__ import annotations

import csv
import glob
import os
import sys
from datetime import date

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.insert(0, SCRIPT_DIR)

from import_utils import checksum_label, upsert_import_run  # noqa: E402

RECALLS_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "recalls.csv")
ACCC_RAW_DIR = os.path.join(SCRIPT_DIR, "..", "raw", "accc")


def main() -> int:
    load_dotenv(os.path.join(REPO_ROOT, ".env"))
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "USER:PASSWORD" in database_url:
        print("ERROR: Set DATABASE_URL in fix-forward/.env")
        return 1

    if not os.path.exists(RECALLS_PATH):
        print("ERROR: Run 00_download_accc.py and 01_clean_accc.py first.")
        return 1

    try:
        import psycopg
    except ImportError:
        print("ERROR: pip install -r requirements-data.txt")
        return 1

    with open(RECALLS_PATH, newline="", encoding="utf-8") as f:
        recalls = list(csv.DictReader(f))

    dates = sorted(
        {r["published_date"] for r in recalls if r.get("published_date")}
    )
    window_start = dates[0] if dates else None
    window_end = dates[-1] if dates else None
    retrieved = date.today().isoformat()
    raw_files = sorted(glob.glob(os.path.join(ACCC_RAW_DIR, "*.xml")))
    if not raw_files:
        print("ERROR: No ACCC snapshot in data/raw/accc/. Use the committed XML or run 00_download_accc.py.")
        return 1
    raw_path = raw_files[-1]
    snapshot_checksum = checksum_label(raw_path)

    accc_source = {
        "name": "ACCC Product Safety Recalls RSS",
        "url": "https://www.productsafety.gov.au/rss/feed.xml/psa_recall",
        "licence": "Australian Government open data (ACCC Product Safety)",
        "retrieval_date": retrieved,
        "version": (
            f"RSS snapshot {window_start or '?'} to {window_end or '?'} "
            f"(retrieved {retrieved})"
        ),
        "limitations": (
            "Possible recall match only — not confirmation. "
            f"This index covers published dates {window_start} to {window_end} "
            "from the recent RSS window only — not full ACCC history. "
            "No match does NOT prove the appliance is recall-free. "
            "Official search fallback: https://www.productsafety.gov.au/recalls"
        ),
    }

    print("Loading ACCC recalls into Neon...")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM recalls;")

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
                accc_source,
            )
            source_id = cur.fetchone()[0]

            for row in recalls:
                published = row["published_date"] or None
                cur.execute(
                    """
                    INSERT INTO recalls (
                        title, published_date, summary, official_url,
                        match_keywords, data_source_id
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (official_url) DO UPDATE SET
                        title = EXCLUDED.title,
                        published_date = EXCLUDED.published_date,
                        summary = EXCLUDED.summary,
                        match_keywords = EXCLUDED.match_keywords,
                        data_source_id = EXCLUDED.data_source_id;
                    """,
                    (
                        row["title"],
                        published,
                        row["summary"],
                        row["official_url"],
                        row["match_keywords"],
                        source_id,
                    ),
                )

            cur.execute("SELECT COUNT(*) FROM recalls;")
            count = cur.fetchone()[0]

            # Snapshot metadata belongs to the run, not to each recall.
            upsert_import_run(
                cur,
                data_source_id=source_id,
                retrieved_at=retrieved,
                coverage_start=window_start,
                coverage_end=window_end,
                record_count=count,
                source_version=accc_source["version"],
                source_file_url=accc_source["url"],
                checksum=snapshot_checksum,
                limitations=accc_source["limitations"],
            )

        conn.commit()

    print("SUCCESS: ACCC recalls loaded into Neon.")
    print(f"  recalls: {count} rows")
    print(f"  snapshot coverage recorded in data_import_runs: {window_start} → {window_end}")
    print(f"  snapshot checksum: {snapshot_checksum}")
    print("  no-match wording: does NOT prove recall-free; use official ACCC search")
    print("  next: python data/scripts/06_match_recalls.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
