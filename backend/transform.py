"""Pure transformations from database rows to the public API contract."""

from datetime import date, datetime
from urllib.parse import urlparse


PRODUCT_SAFETY_HOSTS = {"productsafety.gov.au", "www.productsafety.gov.au"}


def iso_value(value):
    """Return stable ISO dates so the frontend does not depend on server locale."""

    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value) if value is not None else None


def safe_http_url(value, allowed_hosts=None):
    """Accept only absolute HTTP(S) URLs and optionally restrict their host."""

    if not value:
        return None
    try:
        parsed = urlparse(str(value).strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    hostname = parsed.hostname.lower()
    if allowed_hosts and hostname not in allowed_hosts:
        return None
    return str(value).strip()


def build_recall_record(row):
    """Shape one manually reviewed recall product for browser-side matching."""

    identifiers = []
    for item in row.get("identifiers") or []:
        if not isinstance(item, dict):
            continue
        if not item.get("value") or not item.get("normalizedValue"):
            continue
        identifiers.append(
            {
                "type": str(item.get("type", "other")),
                "value": str(item["value"]),
                "normalizedValue": str(item["normalizedValue"]),
            }
        )
    return {
        "id": str(row["product_id"]),
        "recallId": str(row["recall_id"]),
        "categoryCodes": sorted(row.get("category_codes") or []),
        "brand": row.get("brand") or "",
        "productName": row.get("product_name") or "",
        "title": row.get("title") or "",
        "published": iso_value(row.get("published_date")),
        "noticeUrl": safe_http_url(
            row.get("official_url"), allowed_hosts=PRODUCT_SAFETY_HOSTS
        ),
        "identifiers": identifiers,
        "source": "ACCC Product Safety",
    }


def group_repair_evidence(statistic_rows, barrier_rows):
    """Attach zero or more repair barriers to each category benchmark."""

    barriers_by_category = {}
    for row in barrier_rows:
        barriers_by_category.setdefault(row["appliance_category"], []).append(
            {
                "name": row["barrier"],
                "occurrenceCount": int(row["occurrence_count"]),
                "geography": row["geography"],
            }
        )

    evidence = []
    for row in statistic_rows:
        category = row["appliance_category"]
        sample_size = int(row["sample_size"])
        classified = (
            int(row["fixed_count"])
            + int(row["repairable_count"])
            + int(row["end_of_life_count"])
        )
        evidence.append(
            {
                "family": row["appliance_family"],
                "category": category,
                "categoryCode": row["category_code"],
                "geography": row["geography"],
                "sampleSize": sample_size,
                "fixedCount": int(row["fixed_count"]),
                "repairableCount": int(row["repairable_count"]),
                "endOfLifeCount": int(row["end_of_life_count"]),
                "unclassifiedCount": max(0, sample_size - classified),
                "confidenceLevel": row["confidence_level"],
                "limitation": row["limitations"],
                "barriers": barriers_by_category.get(category, []),
            }
        )
    return evidence


def build_location(row):
    """Expose useful service details while keeping provenance available on demand.

    Latitude/longitude allow the browser to calculate nearby results without
    sending a user's device location to FixForward. Qualification, opening and
    appliance-acceptance claims remain conservative unless the source proves them.
    """

    latitude = row.get("latitude")
    longitude = row.get("longitude")
    return {
        "id": str(row["id"]),
        "pathway": "repair" if row["location_type"] == "repair" else "dispose",
        "name": row["name"],
        "type": row.get("facility_type") or "Service",
        "providerType": row.get("provider_type") or "",
        "address": row.get("address") or "Address not provided",
        "suburb": row.get("suburb") or "",
        "postcode": row.get("postcode") or "",
        "latitude": float(latitude) if latitude is not None else None,
        "longitude": float(longitude) if longitude is not None else None,
        "phone": row.get("phone") or "",
        "openingHours": row.get("opening_hours") or "",
        "url": safe_http_url(row.get("website")),
        "verificationStatus": row.get("verification_status") or "unverified",
        "verificationNote": row.get("verification_notes") or row.get("source_notes") or "",
        "verificationUrl": safe_http_url(row.get("verification_url")),
        "lastVerifiedAt": iso_value(row.get("last_verified_at")),
        "sourceUrl": safe_http_url(row.get("source_url")),
        "sourceRetrievedAt": iso_value(row.get("source_retrieved_at")),
    }

