"""
Honest location enrichment (no invented acceptance/public access).

- Fill postcode via suburb_postcodes join when suburb matches
- Set provider_type from facility_type / known OSM labels (always a value)
- Backfill opening_hours from OSM raw JSON only when the tag exists

Appliance acceptance and public access live in location_appliance_acceptance,
not on locations. This script never writes them.

Provenance and verification fields (source_url, source_retrieved_at,
verification_url, last_verified_at, verification_status) are owned by
06_fix_location_verification.py. This script must never write them: a dataset
URL is not evidence about an individual facility.

Run from fix-forward repo root:
    python data/scripts/05_enrich_locations.py
"""

from __future__ import annotations

import json
import os
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OSM_RAW = os.path.join(SCRIPT_DIR, "..", "raw", "osm", "victoria_repair_pois.json")


def provider_type_from_facility(facility_type: str | None, location_type: str) -> str:
    """Always return a constrained provider_type. locations.provider_type is NOT NULL."""
    if not facility_type:
        return "repair_service" if location_type == "repair" else "recycling_facility"
    ft = facility_type.lower()
    if "e-waste" in ft:
        return "e_waste_reprocessor"
    if "transfer station" in ft or "resource recovery centre" in ft:
        return "transfer_station"
    if "repair café" in ft or "repair cafe" in ft:
        return "repair_cafe"
    if "electronics repair" in ft:
        return "electronics_repair"
    if "electronics shop" in ft:
        return "electronics_shop_repair"
    if location_type == "repair":
        return "repair_service"
    return "recycling_facility"


def osm_opening_hours_by_name() -> dict[str, str]:
    if not os.path.exists(OSM_RAW):
        return {}
    with open(OSM_RAW, encoding="utf-8") as f:
        payload = json.load(f)
    mapping: dict[str, str] = {}
    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        name = (tags.get("name") or "").strip()
        hours = (tags.get("opening_hours") or "").strip()
        if name and hours:
            mapping[name.lower()] = hours
    return mapping


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

    osm_hours = osm_opening_hours_by_name()
    print(f"OSM opening_hours tags found: {len(osm_hours)}")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # Postcode is derived from the suburb name, so it is always
            # recomputed against the current suburb table rather than kept from
            # an earlier run against a different source.
            cur.execute(
                """
                UPDATE locations AS loc
                SET postcode = sp.postcode
                FROM suburb_postcodes AS sp
                WHERE loc.suburb IS NOT NULL
                  AND loc.suburb <> ''
                  AND lower(loc.suburb) = lower(sp.suburb)
                  AND loc.postcode IS DISTINCT FROM sp.postcode;
                """
            )
            postcode_updates = cur.rowcount

            # Provider type classification (not acceptance)
            cur.execute(
                "SELECT id, location_type, facility_type, name FROM locations;"
            )
            for loc_id, location_type, facility_type, name in cur.fetchall():
                ptype = provider_type_from_facility(facility_type, location_type)
                hours = None
                if location_type == "repair" and name:
                    hours = osm_hours.get(name.lower())
                cur.execute(
                    """
                    UPDATE locations
                    SET provider_type = %s,
                        opening_hours = COALESCE(%s, opening_hours)
                    WHERE id = %s;
                    """,
                    (ptype, hours, loc_id),
                )

            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE postcode IS NOT NULL AND postcode <> '') AS with_postcode,
                  COUNT(*) FILTER (WHERE opening_hours IS NOT NULL) AS with_hours,
                  COUNT(*) FILTER (WHERE provider_type IS NOT NULL) AS with_ptype,
                  COUNT(*) AS total
                FROM locations;
                """
            )
            with_postcode, with_hours, with_ptype, total = cur.fetchone()
        conn.commit()

    print("SUCCESS: Location enrichment complete.")
    print(f"  postcode filled from suburb join: {postcode_updates}")
    print(f"  with postcode:      {with_postcode}/{total}")
    print(f"  with opening_hours: {with_hours}/{total}")
    print(f"  with provider_type: {with_ptype}/{total}")
    print("  acceptance and public access are not set here; see location_appliance_acceptance")
    return 0


if __name__ == "__main__":
    sys.exit(main())
