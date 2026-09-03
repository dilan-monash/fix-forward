"""Read-only JSON endpoints consumed by the browser application."""

from flask import Blueprint, current_app, jsonify

from .db import DatabaseUnavailable
from . import repository
from .transform import (
    build_location,
    build_recall_record,
    group_repair_evidence,
    iso_value,
    safe_http_url,
)


api = Blueprint("api", __name__, url_prefix="/api")


def release_meta(extra=None):
    meta = {"releaseVersion": current_app.config["RELEASE_VERSION"]}
    if extra:
        meta.update(extra)
    return meta


@api.after_request
def public_api_headers(response):
    # Public data can change between releases, so do not let browsers reuse a
    # stale response during mentor testing.
    response.headers["Cache-Control"] = "no-store"
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    return response


@api.errorhandler(DatabaseUnavailable)
def database_unavailable(_error):
    return jsonify(
        error={
            "code": "data_unavailable",
            "message": "FixForward public data is temporarily unavailable.",
        }
    ), 503


@api.errorhandler(Exception)
def unexpected_api_error(error):
    # Log only the exception class; database messages can contain infrastructure
    # details that should not be returned to users or routine application logs.
    current_app.logger.error("API failure type=%s", type(error).__name__)
    return jsonify(
        error={
            "code": "internal_error",
            "message": "The public-data service could not complete the request.",
        }
    ), 500


@api.get("/health")
def health():
    repository.health_check()
    return jsonify(status="ok", database="available", **release_meta())


@api.get("/recalls")
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
def repair_evidence():
    evidence = group_repair_evidence(
        repository.repair_statistics(), repository.repair_barriers()
    )
    return jsonify(meta=release_meta(), evidence=evidence)


@api.get("/locations")
def locations():
    # User suburb/postcode filtering happens in browser memory. This endpoint
    # therefore never receives or logs the user's area selection.
    rows = repository.relevant_locations()
    return jsonify(
        meta=release_meta(), locations=[build_location(row) for row in rows]
    )

