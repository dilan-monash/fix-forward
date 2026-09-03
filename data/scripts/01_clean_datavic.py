"""
Step 7b: Clean DataVic waste infrastructure for recycling/disposal locations.

Reads:
  - data/raw/datavic/waste_infrastructure_2025-10.json

Writes:
  - data/clean/locations_recycling.csv

Run from fix-forward repo root:
    python data/scripts/01_clean_datavic.py
"""

from __future__ import annotations

import csv
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(__file__)
RAW_PATH = os.path.join(SCRIPT_DIR, "..", "raw", "datavic", "waste_infrastructure_2025-10.json")
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "locations_recycling.csv")

SOURCE_NOTE = (
    "Confirm this facility accepts your appliance before visiting. "
    "Open data may be incomplete or out of date."
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


def clean_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_coord(value) -> str:
    text = clean_text(value)
    if not text:
        return ""
    try:
        return str(float(text))
    except ValueError:
        return ""


def main() -> int:
    if not os.path.exists(RAW_PATH):
        print(f"ERROR: Run 00_download_datavic.py first. Missing: {RAW_PATH}")
        return 1

    with open(RAW_PATH, encoding="utf-8") as f:
        payload = json.load(f)

    rows_out: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    for row in payload["records"]:
        name = clean_text(row.get("Facility Name"))
        suburb = clean_text(row.get("Suburb"))
        address = clean_text(row.get("Address"))
        if not name:
            continue

        dedupe_key = (name.lower(), suburb.lower(), address.lower())
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        facility_type = clean_text(row.get("Facility Type"))
        infra_type = clean_text(row.get("Infrastructure Type"))
        if infra_type and infra_type != facility_type:
            facility_type = f"{facility_type} — {infra_type}"

        rows_out.append(
            {
                "location_type": "recycling",
                "name": name,
                "facility_type": facility_type,
                "address": address,
                "suburb": suburb,
                "lga": clean_text(row.get("LGA")),
                "latitude": parse_coord(row.get("Latitude")),
                "longitude": parse_coord(row.get("Longitude")),
                "phone": "",
                "website": "",
                "source_notes": SOURCE_NOTE,
            }
        )

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows_out)

    print("DataVic clean complete.")
    print(f"  Facilities written: {len(rows_out)}")
    print(f"  Output: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
