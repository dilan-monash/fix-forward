# Reviewed-price support shared by the build script, replacement-prices API and isolated tests.
# Build functions write a local SQLite snapshot; read_catalogue opens that exact file read-only. Neither path contacts Neon.
# Keep observation validation and snapshot identity together so the API and generated static preview agree.

"""Reviewed public price snapshots, kept separate from the Neon public datasets.

The build command writes SQLite; web requests only open it with mode=ro. No
connection string, user answer or location is read or stored in this catalogue.
This module uses only the Python standard library so the data can be validated
and built before Flask or PostgreSQL dependencies are installed.
"""

from datetime import date
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import tempfile
from urllib.parse import urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = PROJECT_ROOT / "data" / "catalogue"
DEFAULT_DATABASE_PATH = DEFAULT_SOURCE_DIR / "replacement-prices.sqlite"
SCHEMA_VERSION = 1
CATEGORY_CODES = frozenset({
    "kettle", "toaster", "sandwich-press", "rice-cooker", "blender", "mixer",
    "food-processor", "coffee-machine", "air-fryer", "microwave",
    "vacuum-cleaner", "steam-cleaner", "hair-dryer", "straightener", "shaver",
    "fan", "portable-heater", "dehumidifier", "portable-air-conditioner",
})
RETAILER_HOSTS = {
    "JB Hi-Fi": "jbhifi.com.au",
    "Harvey Norman": "harveynorman.com.au",
    "The Good Guys": "thegoodguys.com.au",
    "Kmart": "kmart.com.au",
    "BIG W": "bigw.com.au",
    "Officeworks": "officeworks.com.au",
    "Bing Lee": "binglee.com.au",
    "Myer": "myer.com.au",
    "Amazon AU": "amazon.com.au",
}
FIELDS = (
    "id", "categoryCode", "brand", "model", "productName", "retailer",
    "priceAud", "currency", "sourceUrl", "observedAt", "priceKind",
    "availability", "notes",
)
LIMITATION = (
    "Small reviewed sample of advertised Australian retailer prices, not a live "
    "price feed or a complete market survey. Prices and stock may change. "
    "Check the retailer for today's total including delivery. These examples "
    "do not diagnose a fault, confirm repairability or recommend a replacement."
)


# Report rejected authored price metadata or an invalid snapshot before it can be presented as reviewed.
class CatalogueValidationError(ValueError):
    """The reviewed input is incomplete or fails the source/data rules."""


# Hide storage details behind the API-safe missing or untrusted snapshot condition.
class PriceCatalogueUnavailable(RuntimeError):
    """The explicit local public snapshot cannot be read or trusted."""


