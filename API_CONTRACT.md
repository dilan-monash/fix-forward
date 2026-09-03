# FixForward public-data API contract

The frontend works without this API while `DATA_API_CONFIG.enabled` is `false`. When the backend and database are ready, implement the four read-only endpoints below, update `baseUrl` if necessary, and set `enabled: true` in `src/config.js`.

No endpoint receives appliance selections, safety answers, costs, area selections, login details or user profiles.

## Endpoints

### `GET /api/recalls`

```json
{
  "meta": {
    "releaseVersion": "iteration-1-v1.0.0",
    "dataVersion": "recalls-2026-09-01",
    "retrievalDate": "1 September 2026"
  },
  "recalls": [
    {
      "id": "string",
      "family": "heating-simple-cooking",
      "category": "Kettle",
      "title": "string",
      "published": "string",
      "noticeUrl": "https://www.productsafety.gov.au/...",
      "identifyingNote": "string",
      "source": "ACCC Product Safety"
    }
  ]
}
```

### `GET /api/sources`

```json
{
  "meta": {
    "releaseVersion": "iteration-1-v1.0.0",
    "dataVersion": "public-data-2026-09-01",
    "retrievalDate": "1 September 2026"
  },
  "sources": [
    { "name": "string", "url": "https://...", "use": "string" }
  ]
}
```

### `GET /api/repair-evidence`

Returns the complete curated public evidence snapshot. The browser filters it by the appliance family and category already held in memory; it does not send the user's selection to this endpoint.

```json
{
  "meta": {},
  "evidence": {
    "status": "available",
    "statistics": [
      {
        "applianceFamily": "heating-simple-cooking",
        "applianceCategory": "Kettle",
        "geography": "string",
        "sampleSize": 100,
        "fixedCount": 40,
        "repairableCount": 20,
        "endOfLifeCount": 40,
        "insufficientEvidence": false,
        "confidenceLevel": "moderate",
        "limitations": "string",
        "sourceId": "string"
      }
    ],
    "barriers": [
      {
        "applianceFamily": "heating-simple-cooking",
        "applianceCategory": "Kettle",
        "barrier": "Parts unavailable",
        "occurrenceCount": 12,
        "geography": "string",
        "sourceId": "string"
      }
    ],
    "context": {
      "sampleSize": 305649,
      "geography": "string",
      "confidenceLevel": "string",
      "source": "string",
      "updated": "string",
      "limitation": "string"
    }
  }
}
```

Outcome and barrier values are raw counts. The frontend must not convert barrier counts into percentages unless the backend later supplies a documented denominator. `insufficientEvidence: true` suppresses strong interpretations.

### `GET /api/locations`

```json
{
  "meta": {},
  "locations": [
    {
      "area": "Brunswick",
      "pathway": "repair",
      "name": "string",
      "type": "string",
      "address": "string",
      "contact": "string",
      "url": "https://...",
      "verified": true,
      "verificationStatus": "verified",
      "lastVerifiedAt": "2026-09-03",
      "acceptanceEvidenceUrl": "https://..."
    }
  ]
}
```

## Failure behavior

- Non-2xx responses, timeouts and invalid response shapes automatically fall back to `src/data.js`.
- All requests use `GET`, contain no request body and use same-origin credentials only.
- The backend should not log or accept private journey data through these endpoints.
- Only rows with `verified: true`, public access and documented category acceptance may be presented as local service results. Unverified candidates remain pipeline/admin data and must not be exposed as recommendations.
