# FixForward cost evidence and replacement-price catalogue

Updated 11 September 2026. This document describes the implemented catalogue and its limits. See the [current verification report](PRICE_CATALOGUE_VERIFICATION_2026-09-11.md) for final test results and browser checks.

## Purpose and scope

Help a household compare a repair quote with a replacement price, identify relevant retail examples, and prepare useful questions for a repairer.

The user reported that their mentor allowed the project to create its own database. This update implements that permission through a reviewed public price catalogue. It does not require a new scope-confirmation step to build the catalogue.

Earlier design work used Appliance911.ai as inspiration for reducing effort. FixForward's implementation uses its own reviewed public observations and deterministic matching; it does not reproduce another service's proprietary database or add an external AI service.

## Current journey

```text
Appliance type + optional brand and model
                    |
          Appliance safety / recall check
                    |
      Cost comparison, when the route permits it
          |                        |
  Enter a repair quote      Browse recorded retail examples
          |                        |
          |                Explicitly choose a price
          |                        |
          +-------- Compare the two amounts --------+
                    |
      Lower upfront amount, with other factors explained

Optional problem description -> summary + questions for a repairer
                                (does not change either price)
```

Uncertain safety answers can retain cautious cost exploration. Serious warnings and possible recalls continue to restrict ordinary cost routes; a delayed price response cannot override those restrictions.

The comparison form is followed by recorded retail examples and an optional expandable section containing inspection-fee examples. Describing a problem is optional.

## Product matching

Price matching happens in the browser, within the selected appliance category. Complete normalised identifiers are compared; partial model text is never accepted as an exact match.

| Evidence found | Displayed label | What it means |
| --- | --- | --- |
| Same complete brand and model in the selected type | Same brand and model | A source observation matches those identifiers; the user must still check variant and specifications. |
| Same brand and type, different model | Same brand · different model | A brand example with potentially different size or features. |
| Same type, different or unspecified brand | Same appliance type | A broad category example, not a model-specific value. |
| No observations for the selected type | No recorded examples for this appliance type yet | Manual comparison remains available; unrelated appliances are not substituted. |

A model supplied without its brand, or the same model text with a different brand, does not produce an exact retail match. Retail-price matching and conservative product-recall matching are separate rules.

These labels describe the match to the catalogue. They do not measure an appliance's reliability, predict remaining service life, prove repairability or establish electrical safety.

## Selecting and comparing a price

A retail card identifies the product, brand/model, retailer, full AUD amount, source URL and review date. Notes preserve relevant promotions, cached-source limits and differences in capacity or appliance format. The interface explains that delivery, installation and other charges may be extra and stock is not confirmed.

No matching price is inserted automatically. Selecting a card's price:

1. Fills the replacement amount only.
2. Preserves the repair quote.
3. Removes any comparison calculated from the previous amount.
4. Adds a note naming the recorded product, retailer and review date.
5. Moves focus to the replacement field for review.

Editing the replacement amount clears its retailer attribution. Editing either amount clears the old comparison. A confirmed free repair is valid as zero; replacement must be greater than zero. The result presents the difference in upfront cost without recommending repair or replacement.

Observations older than 90 days and records marked out of stock remain visible as context but have no button to insert their price. The 90-day rule is a display safeguard, not a guarantee that newer prices are still offered. Readers must check the retailer for the current total.

## Problem descriptions and inspection fees

An optional description is grouped into power, heat, noise, water, battery or general topics. This produces a plain-language summary and questions for a repairer. For example, a charging issue can prompt the user to ask whether a repairer handles that battery type. It does not diagnose a component, alter inspection fees or generate an exact repair cost. Users are told to describe only what they already noticed.

The inspection-fee section preserves two separately labelled provider examples recorded on 7 September 2026:

