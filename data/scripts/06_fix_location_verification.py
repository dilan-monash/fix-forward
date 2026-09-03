"""
Move dataset URLs out of verification_url and into the source provenance fields.

Before this script every one of the 729 locations carried a verification_url:
663 held the DataVic package page and 66 held the OpenStreetMap copyright page.
Neither confirms anything about an individual facility, so reporting them as
verification produced a false "100% verified" reading.

After this script:
  source_url / source_retrieved_at   -> the dataset the row was imported from
  verification_url / last_verified_at -> NULL, because no facility has been checked
  verification_status                 -> 'unverified'
  verification_notes                  -> what the source does and does not establish

Idempotent: safe to run repeatedly.

Run from fix-forward repo root:
    python data/scripts/06_fix_location_verification.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

# What each dataset actually establishes, and what it leaves unknown. These
# strings are shown to the team and drive the app's honesty labelling.
RECYCLING_NOTES = (
    "Imported from the DataVic waste and resource recovery infrastructure dataset. "
    "The dataset establishes that the facility exists and records its name, owner, "
    "address, LGA, infrastructure type and approximate coordinates. It does NOT state "
    "whether household portable appliances are accepted, whether members of the public "
    "may drop items off, opening hours, or fees. No facility-level evidence has been checked."
)
REPAIR_NOTES = (
    "Imported from OpenStreetMap via the Overpass API. OpenStreetMap is volunteer-maintained, "
    "so the record may be out of date or incomplete. It does NOT establish which appliance "
    "categories are repaired, whether the business is trading, or whether it serves the public. "
    "No facility-level evidence has been checked."
)
WEBSITE_SUFFIX = (
    " A website is listed for this location but has not been opened or checked, so it is "
    "not recorded as verification evidence."
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

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*), COUNT(*) FILTER (WHERE verification_url IS NOT NULL)
                FROM locations;
                """
            )
            total, before_claimed_verified = cur.fetchone()

            # 1. Provenance: where the row came from, and when it was downloaded.
            #    Prefer the recorded import run over the data_sources summary date.
            cur.execute(
                """
                UPDATE locations AS loc
                SET source_url = ds.url,
                    source_retrieved_at = COALESCE(
                        (
                            SELECT MAX(r.retrieved_at)::date
                            FROM data_import_runs r
                            WHERE r.data_source_id = ds.id
                        ),
                        ds.retrieval_date
                    )
                FROM data_sources ds
                WHERE ds.id = loc.data_source_id;
                """
            )
            provenance_set = cur.rowcount

            # 2. Verification: nothing has been checked at facility level, so the
            #    fields that mean "checked" are emptied.
            cur.execute(
                """
                UPDATE locations
                SET verification_url = NULL,
                    last_verified_at = NULL,
                    verification_status = 'unverified'
                WHERE verification_url IS NOT NULL
                   OR last_verified_at IS NOT NULL
                   OR verification_status <> 'unverified';
                """
            )
            cleared = cur.rowcount

            # 3. Say plainly what the source supports and what it does not.
            cur.execute(
                """
                UPDATE locations
                SET verification_notes =
                    CASE WHEN location_type = 'recycling' THEN %s ELSE %s END
                    || CASE
                         WHEN website IS NOT NULL AND btrim(website) <> '' THEN %s
                         ELSE ''
                       END;
                """,
                (RECYCLING_NOTES, REPAIR_NOTES, WEBSITE_SUFFIX),
            )
            noted = cur.rowcount

            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE source_url IS NOT NULL),
                  COUNT(*) FILTER (WHERE source_retrieved_at IS NOT NULL),
                  COUNT(*) FILTER (WHERE verification_url IS NOT NULL),
                  COUNT(*) FILTER (WHERE verification_status = 'unverified'),
                  COUNT(*) FILTER (WHERE website IS NOT NULL AND btrim(website) <> '')
                FROM locations;
                """
            )
            with_source, with_date, still_verified, unverified, with_site = cur.fetchone()
        conn.commit()

    print("SUCCESS: location verification semantics corrected.")
    print(f"  locations total:                      {total}")
    print(f"  previously claimed a verification_url: {before_claimed_verified}")
    print(f"  provenance rows updated:               {provenance_set}")
    print(f"  verification fields cleared:           {cleared}")
    print(f"  verification_notes written:            {noted}")
    print()
    print(f"  now with source_url:                   {with_source}/{total}")
    print(f"  now with source_retrieved_at:          {with_date}/{total}")
    print(f"  now with facility verification_url:    {still_verified}/{total}")
    print(f"  verification_status = 'unverified':    {unverified}/{total}")
    print(f"  listed website (unchecked lead):       {with_site}/{total}")
    print()
    print("  Facility-level verification is 0%. That is the honest figure until")
    print("  someone checks individual facilities and records the evidence.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
