# Public-data JSON contract consumed by the adult browser through src/data-service.js.
# Neon-backed routes use repository.py and pure row transforms; replacement prices use the separate reviewed SQLite snapshot.
# Quest fiction does not fetch these datasets. The shared gate runs before protected API requests.

"""Read-only JSON endpoints consumed by the browser application."""

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
    """Readiness check: prove the public database can be queried."""
    result = repository.health_check()
    if not result or result.get("ok") != 1:
        raise DatabaseUnavailable("Database readiness query did not succeed")
    return jsonify(status="ok", database="available", **release_meta())


@api.get("/recalls")
# Combine the latest recorded recall-source coverage with manually reviewed structured products.
def recalls():
    metadata = repository.recall_metadata() or {}
    rows = repository.reviewed_recall_products()
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
    rows = repository.sources()
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
    evidence = group_repair_evidence(
        repository.repair_statistics(), repository.repair_barriers()
    )
    return jsonify(meta=release_meta(), evidence=evidence)


@api.get("/replacement-prices")
# Read reviewed price observations from the explicitly configured storage target.
def replacement_prices():
    # This is an explicit, independent public price snapshot. It never replaces
    # Neon recalls, repair evidence or locations, and does not prove Neon health.
    # Filtering by the user's brand/model happens locally in their browser.
    payload = (
        read_postgres_catalogue()
        if current_app.config.get("PRICE_CATALOGUE_STORAGE") == "postgres"
        else read_catalogue(current_app.config.get("PRICE_CATALOGUE_PATH", DEFAULT_DATABASE_PATH))
    )
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
    rows = repository.relevant_locations()
    return jsonify(
        meta=release_meta(), locations=[build_location(row) for row in rows]
    )
