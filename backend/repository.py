# Queries consumed by backend/api.py; all execution goes through the read-only helpers in db.py.
# Category-level recall candidates are a separate pipeline from the manually reviewed product identifiers exposed here.

"""SQL queries for FixForward's read-only public datasets."""

from .db import fetch_all, fetch_one


# Read a constant to check connectivity without scanning an application table.
def health_check():
    return fetch_one("SELECT 1 AS ok")


# Choose the newest successful import for the ACCC source and retain its limited coverage window.
def recall_metadata():
    return fetch_one(
        """
        SELECT
            ds.retrieval_date,
            ds.version,
            ds.limitations,
            latest.coverage_start,
            latest.coverage_end,
            latest.record_count,
            latest.source_version
        FROM data_sources AS ds
        LEFT JOIN LATERAL (
            SELECT coverage_start, coverage_end, record_count, source_version
            FROM data_import_runs
            WHERE data_source_id = ds.id AND import_status = 'succeeded'
            ORDER BY retrieved_at DESC, id DESC
            LIMIT 1
        ) AS latest ON TRUE
        WHERE ds.name = %s
        LIMIT 1
        """,
        ("ACCC Product Safety Recalls RSS",),
    )


# Publish only manually reviewed product records, aggregating their category links and identifiers.
def reviewed_recall_products():
    return fetch_all(
        """
        SELECT
            rp.id AS product_id,
            r.id AS recall_id,
            r.title,
            r.published_date,
            r.official_url,
            rp.brand,
            rp.product_name,
            COALESCE(
                array_agg(DISTINCT rcl.ui_category_code)
                    FILTER (WHERE rcl.ui_category_code IS NOT NULL),
                ARRAY[]::text[]
            ) AS category_codes,
            COALESCE(
                jsonb_agg(
                    DISTINCT jsonb_build_object(
                        'type', ri.identifier_type,
                        'value', ri.identifier_value,
                        'normalizedValue', ri.normalized_value
                    )
                ) FILTER (WHERE ri.id IS NOT NULL),
                '[]'::jsonb
            ) AS identifiers
        FROM recall_products AS rp
        JOIN recalls AS r ON r.id = rp.recall_id
        LEFT JOIN recall_category_links AS rcl ON rcl.recall_product_id = rp.id
        LEFT JOIN recall_identifiers AS ri ON ri.recall_product_id = rp.id
        WHERE rp.manually_reviewed = TRUE
        GROUP BY rp.id, r.id, r.title, r.published_date, r.official_url,
                 rp.brand, rp.product_name
        ORDER BY r.published_date DESC, rp.id DESC
        """
    )


# Read the provenance register in stable ID order for the adult source information panel.
def sources():
    return fetch_all(
        """
        SELECT name, url, licence, retrieval_date, version, limitations
        FROM data_sources
        ORDER BY id
        """
    )


# Join the published category statistics to stable UI category codes and display order.
def repair_statistics():
    return fetch_all(
        """
        SELECT
            rs.appliance_family,
            rs.appliance_category,
            ac.category_code,
            rs.geography,
            rs.sample_size,
            rs.fixed_count,
            rs.repairable_count,
            rs.end_of_life_count,
            rs.confidence_level,
            rs.limitations
        FROM repair_statistics AS rs
        JOIN appliance_categories AS ac
          ON ac.category_name = rs.appliance_category
        ORDER BY ac.display_order
        """
    )


# Read the recorded category barriers in descending frequency, without inventing missing explanations.
def repair_barriers():
    return fetch_all(
        """
        SELECT appliance_category, barrier, occurrence_count, geography
        FROM repair_barriers
        ORDER BY appliance_category, occurrence_count DESC, barrier
        """
    )


# Read household-electrical location candidates; relevance alone does not establish acceptance or verification.
def relevant_locations():
    return fetch_all(
        """
        SELECT
            id, location_type, name, facility_type, address, suburb, postcode,
            latitude, longitude, phone, website, opening_hours, provider_type,
            verification_status, verification_notes, verification_url,
            last_verified_at, source_notes, source_url, source_retrieved_at
        FROM locations
        WHERE household_electrical_relevant = TRUE
        ORDER BY location_type, suburb NULLS LAST, name
        """
    )