# Validate one dated AUD offer, including exact cents, supported category and named-retailer product URL.
def validate_observation(record, today=None):
    """Return a clean record, rejecting uncertain numeric or source metadata."""
    if not isinstance(record, dict):
        raise CatalogueValidationError("Each observation must be an object")
    missing = set(FIELDS) - set(record)
    if missing:
        raise CatalogueValidationError("Missing fields: " + ", ".join(sorted(missing)))
    result = {}
    for key in FIELDS:
        if key == "priceAud":
            continue
        value = record[key]
        if not isinstance(value, str) or (not value.strip() and key != "notes"):
            raise CatalogueValidationError(f"{key} must be text and cannot be empty")
        if len(value) > (3000 if key in {"notes", "sourceUrl"} else 300):
            raise CatalogueValidationError(f"{key} exceeds the supported length")
        result[key] = value.strip()
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]*", result["id"]):
        raise CatalogueValidationError("id must be a stable letters/numbers/hyphens identifier")
    if result["categoryCode"] not in CATEGORY_CODES:
        raise CatalogueValidationError("Unknown appliance categoryCode")
    if result["retailer"] not in RETAILER_HOSTS:
        raise CatalogueValidationError("Retailer is not in the reviewed direct-retailer list")
    if result["currency"] != "AUD" or result["priceKind"] != "advertised":
        raise CatalogueValidationError("Only advertised AUD observations are supported")
    if result["availability"] not in {"not-verified", "in-stock", "out-of-stock"}:
        raise CatalogueValidationError("Unknown availability value")
    # Boolean is a Python number subtype, so reject it before accepting a currency amount.
    value = record["priceAud"]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CatalogueValidationError("priceAud must be a number")
    try:
        amount = Decimal(str(value))
        if (not amount.is_finite() or amount <= 0 or amount > Decimal("100000")
                or amount != amount.quantize(Decimal("0.01"))):
            raise CatalogueValidationError("priceAud must be positive AUD, at most 100000, with at most two decimals")
    except InvalidOperation as error:
        raise CatalogueValidationError("priceAud is not valid AUD") from error
    result["priceAud"] = float(amount)
    try:
        observed = date.fromisoformat(result["observedAt"])
    except ValueError as error:
        raise CatalogueValidationError("observedAt must be an ISO calendar date") from error
    if observed.isoformat() != result["observedAt"] or observed > (today or date.today()):
        raise CatalogueValidationError("observedAt must be YYYY-MM-DD and cannot be in the future")
    try:
        url = urlsplit(result["sourceUrl"])
        host = RETAILER_HOSTS[result["retailer"]]
        if (url.scheme != "https" or url.hostname not in {host, "www." + host}
                or url.username or url.password or url.port not in {None, 443}
                or not url.path.strip("/")):
            raise CatalogueValidationError("sourceUrl must be a product page on the named retailer's HTTPS domain")
    except ValueError as error:
        raise CatalogueValidationError("sourceUrl is invalid") from error
    if result["retailer"] == "Amazon AU" and "sold by amazon au" not in result["notes"].lower():
        raise CatalogueValidationError("Amazon observations need reviewed 'Sold by Amazon AU' evidence in notes")
    return {key: result[key] for key in FIELDS}


# Validate the whole nonempty input, reject duplicate offers and return a stable ID ordering.
def validate_observations(records, today=None):
    if not isinstance(records, list) or not records:
        raise CatalogueValidationError("At least one reviewed observation is required")
    clean = []
    seen_ids = set()
    seen_observations = set()
    for index, record in enumerate(records):
        try:
            item = validate_observation(record, today=today)
        except CatalogueValidationError as error:
            raise CatalogueValidationError(f"Observation {index + 1}: {error}") from error
        if item["id"] in seen_ids:
            raise CatalogueValidationError(f"Duplicate observation id: {item['id']}")
        # The same offer on the same day is one observation, even if its ID changes.
        key = (item["sourceUrl"], item["observedAt"], item["model"].casefold())
        if key in seen_observations:
            raise CatalogueValidationError("Duplicate product-page/date/model observation")
        seen_ids.add(item["id"])
        seen_observations.add(key)
        clean.append(item)
    return sorted(clean, key=lambda row: row["id"])


# Read only observation-array JSON files from the explicit source directory and validate their combined content.
def load_reviewed_observations(source_dir=DEFAULT_SOURCE_DIR):
    files = sorted(Path(source_dir).glob("*-observations.json"))
    if not files:
        raise CatalogueValidationError("No reviewed *-observations.json input files found")
    records = []
    for path in files:
        try:
            values = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise CatalogueValidationError(f"Cannot read reviewed observations file: {path.name}") from error
        if not isinstance(values, list):
            raise CatalogueValidationError(f"{path.name} must contain an array of observations")
        records.extend(values)
    return validate_observations(records)


