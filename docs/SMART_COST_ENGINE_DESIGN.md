# Smart Cost Engine — design for a future approved release

## User experience goal

A user should be able to type something imperfect such as `Dysn V8 absolt` and get:

> **Did you mean Dyson V8 Absolute?**

Only after the user confirms the product should FixForward look for price evidence.

## Safe architecture

```text
user brand/model
   ↓
normalisation + product resolver
   ↓
exact match? → yes → model evidence
   ↓ no
suggest likely products for user confirmation
   ↓ no confirmed product
brand + category fallback
   ↓
category fallback
   ↓
governed price evidence
   ↓
min / typical / max + evidence level + source date
```

### AI can help with

- spelling variations;
- product-name/entity resolution;
- extracting a model from messy text;
- classifying a plain-language fault description into an approved fault class;
- explaining a calculation in plain English.

### AI must not

- invent a retail price;
- invent a repair price;
- invent a lifespan;
- claim a retailer has stock without a live approved source;
- turn a category average into an exact-model price;
- make the final repair/replace decision for the user.

## Evidence levels

| Level | Meaning | UI wording |
|---|---|---|
| A | exact model + current source | “Price information for this model” |
| B | same brand + same appliance type | “Brand-level estimate” |
| C | appliance category only | “Broad appliance estimate” |
| D | evidence too weak | “Not enough price information yet” |

## Minimum price-source governance before activation

- source is permitted/approved for use;
- price has a retrieval date;
- comparable product type/capacity is recorded;
- marketplace sellers are distinguishable from retailers;
- stale links can be detected;
- enough observations exist to avoid a three-listing pseudo-market;
- source diversity is documented;
- repair cost data and replacement retail data are never conflated.

The existing weak 57-observation category snapshot is useful as a prototype artefact but not sufficient evidence for exact model-level automatic prices.
