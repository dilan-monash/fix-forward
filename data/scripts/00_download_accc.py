"""
Step 6a: Download ACCC Product Safety recall RSS feed.

Writes raw XML to data/raw/accc/ with today's date in the filename.

Run from fix-forward repo root:
    python data/scripts/00_download_accc.py
"""

from __future__ import annotations

import os
import sys
from datetime import date
from urllib.request import urlopen

SCRIPT_DIR = os.path.dirname(__file__)
OUT_DIR = os.path.join(SCRIPT_DIR, "..", "raw", "accc")
RSS_URL = "https://www.productsafety.gov.au/rss/feed.xml/psa_recall"
OFFICIAL_SEARCH_URL = "https://www.productsafety.gov.au/recalls"


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"accc_recalls_{date.today().isoformat()}.xml")

    print(f"Downloading ACCC recall RSS from:\n  {RSS_URL}")
    with urlopen(RSS_URL, timeout=60) as response:
        data = response.read()

    with open(out_path, "wb") as f:
        f.write(data)

    print(f"SUCCESS: Saved {len(data):,} bytes to:")
    print(f"  {out_path}")
    print()
    print("Official search fallback (if index incomplete):")
    print(f"  {OFFICIAL_SEARCH_URL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
