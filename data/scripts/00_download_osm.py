"""
Step 8a: Download repair-related POIs from OpenStreetMap (Victoria) via Overpass API.

Writes:
  - data/raw/osm/victoria_repair_pois.json

Run from fix-forward repo root:
    python data/scripts/00_download_osm.py
"""

from __future__ import annotations

import json
import os
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SCRIPT_DIR = os.path.dirname(__file__)
OUT_DIR = os.path.join(SCRIPT_DIR, "..", "raw", "osm")
OUT_PATH = os.path.join(OUT_DIR, "victoria_repair_pois.json")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Repair-related features in Victoria (admin area)
OVERPASS_QUERY = """
[out:json][timeout:180];
area["ISO3166-2"="AU-VIC"]["admin_level"=4]->.vic;
(
  node["craft"="electronics_repair"](area.vic);
  way["craft"="electronics_repair"](area.vic);
  node["shop"="repair"](area.vic);
  way["shop"="repair"](area.vic);
  node["shop"="electronics"]["repair"="yes"](area.vic);
  way["shop"="electronics"]["repair"="yes"](area.vic);
  node["amenity"="repair_cafe"](area.vic);
  way["amenity"="repair_cafe"](area.vic);
  node["name"~"Repair Cafe|Repair Café|repair cafe",i](area.vic);
  way["name"~"Repair Cafe|Repair Café|repair cafe",i](area.vic);
);
out center tags;
"""


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Querying OpenStreetMap Overpass API (Victoria repair POIs)...")
    print("(This can take up to 2 minutes.)")

    data = urlencode({"data": OVERPASS_QUERY}).encode("utf-8")
    request = Request(
        OVERPASS_URL,
        data=data,
        method="POST",
        headers={"User-Agent": "FixForward-Uni-Project/1.0 (education)"},
    )

    with urlopen(request, timeout=200) as response:
        payload = json.loads(response.read().decode("utf-8"))

    elements = payload.get("elements", [])
    output = {
        "source": "OpenStreetMap via Overpass API",
        "licence": "ODbL (Open Database License) — attribution required",
        "query_region": "Victoria, Australia",
        "element_count": len(elements),
        "elements": elements,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"SUCCESS: Saved {len(elements)} OSM elements to:")
    print(f"  {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
