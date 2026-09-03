"""
Step 5b: Clean ORA raw data and map to FixForward appliance families.

Reads:
  - data/raw/ora/OpenRepairData_v0.3_aggregate_202507.csv
  - data/mapping/appliance_families.csv

Writes:
  - data/clean/ora_clean_mapped.csv

Run from fix-forward repo root:
    python data/scripts/01_clean_ora.py
"""

from __future__ import annotations

import csv
import os
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(__file__)
RAW_PATH = os.path.join(SCRIPT_DIR, "..", "raw", "ora", "OpenRepairData_v0.3_aggregate_202507.csv")
MAPPING_PATH = os.path.join(SCRIPT_DIR, "..", "mapping", "appliance_families.csv")
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "ora_clean_mapped.csv")

OUT_COLUMNS = [
    "id",
    "country",
    "product_category",
    "repair_status",
    "repair_barrier_if_end_of_life",
    "appliance_family",
    "appliance_category",
    "event_date",
]


def load_mapping() -> dict[str, list[tuple[str, str]]]:
    """Map each ORA product_category to one or more (family, category) pairs."""
    mapping: dict[str, list[tuple[str, str]]] = defaultdict(list)
    with open(MAPPING_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["in_scope"] not in ("yes", "partial"):
                continue
            mapping[row["ora_product_category"]].append(
                (row["family"], row["category"])
            )
    return mapping


def main() -> int:
    if not os.path.exists(RAW_PATH):
        print(f"ERROR: Missing raw file: {RAW_PATH}")
        return 1

    mapping = load_mapping()
    if not mapping:
        print("ERROR: No mappings found in appliance_families.csv")
        return 1

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    in_rows = 0
    out_rows = 0
    skipped_status = 0

    with open(RAW_PATH, newline="", encoding="utf-8") as raw_f, open(
        OUT_PATH, "w", newline="", encoding="utf-8"
    ) as out_f:
        reader = csv.DictReader(raw_f)
        writer = csv.DictWriter(out_f, fieldnames=OUT_COLUMNS)
        writer.writeheader()

        for row in reader:
            in_rows += 1
            ora_cat = row["product_category"]
            if ora_cat not in mapping:
                continue

            status = (row.get("repair_status") or "").strip()
            if status not in ("Fixed", "Repairable", "End of life", "Unknown"):
                skipped_status += 1

            for family, category in mapping[ora_cat]:
                writer.writerow(
                    {
                        "id": row["id"],
                        "country": row["country"],
                        "product_category": ora_cat,
                        "repair_status": status,
                        "repair_barrier_if_end_of_life": (
                            row.get("repair_barrier_if_end_of_life") or ""
                        ).strip(),
                        "appliance_family": family,
                        "appliance_category": category,
                        "event_date": row.get("event_date", ""),
                    }
                )
                out_rows += 1

    print("ORA clean complete.")
    print(f"  Raw rows scanned:     {in_rows:,}")
    print(f"  Mapped rows written:  {out_rows:,}")
    print(f"  ORA categories used:  {len(mapping)}")
    print(f"  Output: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
