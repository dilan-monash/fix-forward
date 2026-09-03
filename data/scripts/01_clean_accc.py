"""
Step 6b: Clean ACCC recall RSS into a CSV for loading.

Reads the latest file in data/raw/accc/*.xml
Writes data/clean/recalls.csv

Run from fix-forward repo root:
    python data/scripts/01_clean_accc.py
"""

from __future__ import annotations

import csv
import glob
import os
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from html import unescape

import feedparser

SCRIPT_DIR = os.path.dirname(__file__)
RAW_DIR = os.path.join(SCRIPT_DIR, "..", "raw", "accc")
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "recalls.csv")

# Household-appliance-related RSS categories (keep others too, but tag relevance)
APPLIANCE_CATEGORIES = {
    "Home electrical appliances",
    "Kitchenware and containers",
    "Kitchen appliances",
    "Small electrical appliances",
    "Heaters and cooling",
    "Personal care",
    "Cleaning and home care",
    "Laundry and cleaning",
    "Electrical appliances",
    "Household electrical",
}

OUT_COLUMNS = [
    "title",
    "published_date",
    "summary",
    "official_url",
    "rss_category",
    "match_keywords",
    "likely_appliance_recall",
]


def strip_html(text: str) -> str:
    text = unescape(text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:2000]


def parse_published(entry) -> str:
    if getattr(entry, "published_parsed", None):
        return datetime(*entry.published_parsed[:6]).date().isoformat()
    if getattr(entry, "published", None):
        try:
            return parsedate_to_datetime(entry.published).date().isoformat()
        except (TypeError, ValueError):
            pass
    return ""


def build_keywords(title: str, category: str, summary: str) -> str:
    parts = [title, category, summary]
    combined = " ".join(p for p in parts if p).lower()
    combined = re.sub(r"[^a-z0-9\s]", " ", combined)
    tokens = sorted({t for t in combined.split() if len(t) > 2})
    return " ".join(tokens[:80])


def latest_raw_file() -> str:
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*.xml")))
    if not files:
        raise FileNotFoundError(f"No XML files in {RAW_DIR}. Run 00_download_accc.py first.")
    return files[-1]


def main() -> int:
    raw_path = latest_raw_file()
    print(f"Parsing: {raw_path}")

    feed = feedparser.parse(raw_path)
    if feed.bozo and not feed.entries:
        print(f"ERROR: Could not parse RSS: {feed.bozo_exception}")
        return 1

    rows: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for entry in feed.entries:
        url = (entry.get("link") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        title = (entry.get("title") or "").strip()
        if not title:
            continue

        category = ""
        if entry.get("tags"):
            category = entry.tags[0].get("term", "")
        elif entry.get("category"):
            category = entry.category

        summary = strip_html(entry.get("summary", ""))
        keywords = build_keywords(title, category, summary)
        likely = "yes" if category in APPLIANCE_CATEGORIES else "maybe"

        rows.append(
            {
                "title": title,
                "published_date": parse_published(entry),
                "summary": summary,
                "official_url": url,
                "rss_category": category,
                "match_keywords": keywords,
                "likely_appliance_recall": likely,
            }
        )

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    appliance_like = sum(1 for r in rows if r["likely_appliance_recall"] == "yes")
    print("ACCC clean complete.")
    print(f"  Recall records:        {len(rows)}")
    print(f"  Likely appliance:      {appliance_like}")
    print(f"  Output: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
