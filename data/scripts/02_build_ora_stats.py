"""
Step 5c: Build repair statistics and barriers from cleaned ORA data.

Reads:
  - data/clean/ora_clean_mapped.csv

Writes:
  - data/clean/repair_statistics.csv
  - data/clean/repair_barriers.csv

Rules:
  - Australian stats when n >= 30
  - Otherwise labelled global_fallback (low confidence)
  - If global n < 30, mark insufficient_evidence

Run from fix-forward repo root:
    python data/scripts/02_build_ora_stats.py
"""

from __future__ import annotations

import csv
import os
from collections import Counter, defaultdict

SCRIPT_DIR = os.path.dirname(__file__)
CLEAN_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "ora_clean_mapped.csv")
STATS_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "repair_statistics.csv")
BARRIERS_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "repair_barriers.csv")

MIN_AU_SAMPLE = 30
LIMITATIONS_BASE = (
    "Category benchmark from Open Repair Alliance community repair events. "
    "Self-selected sample; not a prediction for your specific appliance or model."
)

STATS_COLUMNS = [
    "appliance_family",
    "appliance_category",
    "geography",
    "sample_size",
    "fixed_count",
    "repairable_count",
    "end_of_life_count",
    "insufficient_evidence",
    "confidence_level",
    "limitations",
]

BARRIER_COLUMNS = [
    "appliance_family",
    "appliance_category",
    "barrier",
    "occurrence_count",
    "geography",
]


def load_clean_rows() -> list[dict[str, str]]:
    with open(CLEAN_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def count_status(rows: list[dict[str, str]]) -> dict[str, int]:
    counts = Counter(row["repair_status"] for row in rows)
    return {
        "fixed_count": counts.get("Fixed", 0),
        "repairable_count": counts.get("Repairable", 0),
        "end_of_life_count": counts.get("End of life", 0),
    }


def build_stats(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = (row["appliance_family"], row["appliance_category"])
        grouped[key].append(row)

    results: list[dict[str, str]] = []
    for (family, category), group_rows in sorted(grouped.items()):
        au_rows = [r for r in group_rows if r["country"] == "AUS"]
        global_rows = group_rows

        if len(au_rows) >= MIN_AU_SAMPLE:
            use_rows = au_rows
            geography = "AU"
            confidence = "high"
            insufficient = "false"
            extra = "Australian records only."
        elif len(global_rows) >= MIN_AU_SAMPLE:
            use_rows = global_rows
            geography = "global_fallback"
            confidence = "low"
            insufficient = "false"
            extra = (
                f"Fewer than {MIN_AU_SAMPLE} Australian records; "
                "global ORA data shown as labelled fallback."
            )
        else:
            use_rows = au_rows if au_rows else global_rows
            geography = "AU" if au_rows else "global_fallback"
            confidence = "insufficient"
            insufficient = "true"
            extra = "Insufficient sample size to publish a defensible benchmark."

        status_counts = count_status(use_rows)
        ora_cats = sorted({r["product_category"] for r in group_rows})
        limitations = (
            f"{LIMITATIONS_BASE} ORA categories: {', '.join(ora_cats)}. {extra}"
        )

        results.append(
            {
                "appliance_family": family,
                "appliance_category": category,
                "geography": geography,
                "sample_size": str(len(use_rows)),
                "fixed_count": str(status_counts["fixed_count"]),
                "repairable_count": str(status_counts["repairable_count"]),
                "end_of_life_count": str(status_counts["end_of_life_count"]),
                "insufficient_evidence": insufficient,
                "confidence_level": confidence,
                "limitations": limitations,
            }
        )

    return results


def build_barriers(rows: list[dict[str, str]], stats: list[dict[str, str]]) -> list[dict[str, str]]:
    geo_by_key = {
        (s["appliance_family"], s["appliance_category"]): s["geography"] for s in stats
    }
    barrier_rows: list[dict[str, str]] = []

    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        if row["repair_status"] != "End of life":
            continue
        if not row["repair_barrier_if_end_of_life"]:
            continue
        key = (row["appliance_family"], row["appliance_category"])
        grouped[key].append(row)

    for (family, category), group_rows in sorted(grouped.items()):
        geography = geo_by_key.get((family, category), "AU")
        if geography == "AU":
            use_rows = [r for r in group_rows if r["country"] == "AUS"]
        else:
            use_rows = group_rows

        barriers = Counter(r["repair_barrier_if_end_of_life"] for r in use_rows)
        for barrier, count in barriers.most_common(10):
            barrier_rows.append(
                {
                    "appliance_family": family,
                    "appliance_category": category,
                    "barrier": barrier,
                    "occurrence_count": str(count),
                    "geography": geography,
                }
            )

    return barrier_rows


def main() -> int:
    if not os.path.exists(CLEAN_PATH):
        print(f"ERROR: Run 01_clean_ora.py first. Missing: {CLEAN_PATH}")
        return 1

    rows = load_clean_rows()
    stats = build_stats(rows)
    barriers = build_barriers(rows, stats)

    with open(STATS_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=STATS_COLUMNS)
        writer.writeheader()
        writer.writerows(stats)

    with open(BARRIERS_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=BARRIER_COLUMNS)
        writer.writeheader()
        writer.writerows(barriers)

    print("ORA stats build complete.")
    print(f"  repair_statistics rows: {len(stats)}")
    print(f"  repair_barriers rows:   {len(barriers)}")
    print(f"  Output: {STATS_PATH}")
    print(f"  Output: {BARRIERS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
