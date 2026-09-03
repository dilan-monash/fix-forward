"""
Verify the manually placed Open Repair Alliance aggregate snapshot.

The ORA download is behind an email form, so it cannot be fetched
automatically. Place the published CSV at:

    data/raw/ora/OpenRepairData_v0.3_aggregate_202507.csv

This script checks that the file exists and that its SHA-256 matches the
snapshot used to build Iteration 1. A mismatch is a hard failure: a different
file would change the repair statistics.

Run from fix-forward repo root:
    python data/scripts/00_fetch_ora.py
"""

from __future__ import annotations

import os
import sys

SCRIPT_DIR = os.path.dirname(__file__)
sys.path.insert(0, SCRIPT_DIR)

from import_utils import sha256_file  # noqa: E402

RAW_PATH = os.path.join(
    SCRIPT_DIR, "..", "raw", "ora", "OpenRepairData_v0.3_aggregate_202507.csv"
)
DOWNLOAD_PAGE = "https://openrepair.org/open-data/downloads/"
EXPECTED_FILENAME = "OpenRepairData_v0.3_aggregate_202507.csv"
# Digest of the 202507 aggregate used for Iteration 1.
EXPECTED_SHA256 = "364d741b39b40ce955a5a9f83adf9776b3f40f2f857cc2cd96b6ae1818aabe82"


def main() -> int:
    if not os.path.exists(RAW_PATH):
        print("ERROR: ORA snapshot is not present.")
        print()
        print("  The Open Repair Alliance dataset is released through an email form,")
        print("  so this script cannot download it for you.")
        print()
        print(f"  1. Open {DOWNLOAD_PAGE}")
        print(f"  2. Request {EXPECTED_FILENAME}")
        print(f"  3. Save it to {os.path.abspath(RAW_PATH)}")
        print("  4. Re-run this script to verify the checksum")
        return 1

    digest = sha256_file(RAW_PATH)
    size = os.path.getsize(RAW_PATH)
    print(f"Found {os.path.basename(RAW_PATH)} ({size:,} bytes)")
    print(f"  sha256 {digest}")
    if digest != EXPECTED_SHA256:
        print()
        print("ERROR: checksum does not match the Iteration 1 snapshot.")
        print(f"  expected {EXPECTED_SHA256}")
        print("  A different file would change repair statistics. Replace it with")
        print(f"  the 202507 aggregate from {DOWNLOAD_PAGE}")
        return 1

    print("SUCCESS: ORA snapshot matches the recorded checksum.")
    print("  next: python data/scripts/01_clean_ora.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
