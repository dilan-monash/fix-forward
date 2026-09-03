# Location verification policy (Iteration 1)

## The distinction this policy exists to protect

A **dataset URL** says where a record was imported from. **Facility verification**
means somebody opened a page about that specific place and checked a specific
fact, on a specific date. These are different things, and merging them lets the
product claim it verified 729 locations when it verified none.

Earlier, all 729 rows held a `verification_url`: 663 the DataVic package page,
66 the OpenStreetMap copyright page. Those values now live in `source_url`.

| Field | Meaning | Current state |
|---|---|---|
| `source_url` | The dataset the row was imported from | 729 of 729 |
| `source_retrieved_at` | When that dataset was downloaded | 729 of 729 |
| `verification_url` | A page about **this facility**, actually checked | 0 of 729 |
| `last_verified_at` | The date that page was checked | 0 of 729 |
| `verification_status` | `unverified`, `partially_verified` or `verified` | 729 `unverified` |
| `verification_notes` | What the source establishes, and what it does not | 729 of 729 |

**Facility-level verification is 0%.** That is the honest figure, and it is not
treated as a test failure.

## Rules

1. Never invent acceptance or public access. Absence of information is
   `unknown`, never `false`.
2. Never infer public access from a facility type such as "transfer station",
   from a provider type such as "repair shop", or from coordinates.
3. A `verification_url` may only be set when a person has opened a
   facility-specific page and recorded the date. A business website listed in
   OpenStreetMap is a lead, not evidence; 21 locations have one, and all 21
   remain `unverified`.
4. `household_electrical_relevant = TRUE` means the facility is on the browsing
   shortlist (transfer stations and e-waste reprocessors). It is not a claim
   that anything is accepted.
5. Appliance acceptance is per location **and** per category, in
   `location_appliance_acceptance`. A missing row means unknown. `confirmed`
   and `not_accepted` are both rejected by the database unless they cite
   evidence with a date.

## Eligibility is derived, never stored

The `recommendation_eligible` column has been dropped. A stored boolean can be
set true by any careless `UPDATE`; a view cannot. Use:

- `verified_location_recommendations` — locations the app may recommend.
- `unverified_location_candidates` — everything else, which must carry the
  disclaimer.

A location reaches the recommendation view only when all of the following hold:
the facility is household-electrical relevant, the specific appliance category
is `confirmed` accepted, public access is `TRUE`, and both `verification_url`
and `last_verified_at` are present.

**`verified_location_recommendations` currently returns 0 rows.** This is the
correct result, not a bug. The regression suite includes a positive control
that inserts fully evidenced data and asserts the view returns it, so the empty
result reflects missing evidence rather than a broken query.

## Required wording in the app

Every location outside the recommendation view must be shown as:

> Potential nearby service. Acceptance and public access have not been verified.
> Check before visiting.

Never present these as confirmed drop-off or repair options.

## Why no location can currently be verified for free

Neither source publishes per-facility acceptance:

- **DataVic** exposes ten fields (name, owner, facility type, infrastructure
  type, address, suburb, LGA, latitude, longitude, id). The package offers three
  date-versioned snapshots of that same shape. There is no accepted-materials,
  opening-hours, fee or public-access field.
- **OpenStreetMap** has one `repair=` tag across 70 elements and no
  `recycling:*` tags at all. Fourteen elements carry `opening_hours`.

Raising verification above 0% requires someone to check council and operator
pages by hand and record the URL and date. That is manual work, not a data
problem this pipeline can solve.

## What is filled, and from where

| Field | Source | Coverage |
|---|---|---|
| `postcode` | Join on suburb against ABS `suburb_postcodes` | 678 of 729 |
| `provider_type` | Classified from `facility_type` and OSM labels | 729 of 729 |
| `opening_hours` | Only when OpenStreetMap tags it | 14 of 729 |

Appliance acceptance and public access are **not** columns on `locations`.
They live in `location_appliance_acceptance`, which currently has 0 rows
because no free source publishes them.
