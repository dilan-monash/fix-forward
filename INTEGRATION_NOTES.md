# FixForward v1.3.0 redesign integration notes

This candidate is a deliberate redesign based on the 4 September teaching-team feedback, usability-test observations and the live-release audit. It changes user experience, decision logic and deployment behavior while preserving the existing data pipeline and read-only backend model.

## Key compatibility decisions

- No account, upload, OCR, barcode, analytics or saved journey history was added.
- Existing Neon data schema/migrations are preserved; the redesign does not invent new production datasets.
- Recall matching remains category-scoped and exact-model based, but model matching now occurs before brand confirmation so a brand-text variation cannot hide an exact identifier.
- Safety behavior changed intentionally: warning rules now distinguish critical vs caution signals and appliance applicability.
- Recall endpoint failure no longer blocks static safety screening.
- High-risk/uncertain pathways never reuse community Repair Cafe results as professional assessment.
- Cost comparison remains a transparent manual fallback until a governed retail benchmark dataset is available.

## Deployment behavior

- `render.yaml` now identifies `iteration-1-v1.3.0-redesign` and sets an explicit Gunicorn worker/thread/timeout configuration.
- `/api/health` is liveness only.
- `/api/ready` verifies Neon.
- Public API responses use short caching to reduce repeated database pressure.
- Server errors record safe path/type context while generic client messages remain unchanged.

## Review before merge

Use `docs/DEPLOYMENT_CHECKLIST_V1.3.md` and do not merge directly to production without a preview/staging walkthrough. The Node suite proves decision/UI contracts, but it does not prove Render cold-start behavior, Neon concurrency, mobile rendering or live accessibility.
