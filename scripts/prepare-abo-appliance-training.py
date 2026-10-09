"""Prepare licensed, product-disjoint ABO training candidates.

Amazon Berkeley Objects (ABO) supplies catalogue images and structured product
metadata under CC BY 4.0. This script uses only listing main images with exact
product types (plus the explicit portable-AC type/title rule already recorded
in the candidate TSV). Every item reserved by the benchmark manifest is
excluded, so alternate views of a test product cannot leak into training.

The output remains model-development data under ``tmp``. Dataset labels are
recorded as ``dataset_exact_label`` rather than pretending a person approved
each image.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image, ImageOps


ABO_BASE = "https://amazon-berkeley-objects.s3.us-east-1.amazonaws.com/images/small/"
ABO_LICENSE = "CC BY 4.0 (Amazon Berkeley Objects)"
ABO_ATTRIBUTION = "Amazon Berkeley Objects dataset, CC BY 4.0"

# Exact types intentionally include near-confusers found in earlier tests.
OOD_TYPES = {
    "BACKPACK", "BOTTLE", "CHAIR", "COUNTERTOP_OVEN", "DESK",
    "DISHWARE_BOWL", "HAIR_IRON", "LAMP", "NOTEBOOK_COMPUTER",
    "REFRIGERATOR", "SHOES", "TELEVISION", "TOY_FIGURE",
    "WASHER_DRYER_COMBINATION",
}


def parse_args() -> argparse.Namespace:
    """Require official metadata and the already-reserved benchmark products."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate-tsv", required=True, type=Path)
    parser.add_argument("--metadata-dir", required=True, type=Path)
    parser.add_argument("--images-csv-gz", required=True, type=Path)
    parser.add_argument("--test-manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--items-per-class", type=int, default=40)
    parser.add_argument("--items-per-ood", type=int, default=20)
    parser.add_argument("--max-image-side", type=int, default=512)
    parser.add_argument(
        "--include-title-rules",
        action="store_true",
        help="Collect title-query candidates as pending for manual review.",
    )
    return parser.parse_args()


def product_types(listing: dict) -> set[str]:
    """Normalize ABO's list/dict product-type variants to a set."""
    raw = listing.get("product_type") or []
    if isinstance(raw, dict):
        raw = [raw]
    return {
        str(item.get("value")) for item in raw
        if isinstance(item, dict) and item.get("value")
    }


def title_for(listing: dict) -> str:
    """Keep one readable title for later audit sheets."""
    values = listing.get("item_name") or []
    if isinstance(values, dict):
        values = [values]
    english = next((item for item in values if item.get("language_tag") in {
        "en_US", "en_GB", "en_AU"
    }), None)
    selected = english or (values[0] if values else {})
    return str(selected.get("value") or "")


def load_test_exclusions(path: Path) -> tuple[set[str], set[str]]:
    """Exclude complete products as well as the individual benchmark images."""
    manifest = json.loads(path.read_text(encoding="utf-8"))
    samples = manifest.get("samples", [])
    return (
        {str(row["item_id"]) for row in samples if row.get("item_id")},
        {str(row["image_id"]) for row in samples if row.get("image_id")},
    )


def load_candidates(path: Path, include_title_rules: bool) -> dict[str, dict[str, dict]]:
    """Validate positive TSV provenance and group exact candidates by product."""
    grouped: dict[str, dict[str, dict]] = defaultdict(dict)
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            allowed = {"product_type", "product_type+title"}
            if include_title_rules:
                allowed.add("title_query")
            if row.get("selection_method") not in allowed:
                continue
            if row.get("license") != ABO_LICENSE or not str(row.get("url", "")).startswith(ABO_BASE):
                raise SystemExit("Candidate TSV contains a non-ABO URL or unexpected licence.")
            grouped[row["class"]].setdefault(row["item_id"], row)
    return grouped


def load_image_paths(path: Path) -> dict[str, str]:
    """Map public ABO image IDs to their official small-image paths."""
    with gzip.open(path, "rt", encoding="utf-8", newline="") as handle:
        return {row["image_id"]: row["path"] for row in csv.DictReader(handle)}


