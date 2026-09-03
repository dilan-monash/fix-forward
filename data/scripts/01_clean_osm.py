"""
Step 8b: Clean OSM repair POIs for the locations table.

Reads:
  - data/raw/osm/victoria_repair_pois.json

Writes:
  - data/clean/locations_repair.csv

Run from fix-forward repo root:
    python data/scripts/01_clean_osm.py
"""

from __future__ import annotations

import csv
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(__file__)
RAW_PATH = os.path.join(SCRIPT_DIR, "..", "raw", "osm", "victoria_repair_pois.json")
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "locations_repair.csv")

SOURCE_NOTE = (
    "OpenStreetMap data may be incomplete or out of date. "
    "Contact the provider before travelling."
)

OUT_COLUMNS = [
    "location_type",
    "name",
    "facility_type",
    "address",
    "suburb",
    "lga",
    "latitude",
    "longitude",
    "phone",
    "website",
    "source_notes",
]


def tag(tags: dict, *keys: str) -> str:
    for key in keys:
        if key in tags and tags[key]:
            return str(tags[key]).strip()
    return ""


def build_address(tags: dict) -> str:
    parts = []
    housenumber = tag(tags, "addr:housenumber")
    street = tag(tags, "addr:street")
    if housenumber and street:
        parts.append(f"{housenumber} {street}")
    elif street:
        parts.append(street)
    elif tag(tags, "addr:full"):
        parts.append(tag(tags, "addr:full"))
    return ", ".join(parts)


def build_facility_type(tags: dict) -> str:
    if tag(tags, "amenity") == "repair_cafe":
        return "Repair café"
    if tag(tags, "craft") == "electronics_repair":
        return "Electronics repair"
    if tag(tags, "shop") == "repair":
        return "Repair shop"
    if tag(tags, "shop") == "electronics" and tag(tags, "repair") == "yes":
        return "Electronics shop (repair)"
    name = tag(tags, "name").lower()
    if "repair cafe" in name or "repair café" in name:
        return "Repair café"
    return "Repair service"


def coords(element: dict) -> tuple[str, str]:
    if element["type"] == "node":
        return str(element.get("lat", "")), str(element.get("lon", ""))
    center = element.get("center") or {}
    return str(center.get("lat", "")), str(center.get("lon", ""))


def main() -> int:
    if not os.path.exists(RAW_PATH):
        print(f"ERROR: Run 00_download_osm.py first. Missing: {RAW_PATH}")
        return 1

    with open(RAW_PATH, encoding="utf-8") as f:
        payload = json.load(f)

    rows_out: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        name = tag(tags, "name")
        if not name:
            continue

        suburb = tag(tags, "addr:suburb", "addr:city", "addr:town", "addr:village")
        address = build_address(tags)
        lat, lon = coords(element)
        if not lat or not lon:
            continue

        dedupe_key = (name.lower(), suburb.lower(), f"{lat},{lon}")
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        rows_out.append(
            {
                "location_type": "repair",
                "name": name,
                "facility_type": build_facility_type(tags),
                "address": address,
                "suburb": suburb,
                "lga": tag(tags, "addr:state"),  # OSM rarely has LGA; leave blank often
                "latitude": lat,
                "longitude": lon,
                "phone": tag(tags, "phone", "contact:phone"),
                "website": tag(tags, "website", "contact:website"),
                "source_notes": SOURCE_NOTE,
            }
        )

    rows_out.sort(key=lambda r: (r["suburb"].lower(), r["name"].lower()))

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows_out)

    with_suburb = sum(1 for r in rows_out if r["suburb"])
    print("OSM clean complete.")
    print(f"  Repair locations:     {len(rows_out)}")
    print(f"  With suburb field:    {with_suburb}")
    print(f"  Output: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
