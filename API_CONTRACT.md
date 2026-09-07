# FixForward public-data API contract — v1.3 redesign

All browser journey values remain client-side. Public API endpoints are read-only `GET` routes and receive no appliance answers, safety responses, suburb/postcode searches, quotes, login details or user profiles.

## Liveness and readiness

### `GET /api/health`

Fast process liveness. This endpoint deliberately does **not** query Neon.

```json
{"status":"ok","service":"available","releaseVersion":"iteration-1-v1.3.0-redesign"}
```

### `GET /api/ready`

Checks that the public database can be queried.

```json
{"status":"ok","database":"available","releaseVersion":"iteration-1-v1.3.0-redesign"}
```

Database failures return a generic `503` without infrastructure secrets.

## Public datasets

### `GET /api/recalls`

```json
{
  "meta": {
    "releaseVersion": "iteration-1-v1.3.0-redesign",
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

### `GET /api/sources`

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.3.0-redesign"},
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

### `GET /api/repair-evidence`

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.3.0-redesign"},
  "evidence": [{
    "family":"Cleaning",
    "category":"Vacuum cleaner",
    "categoryCode":"vacuum_cleaner",
    "geography":"AU",
    "sampleSize":100,
    "fixedCount":40,
    "repairableCount":20,
    "endOfLifeCount":30,
    "unclassifiedCount":10,
    "confidenceLevel":"source field retained for provenance",
    "limitation":"Not model-specific",
    "barriers":[]
  }]
}
```

The frontend does not present `confidenceLevel` as scientific certainty. It shows sample size and explicitly states that representativeness is not established.

### `GET /api/locations`

```json
{
  "meta": {"releaseVersion":"iteration-1-v1.3.0-redesign"},
  "locations": [{
    "id":"1",
    "pathway":"repair",
    "name":"Example Repair Cafe",
    "type":"Community repair cafe",
    "address":"1 Example St",
    "suburb":"Ascot Vale",
    "postcode":"3032",
    "phone":"",
    "url":"https://...",
    "verificationStatus":"unverified",
    "verificationNote":"...",
    "sourceUrl":"https://...",
    "sourceRetrievedAt":"2026-08-31"
  }]
}
```

The browser filters area locally. It must not call this dataset a verified professional-repair directory or a genuine distance-based “nearby” service.

## Independent failure behavior

The frontend uses `Promise.allSettled()` and keeps separate availability for:

- recalls;
- sources;
- repair evidence;
- locations.

A failure in one dataset must not disable unrelated functionality. In particular, recall data failure must leave static safety screening available while preserving an explicit “recall status unknown” warning.
