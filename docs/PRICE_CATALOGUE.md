# Reviewed replacement-price catalogue

FixForward now has a small public database of dated, advertised Australian
replacement-price examples. Each observation identifies the appliance category,
brand, model, retailer, price in AUD, source product page, observation date and
availability evidence. These examples help a household choose a comparison
price; they are not a diagnosis, a repair quote or a recommendation to replace.

## Where this database lives

- Reviewed source records: `data/catalogue/*-observations.json`.
- Public SQLite database: `data/catalogue/replacement-prices.sqlite`.
- Static-preview copy of the same reviewed records: `src/price-snapshot.js`.
- Flask endpoint: `GET /api/replacement-prices`.
- Source-review notes: `data/catalogue/SOURCES.md` and
  `data/catalogue/ADDITIONAL_SOURCES.md`.

The initial snapshot reviewed on 11 September 2026 contains 28 observations
across all 19 supported appliance categories: 22 from The Good Guys and 6 from
Harvey Norman. JB Hi-Fi is a supported future source but no JB Hi-Fi price was
included because seller evidence for the candidate listing was incomplete.

The price database is an **explicit local public snapshot**, created without a
Neon credential. Runtime reads use SQLite `mode=ro` and `query_only`; a web request
cannot create or modify the file. This database contains public price records
only. It does not store the user's appliance answers, location or contact details.

The recall, repair-evidence and location endpoints still use PostgreSQL/Neon and
`DATABASE_URL`. They return an error when that connection is missing or fails.
The price snapshot never substitutes for those datasets. A successful price API
response does **not** prove that Neon is connected; use `/api/ready` and the
[database connection guide](DATABASE_CONNECTION_CHECK.md) for that check.

## Rebuild and verify

Run these commands from the project root with Python 3.10 or later. The price
builder and its unit tests use only the Python standard library.

```powershell
python data/scripts/build_price_catalogue.py
python -m unittest test_backend.test_price_catalogue -v
```

The builder loads every `*-observations.json` file in the catalogue folder,
validates the full set, writes a temporary SQLite file, verifies SQLite integrity,
replaces the destination, and reads it back. It also regenerates the public ESM
module used by the static preview. Commit the source observations, SQLite file
and generated module together. Do not hand-edit either generated output.

Optional output arguments support a separate build location or a plain JSON API
response for inspection:

```powershell
python data/scripts/build_price_catalogue.py --export-json tmp/price-catalogue.json
```

Running the website through Flask also requires the project's normal Python web
dependencies. The API integration tests are explicitly skipped if Flask or
python-dotenv is unavailable; a passing stdlib build is not evidence that the
Flask service or a hosted database has been tested.

## Evidence and update rules

Keep each price as an observation, with a stable unique ID. When a price changes,
add a dated observation instead of editing history into a claim about today's
price. An old price is not a current offer. Do not invent historical prices from
memory, extrapolate missing brands/models, or import a strike-through amount as
an earlier selling price without separately verified evidence.

The first dataset is a small manually reviewed sample. It is not representative
of all models, retailers, price tiers or Australian stock. The observation date
states when the advertised information was recorded; it does not guarantee
checkout price or stock. Keep availability `not-verified` unless the source
actually supports a dated stock statement. Notes should record special price
conditions, unresolved source limitations and the evidence method.

Only numeric, finite, positive AUD prices up to $100,000 with at most two decimal
places are accepted, matching the comparison form. Prices are stored as integer
cents to preserve currency precision.
The validator rejects missing brand/model/product names, unknown UI categories,
invalid/future dates, duplicate observations, unreviewed retailers and URLs that
do not match the named retailer's official HTTPS domain. No scraping, affiliate
redirects, checkout, account login or external database writes occur in the build.

Supported source hosts are JB Hi-Fi, Harvey Norman, The Good Guys, Kmart, BIG W,
Officeworks, Bing Lee, Myer and Amazon AU. Host validation cannot prove who sells
a marketplace listing: the reviewer must check direct-retailer supply before
adding a record. Amazon rows additionally require explicit reviewed
`Sold by Amazon AU` evidence in the notes. Do not add marketplace offers.

## API contract and failure behavior

The endpoint returns `{meta, prices}`. Each price retains the source JSON fields.
`meta.source` is `reviewed-price-snapshot`, `meta.storage` is
`local-public-snapshot`, and `meta.livePrices` is `false`. Metadata also includes
the schema version, record count, first/last observation dates, a content-derived
snapshot version and a plain-English limitation. Flask adds `releaseVersion`.

The endpoint does not receive the user's brand/model or fault answers; matching
and comparison happen in the browser. A missing, corrupt, empty, incompatible
or modified snapshot returns HTTP 503 with `price_catalogue_unavailable` and
`Cache-Control: no-store`. It never invents replacement prices or contacts Neon
as an implicit fallback. Manual price entry remains available in the UI.

## Optional later move to PostgreSQL

`database/003_replacement_price_catalogue.sql` supplies equivalent PostgreSQL
tables and indexes for a future move. **It has not been applied to Neon and does
not change current storage.** The local catalogue requires no database URL.

To move the catalogue later:

1. Verify the target development database and take the team's usual backup.
2. Apply migration 003 using a separate migration credential.
3. Validate the reviewed JSON with the same Python validator. Import the exact
   records with parameterised SQL, converting `priceAud` to integer `price_cents`
   using `Decimal`, and preserve the source URL and observation date. The
   `replacement_price_catalogue_meta` values are JSON-encoded text, as in SQLite.
4. Reconcile row count, source metadata and snapshot version against the local
   validated payload before publishing. Keep the application runtime role
   SELECT-only. The migration grants SELECT if `fixforward_runtime` exists.
5. Deliberately change and test the catalogue reader to use PostgreSQL, update
   `meta.storage` to the chosen source, and keep failures explicit. Merely setting
   `DATABASE_URL` does not switch this catalogue to Neon.

No hosted migration or import is part of this change. Credentials belong only in
the ignored project-root `.env` file locally, or in hosting environment settings.
Never put them in the public catalogue, generated JavaScript or GitHub.
