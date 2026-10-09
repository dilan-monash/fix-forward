"""Build an independent Amazon Berkeley Objects benchmark candidate set.

The script chooses products, not alternate views, so no item is duplicated in
the test sample. It downloads only the selected CC BY 4.0 images and records the
ABO item ID, product type and source URL for a later visual audit. These images
must remain test-only and are never consumed by the training script.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps


ABO_BASE = "https://amazon-berkeley-objects.s3.us-east-1.amazonaws.com/images/small/"
ABO_LICENSE = "CC BY 4.0"

# Exact non-target product types provide realistic near and far OOD examples.
OOD_TYPES = [
    "REFRIGERATOR", "TELEVISION", "NOTEBOOK_COMPUTER",
    "WASHER_DRYER_COMBINATION", "DISHWARE_BOWL", "BOTTLE", "CHAIR",
    "DESK", "BACKPACK", "LAMP", "HAIR_IRON", "COUNTERTOP_OVEN",
    "SHOES", "TOY_FIGURE",
]


def parse_args() -> argparse.Namespace:
    """Require the official metadata inputs and a separate test destination."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate-tsv", required=True, type=Path)
    parser.add_argument("--metadata-dir", required=True, type=Path)
    parser.add_argument("--images-csv-gz", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--items-per-class", type=int, default=2)
    parser.add_argument("--items-per-ood", type=int, default=2)
    return parser.parse_args()


def first_target_items(path: Path, limit: int) -> list[dict]:
    """Select one catalog view for each of the first distinct products/class."""
    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            grouped[row["class"]][row["item_id"]].append(row)
    selected = []
    for label, products in sorted(grouped.items()):
        seen_images = set()
        for item_id in sorted(products):
            # The generator preserves the listing's main-image row first; use
            # its first row and retain the title for manual visual audit.
            candidate = {
                "kind": "positive", "expected": label, "ood_class": None,
                **products[item_id][0],
            }
            if candidate["image_id"] in seen_images:
                continue
            seen_images.add(candidate["image_id"])
            selected.append(candidate)
            if len(seen_images) == limit:
                break
    return selected


def image_paths(path: Path) -> dict[str, str]:
    """Map ABO image IDs to official small-image object paths."""
    with gzip.open(path, "rt", encoding="utf-8", newline="") as handle:
        return {row["image_id"]: row["path"] for row in csv.DictReader(handle)}


def first_ood_items(metadata_dir: Path, paths: dict[str, str], limit: int) -> list[dict]:
    """Pick deterministic main images for exact non-target product types."""
    products: dict[str, list[dict]] = defaultdict(list)
    for shard in sorted(metadata_dir.glob("listings_*.json.gz")):
        with gzip.open(shard, "rt", encoding="utf-8") as handle:
            for line in handle:
                listing = json.loads(line)
                types = {entry.get("value") for entry in listing.get("product_type", [])}
                matched = next((value for value in OOD_TYPES if value in types), None)
                image_id = listing.get("main_image_id")
                if not matched or not image_id or image_id not in paths:
                    continue
                title = next((entry.get("value") for entry in listing.get("item_name", [])
                              if entry.get("value")), "")
                products[matched].append({
                    "kind": "ood", "expected": None,
                    "ood_class": matched.lower(), "class": "unsupported_or_unknown",
                    "item_id": listing["item_id"], "image_id": image_id,
                    "product_type": matched, "selection_method": "exact_product_type",
                    "title": title, "url": ABO_BASE + paths[image_id],
                    "license": f"{ABO_LICENSE} (Amazon Berkeley Objects)",
                    "review_status": "pending_manual_review",
                })
    selected = []
    for product_type, rows in sorted(products.items()):
        seen_images = set()
        for row in sorted(rows, key=lambda row: row["item_id"]):
            if row["image_id"] in seen_images:
                continue
            seen_images.add(row["image_id"])
            selected.append(row)
            if len(seen_images) == limit:
                break
    return selected


def download(row: dict, directory: Path) -> dict | None:
    """Download, decode, strip metadata and fingerprint one selected image."""
    try:
        response = requests.get(row["url"], timeout=30)
        response.raise_for_status()
        with Image.open(io.BytesIO(response.content)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            if min(image.size) < 100:
                return None
            output = io.BytesIO()
            image.save(output, "JPEG", quality=92, optimize=True)
            data = output.getvalue()
        destination = directory / f"{row['kind']}-{row['item_id']}-{row['image_id']}.jpg"
        destination.write_bytes(data)
        return {
            **row,
            "downloaded_jpeg": destination.as_posix(),
            "decoded_size": [image.width, image.height],
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    except (requests.RequestException, OSError):
        return None


def contact_sheet(rows: list[dict], destination: Path) -> None:
    """Render all candidates with stable indices for visual inclusion decisions."""
    cell_width, image_height, text_height, columns = 230, 180, 60, 5
    count_rows = (len(rows) + columns - 1) // columns
    sheet = Image.new("RGB", (cell_width * columns, 40 + count_rows * (image_height + text_height)), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((8, 12), "ABO independent benchmark candidates — approve only clear, correctly labelled products", fill="black", font=font)
    for index, row in enumerate(rows, start=1):
        column, line = (index - 1) % columns, (index - 1) // columns
        left, top = column * cell_width, 40 + line * (image_height + text_height)
        with Image.open(row["downloaded_jpeg"]) as opened:
            image = opened.convert("RGB")
            image.thumbnail((cell_width - 12, image_height - 8), Image.Resampling.LANCZOS)
        sheet.paste(image, (left + (cell_width - image.width) // 2,
                            top + (image_height - image.height) // 2))
        expected = row.get("expected") or f"OOD:{row.get('ood_class')}"
        title = " ".join(str(row.get("title") or "").split())
        draw.text((left + 5, top + image_height + 3), f"{index}. {expected}", fill="black", font=font)
        draw.text((left + 5, top + image_height + 21), title[:36], fill="black", font=font)
        draw.text((left + 5, top + image_height + 39), row["item_id"], fill="black", font=font)
    sheet.save(destination, quality=90)


def main() -> None:
    """Create test-only candidate manifest and contact sheet."""
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    images_dir = args.output_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    paths = image_paths(args.images_csv_gz)
    selected = [
        *first_target_items(args.candidate_tsv, args.items_per_class),
        *first_ood_items(args.metadata_dir, paths, args.items_per_ood),
    ]
    with ThreadPoolExecutor(max_workers=8) as executor:
        downloaded = list(executor.map(lambda row: download(row, images_dir), selected))
    rows = [row for row in downloaded if row is not None]
    manifest = {
        "benchmark": "fixforward-abo-independent-candidates-v1",
        "source": "Amazon Berkeley Objects",
        "license": ABO_LICENSE,
        "selection": "First main image from the first distinct item IDs per exact candidate class/product type; manual inclusion review required.",
        "samples": rows,
    }
    (args.output_dir / "sample-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    contact_sheet(rows, args.output_dir / "candidate-contact-sheet.jpg")
    print(json.dumps({"selected": len(selected), "downloaded": len(rows),
                      "positive": sum(row["kind"] == "positive" for row in rows),
                      "ood": sum(row["kind"] == "ood" for row in rows)}, indent=2))


if __name__ == "__main__":
    main()
