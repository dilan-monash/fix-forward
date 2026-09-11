# FixForward public-data API contract — v1.6 usability-lab prototype

The data API returns read-only public/reference information behind the shared website-access gate. Except for `/api/health`, these routes require a valid signed access cookie. The browser does **not** send the user's selected goal, appliance details, safety answers, cost values, typed suburb or device coordinates to these endpoints.

v1.6 changes the browser experience, not the core public-data schema: the static landing/app definitions render first and these datasets load independently in the background.

## Website access

The Flask server protects the HTML application, its JavaScript modules and all data routes. The sign-in page, its stylesheet, the favicon and `/api/health` remain accessible before sign-in.

| Request | Behavior |
|---|---|
| `GET /login` | Password form and CSRF token; an existing valid session redirects home. |
| `POST /login` | Accepts form fields `password` and `csrf_token`; correct credentials create an access session and return `303` to `/`. Wrong password returns `401`; invalid CSRF returns `400`. |
| `GET /logout` | Authenticated confirmation page; this request does not sign the visitor out. |
| `POST /logout` | Requires a valid `csrf_token`; clears the session and returns `303` to `/login`. |
| Protected page without access | `303` redirect to `/login`. |
| Protected API without access | `401` JSON with error code `access_required`. |
| Protected request without valid server access settings | `503`; API error code `access_unavailable`. |

The password is compared on the server and never included in frontend source, responses or cookie payloads. The `fixforward_access` cookie contains signed access and CSRF state, with a four-hour absolute lifetime from sign-in. It is HttpOnly and SameSite=Lax, and Secure by default. Only local HTTP development should set `SESSION_COOKIE_SECURE=false`. Login and logout do not write to Neon or the price database. Protected responses use `Cache-Control: private, no-store` and `Vary: Cookie`.

The gate is enabled by default. An absent/empty `SITE_PASSWORD` or a `SECRET_KEY` shorter than 32 characters closes access rather than disabling protection. See [website access configuration](docs/WEBSITE_ACCESS.md).

## Liveness and readiness

### `GET /api/health`

Public Flask-process liveness. It does not require the website password and deliberately does not query Neon or prove that access settings are configured.

```json
{"status":"ok","service":"available","releaseVersion":"iteration-1-v1.6.0-usability-lab"}
```

### `GET /api/ready`

Requires website access and checks database readiness.

```json
{"status":"ok","database":"available","releaseVersion":"iteration-1-v1.6.0-usability-lab"}
```

Database failure returns a generic `503` without credentials or infrastructure detail.

## `GET /api/recalls`

Returns only manually reviewed structured recall products used by the conservative browser matcher.

```json
{
  "meta": {
    "releaseVersion": "iteration-1-v1.6.0-usability-lab",
    "dataVersion": "snapshot-version",
    "retrievalDate": "2026-09-03",
    "coverageStart": "2026-04-16",
    "coverageEnd": "2026-08-27",
    "recordCount": 1,
    "limitation": "limited coverage text"
  },
  "recalls": [{
    "id": "1",
    "recallId": "55",
    "categoryCodes": ["vacuum-cleaner"],
    "brand": "Mistral",
    "productName": "Barrel Cyclonic Vacuum Cleaner",
    "title": "notice title",
    "published": "2026-06-10",
    "noticeUrl": "https://www.productsafety.gov.au/...",
    "identifiers": [{"type":"model","value":"BVC 160","normalizedValue":"BVC160"}],
    "source": "ACCC Product Safety"
  }]
}
```

The browser must never turn category-only input, a one-character near match or an API outage into recall clearance.

## `GET /api/sources`

Returns source-register data for **About the information**.

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.6.0-usability-lab"},
  "sources": [{
    "name":"string",
    "url":"https://...",
    "licence":"string",
    "retrievalDate":"2026-09-03",
    "version":"string",
    "limitations":"string"
  }]
}
```

## `GET /api/repair-evidence`

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.6.0-usability-lab"},
  "evidence": [{
    "family":"Cleaning",
    "category":"Vacuum cleaner",
    "categoryCode":"vacuum_cleaner",
    "geography":"AU",
    "sampleSize":169,
    "fixedCount":73,
    "repairableCount":32,
    "endOfLifeCount":64,
    "unclassifiedCount":0,
    "confidenceLevel":"source field retained only",
    "limitation":"Category-level community repair history",
    "barriers":[]
  }]
}
```

v1.6 turns these counts into a three-part visual **after** the practical repair finder. It does not translate `confidenceLevel` into a scientific confidence claim and does not present category history as a model-specific repair probability.

## `GET /api/locations`

Returns public repair/recycling location fields. Coordinates allow the browser to render an in-app map and calculate straight-line distance locally.

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.6.0-usability-lab"},
  "locations": [{
    "id":"1",
    "pathway":"repair",
    "name":"Example Repair Cafe",
    "type":"Community repair cafe",
    "providerType":"repair_cafe",
    "address":"1 Example St",
    "suburb":"Ascot Vale",
    "postcode":"3032",
    "latitude":-37.77,
    "longitude":144.92,
    "phone":"",
    "openingHours":"",
    "url":"https://...",
    "verificationStatus":"unverified",
    "verificationNote":"...",
    "verificationUrl":null,
    "lastVerifiedAt":null,
    "sourceUrl":"https://...",
    "sourceRetrievedAt":"2026-08-31"
  }]
}
```

### Location privacy contract

The API never receives browser geolocation. `/api/locations` returns public service coordinates; `distanceKm()` runs in JavaScript against in-memory user coordinates. Manual suburb/postcode matching also remains client-side.

The in-app map is not loaded until there is a useful set of results to plot. Denying geolocation must leave manual suburb/postcode search usable.

### Location truthfulness contract

A card can show address, phone or opening information only when those fields are present in the imported record. It must not claim professional qualification, current opening status or appliance acceptance unless separately verified evidence supports that claim. The main card therefore tells users to call/check before travelling rather than displaying a technical verification label as the primary message.

## Independent failure behavior

The frontend uses `Promise.allSettled()` and keeps separate availability for recalls, sources, repair evidence and locations. Failure of one public dataset must not make an unrelated dataset appear unavailable.

The static first screen and static safety definitions remain usable while public datasets are still loading. A recall result initially marked unavailable can be re-evaluated when recall data arrives; service results can refresh when location data arrives without clearing a typed area.

Here, “static” describes the application assets after the server grants access. It does not mean that a public static-file deployment provides password protection.

## `GET /api/replacement-prices`

Requires website access. Returns `{ "meta": { ... }, "prices": [ ... ] }` from the reviewed local SQLite price snapshot, independently of Neon readiness. Metadata identifies the source as `reviewed-price-snapshot` and the currency as AUD. Each observation contains its appliance category, brand, model, product name, retailer, AUD price, source URL, observation date, price kind, availability and limitations.

The browser validates and matches these records locally. It does not submit the visitor's brand/model search or cost values to the endpoint. A missing or invalid snapshot returns `503` with error code `price_catalogue_unavailable`; the UI may show its explicitly labelled saved price copy. This never substitutes SQLite data for unavailable Neon recall, location, evidence or source queries.

See [price catalogue schema and maintenance](docs/PRICE_CATALOGUE.md) for the complete fields, validation and rebuild procedure.
