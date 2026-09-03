"""
Attach specific, checkable sources to every safety rule.

Two problems this fixes:

1. The swollen-battery rule cited a general CFA electricity factsheet, which
   does not discuss lithium-ion batteries. It now cites the Victorian fire
   agencies' lithium-ion warning directly.
2. The personal-data rule cited an OAIC URL that returns 404. It now cites the
   OAIC page that actually tells consumers to wipe a device and remove the SIM
   before disposal.

Each row records what the specific source supports, so a reviewer can check the
claim against the citation rather than trusting a bare link. Every URL is
requested to confirm it resolves.

Idempotent: safe to run repeatedly.

Run from fix-forward repo root:
    python data/scripts/06_seed_safety_rule_sources.py
    python data/scripts/06_seed_safety_rule_sources.py --strict-urls
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from datetime import date

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

ESV = {
    "source_name": "Energy Safe Victoria — Using electricity safely",
    "source_url": "https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely",
    "publisher": "Energy Safe Victoria (Victorian electricity and gas safety regulator)",
}
CFA_ELECTRICAL = {
    "source_name": "CFA Victoria — Electrical safety factsheet",
    "source_url": "https://www.cfa.vic.gov.au/ArticleDocuments/372/Factsheet%20Electrical.pdf.aspx",
    "publisher": "Country Fire Authority Victoria",
}
CFA_LITHIUM = {
    "source_name": "CFA Victoria — Victorian fire agencies urge caution over lithium-ion battery fire risks",
    "source_url": "https://news.cfa.vic.gov.au/news/victorian-fire-agencies-and-regulator-urge-caution-over-lithium-ion-battery-fire-risks",
    "publisher": "Country Fire Authority Victoria, Fire Rescue Victoria and Energy Safe Victoria",
}
ACCC = {
    "source_name": "ACCC Product Safety — Recalls",
    "source_url": "https://www.productsafety.gov.au/recalls",
    "publisher": "Australian Competition and Consumer Commission",
}
OAIC = {
    "source_name": "OAIC — Tips to protect your privacy",
    "source_url": "https://www.oaic.gov.au/privacy/your-privacy-rights/ways-to-protect-your-privacy/tips-to-protect-your-privacy",
    "publisher": "Office of the Australian Information Commissioner",
}

# hazard_code -> [(source, is_primary, what this source supports)]
RULE_SOURCES: dict[str, list[tuple[dict, bool, str]]] = {
    "smoke_or_fire": [
        (CFA_LITHIUM, False, "Household appliance fires and the advice to call 000 rather than fight a fire you cannot control."),
        (CFA_ELECTRICAL, True, "Electrical fire risk in the home and the instruction to call 000 for fire you cannot control."),
        (ESV, False, "Stopping use of a faulty electrical appliance and not attempting DIY electrical repair."),
    ],
    "burning_smell": [
        (ESV, True, "Overheating as a sign of an electrical fault, and the instruction to stop using the appliance."),
        (CFA_ELECTRICAL, False, "Overheating wiring and components as a fire risk."),
    ],
    "sparking": [
        (ESV, True, "Sparking from an appliance, plug or cord indicating a dangerous electrical fault."),
        (CFA_ELECTRICAL, False, "Electrical faults as a household fire risk."),
    ],
    "overheating": [
        (ESV, True, "Unusual heat from an appliance, plug or cord as an electrical fault requiring the appliance to be taken out of use."),
        (CFA_ELECTRICAL, False, "Overheating as a precursor to electrical fire."),
    ],
    "shock_or_tingling": [
        (ESV, True, "Electric shock risk from faulty appliances and the instruction to stop use and seek a licensed electrician."),
    ],
    "exposed_wiring": [
        (ESV, True, "Damaged cords, plugs and exposed conductors as a shock and fire risk, and that DIY electrical repair is unlawful and unsafe."),
    ],
    "swollen_battery": [
        (CFA_LITHIUM, True, "Swollen, leaking or damaged lithium-ion batteries as a fire risk, the advice to stop charging and to avoid puncturing or crushing, and that batteries must not go in household or recycling bins."),
    ],
    "liquid_damage": [
        (ESV, True, "Water and electricity together as a shock hazard, and not switching on a wet appliance."),
    ],
    "visible_damage": [
        (ESV, True, "Damaged appliance casing potentially exposing live parts."),
    ],
    "unusual_sounds": [
        (ESV, True, "Treating suspected appliance faults conservatively and seeking a licensed electrician."),
    ],
    "circuit_trips": [
        (ESV, True, "Repeated safety switch or circuit breaker operation indicating an electrical fault that needs investigation."),
    ],
    "general_uncertainty": [
        (ESV, True, "Seeking a licensed electrician when unsure about an electrical fault."),
    ],
    "possible_recall_follow_accc": [
        (ACCC, True, "The official recall register and the requirement to follow the published recall notice for the affected product."),
    ],
    "personal_data_on_device": [
        (OAIC, True, "Wiping a device and removing the SIM card before throwing out or giving away an old phone, tablet or computer."),
    ],
}

# Earlier names for the same guidance, left behind when the citations were made
# specific. Removed once nothing references them, so the source register does
# not list the same page twice under two names.
LEGACY_SOURCE_NAMES = [
    "Energy Safe Victoria — Using Electricity Safely",
    "CFA Victoria — Electricity factsheet",
    "CFA Victoria — home fire safety guidance",
]

# Registered in data_sources so provenance stays consistent across the database.
SOURCE_REGISTRY = [
    (ESV, "Crown copyright, Victorian Government. Referenced by link only; no content is copied.",
     "Regulator guidance for consumers. FixForward paraphrases it for screening wording and does not diagnose faults or certify safety."),
    (CFA_ELECTRICAL, "Crown copyright, Victorian Government. Referenced by link only; no content is copied.",
     "Fire service factsheet. Not a substitute for emergency services: call 000 in an emergency."),
    (CFA_LITHIUM, "Crown copyright, Victorian Government. Referenced by link only; no content is copied.",
     "Public safety warning about lithium-ion batteries. Not a repair or disposal instruction manual for a specific product."),
    (ACCC, "Australian Government open data (ACCC Product Safety).",
     "Official recall register. FixForward's possible matches are never confirmation; the official notice governs."),
    (OAIC, "Crown copyright, Commonwealth of Australia. Referenced by link only; no content is copied.",
     "General consumer privacy guidance. Not legal advice, and it does not confirm that data has been erased from any device."),
]


BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

# These two government sites filter opposite things: productsafety.gov.au
# answers 403 to any custom User-Agent, while oaic.gov.au answers 403 to the
# default Python one. Trying both is the only way to tell a filtered request
# apart from a genuinely dead link.
ATTEMPTS = [
    ("HEAD", {}),
    ("GET", {}),
    ("GET", {"User-Agent": BROWSER_UA}),
]


def url_status(url: str, timeout: int = 20) -> int | str:
    """Confirm a citation resolves. 403 means a filter refused us, not 404."""
    last: int | str = "unknown"
    for method, headers in ATTEMPTS:
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, method=method, headers=headers),
                timeout=timeout,
            ) as response:
                return response.status
        except urllib.error.HTTPError as exc:
            last = exc.code
            if exc.code not in (403, 405):
                return exc.code
        except Exception as exc:  # offline, DNS failure, TLS problem
            return f"unreachable ({type(exc).__name__})"
    return last


def main(argv: list[str]) -> int:
    strict = "--strict-urls" in argv

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

    print("Checking every cited URL resolves...")
    statuses: dict[str, int | str] = {}
    broken: list[str] = []
    for source, _licence, _limitations in SOURCE_REGISTRY:
        url = source["source_url"]
        status = url_status(url)
        statuses[url] = status
        flag = "ok " if status == 200 else "BAD"
        print(f"  [{flag}] {status}  {source['source_name']}")
        if status != 200:
            broken.append(url)

    if broken and strict:
        print()
        print(f"ERROR: {len(broken)} cited URL(s) did not return 200 and --strict-urls was set.")
        return 1

    today = date.today().isoformat()
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            source_ids: dict[str, int] = {}
            for source, licence, limitations in SOURCE_REGISTRY:
                cur.execute(
                    """
                    INSERT INTO data_sources (name, url, licence, retrieval_date, version, limitations)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (name) DO UPDATE SET
                        url = EXCLUDED.url,
                        licence = EXCLUDED.licence,
                        retrieval_date = EXCLUDED.retrieval_date,
                        version = EXCLUDED.version,
                        limitations = EXCLUDED.limitations
                    RETURNING id;
                    """,
                    (
                        source["source_name"],
                        source["source_url"],
                        licence,
                        today,
                        f"Checked {today}",
                        limitations,
                    ),
                )
                source_ids[source["source_url"]] = cur.fetchone()[0]

            cur.execute("SELECT hazard_code, id FROM safety_rules;")
            rule_ids = dict(cur.fetchall())

            missing = sorted(set(RULE_SOURCES) - set(rule_ids))
            if missing:
                print()
                print("ERROR: these hazard codes are not in safety_rules:")
                for code in missing:
                    print(f"  - {code}")
                print("Run 04_seed_safety_rules.py first.")
                return 1

            cur.execute("DELETE FROM safety_rule_sources;")
            attached = 0
            for hazard_code, entries in RULE_SOURCES.items():
                rule_id = rule_ids[hazard_code]
                for source, is_primary, supports in entries:
                    cur.execute(
                        """
                        INSERT INTO safety_rule_sources (
                            safety_rule_id, source_name, source_url, publisher,
                            supports, retrieved_at, is_primary, data_source_id
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (safety_rule_id, source_url) DO UPDATE SET
                            source_name = EXCLUDED.source_name,
                            publisher = EXCLUDED.publisher,
                            supports = EXCLUDED.supports,
                            retrieved_at = EXCLUDED.retrieved_at,
                            is_primary = EXCLUDED.is_primary,
                            data_source_id = EXCLUDED.data_source_id;
                        """,
                        (
                            rule_id,
                            source["source_name"],
                            source["source_url"],
                            source["publisher"],
                            supports,
                            today,
                            is_primary,
                            source_ids[source["source_url"]],
                        ),
                    )
                    attached += 1

                # Keep the single-URL column agreeing with the primary source.
                primary = next(s for s, is_primary, _ in entries if is_primary)
                cur.execute(
                    """
                    UPDATE safety_rules
                    SET source_name = %s, source_url = %s, last_reviewed_at = %s
                    WHERE id = %s;
                    """,
                    (primary["source_name"], primary["source_url"], today, rule_id),
                )

            # Drop superseded duplicates, but only when nothing points at them.
            cur.execute(
                """
                DELETE FROM data_sources ds
                WHERE ds.name = ANY(%s)
                  AND NOT EXISTS (SELECT 1 FROM safety_rule_sources t WHERE t.data_source_id = ds.id)
                  AND NOT EXISTS (SELECT 1 FROM locations t WHERE t.data_source_id = ds.id)
                  AND NOT EXISTS (SELECT 1 FROM recalls t WHERE t.data_source_id = ds.id)
                  AND NOT EXISTS (SELECT 1 FROM repair_statistics t WHERE t.data_source_id = ds.id)
                  AND NOT EXISTS (SELECT 1 FROM repair_barriers t WHERE t.data_source_id = ds.id)
                  AND NOT EXISTS (SELECT 1 FROM suburb_postcodes t WHERE t.data_source_id = ds.id)
                  AND NOT EXISTS (SELECT 1 FROM data_import_runs t WHERE t.data_source_id = ds.id);
                """,
                (LEGACY_SOURCE_NAMES,),
            )
            legacy_removed = cur.rowcount

            cur.execute("SELECT COUNT(*) FROM safety_rules WHERE active;")
            rules = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM safety_rules r
                WHERE r.active AND NOT EXISTS (
                    SELECT 1 FROM safety_rule_sources s
                    WHERE s.safety_rule_id = r.id AND s.is_primary
                );
                """
            )
            without_primary = cur.fetchone()[0]
        conn.commit()

    print()
    print("SUCCESS: safety rule sources attached.")
    print(f"  active rules:              {rules}")
    print(f"  citations attached:        {attached}")
    print(f"  rules without a primary:   {without_primary}")
    print(f"  distinct sources:          {len(SOURCE_REGISTRY)}")
    print(f"  superseded duplicates removed: {legacy_removed}")
    print()
    print("  Screening is not a diagnosis and never certifies that an appliance is safe.")
    if broken:
        print()
        print(f"  WARNING: {len(broken)} cited URL(s) did not return 200:")
        for url in broken:
            print(f"    {statuses[url]}  {url}")
    return 0 if without_primary == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
