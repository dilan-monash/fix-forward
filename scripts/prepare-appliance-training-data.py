"""Collect licensed model-development candidates through the Openverse API.

The script writes only to the requested development directory (normally under
the ignored ``tmp`` folder). Search results are candidates, not ground-truth
labels: the generated manifest deliberately records ``review_status=pending``
until a person checks each image. Production and shared database data are never
read or changed.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Iterable

import requests
from PIL import Image, ImageOps, UnidentifiedImageError


OPENVERSE_URL = "https://api.openverse.org/v1/images/"
ALLOWED_LICENSES = "cc0,by,by-sa"

# Query wording follows FixForward's operational definitions, not merely the
# broad names used by general-purpose datasets such as Open Images.
CLASS_QUERIES = {
    "air_fryer": '"air fryer"',
    "blender": 'blender',
    "coffee_machine": '"coffee machine"',
    "dehumidifier": 'dehumidifier',
    "fan": '"electric fan"',
    "food_processor": '"food processor"',
    "hair_dryer": '"hair dryer"',
    "kettle": '"electric kettle"',
    "microwave": '"microwave oven"',
    "mixer": '"stand mixer"',
    "portable_ac": '"portable air conditioner"',
    "portable_heater": '"portable heater"',
    "rice_cooker": '"rice cooker"',
    "sandwich_press": '"sandwich press"',
    "shaver": '"electric shaver"',
    "steam_cleaner": '"steam cleaner"',
    "straightener": '"hair straightener"',
    "toaster": 'toaster',
    "vaccum_cleaner": '"vacuum cleaner"',
}

# These examples teach a later model that a clear photograph can still be
# outside the supported set. Near-confusers are included alongside far OOD.
OOD_QUERIES = {
    "built_in_oven": 'built-in oven kitchen',
    "refrigerator": 'refrigerator appliance',
    "washing_machine": 'washing machine appliance',
    "humidifier": 'humidifier appliance',
    "clothes_iron": 'electric clothes iron',
    "floor_mop": 'floor mop',
    "desk_lamp": 'desk lamp',
    "laptop": 'laptop computer',
    "mobile_phone": 'mobile phone',
    "television": 'television screen',
    "person": 'person indoors',
    "dog": 'pet dog indoors',
    "cat": 'pet cat indoors',
    "car": 'car vehicle',
    "chair": 'chair furniture',
    "desk": 'desk furniture',
    "backpack": 'backpack bag',
    "bottle": 'bottle object',
    "bowl": 'bowl object',
    "flower": 'flower plant',
    "tree": 'tree outdoors',
    "empty_room": 'empty room interior',
}


def parse_args() -> argparse.Namespace:
    """Require an output path and keep API volume explicit and bounded."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--pages-per-class", type=int, default=3, choices=range(1, 6))
    parser.add_argument("--pages-per-ood", type=int, default=1, choices=range(1, 4))
    parser.add_argument("--request-delay", type=float, default=3.1)
    parser.add_argument("--max-image-side", type=int, default=512)
    return parser.parse_args()


def iter_results(session: requests.Session, query: str, pages: int,
                 delay: float) -> Iterable[dict]:
    """Use the documented anonymous page size and respect its burst limit."""
    for page in range(1, pages + 1):
        response = None
        for attempt in range(5):
            response = session.get(
                OPENVERSE_URL,
                params={"q": query, "license": ALLOWED_LICENSES,
                        "page_size": 20, "page": page},
                timeout=30,
            )
            if response.ok:
                break
            # Cloudflare or the anonymous API may temporarily slow a bounded
            # research run. Back off; never bypass the challenge or rotate IPs.
            if response.status_code not in {403, 429, 502, 503, 504}:
                response.raise_for_status()
            time.sleep(min(60, 10 * (attempt + 1)))
        if response is None:
            raise RuntimeError("Openverse returned no response.")
        response.raise_for_status()
        payload = response.json()
        yield from payload.get("results", [])
        if page < pages:
            time.sleep(delay)


def safe_image(session: requests.Session, urls: Iterable[str],
               max_side: int) -> tuple[bytes, int, int] | None:
    """Try proxy then source URL, strip metadata and return a bounded JPEG."""
    maximum_bytes = 15 * 1024 * 1024
    for url in urls:
        if not url:
            continue
        try:
            with session.get(url, timeout=30, stream=True) as response:
                response.raise_for_status()
                declared = int(response.headers.get("content-length", "0") or 0)
                if declared > maximum_bytes:
                    continue
                chunks = []
                total = 0
                for chunk in response.iter_content(64 * 1024):
                    total += len(chunk)
                    if total > maximum_bytes:
                        chunks = []
                        break
                    chunks.append(chunk)
                if not chunks:
                    continue
                data = b"".join(chunks)
            with Image.open(io.BytesIO(data)) as opened:
                image = ImageOps.exif_transpose(opened).convert("RGB")
                if min(image.size) < 120:
                    continue
                image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
                output = io.BytesIO()
                image.save(output, format="JPEG", quality=90, optimize=True)
                return output.getvalue(), image.width, image.height
        except (requests.RequestException, OSError, UnidentifiedImageError, ValueError):
            continue
    return None


