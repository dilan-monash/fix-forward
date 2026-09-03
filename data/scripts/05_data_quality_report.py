"""
Data-quality report for the FixForward Neon database.

This report deliberately separates measures that were previously reported as
one number. In particular, source provenance and facility verification are
counted apart: knowing which dataset a row came from is not the same as having
checked anything about that facility, and reporting the two together produced a
false "100% verified" reading.

Writes data/docs/DATA_QUALITY_REPORT.json and exits non-zero when a hard
invariant is broken, so the report can fail a build rather than just describe a
problem.

Run from fix-forward repo root:
    python data/scripts/05_data_quality_report.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "docs", "DATA_QUALITY_REPORT.json")

OFFICIAL_RECALL_SEARCH = "https://www.productsafety.gov.au/recalls"


def pct(part: int, whole: int) -> float:
    return 0.0 if whole == 0 else round(100.0 * part / whole, 1)


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

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "checks": {},
        "failures": [],
        "remaining_unknowns": [],
    }
    failures: list[str] = []

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM locations;")
            total = cur.fetchone()[0]

            # 1. Source provenance: which dataset the row came from.
            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE source_url IS NOT NULL),
                  COUNT(*) FILTER (WHERE source_retrieved_at IS NOT NULL),
                  COUNT(*) FILTER (WHERE data_source_id IS NOT NULL)
                FROM locations;
                """
            )
            src_url, src_date, src_id = cur.fetchone()
            report["checks"]["source_provenance"] = {
                "locations_total": total,
                "with_source_url": src_url,
                "with_source_url_pct": pct(src_url, total),
                "with_source_retrieved_at": src_date,
                "with_data_source_id": src_id,
                "meaning": "The dataset this row was imported from. Says nothing about the facility itself.",
            }
            if src_id < total:
                failures.append(f"{total - src_id} locations have no data_source_id")

            # 2. Facility-level verification: evidence about this specific place.
            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE verification_url IS NOT NULL AND last_verified_at IS NOT NULL),
                  COUNT(*) FILTER (WHERE verification_status = 'verified'),
                  COUNT(*) FILTER (WHERE verification_status = 'partially_verified'),
                  COUNT(*) FILTER (WHERE verification_status = 'unverified'),
                  COUNT(*) FILTER (WHERE verification_notes IS NOT NULL)
                FROM locations;
                """
            )
            fac_evidence, verified, partial, unverified, noted = cur.fetchone()
            report["checks"]["facility_verification"] = {
                "with_facility_evidence": fac_evidence,
                "with_facility_evidence_pct": pct(fac_evidence, total),
                "status_verified": verified,
                "status_partially_verified": partial,
                "status_unverified": unverified,
                "with_verification_notes": noted,
                "meaning": "A facility-specific page that was actually checked, plus the date it was checked.",
                "warning": "Dataset URLs are counted under source_provenance and are NEVER counted here.",
            }

            # A claimed verification with no evidence behind it.
            cur.execute(
                """
                SELECT COUNT(*) FROM locations
                WHERE verification_status <> 'unverified'
                  AND (verification_url IS NULL OR last_verified_at IS NULL);
                """
            )
            bogus = cur.fetchone()[0]
            if bogus:
                failures.append(f"{bogus} locations claim verification without evidence")

            # 3. Appliance-specific acceptance.
            cur.execute(
                """
                SELECT
                  COUNT(*),
                  COUNT(*) FILTER (WHERE acceptance_status = 'confirmed'),
                  COUNT(*) FILTER (WHERE acceptance_status = 'not_accepted'),
                  COUNT(*) FILTER (WHERE acceptance_status = 'unknown'),
                  COUNT(DISTINCT location_id)
                FROM location_appliance_acceptance;
                """
            )
            acc_total, acc_conf, acc_no, acc_unknown, acc_locs = cur.fetchone()
            cur.execute("SELECT COUNT(*) FROM appliance_categories WHERE active;")
            categories = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM locations WHERE household_electrical_relevant IS TRUE;"
            )
            relevant = cur.fetchone()[0]

            report["checks"]["appliance_acceptance"] = {
                "rows_recorded": acc_total,
                "confirmed": acc_conf,
                "not_accepted": acc_no,
                "explicit_unknown": acc_unknown,
                "locations_with_any_record": acc_locs,
                "household_electrical_relevant_locations": relevant,
                "active_categories": categories,
                "possible_location_category_pairs": relevant * categories,
                "coverage_pct": pct(acc_total, relevant * categories),
                "meaning": "Whether a specific location accepts a specific appliance category.",
                "note": "A missing row means unknown. It never means the item is refused.",
            }

            # 4. Public access lives only on location_appliance_acceptance.
            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE public_access IS TRUE),
                  COUNT(*) FILTER (WHERE public_access IS FALSE),
                  COUNT(*) FILTER (WHERE public_access IS NOT NULL)
                FROM location_appliance_acceptance;
                """
            )
            pub_yes, pub_no, pub_known = cur.fetchone()
            report["checks"]["public_access"] = {
                "acceptance_rows_confirmed_public": pub_yes,
                "acceptance_rows_confirmed_not_public": pub_no,
                "acceptance_rows_with_public_access": pub_known,
                "location_level_column": "dropped",
                "note": (
                    "locations.public_access was removed. Public access is per "
                    "location and per appliance category. Not inferred from "
                    "facility type, provider type or coordinates."
                ),
            }

            # 5-7. Recall candidates, confirmations and false positives.
            cur.execute("SELECT COUNT(*) FROM recalls;")
            recalls_n = cur.fetchone()[0]
            cur.execute(
                """
                SELECT
                  COUNT(*),
                  COUNT(*) FILTER (WHERE review_status = 'confirmed'),
                  COUNT(*) FILTER (WHERE review_status = 'false_positive'),
                  COUNT(*) FILTER (WHERE review_status = 'unreviewed'),
                  COUNT(*) FILTER (WHERE matched_pattern IS NULL OR matched_pattern = ''),
                  COUNT(*) FILTER (WHERE matched_field IS NULL OR matched_field NOT IN ('title', 'summary'))
                FROM recall_category_matches;
                """
            )
            cand, confirmed_m, false_pos, unreviewed_m, unexplained, missing_field = cur.fetchone()
            cur.execute("SELECT COUNT(*) FROM appliance_recall_patterns WHERE active;")
            patterns_n = cur.fetchone()[0]
            cur.execute(
                """
                SELECT r.coverage_start, r.coverage_end, r.retrieved_at::date
                FROM data_import_runs r
                JOIN data_sources ds ON ds.id = r.data_source_id
                WHERE ds.name ILIKE '%ACCC%'
                ORDER BY r.retrieved_at DESC LIMIT 1;
                """
            )
            snapshot = cur.fetchone()
            report["checks"]["recall_matching"] = {
                "recalls_in_snapshot": recalls_n,
                "active_patterns": patterns_n,
                "candidates": cand,
                "confirmed": confirmed_m,
                "false_positives": false_pos,
                "unreviewed": unreviewed_m,
                "candidates_without_a_pattern": unexplained,
                "candidates_without_matched_field": missing_field,
                "snapshot_coverage_start": str(snapshot[0]) if snapshot else None,
                "snapshot_coverage_end": str(snapshot[1]) if snapshot else None,
                "snapshot_retrieved": str(snapshot[2]) if snapshot else None,
                "official_search": OFFICIAL_RECALL_SEARCH,
                "warning": "No match does NOT prove a product is recall-free. This is a limited snapshot.",
            }
            if unexplained:
                failures.append(f"{unexplained} recall candidates do not record the pattern that matched")
            if missing_field:
                failures.append(f"{missing_field} recall candidates do not record whether title or summary matched")

            # 8. Safety rules with real, specific sources.
            cur.execute("SELECT COUNT(*) FROM safety_rules WHERE active;")
            rules_n = cur.fetchone()[0]
            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE has_primary),
                  COUNT(*) FILTER (WHERE NOT has_primary)
                FROM (
                    SELECT r.id, EXISTS (
                        SELECT 1 FROM safety_rule_sources s
                        WHERE s.safety_rule_id = r.id AND s.is_primary
                    ) AS has_primary
                    FROM safety_rules r WHERE r.active
                ) t;
                """
            )
            with_primary, without_primary = cur.fetchone()
            cur.execute("SELECT COUNT(*) FROM safety_rule_sources;")
            citations = cur.fetchone()[0]
            # A bare domain is not evidence for a specific claim.
            cur.execute(
                r"""
                SELECT COUNT(*) FROM safety_rule_sources
                WHERE source_url !~ '^https://[^/]+/.+';
                """
            )
            homepage_only = cur.fetchone()[0]
            report["checks"]["safety_rules"] = {
                "active_rules": rules_n,
                "with_primary_source": with_primary,
                "without_primary_source": without_primary,
                "total_citations": citations,
                "homepage_only_urls": homepage_only,
                "note": "Screening is never a diagnosis and never certifies that an appliance is safe.",
            }
            if without_primary:
                failures.append(f"{without_primary} active safety rules have no primary source")
            if homepage_only:
                failures.append(f"{homepage_only} safety citations point at a bare homepage")

            # 9. Coordinate and postcode validity.
            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL),
                  COUNT(*) FILTER (
                    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                      AND (latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180)
                  ),
                  COUNT(*) FILTER (WHERE postcode IS NOT NULL AND postcode !~ '^[0-9]{4}$'),
                  COUNT(*) FILTER (WHERE postcode IS NULL OR postcode = '')
                FROM locations;
                """
            )
            loc_missing_xy, loc_bad_xy, loc_bad_pc, loc_no_pc = cur.fetchone()
            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE latitude NOT BETWEEN -90 AND 90
                                      OR longitude NOT BETWEEN -180 AND 180),
                  COUNT(*) FILTER (WHERE postcode !~ '^[0-9]{4}$'),
                  COUNT(*) FILTER (WHERE state <> 'VIC'),
                  COUNT(*)
                FROM suburb_postcodes;
                """
            )
            sub_bad_xy, sub_bad_pc, sub_bad_state, sub_total = cur.fetchone()
            report["checks"]["coordinates_and_postcodes"] = {
                "locations_missing_coordinates": loc_missing_xy,
                "locations_invalid_coordinates": loc_bad_xy,
                "locations_invalid_postcode_format": loc_bad_pc,
                "locations_without_postcode": loc_no_pc,
                "suburbs_total": sub_total,
                "suburbs_invalid_coordinates": sub_bad_xy,
                "suburbs_invalid_postcode_format": sub_bad_pc,
                "suburbs_not_vic": sub_bad_state,
                "note": "Suburb coordinates are approximate polygon centroids, never exact locations.",
            }
            for count, label in (
                (loc_bad_xy, "locations with out-of-range coordinates"),
                (loc_bad_pc, "locations with a malformed postcode"),
                (sub_bad_xy, "suburbs with out-of-range coordinates"),
                (sub_bad_pc, "suburbs with a malformed postcode"),
                (sub_bad_state, "suburbs outside Victoria"),
            ):
                if count:
                    failures.append(f"{count} {label}")

            # 10. Duplicates.
            cur.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT lower(suburb), postcode FROM suburb_postcodes
                    GROUP BY 1, 2 HAVING COUNT(*) > 1
                ) d;
                """
            )
            dup_suburbs = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT family_code, category_code FROM appliance_categories
                    GROUP BY 1, 2 HAVING COUNT(*) > 1
                ) d;
                """
            )
            dup_categories = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT official_url FROM recalls GROUP BY 1 HAVING COUNT(*) > 1
                ) d;
                """
            )
            dup_recalls = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT lower(name), location_type, latitude, longitude
                    FROM locations GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1
                ) d;
                """
            )
            dup_locations = cur.fetchone()[0]
            report["checks"]["duplicates"] = {
                "suburb_postcode": dup_suburbs,
                "appliance_categories": dup_categories,
                "recalls_by_official_url": dup_recalls,
                "locations_same_name_and_point": dup_locations,
            }
            for count, label in (
                (dup_suburbs, "duplicate suburb/postcode pairs"),
                (dup_categories, "duplicate appliance categories"),
                (dup_recalls, "duplicate recall URLs"),
            ):
                if count:
                    failures.append(f"{count} {label}")

            # 11. Recommendation eligibility.
            cur.execute("SELECT COUNT(*) FROM verified_location_recommendations;")
            eligible = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM unverified_location_candidates;")
            unverified_candidates = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM verified_location_recommendations
                WHERE verification_url IS NULL
                   OR last_verified_at IS NULL
                   OR acceptance_evidence_url IS NULL;
                """
            )
            eligibility_violations = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM location_appliance_acceptance
                WHERE acceptance_status = 'confirmed'
                  AND (evidence_url IS NULL OR verified_at IS NULL);
                """
            )
            unsupported_confirmations = cur.fetchone()[0]
            report["checks"]["recommendation_eligibility"] = {
                "verified_recommendations": eligible,
                "unverified_candidates_requiring_disclaimer": unverified_candidates,
                "rows_violating_eligibility_rules": eligibility_violations,
                "confirmed_acceptance_without_evidence": unsupported_confirmations,
                "note": "Eligibility is derived by a view, not stored, so it cannot be set true by an UPDATE.",
                "expected": "Zero verified recommendations is the correct result until facility evidence is gathered.",
                "required_label_for_others": (
                    "Potential nearby service. Acceptance and public access have not been "
                    "verified. Check before visiting."
                ),
            }
            if eligibility_violations or unsupported_confirmations:
                failures.append("recommendation eligibility rules are violated")

            cur.execute("SELECT name, licence FROM data_sources ORDER BY name;")
            report["data_sources"] = [{"name": n, "licence": lic} for n, lic in cur.fetchall()]

            cur.execute(
                """
                SELECT ds.name
                FROM data_sources ds
                WHERE ds.name IN (
                        'ACCC Product Safety Recalls RSS',
                        'Open Repair Alliance aggregate dataset',
                        'OpenStreetMap repair POIs (Victoria extract)',
                        'Victoria waste and resource recovery infrastructure (DataVic)',
                        'ABS ASGS Edition 3 — Suburbs and Localities (SAL) and Postal Areas (POA) 2021'
                    )
                  AND NOT EXISTS (
                        SELECT 1 FROM data_import_runs r
                        WHERE r.data_source_id = ds.id
                          AND r.checksum IS NOT NULL AND btrim(r.checksum) <> ''
                    )
                ORDER BY 1;
                """
            )
            missing_checksums = [n for (n,) in cur.fetchall()]
            report["checks"]["import_checksums"] = {
                "sources_missing_checksum": missing_checksums,
            }
            if missing_checksums:
                failures.append(
                    "import runs missing snapshot checksums: " + ", ".join(missing_checksums)
                )

    report["remaining_unknowns"] = [
        f"{unverified} of {total} locations have no facility-level verification. "
        "Neither DataVic nor OpenStreetMap publishes per-facility evidence, so this "
        "requires manual checking.",
        f"{acc_total} appliance acceptance records exist across "
        f"{relevant * categories} possible location and category pairs. "
        "No free open source states which household appliances a Victorian facility accepts.",
        "Public access is unknown for every location. It lives on "
        "location_appliance_acceptance, not on locations, and is not inferred "
        "from facility type or coordinates.",
        "Recall coverage is a rolling ACCC RSS snapshot, not the full recall history.",
        "Suburb coordinates are ABS polygon centroids. A suburb spanning several "
        "postcodes is reduced to the postcode containing its centroid.",
        "Microwaves are out of Iteration 1 scope: ORA v0.3 has no microwave category, "
        "so there is no repair evidence to attach.",
        "The Mistral vacuum recall candidate remains unreviewed until a named person "
        "compares it with the official ACCC notice via 06_review_recall_match.py.",
    ]
    report["failures"] = failures

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    print()
    print(f"Wrote {OUT_PATH}")
    if failures:
        print()
        print(f"FAILED: {len(failures)} data-quality invariant(s) broken:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print()
    print("PASSED: no data-quality invariants broken.")
    print("Note: 0% facility verification is reported honestly, not treated as a failure.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
