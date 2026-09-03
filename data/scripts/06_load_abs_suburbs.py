"""
Load Victorian suburb centroids and postcodes from ABS ASGS Edition 3.

Why this replaces the previous source
-------------------------------------
suburb_postcodes was built from a community CSV on GitHub that carries no
licence file at all (the GitHub API reports license: null). Without granted
reuse terms it cannot be defended in an open-data project. The ABS Australian
Statistical Geography Standard is published under CC BY 4.0.

What this produces
------------------
- Suburb name and an approximate centroid from SAL (Suburbs and Localities).
- Postcode by testing which POA (Postal Area) polygon contains that centroid.

Honest limits, recorded with the data
-------------------------------------
- Centroids are area-weighted polygon centres, not addresses. They locate a
  suburb roughly, and must never be presented as an exact position.
- ABS states that Postal Areas are a statistical approximation of postcodes,
  not authoritative Australia Post boundaries.
- A suburb spanning more than one postcode is reduced to the single postcode
  covering its centroid.

Idempotent: replaces the Victorian rows each run.

Run from fix-forward repo root:
    python data/scripts/06_load_abs_suburbs.py
"""

from __future__ import annotations

import csv
import hashlib
import io
import os
import re
import sys
import zipfile
from datetime import date

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
RAW_DIR = os.path.join(SCRIPT_DIR, "..", "raw", "suburbs", "abs")
CLEAN_PATH = os.path.join(SCRIPT_DIR, "..", "clean", "suburb_postcodes.csv")

ABS_BASE = (
    "https://www.abs.gov.au/statistics/standards/"
    "australian-statistical-geography-standard-asgs-edition-3/"
    "jul2021-jun2026/access-and-downloads/digital-boundary-files"
)
SAL_ZIP = "SAL_2021_AUST_GDA2020_SHP.zip"
POA_ZIP = "POA_2021_AUST_GDA2020_SHP.zip"

ABS_SOURCE = {
    "name": "ABS ASGS Edition 3 — Suburbs and Localities (SAL) and Postal Areas (POA) 2021",
    "url": ABS_BASE,
    "licence": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    "version": "ASGS Edition 3 (July 2021 to June 2026); SAL_2021_AUST_GDA2020, POA_2021_AUST_GDA2020",
    "limitations": (
        "Suburb coordinates are area-weighted polygon centroids, not addresses or exact "
        "locations. The ABS states that Postal Areas are an approximation of postcodes built "
        "from Mesh Blocks and are not official Australia Post postcode boundaries. A suburb "
        "that spans several postcodes is recorded with the single postcode containing its "
        "centroid. Boundaries are 2021 vintage and later changes are not reflected."
    ),
}

# Old unlicensed source, removed by this script once its rows are gone.
LEGACY_SOURCE_NAME = "Australian postcodes (schappim community CSV)"

VIC_POSTCODE = re.compile(r"^(3\d{3}|8\d{3})$")
# Generous bounding box for Victoria, used to skip irrelevant POA polygons.
VIC_BBOX = (140.5, -39.4, 150.4, -33.8)  # min_lon, min_lat, max_lon, max_lat


def sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, path: str) -> None:
    import urllib.request

    print(f"  downloading {os.path.basename(path)} ...")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    urllib.request.urlretrieve(url, path)


def read_shapefile(zip_path: str):
    """Yield (record, shape) from the single shapefile inside an ABS zip."""
    import shapefile

    zf = zipfile.ZipFile(zip_path)
    base = next(n for n in zf.namelist() if n.endswith(".shp"))[:-4]
    reader = shapefile.Reader(
        shp=io.BytesIO(zf.read(base + ".shp")),
        dbf=io.BytesIO(zf.read(base + ".dbf")),
        shx=io.BytesIO(zf.read(base + ".shx")),
    )
    fields = [f[0] for f in reader.fields[1:]]
    for shape_record in reader.iterShapeRecords():
        yield dict(zip(fields, shape_record.record)), shape_record.shape


def rings(shape) -> list[list[tuple[float, float]]]:
    """Split a shapefile polygon into its rings (outer rings and holes)."""
    points = shape.points
    starts = list(shape.parts) + [len(points)]
    return [points[starts[i]:starts[i + 1]] for i in range(len(starts) - 1)]


def ring_area_centroid(ring) -> tuple[float, float, float]:
    """Signed area and centroid of one ring via the shoelace formula.

    The sign distinguishes outer rings from holes, so summing across rings
    subtracts holes automatically.
    """
    area2 = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        cross = x0 * y1 - x1 * y0
        area2 += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if area2 == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return 0.0, sum(xs) / len(xs), sum(ys) / len(ys)
    return area2 / 2.0, cx / (3.0 * area2), cy / (3.0 * area2)


