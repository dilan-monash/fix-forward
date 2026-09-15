# Iteration 2 automated cost catalogue

## Current verified state

- Neon project: `fix-forward` (`sparkling-poetry-32997503`).
- Isolated branch: `iteration-2-cost-comparison` (`br-ancient-snow-a7hi7h93`), forked from `production` on 14 September 2026.
- The production branch was not changed.
- Hosted catalogue: 57 replacement-price observations across all 19 supported appliance categories, with a minimum of 3 observations per category.
- Repair context: 4 separately sourced public service-fee observations.
- API verification: `/api/replacement-prices` returned HTTP 200 with `meta.storage = neon-postgresql`, 57 price rows and 4 fee rows.

## Provenance and limits

Every price row has a retailer, brand, model, full AUD amount, source URL and review date. The validator accepts only HTTPS pages on the named retailer's approved Australian domain. The authored evidence is in `data/catalogue/*-observations.json`; source-review notes are in `data/catalogue/SOURCES.md` and `data/catalogue/ADDITIONAL_SOURCES.md`.

These are dated advertised-price observations, not a live feed or a complete market survey. Stock is not claimed. Delivery and optional extras are excluded. The browser ranks exact brand/model matches first, but it labels category-only examples clearly. Offers older than 90 days, out-of-stock rows and promotions past `offerEndsAt` cannot drive the automatic comparison.

Three observations per category is the enforced minimum for Iteration 2 feature and usability testing. It is not sufficient to claim comprehensive market coverage; production maintenance still needs scheduled source review and additional observations over time.

## Rebuild and verify locally

```powershell
.\.venv\Scripts\python.exe data\scripts\build_price_catalogue.py
.\.venv\Scripts\python.exe data\scripts\build_price_catalogue_neon_sql.py
.\.venv\Scripts\python.exe -m unittest discover -s test_backend -p "test*.py"
npm.cmd test
```

## Runtime switch

The default remains `PRICE_CATALOGUE_STORAGE=local`. The backend reads Neon only when both conditions are met:

1. `DATABASE_URL` points to the isolated Iteration 2 branch using a SELECT-only application role.
2. `PRICE_CATALOGUE_STORAGE=postgres` is set server-side.

Do not place a connection string in source control or frontend files. Do not enable the switch on the existing Iteration 1/production deployment until the team deliberately deploys the Iteration 2 service with the isolated branch connection.

The import is generated in `database/005_import_reviewed_price_catalogue.sql`. Its transaction fails and rolls back unless the hosted result contains exactly 57 prices, 19 categories, at least 3 prices per category and 4 service-fee rows.