def select_rows(args: argparse.Namespace, image_paths: dict[str, str],
                excluded_items: set[str], excluded_images: set[str]) -> list[dict]:
    """Select main images for exact targets and deterministic OOD products."""
    candidates = load_candidates(args.candidate_tsv, args.include_title_rules)
    selected_targets: dict[str, list[dict]] = defaultdict(list)
    selected_ood: dict[str, list[dict]] = defaultdict(list)
    for shard in sorted(args.metadata_dir.glob("listings_[0-9a-f].json.gz")):
        with gzip.open(shard, "rt", encoding="utf-8") as handle:
            for line in handle:
                listing = json.loads(line)
                item_id = str(listing.get("item_id") or "")
                image_id = str(listing.get("main_image_id") or "")
                if (
                    not item_id or not image_id or item_id in excluded_items
                    or image_id in excluded_images or image_id not in image_paths
                ):
                    continue
                types = product_types(listing)
                for label, products in candidates.items():
                    if item_id not in products or len(selected_targets[label]) >= args.items_per_class:
                        continue
                    candidate = products[item_id]
                    selected_targets[label].append({
                        "kind": "supported",
                        "candidate_label": label,
                        "source_item_id": item_id,
                        "image_id": image_id,
                        "product_type": candidate.get("product_type"),
                        "label_source": candidate.get("selection_method"),
                        "title": title_for(listing) or candidate.get("title", ""),
                    })
                matched_ood = next((value for value in sorted(OOD_TYPES) if value in types), None)
                if matched_ood and len(selected_ood[matched_ood]) < args.items_per_ood:
                    selected_ood[matched_ood].append({
                        "kind": "ood",
                        "candidate_label": matched_ood.lower(),
                        "source_item_id": item_id,
                        "image_id": image_id,
                        "product_type": matched_ood,
                        "label_source": "exact_product_type",
                        "title": title_for(listing),
                    })

    rows = []
    for collection in (selected_targets, selected_ood):
        for label in sorted(collection):
            for row in sorted(collection[label], key=lambda item: item["source_item_id"]):
                rows.append({
                    **row,
                    "source": "amazon_berkeley_objects",
                    "provider": "Amazon Berkeley Objects",
                    "review_status": (
                        "pending_manual_review"
                        if row.get("label_source") == "title_query"
                        else "dataset_exact_label"
                    ),
                    "license": "by",
                    "license_version": "4.0",
                    "license_url": "https://creativecommons.org/licenses/by/4.0/",
                    "attribution": ABO_ATTRIBUTION,
                    "url": ABO_BASE + image_paths[row["image_id"]],
                })
    return rows


def download(row: dict, directory: Path, max_side: int) -> dict | None:
    """Download one official image, strip metadata and record its fingerprint."""
    try:
        response = requests.get(row["url"], timeout=30)
        response.raise_for_status()
        with Image.open(io.BytesIO(response.content)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            if min(image.size) < 100:
                return None
            image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            image.save(output, "JPEG", quality=92, optimize=True)
        data = output.getvalue()
        label_dir = directory / row["kind"] / row["candidate_label"]
        label_dir.mkdir(parents=True, exist_ok=True)
        destination = label_dir / f"{row['source_item_id']}-{row['image_id']}.jpg"
        destination.write_bytes(data)
        return {
            **row,
            "local_path": destination.as_posix(),
            "sha256": hashlib.sha256(data).hexdigest(),
            "width": image.width,
            "height": image.height,
        }
    except (requests.RequestException, OSError):
        return None


def file_sha256(path: Path) -> str:
    """Fingerprint the emitted manifest for later experiment reports."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    """Write a provenance-complete JSONL manifest without touching app assets."""
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    excluded_items, excluded_images = load_test_exclusions(args.test_manifest)
    paths = load_image_paths(args.images_csv_gz)
    selected = select_rows(args, paths, excluded_items, excluded_images)
    with ThreadPoolExecutor(max_workers=8) as executor:
        downloaded = list(executor.map(
            lambda row: download(row, args.output_dir / "images", args.max_image_side),
            selected,
        ))
    rows = [row for row in downloaded if row is not None]
    manifest = args.output_dir / "abo-training-candidates.jsonl"
    manifest.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )
    counts = Counter(
        row["candidate_label"] if row["kind"] == "supported" else "unknown"
        for row in rows
    )
    summary = {
        "dataset": "Amazon Berkeley Objects",
        "license": "CC BY 4.0",
        "selection": "Main image only; exact structured type; benchmark products excluded",
        "reserved_test_items": len(excluded_items),
        "selected": len(selected),
        "downloaded": len(rows),
        "counts": counts,
        "manifest": manifest.as_posix(),
        "manifest_sha256": file_sha256(manifest),
    }
    (args.output_dir / "collection-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
