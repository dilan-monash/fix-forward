-- One verified record from the team's ACCC RSS snapshot.
-- Source notice: Mistral Barrel Cyclonic Vacuum Cleaner - BVC 160 / BVC 165.
-- This seed is deliberately narrow; it is not a claim of complete recall coverage.

BEGIN;

INSERT INTO recall_products
    (recall_id, brand, product_name, manually_reviewed, reviewed_at, review_notes)
SELECT
    id,
    'Mistral',
    'Barrel Cyclonic Vacuum Cleaner',
    true,
    CURRENT_DATE,
    'Brand and model identifiers manually checked against the official ACCC notice.'
FROM recalls
WHERE official_url = 'https://www.productsafety.gov.au/search-consumer-product-recalls/mistral-barrel-cyclonic-vacuum-cleaner-%E2%80%93-sold-at-bunnings'
ON CONFLICT (recall_id, brand, product_name) DO UPDATE SET
    manually_reviewed = EXCLUDED.manually_reviewed,
    reviewed_at = EXCLUDED.reviewed_at,
    review_notes = EXCLUDED.review_notes;

INSERT INTO recall_category_links (recall_product_id, ui_category_code)
SELECT rp.id, 'vacuum-cleaner'
FROM recall_products AS rp
JOIN recalls AS r ON r.id = rp.recall_id
WHERE r.official_url = 'https://www.productsafety.gov.au/search-consumer-product-recalls/mistral-barrel-cyclonic-vacuum-cleaner-%E2%80%93-sold-at-bunnings'
ON CONFLICT DO NOTHING;

INSERT INTO recall_identifiers
    (recall_product_id, identifier_type, identifier_value, normalized_value)
SELECT rp.id, values_to_add.identifier_type,
       values_to_add.identifier_value, values_to_add.normalized_value
FROM recall_products AS rp
JOIN recalls AS r ON r.id = rp.recall_id
CROSS JOIN (VALUES
    ('model', 'BVC 160', 'BVC160'),
    ('model', 'BVC 165', 'BVC165')
) AS values_to_add(identifier_type, identifier_value, normalized_value)
WHERE r.official_url = 'https://www.productsafety.gov.au/search-consumer-product-recalls/mistral-barrel-cyclonic-vacuum-cleaner-%E2%80%93-sold-at-bunnings'
ON CONFLICT DO NOTHING;

COMMIT;