# Create the shared response payload and deterministic content hash from validated observations.
def snapshot_payload(records):
    """Shared contract for the SQLite API and explicit static-preview bundle."""
    clean = validate_observations(records)
    # Stable keys and row ordering make the content hash repeatable across the SQLite and browser exports.
    canonical = json.dumps(clean, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    observed_dates = [row["observedAt"] for row in clean]
    meta = {
        "source": "reviewed-price-snapshot",
        "storage": "local-public-snapshot",
        "currency": "AUD",
        "schemaVersion": SCHEMA_VERSION,
        "snapshotVersion": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "recordCount": len(clean),
        "firstObservedAt": min(observed_dates),
        "lastObservedAt": max(observed_dates),
        "livePrices": False,
        "limitation": LIMITATION,
    }
    return {"meta": meta, "prices": clean}


SQLITE_SCHEMA = """
CREATE TABLE replacement_price_observations (
    id TEXT PRIMARY KEY,
    category_code TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    product_name TEXT NOT NULL,
    retailer TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0 AND price_cents <= 10000000),
    currency TEXT NOT NULL CHECK (currency = 'AUD'),
    source_url TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    price_kind TEXT NOT NULL CHECK (price_kind = 'advertised'),
    availability TEXT NOT NULL CHECK (availability IN ('not-verified', 'in-stock', 'out-of-stock')),
    notes TEXT NOT NULL,
    UNIQUE (source_url, observed_at, model)
);
CREATE INDEX replacement_prices_category_brand_model
    ON replacement_price_observations (category_code, brand, model);
CREATE INDEX replacement_prices_observed_at
    ON replacement_price_observations (observed_at);
CREATE TABLE replacement_price_catalogue_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


# Build and check a temporary SQLite file before atomically replacing the previous public snapshot.
def build_database(records, destination=DEFAULT_DATABASE_PATH):
    """Validate everything before atomically replacing a public snapshot file."""
    payload = snapshot_payload(records)
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=".replacement-prices-", suffix=".tmp", dir=destination.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        connection = sqlite3.connect(temporary_path)
        try:
            connection.executescript(SQLITE_SCHEMA)
            connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
            connection.executemany(
                "INSERT INTO replacement_price_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [(
                    row["id"], row["categoryCode"], row["brand"], row["model"],
                    row["productName"], row["retailer"],
                    int(Decimal(str(row["priceAud"])) * 100), row["currency"],
                    row["sourceUrl"], row["observedAt"], row["priceKind"],
                    row["availability"], row["notes"],
                ) for row in payload["prices"]],
            )
            connection.executemany(
                "INSERT INTO replacement_price_catalogue_meta (key, value) VALUES (?, ?)",
                [(key, json.dumps(value, ensure_ascii=False)) for key, value in payload["meta"].items()],
            )
            connection.commit()
            if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise CatalogueValidationError("Built snapshot failed SQLite integrity check")
        finally:
            connection.close()
        # Readers keep the previous complete snapshot until the new file has passed validation and integrity checks.
        temporary_path.replace(destination)
    finally:
        temporary_path.unlink(missing_ok=True)
    return payload


# Open the existing SQLite file read-only and revalidate content against its stored snapshot metadata.
def read_catalogue(database_path=DEFAULT_DATABASE_PATH):
    """Read only this explicit database; a missing file never creates a new one."""
    try:
        path = Path(database_path).resolve()
        connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=2)
        try:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA query_only = ON")
            if connection.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
                raise CatalogueValidationError("Unsupported price catalogue schema")
            rows = connection.execute("""
                SELECT id, category_code AS categoryCode, brand, model,
                    product_name AS productName, retailer, price_cents,
                    currency, source_url AS sourceUrl, observed_at AS observedAt,
                    price_kind AS priceKind, availability, notes
                FROM replacement_price_observations ORDER BY id
            """).fetchall()
            stored_meta = {
                row["key"]: json.loads(row["value"])
                for row in connection.execute("SELECT key, value FROM replacement_price_catalogue_meta")
            }
        finally:
            connection.close()
        records = []
        for row in rows:
            item = dict(row)
            cents = item.pop("price_cents")
            if isinstance(cents, bool) or not isinstance(cents, int):
                raise CatalogueValidationError("Invalid stored currency amount")
            item["priceAud"] = cents / 100
            records.append(item)
        payload = snapshot_payload(records)
        # Recompute rather than trust stored labels: edited rows must not retain an older reviewed snapshot identity.
        if stored_meta != payload["meta"]:
            raise CatalogueValidationError("Price catalogue content does not match its reviewed snapshot metadata")
        return payload
    except (OSError, sqlite3.Error, ValueError, TypeError, KeyError) as error:
        raise PriceCatalogueUnavailable("The reviewed replacement-price snapshot is unavailable") from error
