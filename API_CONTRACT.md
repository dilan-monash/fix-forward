# FixForward public-data API contract — v1.4 goal-first prototype

The API returns read-only public/reference information. The browser does **not** send the user's selected goal, appliance details, safety answers, cost values, typed suburb or device coordinates to these endpoints.

## Liveness and readiness

### `GET /api/health`

Fast Flask-process liveness. It deliberately does not query Neon.

```json
{"status":"ok","service":"available","releaseVersion":"iteration-1-v1.4.0-goal-first"}
```

### `GET /api/ready`

Checks database readiness.

```json
{"status":"ok","database":"available","releaseVersion":"iteration-1-v1.4.0-goal-first"}
```

Database failure returns a generic `503` without credentials or infrastructure detail.

## `GET /api/recalls`

Returns only manually reviewed structured recall products used by the conservative browser matcher.

```json
{
  "meta": {
    "releaseVersion": "iteration-1-v1.4.0-goal-first",
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

## `GET /api/sources`

Returns source register data for the expandable **About the information** area.

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.4.0-goal-first"},
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
  "meta": {"releaseVersion":"iteration-1-v1.4.0-goal-first"},
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

The UI does not translate `confidenceLevel` into a scientific “high confidence” claim.

## `GET /api/locations`

v1.4 adds coordinates and optional practical service fields so the browser can render an in-app map and calculate distance locally.

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.4.0-goal-first"},
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

The API never receives browser geolocation. `/api/locations` returns public service coordinates; `distanceKm()` runs in JavaScript against the user's in-memory coordinates. Manual suburb/postcode matching also remains client-side.

### Location truthfulness contract

A card can show address/phone/opening hours only when those fields are present in the imported record. It must not claim professional qualification, current opening status or appliance acceptance unless separately verified evidence supports that claim.

## Independent failure behavior

The frontend uses `Promise.allSettled()` and keeps separate availability for recalls, sources, repair evidence and locations. Failure of one public dataset must not make an unrelated dataset appear unavailable.