def candidate_record(result: dict, kind: str, label: str, query: str,
                     local_path: str, sha256: str, width: int, height: int) -> dict:
    """Keep the provenance needed for review, deduplication and attribution."""
    return {
        "kind": kind,
        "candidate_label": label,
        "query": query,
        "review_status": "pending",
        "openverse_id": result.get("id"),
        "title": result.get("title"),
        "creator": result.get("creator"),
        "creator_url": result.get("creator_url"),
        "source": result.get("source"),
        "provider": result.get("provider"),
        "landing_url": result.get("foreign_landing_url"),
        "original_url": result.get("url"),
        "thumbnail_url": result.get("thumbnail"),
        "license": result.get("license"),
        "license_version": result.get("license_version"),
        "license_url": result.get("license_url"),
        "attribution": result.get("attribution"),
        "mature": result.get("mature"),
        "local_path": local_path,
        "sha256": sha256,
        "width": width,
        "height": height,
    }


def collect_query(session: requests.Session, output_dir: Path, kind: str,
                  label: str, query: str, pages: int, args: argparse.Namespace,
                  seen_hashes: set[str]) -> list[dict]:
    """Download unique, decodable candidates for one expected label."""
    directory = output_dir / "images" / kind / label
    directory.mkdir(parents=True, exist_ok=True)
    records = []
    seen_ids = set()
    candidates = []
    for result in iter_results(session, query, pages, args.request_delay):
        source_id = str(result.get("id") or "")
        thumbnail = result.get("thumbnail")
        if not source_id or source_id in seen_ids or not thumbnail or result.get("mature") is True:
            continue
        seen_ids.add(source_id)
        candidates.append(result)

    def download(result: dict):
        source_id = str(result["id"])
        existing = directory / f"{source_id}.jpg"
        if existing.exists():
            try:
                data = existing.read_bytes()
                with Image.open(io.BytesIO(data)) as opened:
                    return data, opened.width, opened.height
            except (OSError, UnidentifiedImageError):
                pass
        # Requests sessions are kept inside workers because Session itself is
        # not documented as thread-safe. Source downloads do not need cookies.
        worker = requests.Session()
        worker.headers.update(session.headers)
        try:
            # Openverse's thumbnail proxy can report a source failure (HTTP 424),
            # so use the licensed source first and keep the proxy as fallback.
            return safe_image(
                worker, (result.get("url"), result.get("thumbnail")), args.max_image_side
            )
        finally:
            worker.close()

    # Concurrent source downloads shorten this bounded research run without
    # increasing Openverse search requests or bypassing its API rate limits.
    with ThreadPoolExecutor(max_workers=8) as executor:
        downloads = list(executor.map(download, candidates))
    for result, downloaded in zip(candidates, downloads):
        source_id = str(result["id"])
        if not downloaded:
            continue
        data, width, height = downloaded
        digest = hashlib.sha256(data).hexdigest()
        if digest in seen_hashes:
            continue
        seen_hashes.add(digest)
        path = directory / f"{source_id}.jpg"
        path.write_bytes(data)
        records.append(candidate_record(
            result, kind, label, query, path.as_posix(), digest, width, height
        ))
    return records


def main() -> None:
    """Collect candidates and write one JSONL row per auditable image."""
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    # A descriptive agent makes this small educational research run traceable.
    session.headers.update({
        "User-Agent": "FixForwardResearch/1.0 (https://fixforward.me; educational model validation)"
    })
    records: list[dict] = []
    seen_hashes: set[str] = set()
    parts = args.output_dir / "manifest-parts"
    parts.mkdir(parents=True, exist_ok=True)

    jobs = [
        *(('supported', label, query, args.pages_per_class)
          for label, query in CLASS_QUERIES.items()),
        *(('ood', label, query, args.pages_per_ood)
          for label, query in OOD_QUERIES.items()),
    ]
    for index, (kind, label, query, pages) in enumerate(jobs, start=1):
        part = parts / f"{kind}-{label}.jsonl"
        if part.exists():
            collected = [json.loads(line) for line in part.read_text(encoding="utf-8").splitlines() if line]
            seen_hashes.update(record["sha256"] for record in collected)
        else:
            collected = collect_query(
                session, args.output_dir, kind, label, query, pages, args, seen_hashes
            )
            part.write_text(
                "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in collected),
                encoding="utf-8",
            )
        records.extend(collected)
        print(f"[{index}/{len(jobs)}] {kind}/{label}: {len(collected)} candidates", flush=True)
        # Rewrite the combined manifest after every complete query. An API or
        # source outage can then resume without losing provenance already read.
        manifest = args.output_dir / "openverse-candidates.jsonl"
        manifest.write_text(
            "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
            encoding="utf-8",
        )
        if index < len(jobs):
            time.sleep(args.request_delay)

    manifest = args.output_dir / "openverse-candidates.jsonl"
    summary = {
        "source": "Openverse API",
        "license_filter": ALLOWED_LICENSES,
        "warning": "Search candidates are not labels; review_status remains pending.",
        "records": len(records),
        "manifest": manifest.as_posix(),
    }
    (args.output_dir / "collection-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
