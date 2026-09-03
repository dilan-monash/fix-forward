"""
Seed appliance_recall_patterns from the reviewed pattern list.

Patterns live in the database so the team can inspect and correct them without
a code change. recall_matching.py holds the reviewed source of truth and the
reasoning behind each inclusion and exclusion.

Idempotent: rewrites the table from the pattern list.

Run from fix-forward repo root:
    python data/scripts/06_build_recall_patterns.py
"""

from __future__ import annotations

import os
import sys
from collections import Counter

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.insert(0, SCRIPT_DIR)

from recall_matching import PATTERNS  # noqa: E402


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

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT category_code FROM appliance_categories;")
            known = {r[0] for r in cur.fetchall()}

            unknown = sorted({p.category_code for p in PATTERNS} - known)
            if unknown:
                print("ERROR: patterns reference unknown category codes:")
                for code in unknown:
                    print(f"  - {code}")
                print("Run 04_seed_appliance_categories.py first.")
                return 1

            for p in PATTERNS:
                cur.execute(
                    """
                    INSERT INTO appliance_recall_patterns (
                        category_code, pattern, pattern_type,
                        required_context, excluded_context,
                        confidence, active, notes
                    ) VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s)
                    ON CONFLICT (category_code, pattern) DO UPDATE SET
                        pattern_type = EXCLUDED.pattern_type,
                        required_context = EXCLUDED.required_context,
                        excluded_context = EXCLUDED.excluded_context,
                        confidence = EXCLUDED.confidence,
                        active = TRUE,
                        notes = EXCLUDED.notes;
                    """,
                    (
                        p.category_code,
                        p.pattern,
                        p.pattern_type,
                        p.required_context,
                        p.excluded_context,
                        p.confidence,
                        p.notes,
                    ),
                )

            # Patterns removed from recall_matching.py stay in the table as an
            # audit trail but must not keep firing.
            source_keys = {(p.category_code, p.pattern) for p in PATTERNS}
            cur.execute("SELECT id, category_code, pattern FROM appliance_recall_patterns;")
            deactivated = 0
            for pid, category_code, pattern in cur.fetchall():
                if (category_code, pattern) not in source_keys:
                    cur.execute(
                        "UPDATE appliance_recall_patterns SET active = FALSE WHERE id = %s;",
                        (pid,),
                    )
                    deactivated += 1

            cur.execute("SELECT COUNT(*) FROM appliance_recall_patterns WHERE active;")
            total = cur.fetchone()[0]
        conn.commit()

    by_category = Counter(p.category_code for p in PATTERNS)
    by_confidence = Counter(p.confidence for p in PATTERNS)

    print("SUCCESS: appliance_recall_patterns seeded.")
    print(f"  active patterns: {total}")
    print(f"  deactivated (no longer in source): {deactivated}")
    print(f"  categories covered: {len(by_category)}/{len(known)}")
    print()
    for code in sorted(by_category):
        print(f"  {code:45s} {by_category[code]:3d} patterns")
    print()
    print(
        "  confidence: "
        f"high={by_confidence['high']} "
        f"medium={by_confidence['medium']} "
        f"low={by_confidence['low']}"
    )
    print()
    print("  Deliberately excluded bare terms: fan, vacuum (unqualified is low only),")
    print("  mixer, trimmer, jug, portable ac. Each produced false positives.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
