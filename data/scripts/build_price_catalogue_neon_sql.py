"""Generate the reviewed price import for an isolated Iteration 2 Neon branch.

This script never connects to Neon. It validates the same authored JSON used by
the local snapshot and emits one transactional, repeatable PostgreSQL import.
"""

import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.price_catalogue import (  # noqa: E402
    load_reviewed_observations,
    load_reviewed_service_fees,
    snapshot_payload,
)


DESTINATION = PROJECT_ROOT / "database" / "005_import_reviewed_price_catalogue.sql"


def dollar_json(value):
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if "$catalogue$" in text:
        raise ValueError("Generated data contains reserved SQL dollar-quote marker")
    return f"$catalogue${text}$catalogue$"


def build_sql():
    payload = snapshot_payload(load_reviewed_observations(), load_reviewed_service_fees())
    payload["meta"]["storage"] = "neon-postgresql"
    meta_rows = [
        {"key": key, "value": json.dumps(value, ensure_ascii=False)}
        for key, value in payload["meta"].items()
    ]
    return f"""-- GENERATED reviewed catalogue import. Apply only to an isolated Iteration 2 Neon branch.
-- Source JSON is validated by backend/price_catalogue.py before this file is written.
BEGIN;

WITH rows AS (
    SELECT * FROM jsonb_to_recordset({dollar_json(payload['prices'])}::jsonb) AS x(
        id text, \"categoryCode\" text, brand text, model text, \"productName\" text,
        retailer text, \"priceAud\" numeric, currency text, \"sourceUrl\" text,
        \"observedAt\" date, \"priceKind\" text, availability text,
        \"offerEndsAt\" date, notes text
    )
)
INSERT INTO replacement_price_observations (
    id, category_code, brand, model, product_name, retailer, price_cents,
    currency, source_url, observed_at, price_kind, availability, offer_ends_at, notes
)
SELECT id, \"categoryCode\", brand, model, \"productName\", retailer,
       round(\"priceAud\" * 100)::bigint, currency, \"sourceUrl\", \"observedAt\",
       \"priceKind\", availability, \"offerEndsAt\", notes
FROM rows
ON CONFLICT (id) DO UPDATE SET
    category_code = EXCLUDED.category_code, brand = EXCLUDED.brand,
    model = EXCLUDED.model, product_name = EXCLUDED.product_name,
    retailer = EXCLUDED.retailer, price_cents = EXCLUDED.price_cents,
    currency = EXCLUDED.currency, source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at, price_kind = EXCLUDED.price_kind,
    availability = EXCLUDED.availability, offer_ends_at = EXCLUDED.offer_ends_at,
    notes = EXCLUDED.notes;

WITH rows AS (
    SELECT * FROM jsonb_to_recordset({dollar_json(payload['repairFees'])}::jsonb) AS x(
        id text, provider text, label text, amount numeric, note text,
        url text, retrieved date
    )
)
INSERT INTO repair_service_fee_observations (
    id, provider, label, amount_cents, note, source_url, retrieved_at
)
SELECT id, provider, label, round(amount * 100)::bigint, note, url, retrieved
FROM rows
ON CONFLICT (id) DO UPDATE SET
    provider = EXCLUDED.provider, label = EXCLUDED.label,
    amount_cents = EXCLUDED.amount_cents, note = EXCLUDED.note,
    source_url = EXCLUDED.source_url, retrieved_at = EXCLUDED.retrieved_at;

DELETE FROM replacement_price_catalogue_meta;
WITH rows AS (
    SELECT * FROM jsonb_to_recordset({dollar_json(meta_rows)}::jsonb)
        AS x(key text, value text)
)
INSERT INTO replacement_price_catalogue_meta (key, value)
SELECT key, value FROM rows;

DO $verify$
DECLARE
    price_count integer;
    fee_count integer;
    category_count integer;
    minimum_per_category integer;
BEGIN
    SELECT count(*) INTO price_count FROM replacement_price_observations;
    SELECT count(*) INTO fee_count FROM repair_service_fee_observations;
    SELECT count(*), min(n) INTO category_count, minimum_per_category
    FROM (SELECT category_code, count(*) AS n FROM replacement_price_observations GROUP BY category_code) counts;
    IF price_count <> {payload['meta']['recordCount']}
       OR fee_count <> {payload['meta']['repairFeeRecordCount']}
       OR category_count <> 19 OR minimum_per_category < 3 THEN
        RAISE EXCEPTION 'Catalogue verification failed: prices %, fees %, categories %, minimum %',
            price_count, fee_count, category_count, minimum_per_category;
    END IF;
END
$verify$;

COMMIT;
""", payload


if __name__ == "__main__":
    sql, payload = build_sql()
    DESTINATION.write_text(sql, encoding="utf-8", newline="\n")
    print(f"Wrote {DESTINATION}")
    print(f"Prices: {payload['meta']['recordCount']} across 19 categories")
    print(f"Repair service fees: {payload['meta']['repairFeeRecordCount']}")