def point_in_shape(x: float, y: float, shape_rings) -> bool:
    """Even-odd ray casting across every ring, so holes exclude correctly."""
    inside = False
    for ring in shape_rings:
        for i in range(len(ring) - 1):
            x0, y0 = ring[i]
            x1, y1 = ring[i + 1]
            if (y0 > y) != (y1 > y):
                x_cross = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
                if x_cross > x:
                    inside = not inside
    return inside


def representative_point(shape_rings) -> tuple[float, float]:
    """A point guaranteed to sit inside the polygon.

    The area-weighted centroid falls outside concave suburbs (a C-shaped
    boundary is common along rivers and coastlines). When that happens the
    centroid would be tested against the wrong postal area, so fall back to the
    midpoint of the widest interior span on the centroid's latitude.
    """
    total_area = 0.0
    cx = 0.0
    cy = 0.0
    for ring in shape_rings:
        area, rx, ry = ring_area_centroid(ring)
        total_area += area
        cx += rx * area
        cy += ry * area

    if total_area != 0:
        cx /= total_area
        cy /= total_area
        if point_in_shape(cx, cy, shape_rings):
            return cx, cy
    else:
        pts = [p for ring in shape_rings for p in ring]
        cy = sum(p[1] for p in pts) / len(pts)
        cx = sum(p[0] for p in pts) / len(pts)
        if point_in_shape(cx, cy, shape_rings):
            return cx, cy

    crossings = []
    for ring in shape_rings:
        for i in range(len(ring) - 1):
            x0, y0 = ring[i]
            x1, y1 = ring[i + 1]
            if (y0 > cy) != (y1 > cy):
                crossings.append(x0 + (cy - y0) * (x1 - x0) / (y1 - y0))
    crossings.sort()

    best_width = -1.0
    best_x = cx
    for i in range(0, len(crossings) - 1, 2):
        width = crossings[i + 1] - crossings[i]
        if width > best_width:
            best_width = width
            best_x = (crossings[i] + crossings[i + 1]) / 2.0
    return best_x, cy


def bbox_overlaps(bbox, other) -> bool:
    return not (
        bbox[2] < other[0] or bbox[0] > other[2] or bbox[3] < other[1] or bbox[1] > other[3]
    )


def clean_suburb_name(name: str) -> str:
    """Drop the ABS state qualifier, e.g. 'Hillside (Vic.)' -> 'Hillside'."""
    return re.sub(r"\s*\((?:Vic\.?|Victoria)\)\s*$", "", name).strip()


