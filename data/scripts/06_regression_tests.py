"""
Regression tests for the FixForward data layer.

These lock in the specific defects found during review so they cannot return:

  infant                     must NOT match fan
  vacuum-insulated food jar  must NOT match vacuum cleaner
  Mistral vacuum cleaner     must     match vacuum cleaner
  unknown acceptance         must NOT be recommendation eligible
  unknown public access      must NOT be recommendation eligible

Database tests run inside transactions that are rolled back, so nothing is
left behind. A positive control proves the eligibility view can return a row,
which is what makes the real result of zero rows meaningful rather than
vacuous.

Exits non-zero on any failure.

Run from fix-forward repo root:
    python data/scripts/06_regression_tests.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.insert(0, SCRIPT_DIR)

from recall_matching import PATTERNS, best_matches  # noqa: E402

DATASET_URLS = (
    "https://discover.data.vic.gov.au/dataset/"
    "victoria-s-waste-and-resource-recovery-infrastructure-map-data",
    "https://www.openstreetmap.org/copyright",
)

results: list[tuple[bool, str, str]] = []


def check(passed: bool, name: str, detail: str = "") -> None:
    results.append((passed, name, detail))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}")
    if detail and not passed:
        print(f"         {detail}")


def categories_for(title: str, summary: str = "") -> dict:
    return best_matches(title, summary, PATTERNS)


def offline_pattern_tests() -> None:
    print("Pattern matching (no database required)")

    # The exact titles that the old ILIKE '%fan%' matcher reported as fans.
    infant_titles = [
        "Nuby Foldable Bathtub for babies and infants",
        "Pull String Interactive Toys suitable for infants",
        "5-in-1 nursery center - portable cot for infants",
        "Joolz Aer2 car seat adapter set for infant carriers",
    ]
    for title in infant_titles:
        hit = categories_for(title)
        check(
            "fan" not in hit,
            f"'infant' does not match fan: {title[:46]}",
            f"matched {hit.get('fan')}",
        )

    jar = (
        "Stainless King Food Jars. The vacuum insulated food jar keeps contents hot. "
        "Some vacuum-sealed units may leak."
    )
    hit = categories_for(jar)
    check(
        "vacuum_cleaner" not in hit,
        "vacuum-insulated food jar does not match vacuum cleaner",
        f"matched {hit.get('vacuum_cleaner')}",
    )

    mistral = "Mistral Barrel Cyclonic Vacuum Cleaner - sold at Bunnings"
    hit = categories_for(mistral)
    check(
        "vacuum_cleaner" in hit,
        "Mistral vacuum cleaner matches vacuum cleaner",
        f"matched {hit}",
    )
    if "vacuum_cleaner" in hit:
        check(
            bool(hit["vacuum_cleaner"]["pattern"]),
            "the Mistral match records the pattern that produced it",
        )
        check(
            hit["vacuum_cleaner"]["matched_field"] == "title",
            "the Mistral match is recorded as coming from the title",
            f"matched_field={hit['vacuum_cleaner'].get('matched_field')}",
        )

    check(
        not any("microwave" in p.pattern.lower() for p in PATTERNS),
        "no microwave pattern remains in the source list",
    )
    hit = categories_for("Household microwave oven overheating hazard")
    check(
        "air_fryer_and_other_complex_kitchen" not in hit,
        "microwave oven does not match the air-fryer category",
        f"matched {hit.get('air_fryer_and_other_complex_kitchen')}",
    )

    hit = categories_for("Unrelated product title", "Robot vacuum battery fault")
    check(
        hit.get("vacuum_cleaner", {}).get("matched_field") == "summary",
        "a summary-only hit records matched_field=summary",
        f"matched {hit.get('vacuum_cleaner')}",
    )
    hit = categories_for("Robot vacuum recall", "Also mentions a vacuum cleaner")
    check(
        hit.get("vacuum_cleaner", {}).get("matched_field") == "title",
        "a title hit is preferred over a summary hit",
        f"matched {hit.get('vacuum_cleaner')}",
    )

    # Terms the brief called out as unsafe on their own.
    for text, category, label in [
        ("Cement mixer with faulty guard", "blender_mixer_and_food_processor", "bare 'mixer'"),
        ("Petrol hedge trimmer recall", "hair_and_beauty_appliances", "bare 'trimmer'"),
        ("Insulated drink jug with faulty lid", "kettle", "bare 'jug'"),
        ("Portable AC adapter overheating", "dehumidifier_and_portable_air_conditioner", "'portable ac'"),
        ("Ceiling fan mounting bracket failure", "fan", "ceiling fan (fixed wiring)"),
        ("Kettle Chips packaging recall", "kettle", "'Kettle Chips' brand"),
    ]:
        hit = categories_for(text)
        check(
            category not in hit,
            f"{label} does not match {category}",
            f"matched {hit.get(category)}",
        )

    # Genuine appliance recalls must still be found.
    for text, category in [
        ("Sunbeam electric kettle with faulty base", "kettle"),
        ("Breville stand mixer recall", "blender_mixer_and_food_processor"),
        ("Tower fan overheating hazard", "fan"),
        ("Robot vacuum battery fault", "vacuum_cleaner"),
        ("Hair dryer with damaged cord", "hair_dryer"),
        ("Portable air conditioner fire risk", "dehumidifier_and_portable_air_conditioner"),
    ]:
        hit = categories_for(text)
        check(category in hit, f"genuine recall still matches {category}: {text[:40]}")


def database_tests(conn) -> None:
    import psycopg

    print()
    print("Database state")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM recall_category_matches
            WHERE matched_pattern IS NULL OR matched_pattern = '';
            """
        )
        check(cur.fetchone()[0] == 0, "every stored recall candidate records its pattern")

        cur.execute(
            """
            SELECT COUNT(*) FROM recall_category_matches m
            JOIN recalls r ON r.id = m.recall_id
            WHERE r.title ILIKE '%Mistral%' AND m.category_code = 'vacuum_cleaner';
            """
        )
        check(cur.fetchone()[0] == 1, "the real Mistral recall is stored as a vacuum candidate")

        cur.execute(
            """
            SELECT m.matched_field FROM recall_category_matches m
            JOIN recalls r ON r.id = m.recall_id
            WHERE r.title ILIKE '%Mistral%' AND m.category_code = 'vacuum_cleaner';
            """
        )
        field = cur.fetchone()
        check(
            field is not None and field[0] == "title",
            "the stored Mistral candidate records matched_field=title",
            f"got {field}",
        )

        cur.execute(
            """
            SELECT COUNT(*) FROM recall_category_matches
            WHERE matched_field IS NULL OR matched_field NOT IN ('title', 'summary');
            """
        )
        check(cur.fetchone()[0] == 0, "every stored candidate records title or summary as the match field")

        cur.execute(
            """
            SELECT COUNT(*) FROM appliance_recall_patterns
            WHERE active AND pattern ILIKE '%microwave%';
            """
        )
        check(cur.fetchone()[0] == 0, "no active microwave recall pattern")

        cur.execute(
            """
            SELECT search_aliases FROM appliance_categories
            WHERE category_code = 'air_fryer_and_other_complex_kitchen';
            """
        )
        aliases = (cur.fetchone() or [""])[0] or ""
        check(
            "microwave" not in aliases.lower(),
            "air-fryer search aliases do not include microwave",
            aliases,
        )

        cur.execute(
            """
            SELECT COUNT(*) FROM recall_category_matches m
            JOIN recalls r ON r.id = m.recall_id
            WHERE r.title ILIKE '%infant%' OR r.title ILIKE '%nursery%'
               OR r.title ILIKE '%car seat%' OR r.title ILIKE '%Food Jar%';
            """
        )
        check(cur.fetchone()[0] == 0, "no infant or food-jar product is stored as a candidate")

        cur.execute(
            "SELECT COUNT(*) FROM locations WHERE verification_url = ANY(%s);",
            (list(DATASET_URLS),),
        )
        check(cur.fetchone()[0] == 0, "no dataset URL is stored as facility verification")

        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'locations' AND column_name = 'recommendation_eligible';
            """
        )
        check(cur.fetchone()[0] == 0, "recommendation_eligible is not a stored column")

        cur.execute(
            """
            SELECT COUNT(*) FROM locations
            WHERE verification_status <> 'unverified'
              AND (verification_url IS NULL OR last_verified_at IS NULL);
            """
        )
        check(cur.fetchone()[0] == 0, "nothing claims verification without evidence")

        cur.execute(
            """
            SELECT COUNT(*) FROM safety_rules r
            WHERE r.active AND NOT EXISTS (
                SELECT 1 FROM safety_rule_sources s
                WHERE s.safety_rule_id = r.id AND s.is_primary
            );
            """
        )
        check(cur.fetchone()[0] == 0, "every active safety rule has a primary source")

        cur.execute(
            """
            SELECT COUNT(*) FROM data_sources
            WHERE licence IS NULL OR btrim(licence) = ''
               OR licence ILIKE '%community open dataset%';
            """
        )
        check(cur.fetchone()[0] == 0, "every data source states defensible reuse terms")

        cur.execute(
            """
            SELECT COUNT(*) FROM data_import_runs r
            JOIN data_sources ds ON ds.id = r.data_source_id
            WHERE ds.name ILIKE '%ACCC%'
              AND r.limitations ILIKE '%not%recall-free%';
            """
        )
        check(
            cur.fetchone()[0] >= 1,
            "the ACCC import run records that no match does not prove recall-free",
        )

        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'locations'
              AND column_name IN ('accepts_electrical_appliances', 'public_access');
            """
        )
        check(cur.fetchone()[0] == 0, "location-level acceptance and public_access columns are gone")

        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'locations'
              AND column_name IN ('source_url', 'source_retrieved_at', 'provider_type')
              AND is_nullable = 'NO';
            """
        )
        check(cur.fetchone()[0] == 3, "source_url, source_retrieved_at and provider_type are NOT NULL")

        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_name = 'location_appliance_acceptance'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = 'location_appliance_acceptance_category_fk';
            """
        )
        check(cur.fetchone()[0] == 1, "location_appliance_acceptance.category_code has a foreign key")

        cur.execute(
            """
            SELECT ds.name
            FROM data_sources ds
            WHERE ds.name IN (
                    'ACCC Product Safety Recalls RSS',
                    'Open Repair Alliance aggregate dataset',
                    'OpenStreetMap repair POIs (Victoria extract)',
                    'Victoria waste and resource recovery infrastructure (DataVic)'
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
        check(
            not missing_checksums,
            "ACCC, ORA, DataVic and OSM import runs each record a snapshot checksum",
            f"missing: {missing_checksums}",
        )

    print()
    print("Eligibility rules (rolled back, nothing is kept)")
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM data_sources ORDER BY id LIMIT 1;")
                source_id = cur.fetchone()[0]

                def make_location(name: str) -> int:
                    cur.execute(
                        """
                        INSERT INTO locations (
                            location_type, name, provider_type, suburb, postcode,
                            latitude, longitude, data_source_id,
                            household_electrical_relevant,
                            source_url, source_retrieved_at,
                            verification_url, last_verified_at, verification_status
                        ) VALUES (
                            'recycling', %s, 'transfer_station', 'Testville', '3000',
                            -37.8, 144.9, %s, TRUE,
                            'https://example.org/dataset', CURRENT_DATE,
                            'https://example.org/facility-evidence', CURRENT_DATE, 'verified'
                        ) RETURNING id;
                        """,
                        (name, source_id),
                    )
                    return cur.fetchone()[0]

                def in_view(location_id: int) -> int:
                    cur.execute(
                        "SELECT COUNT(*) FROM verified_location_recommendations WHERE id = %s;",
                        (location_id,),
                    )
                    return cur.fetchone()[0]

                # Positive control: everything present, so the view must return it.
                control = make_location("REGRESSION control")
                cur.execute(
                    """
                    INSERT INTO location_appliance_acceptance (
                        location_id, category_code, acceptance_status, public_access,
                        evidence_url, verified_at, data_source_id
                    ) VALUES (%s, 'kettle', 'confirmed', TRUE,
                              'https://example.org/accepts-kettles', CURRENT_DATE, %s);
                    """,
                    (control, source_id),
                )
                check(
                    in_view(control) == 1,
                    "positive control: full evidence IS recommendation eligible",
                    "the view returned nothing even with complete evidence",
                )

                # Unknown acceptance must never be eligible.
                unknown_acc = make_location("REGRESSION unknown acceptance")
                cur.execute(
                    """
                    INSERT INTO location_appliance_acceptance (
                        location_id, category_code, acceptance_status, public_access
                    ) VALUES (%s, 'kettle', 'unknown', TRUE);
                    """,
                    (unknown_acc,),
                )
                check(
                    in_view(unknown_acc) == 0,
                    "unknown acceptance is NOT recommendation eligible",
                )

                # Unknown public access must never be eligible.
                unknown_pub = make_location("REGRESSION unknown public access")
                cur.execute(
                    """
                    INSERT INTO location_appliance_acceptance (
                        location_id, category_code, acceptance_status, public_access,
                        evidence_url, verified_at, data_source_id
                    ) VALUES (%s, 'kettle', 'confirmed', NULL,
                              'https://example.org/accepts-kettles', CURRENT_DATE, %s);
                    """,
                    (unknown_pub, source_id),
                )
                check(
                    in_view(unknown_pub) == 0,
                    "unknown public access is NOT recommendation eligible",
                )

                # No facility evidence must never be eligible.
                no_evidence = make_location("REGRESSION no facility evidence")
                cur.execute(
                    """
                    UPDATE locations SET verification_url = NULL, last_verified_at = NULL,
                           verification_status = 'unverified' WHERE id = %s;
                    """,
                    (no_evidence,),
                )
                cur.execute(
                    """
                    INSERT INTO location_appliance_acceptance (
                        location_id, category_code, acceptance_status, public_access,
                        evidence_url, verified_at, data_source_id
                    ) VALUES (%s, 'kettle', 'confirmed', TRUE,
                              'https://example.org/accepts-kettles', CURRENT_DATE, %s);
                    """,
                    (no_evidence, source_id),
                )
                check(
                    in_view(no_evidence) == 0,
                    "no facility evidence is NOT recommendation eligible",
                )

                # The database must reject a confirmation with nothing behind it.
                rejected = False
                try:
                    with conn.transaction():
                        cur.execute(
                            """
                            INSERT INTO location_appliance_acceptance (
                                location_id, category_code, acceptance_status, public_access
                            ) VALUES (%s, 'toaster', 'confirmed', TRUE);
                            """,
                            (control,),
                        )
                except psycopg.errors.CheckViolation:
                    rejected = True
                check(rejected, "database rejects 'confirmed' acceptance with no evidence")

                fk_rejected = False
                try:
                    with conn.transaction():
                        cur.execute(
                            """
                            INSERT INTO location_appliance_acceptance (
                                location_id, category_code, acceptance_status
                            ) VALUES (%s, 'not_a_real_category', 'unknown');
                            """,
                            (control,),
                        )
                except psycopg.errors.ForeignKeyViolation:
                    fk_rejected = True
                check(fk_rejected, "database rejects an acceptance row with an unknown category_code")

                raise psycopg.Rollback
    except psycopg.Rollback:
        pass

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM locations WHERE name LIKE 'REGRESSION %';")
        check(cur.fetchone()[0] == 0, "test rows were rolled back and left nothing behind")


def main() -> int:
    print("FixForward data regression tests")
    print("=" * 72)
    offline_pattern_tests()

    load_dotenv(os.path.join(REPO_ROOT, ".env"))
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "USER:PASSWORD" in database_url:
        print()
        print("SKIPPED database tests: DATABASE_URL is not set.")
    else:
        try:
            import psycopg
        except ImportError:
            print("ERROR: pip install -r requirements-data.txt")
            return 1
        with psycopg.connect(database_url) as conn:
            database_tests(conn)

    failed = [name for ok, name, _ in results if not ok]
    print()
    print("=" * 72)
    print(f"  {len(results) - len(failed)} passed, {len(failed)} failed")
    if failed:
        print()
        print("FAILED:")
        for name in failed:
            print(f"  - {name}")
        return 1
    print()
    print("  All regression tests passed.")
    print("  Reminder: no match does NOT prove a product is recall-free, and an")
    print("  unverified location must carry its disclaimer in the app.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
