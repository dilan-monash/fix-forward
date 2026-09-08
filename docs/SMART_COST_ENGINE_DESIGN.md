# FixForward Smart Cost Engine — v1.6 design and evidence boundary

## Purpose

The desired experience is fast and simple:

> Enter what the appliance is, describe what is wrong, and get useful repair-versus-replacement cost context without manually researching five websites.

The interaction is inspired by products such as **Appliance911.ai**, which presents a low-friction repair-or-replace flow from appliance identification and cost/reliability information. FixForward must not imply it owns or can reproduce Appliance911's proprietary model database, image-recognition pipeline, reliability data or exact recommendation logic.

Reference reviewed 7 September 2026: `https://www.appliance911.ai/`

## What v1.6 actually implements

The v1.6 usability-lab candidate implements the **experience shell and evidence rules**, not a complete AI price estimator.

```text
brand / model / appliance type
          +
plain-language problem description
          ↓
input validation
          ↓
product evidence level
          +
simple deterministic problem grouping
          ↓
show only source-supported cost signals
          ↓
optional real repair quote + replacement-price comparison
```

### Product evidence level

If the user enters both brand and model, v1.6 does **not** say the model has been found in a price database. The user sees that the model was entered but is **not price-verified**, so current cost context falls back to brand + appliance type.

This is intentional. A wrong, misspelled or unsupported model must not create a fake exact estimate.

Future levels should be:

| Level | Required evidence | User wording |
|---|---|---|
| A | confirmed exact model in an approved current product catalogue | Price information for this model |
| B | confirmed brand + same appliance type | Brand + appliance estimate |
| C | appliance type only | Broad appliance estimate |
| D | evidence too weak | Not enough trustworthy price information yet |

A model string typed by a user is **not Level A by itself**.

## Current v1.6 published cost signals

The usability lab includes two public commercial pricing examples so the automatic-result screen can be tested with real source links. They are deliberately shown as **separate signals**, not one artificial repair-price range.

### Signal 1 — small-appliance workshop

National Appliance Repairs publishes:

- AUD 99 drop-off inspection/diagnosis for standard small appliances;
- AUD 198 pick-up inspection/diagnosis;
- return delivery, extra labour and parts separately quoted after assessment.

Reference reviewed 7 September 2026:  
`https://www.nationalappliancerepairs.com.au/small-appliance-repairs/`

### Signal 2 — Melbourne mobile service

One Touch Appliance Repairs publishes:

- AUD 129 call-out/diagnostic service;
- total labour including the call-out capped at AUD 229 when repair proceeds;
- parts quoted separately.

Reference reviewed 7 September 2026:  
`https://1touchappliancerepairs.com.au/services/`

### Why these figures are not combined

These are different service models and scopes. The first is a standard-small-appliance workshop inspection/pick-up fee. The second is a Melbourne mobile appliance service with a published call-out/labour structure. Treating `$99–$229` as though it were a statistical market repair range would be misleading.

Therefore v1.6 shows two labelled examples and says:

> These prices come from different service models, so we do not combine them into one fake repair-cost range.

They are **not** approved open-data market evidence and **not** an exact quote for the user's appliance.

## Replacement-price boundary

The v1.6 candidate intentionally shows:

> **Not enough verified price evidence yet.**

The existing old 57-observation / three-observations-per-category snapshot is too weak and concentrated to support a trustworthy model-level market price. The application therefore does not invent a replacement value simply to make the UI look complete.

A future replacement-price source must establish:

- permitted collection/API/licensing method;
- retrieval timestamp;
- exact product identity or documented comparable-product rules;
- retailer versus marketplace seller distinction;
- retailer diversity;
- geography/currency/tax treatment;
- stale-link/price checks;
- enough observations for the claimed evidence level.

The proposal's no-web-scraping boundary remains in force unless formally changed. Do not turn a search-engine result page into an undocumented scraping pipeline.

## Future resolver

A production candidate could support:

```text
User types:  "Dysn V8 Absolut"
               ↓
normalisation / candidate resolver
               ↓
Did you mean "Dyson V8 Absolute"?
      ├─ user confirms → exact product ID may be used
      └─ user rejects  → brand/category fallback
```

Possible approved resolver inputs:

- manufacturer product catalogue/API;
- licensed/open product catalogue;
- governed retailer/provider API;
- manually reviewed product-alias table;
- AI/entity-resolution service used only to rank candidates for user confirmation.

## AI role

AI can help with:

- spelling variations;
- product-name/entity resolution;
- extracting a model from messy user text;
- grouping a plain-language fault description into an approved fault class;
- summarising evidence in plain English.

AI must **not**:

- create a price because no price source exists;
- invent a retailer, provider, stock status or quote;
- claim an entered model was found when it was not verified;
- turn a category figure into an exact-model estimate;
- diagnose an electrical fault;
- choose repair/replace for the user as if it were certain.

Dollar values must be traceable to a source record or to values explicitly entered by the user.

## Proposed future data model

### Product identity

```text
product_catalogue
- product_id
- appliance_category
- brand
- model
- aliases
- source_owner
- source_url
- source_date
- licence_or_permission
- reviewed_at
```

### Repair cost evidence

```text
repair_cost_observation
- observation_id
- appliance_category
- brand nullable
- model nullable
- fault_class nullable
- service_type
- assessment_fee nullable
- labour_fee nullable
- parts_included boolean
- total_repair_cost nullable
- geography
- source_owner
- source_url
- observed_at
- evidence_level
```

### Replacement price evidence

```text
replacement_price_observation
- observation_id
- product_id nullable
- appliance_category
- brand
- model
- comparable_group
- retailer
- marketplace_seller nullable
- price_aud
- delivery_included boolean
- observed_at
- source_url
- source_permission
```

## Decision output

Even after good data exists, the UI should separate:

1. **What we know** — product match/evidence level.
2. **Repair cost evidence** — source, date, inclusions/exclusions.
3. **Replacement price evidence** — source, date, comparable-product rule.
4. **Difference** — transparent arithmetic.
5. **Other factors** — recall/safety/repairability/waste, without pretending money alone decides.

A recommended sentence is:

> Repair is the lower upfront amount using the evidence shown, but that does not automatically make it the better choice.

## Acceptance gate before calling it “automatic repair/replacement estimation”

Do not use that claim in mentor/demo material until all of the following are true:

- exact/current approved product data source exists or fallback level is clearly labelled;
- repair-cost evidence is appropriate for the appliance/service type;
- replacement-price evidence has adequate comparability and source diversity;
- source dates and limitations are displayed;
- no scraping/licensing conflict exists;
- model misspellings are confirmed by the user before exact-model use;
- unit tests and realistic false-match tests pass;
- live data failure produces “not enough information,” not a fabricated estimate;
- BA/mentor approves the feature's iteration scope;
- security/privacy review covers any external AI/API calls.

Until then, v1.6 should be described as a **smart cost check prototype with source-linked pricing examples and a real-price comparison fallback**.