| Provider | Recorded amounts | Limit |
| --- | --- | --- |
| [National Appliance Repairs](https://www.nationalappliancerepairs.com.au/small-appliance-repairs/) | AUD 99 drop-off inspection; AUD 198 pick-up inspection | Additional labour, parts and delivery may be quoted separately. Confirm service coverage and the current total. |
| [One Touch Appliance Repairs](https://1touchappliancerepairs.com.au/services/) | AUD 129 call-out; stated AUD 229 labour cap including call-out | Parts separate; coverage and current fee need confirmation with the provider. |

These are different service models. They are not combined into a market repair-price range and do not become a personalised quote when a brand, model or problem is entered. The user needs an actual quote for their appliance.

## Price observations and evidence limits

The catalogue draws on manually reviewed official Australian retailer pages. See the [initial source register](../data/catalogue/SOURCES.md) and [additional source register](../data/catalogue/ADDITIONAL_SOURCES.md) for included observations, retrieval limitations, conflicting prices and exclusions.

Each input record contains:

```text
id
categoryCode
brand
model
productName
retailer
priceAud
currency = AUD
sourceUrl
observedAt
priceKind = advertised
availability = not-verified | in-stock | out-of-stock
notes
```

`observedAt` means the source was reviewed on that date. It is not a retailer price-change timestamp. Cached pages are documented, conflicting or expired amounts are excluded from the active examples, and checkout availability is not inferred from an Add to Cart button.

The dataset is a small curated sample. It is not a live retailer feed, a complete market survey, a historical price database or evidence of a price trend. Repeated reviews in future must retain real dates; they must not manufacture a past price series from ticket prices, discounts or conflicting snapshots.

Only full advertised AUD purchase amounts are stored. Instalment amounts, conditional price-beat promises, cashback and assumed discounts are not substituted for the purchase price. A broad appliance category may contain different formats; a hand mixer or steam mop is not necessarily an equivalent replacement for every product in its category.

## Storage and API

```text
data/catalogue/*-observations.json + source notes
                    |
        validate and build public snapshot
                    |
          +---------+----------+
          |                    |
replacement-prices.sqlite   src/price-snapshot.js
          |                    |
Flask opens read-only       labelled saved copy
          |                    |
GET /api/replacement-prices ----+----> browser validates and matches
```

Build from the project root:

```powershell
python data/scripts/build_price_catalogue.py
```

The builder uses Python's standard library, validates each observation, checks duplicates, dates, currency and retailer URLs, stores amounts as integer cents and reads the built database back for verification. The SQLite schema includes `replacement_price_observations`, indexes for category/brand/model and date, and `replacement_price_catalogue_meta`. Snapshot metadata includes the schema version, record count, date bounds, content hash and `livePrices: false`.

Flask opens `data/catalogue/replacement-prices.sqlite` in read-only mode and verifies its metadata. A missing or invalid file yields an unavailable response; web requests do not create an empty database. Generate the public snapshot during deployment as well as local setup.

The price request is lazy and bounded. If it succeeds, the interface states that the catalogue loaded while preserving the warning that prices are dated observations. If the request fails or its payload is invalid, the interface explicitly labels the bundled saved copy. If neither is valid, manual entry remains available. A price refresh updates the catalogue section without overwriting the user's entered amounts.

## Separation from the main PostgreSQL database

The public SQLite catalogue is an independent reference store. It does not replace the existing Neon recalls, sources, repair evidence or service-location datasets when PostgreSQL is unavailable. It stores no journey answers, quotes, model searches or user location.

The private local `.env` in this workspace is prepared with `DATABASE_URL=` left blank. Put the application's SELECT-only PostgreSQL URL after the equals sign and restart Flask. A fresh checkout should copy the placeholder `.env.example` to its ignored `.env` first. Shell and hosting environment variables take precedence. Do not put the URL in frontend code or version control.

The price catalogue requires no database URL. A successful `/api/replacement-prices` response or visible saved price card says nothing about Neon readiness. Check `/api/ready` and the actual main dataset routes, or run `python -m backend.check_database`. See the [connection guide](DATABASE_CONNECTION_CHECK.md).

## Validation and release checks

The [current verification report](PRICE_CATALOGUE_VERIFICATION_2026-09-11.md) is the source for final test totals and any unverified behavior. Tests cover source-data validation and storage, complete-versus-partial matching, explicit selection, attribution removal after manual edits, delayed responses, saved-copy labels, stale/out-of-stock examples, safety restrictions and title/reset behavior.

Before publishing a combined GitHub update, rebuild the catalogue and rerun the suite in the destination checkout. Before calling the deployed site connected, verify that exact origin and its required dataset routes. Expert walkthroughs and automated DOM tests do not replace real-parent usability sessions.

Current supported description:

> FixForward offers recorded retail-price examples, general inspection-fee context and a comparison using amounts the user chooses.

Broader claims such as automatic repair-cost prediction, market-wide replacement pricing, price-history trends or brand reliability would require additional evidence and implementation. Neither a source link nor a larger row count establishes those capabilities by itself.
