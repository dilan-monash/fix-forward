"""
Step 7a: Download Victoria waste infrastructure data from DataVic API.

The direct CSV URL on vic.gov.au may 404; we use the official DataVic datastore API.

Writes:
  - data/raw/datavic/waste_infrastructure_2025-10.json

Run from fix-forward repo root:
    python data/scripts/00_download_datavic.py
"""

from __future__ import annotations

import json
import os
import sys
from urllib.parse import urlencode
from urllib.request import urlopen

SCRIPT_DIR = os.path.dirname(__file__)
OUT_DIR = os.path.join(SCRIPT_DIR, "..", "raw", "datavic")
OUT_PATH = os.path.join(OUT_DIR, "waste_infrastructure_2025-10.json")

RESOURCE_ID = "e44f5d96-51e8-48ec-b674-299d100a0231"
API_BASE = "https://discover.data.vic.gov.au/api/3/action/datastore_search"
PAGE_SIZE = 500


def fetch_page(offset: int) -> dict:
    params = urlencode(
        {
            "resource_id": RESOURCE_ID,
            "limit": PAGE_SIZE,
            "offset": offset,
        }
    )
    url = f"{API_BASE}?{params}"
    with urlopen(url, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Downloading from DataVic datastore API...")
    first = fetch_page(0)
    if not first.get("success"):
        print("ERROR: DataVic API request failed.")
        return 1

    total = first["result"]["total"]
    records = list(first["result"]["records"])
    offset = PAGE_SIZE

    while offset < total:
        page = fetch_page(offset)
        records.extend(page["result"]["records"])
        offset += PAGE_SIZE

    payload = {
        "resource_id": RESOURCE_ID,
        "dataset": "Victoria's waste and resource recovery infrastructure map data",
        "release": "October 2025",
        "licence": "CC BY 4.0",
        "source_url": "https://discover.data.vic.gov.au/dataset/victoria-s-waste-and-resource-recovery-infrastructure-map-data",
        "total_records": total,
        "records": records,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"SUCCESS: Saved {len(records)} records to:")
    print(f"  {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
