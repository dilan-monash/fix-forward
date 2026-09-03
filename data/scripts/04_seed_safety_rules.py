"""
Seed safety_rules from reviewed version-controlled JSON.

Citations are then attached by 06_seed_safety_rule_sources.py, which owns the
data_sources entries for safety guidance and checks that each URL resolves.

Run from fix-forward repo root:
    python data/scripts/04_seed_safety_rules.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
SEED_PATH = os.path.join(SCRIPT_DIR, "..", "seed", "safety_rules.json")


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

    with open(SEED_PATH, encoding="utf-8") as f:
        rules = json.load(f)

    reviewed = date.today().isoformat()
    print(f"Seeding {len(rules)} safety rules...")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM safety_rules;")
            for rule in rules:
                cur.execute(
                    """
                    INSERT INTO safety_rules (
                        appliance_family, hazard_code, question_text, explanation,
                        severity, stop_use_required, professional_assessment_required,
                        guidance_text, source_name, source_url, last_reviewed_at,
                        active, display_order
                    ) VALUES (
                        NULL, %(hazard_code)s, %(question_text)s, %(explanation)s,
                        %(severity)s, %(stop_use_required)s, %(professional_assessment_required)s,
                        %(guidance_text)s, %(source_name)s, %(source_url)s, %(last_reviewed_at)s,
                        TRUE, %(display_order)s
                    )
                    ON CONFLICT (hazard_code) DO UPDATE SET
                        question_text = EXCLUDED.question_text,
                        explanation = EXCLUDED.explanation,
                        severity = EXCLUDED.severity,
                        stop_use_required = EXCLUDED.stop_use_required,
                        professional_assessment_required = EXCLUDED.professional_assessment_required,
                        guidance_text = EXCLUDED.guidance_text,
                        source_name = EXCLUDED.source_name,
                        source_url = EXCLUDED.source_url,
                        last_reviewed_at = EXCLUDED.last_reviewed_at,
                        active = EXCLUDED.active,
                        display_order = EXCLUDED.display_order;
                    """,
                    {**rule, "last_reviewed_at": reviewed},
                )
            cur.execute("SELECT COUNT(*) FROM safety_rules WHERE active;")
            count = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM safety_rules WHERE active AND stop_use_required;"
            )
            stop_use = cur.fetchone()[0]

        conn.commit()

    print("SUCCESS: safety_rules seeded.")
    print(f"  active rules:     {count}")
    print(f"  stop-use (high):  {stop_use}")
    print("  Note: user answers are NEVER written to this table.")
    print("  next: python data/scripts/06_seed_safety_rule_sources.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
