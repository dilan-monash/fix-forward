# Public-data JSON contract consumed by the adult browser through src/data-service.js.
# Neon-backed routes use repository.py and pure row transforms; replacement prices use the separate reviewed SQLite snapshot.
# Quest fiction does not fetch these datasets. The shared gate runs before protected API requests.
# Each worker briefly reuses successful reads so request volume cannot multiply connections to the shared database.

"""Read-only JSON endpoints consumed by the browser application."""

import threading
import time

from flask import Blueprint, current_app, jsonify, request
from .db import DatabaseUnavailable
from . import repository
from .price_catalogue import (
    DEFAULT_DATABASE_PATH,
    PriceCatalogueUnavailable,
    read_catalogue,
    read_postgres_catalogue,
)
from .transform import (
    build_location,
    build_recall_record,
    group_repair_evidence,
    iso_value,
    safe_http_url,
)


api = Blueprint("api", __name__, url_prefix="/api")

# Neon is shared by every FixForward website, and Main serves these routes
# without a password. Reference data changes only through governed imports, so
# a worker reuses a successful read for a short interval instead of opening a
# database connection for every request. Readiness is reused only briefly so it
# still reflects a recent query.
DATASET_REUSE_SECONDS = 120
READY_REUSE_SECONDS = 10


class RecentReads:
    """Per-worker memory of recent successful reads; failures are never kept."""

    def __init__(self):
        self._lock = threading.Lock()
        self._values = {}

    # Return a saved value younger than ``seconds`` or call ``load`` and save its result.
    # An exception from ``load`` propagates before anything is saved, so an
    # outage keeps returning 503 and the next request tries the database again.
    def get(self, key, seconds, load):
        with self._lock:
            saved = self._values.get(key)
        if saved is not None and time.monotonic() - saved[0] < seconds:
            return saved[1]
        value = load()
        with self._lock:
            self._values[key] = (time.monotonic(), value)
        return value


@api.record_once
# Give each application its own memory, so separate apps and tests never share data.
def attach_recent_reads(state):
    state.app.extensions["public_data_reads"] = RecentReads()


# Reuse a recent successful read when the application enables reuse; tests that
# swap repository results between requests leave it disabled unless they opt in.
def reuse(key, load, seconds=DATASET_REUSE_SECONDS):
    if not current_app.config.get("PUBLIC_DATA_REUSE", True):
        return load()
    return current_app.extensions["public_data_reads"].get(key, seconds, load)


# Attach the configured release label and optional dataset-specific provenance to a response.
def release_meta(extra=None):
    meta = {"releaseVersion": current_app.config["RELEASE_VERSION"]}
    if extra:
        meta.update(extra)
    return meta


@api.after_request
# Set JSON type and default dataset caching; the access gate later overrides caching when enabled.
def public_api_headers(response):
    # Public datasets change only when the governed import pipeline changes.
    # Short caching reduces repeated Neon reads without hiding release updates.
    if response.status_code >= 400 or request.path in {"/api/health", "/api/ready"}:
        response.headers["Cache-Control"] = "no-store"
    else:
        response.headers["Cache-Control"] = "public, max-age=120, stale-if-error=600"
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    return response


@api.errorhandler(DatabaseUnavailable)
# Translate an unavailable PostgreSQL read into a generic recoverable 503 response.
def database_unavailable(_error):
    return jsonify(
        error={
            "code": "data_unavailable",
            "message": "FixForward public data is temporarily unavailable.",
        }
    ), 503


@api.errorhandler(PriceCatalogueUnavailable)
# Report a missing or untrusted price snapshot while preserving the manual-price option.
def price_catalogue_unavailable(_error):
    return jsonify(
        error={
            "code": "price_catalogue_unavailable",
            "message": "The reviewed replacement-price examples are temporarily unavailable. You can still enter a price yourself.",
        }
    ), 503


