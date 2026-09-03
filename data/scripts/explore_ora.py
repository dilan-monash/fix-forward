"""
Step 4 helper: Print ORA column names and Australian category counts.

Run from fix-forward repo root:
    python data/scripts/explore_ora.py
"""

from __future__ import annotations

import csv
import os
from collections import Counter

RAW_PATH = os.path.join(
    os.path.dirname(__file__), "..", "raw", "ora", "OpenRepairData_v0.3_aggregate_202507.csv"
)


def main() -> None:
    if not os.path.exists(RAW_PATH):
        print(f"ERROR: Raw file not found: {RAW_PATH}")
        print("Download ORA CSV to data/raw/ora/ first.")
        return

    rows = 0
    aus_cats: Counter[str] = Counter()
    with open(RAW_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        print("Columns:", reader.fieldnames)
        print()
        for row in reader:
            rows += 1
            if row["country"] == "AUS":
                aus_cats[row["product_category"]] += 1

    print(f"Total rows: {rows:,}")
    print(f"Australian rows: {sum(aus_cats.values()):,}")
    print()
    print("Australian product_category counts:")
    for cat, count in aus_cats.most_common():
        flag = "  <-- n<30" if count < 30 else ""
        print(f"  {cat}: {count}{flag}")


if __name__ == "__main__":
    main()