def main() -> int:
    load_dotenv(os.path.join(REPO_ROOT, ".env"))
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "USER:PASSWORD" in database_url:
        print("ERROR: Set DATABASE_URL in fix-forward/.env")
        return 1

    try:
        import psycopg
    except ImportError:
        print("ERROR: pip install -r requirements-data.txt")
        return 1

    try:
        import shapefile  # noqa: F401
    except ImportError:
        print("ERROR: pyshp is required. pip install -r requirements-data.txt")
        return 1

    sal_path = os.path.join(RAW_DIR, SAL_ZIP)
    poa_path = os.path.join(RAW_DIR, POA_ZIP)
    print("ABS ASGS Edition 3 boundaries (CC BY 4.0)")
    for url_name, path in ((SAL_ZIP, sal_path), (POA_ZIP, poa_path)):
        if not os.path.exists(path):
            download(f"{ABS_BASE}/{url_name}", path)

    sal_checksum = sha256(sal_path)
    poa_checksum = sha256(poa_path)
    print(f"  SAL sha256 {sal_checksum}")
    print(f"  POA sha256 {poa_checksum}")

    # Postal areas that could plausibly contain a Victorian suburb.
    print("Reading Postal Areas ...")
    postal_areas = []
    for record, shape in read_shapefile(poa_path):
        code = (record.get("POA_CODE21") or "").strip()
        if not VIC_POSTCODE.match(code):
            continue
        if not shape.points or not bbox_overlaps(shape.bbox, VIC_BBOX):
            continue
        postal_areas.append((code, shape.bbox, rings(shape)))
    print(f"  Victorian-range postal areas: {len(postal_areas)}")

    print("Reading Suburbs and Localities ...")
    suburbs = []
    no_postcode = []
    for record, shape in read_shapefile(sal_path):
        if (record.get("STE_NAME21") or "") != "Victoria":
            continue
        if not shape.points:
            continue

        shape_rings = rings(shape)
        lon, lat = representative_point(shape_rings)
        name = clean_suburb_name(record.get("SAL_NAME21") or "")
        if not name:
            continue

        postcode = None
        for code, bbox, poa_rings in postal_areas:
            if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
                continue
            if point_in_shape(lon, lat, poa_rings):
                postcode = code
                break

        if postcode is None:
            no_postcode.append(name)
            continue

        suburbs.append(
            {
                "suburb": name,
                "postcode": postcode,
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "state": "VIC",
                "abs_code": (record.get("SAL_CODE21") or "").strip(),
                "centroid_method": "ASGS SAL polygon representative point (approximate)",
            }
        )

    # Collapse rows that differ only by letter case after cleaning the name.
    unique: dict[tuple[str, str], dict] = {}
    for row in suburbs:
        unique.setdefault((row["suburb"].lower(), row["postcode"]), row)
    rows = sorted(unique.values(), key=lambda r: (r["suburb"], r["postcode"]))

    print(f"  Victorian suburbs with a postcode: {len(rows)}")
    print(f"  dropped as duplicates:             {len(suburbs) - len(rows)}")
    print(f"  no containing postal area:         {len(no_postcode)}")

    if not rows:
        print("ERROR: No suburbs resolved. Not replacing existing data.")
        return 1

    os.makedirs(os.path.dirname(CLEAN_PATH), exist_ok=True)
    with open(CLEAN_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "suburb", "postcode", "latitude", "longitude",
                "state", "abs_code", "centroid_method",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"  wrote {CLEAN_PATH}")

    retrieved = date.today().isoformat()
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM suburb_postcodes;")
            before = cur.fetchone()[0]

            cur.execute(
                """
                INSERT INTO data_sources (name, url, licence, retrieval_date, version, limitations)
                VALUES (%(name)s, %(url)s, %(licence)s, %(retrieval_date)s, %(version)s, %(limitations)s)
                ON CONFLICT (name) DO UPDATE SET
                    url = EXCLUDED.url,
                    licence = EXCLUDED.licence,
                    retrieval_date = EXCLUDED.retrieval_date,
                    version = EXCLUDED.version,
                    limitations = EXCLUDED.limitations
                RETURNING id;
                """,
                {**ABS_SOURCE, "retrieval_date": retrieved},
            )
            source_id = cur.fetchone()[0]

            cur.execute("DELETE FROM suburb_postcodes;")
            for row in rows:
                cur.execute(
                    """
                    INSERT INTO suburb_postcodes (
                        suburb, postcode, latitude, longitude, state,
                        data_source_id, abs_code, centroid_method, is_approximate
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE);
                    """,
                    (
                        row["suburb"], row["postcode"], row["latitude"], row["longitude"],
                        row["state"], source_id, row["abs_code"], row["centroid_method"],
                    ),
                )

            cur.execute(
                """
                INSERT INTO data_import_runs (
                    data_source_id, retrieved_at, record_count, source_version,
                    source_file_url, checksum, import_status, limitations
                ) VALUES (%s, %s::timestamptz, %s, %s, %s, %s, 'succeeded', %s)
                ON CONFLICT (data_source_id, retrieved_at) DO UPDATE SET
                    record_count = EXCLUDED.record_count,
                    source_version = EXCLUDED.source_version,
                    source_file_url = EXCLUDED.source_file_url,
                    checksum = EXCLUDED.checksum,
                    limitations = EXCLUDED.limitations;
                """,
                (
                    source_id,
                    retrieved,
                    len(rows),
                    ABS_SOURCE["version"],
                    f"{ABS_BASE}/{SAL_ZIP} ; {ABS_BASE}/{POA_ZIP}",
                    f"sha256({SAL_ZIP})={sal_checksum}; sha256({POA_ZIP})={poa_checksum}",
                    ABS_SOURCE["limitations"],
                ),
            )

            # The unlicensed community dataset no longer backs any row.
            cur.execute(
                """
                DELETE FROM data_sources
                WHERE name = %s
                  AND NOT EXISTS (SELECT 1 FROM suburb_postcodes s WHERE s.data_source_id = data_sources.id)
                  AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.data_source_id = data_sources.id);
                """,
                (LEGACY_SOURCE_NAME,),
            )
            legacy_removed = cur.rowcount

            cur.execute("SELECT COUNT(*) FROM suburb_postcodes;")
            after = cur.fetchone()[0]
        conn.commit()

    print()
    print("SUCCESS: suburb_postcodes rebuilt from ABS boundaries.")
    print(f"  rows before: {before} (unlicensed community CSV)")
    print(f"  rows after:  {after} (ABS ASGS, CC BY 4.0)")
    print(f"  legacy data_sources rows removed: {legacy_removed}")
    print()
    print("  Coordinates are approximate suburb centroids, never exact locations.")
    if no_postcode:
        print(f"  {len(no_postcode)} localities had no containing postal area, for example:")
        for name in sorted(no_postcode)[:5]:
            print(f"    - {name}")
    print()
    print("  next: python data/scripts/05_enrich_locations.py (refresh location postcodes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