@api.errorhandler(Exception)
# Log only the route and exception type, then return a generic API failure.
def unexpected_api_error(error):
    # Log only the exception class; database messages can contain infrastructure
    # details that should not be returned to users or routine application logs.
    # Do not attach the traceback here: unexpected exception messages can
    # contain database hostnames, SQL fragments or other infrastructure detail.
    current_app.logger.error(
        "API failure path=%s type=%s", request.path, type(error).__name__
    )
    return jsonify(
        error={
            "code": "internal_error",
            "message": "The public-data service could not complete the request.",
        }
    ), 500


@api.get("/health")
# Answer liveness without a database read; this route alone does not prove data readiness.
def health():
    """Liveness check: prove the Flask process can answer without depending on Neon."""
    return jsonify(status="ok", service="available", **release_meta())


@api.get("/ready")
# Require a successful SELECT 1 result before reporting the PostgreSQL connection ready.
def ready():
    """Readiness check: prove the public database was queried in the last few seconds."""
    # Validate inside the reused function: an empty result raises and is never kept.
    def confirmed_query():
        result = repository.health_check()
        if not result or result.get("ok") != 1:
            raise DatabaseUnavailable("Database readiness query did not succeed")
        return result

    reuse("ready", confirmed_query, READY_REUSE_SECONDS)
    return jsonify(status="ok", database="available", **release_meta())


@api.get("/recalls")
# Combine the latest recorded recall-source coverage with manually reviewed structured products.
def recalls():
    metadata, rows = reuse("recalls", lambda: (
        repository.recall_metadata() or {}, repository.reviewed_recall_products()
    ))
    meta = release_meta(
        {
            "dataVersion": metadata.get("source_version") or metadata.get("version"),
            "retrievalDate": iso_value(metadata.get("retrieval_date")),
            "coverageStart": iso_value(metadata.get("coverage_start")),
            "coverageEnd": iso_value(metadata.get("coverage_end")),
            "recordCount": metadata.get("record_count"),
            "limitation": metadata.get("limitations"),
        }
    )
    return jsonify(meta=meta, recalls=[build_recall_record(row) for row in rows])


@api.get("/sources")
# Expose dataset provenance with validated links and consistent date formatting.
def sources():
    rows = reuse("sources", repository.sources)
    public_sources = [
        {
            "name": row["name"],
            "url": safe_http_url(row["url"]),
            "licence": row["licence"],
            "retrievalDate": iso_value(row["retrieval_date"]),
            "version": row["version"],
            "limitations": row["limitations"],
        }
        for row in rows
    ]
    return jsonify(meta=release_meta(), sources=public_sources)


@api.get("/repair-evidence")
# Join category statistics to their barriers and preserve geography and sample limitations.
def repair_evidence():
    statistics, barriers = reuse("repair-evidence", lambda: (
        repository.repair_statistics(), repository.repair_barriers()
    ))
    evidence = group_repair_evidence(statistics, barriers)
    return jsonify(meta=release_meta(), evidence=evidence)


@api.get("/replacement-prices")
# Read reviewed price observations from the explicitly configured storage target.
def replacement_prices():
    # This is an explicit, independent public price snapshot. It never replaces
    # Neon recalls, repair evidence or locations, and does not prove Neon health.
    # Filtering by the user's brand/model happens locally in their browser.
    storage = current_app.config.get("PRICE_CATALOGUE_STORAGE")
    path = current_app.config.get("PRICE_CATALOGUE_PATH", DEFAULT_DATABASE_PATH)
    # The key names the storage target so a reused payload always matches the configured source.
    payload = reuse(("replacement-prices", storage, str(path)), lambda: (
        read_postgres_catalogue() if storage == "postgres" else read_catalogue(path)
    ))
    return jsonify(
        meta=release_meta(payload["meta"]),
        prices=payload["prices"],
        repairFees=payload["repairFees"],
    )


@api.get("/locations")
# Return eligible location candidates for browser-side filtering; the visitor area is not sent here.
def locations():
    # User suburb/postcode filtering happens in browser memory. This endpoint
    # therefore never receives or logs the user's area selection.
    rows = reuse("locations", repository.relevant_locations)
    return jsonify(
        meta=release_meta(), locations=[build_location(row) for row in rows]
    )
