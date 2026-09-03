# FixForward v1.2.0 integration notes

## Purpose

This release combines the latest team GitHub snapshot with the separately developed Flask/public-data integration. It is intended for review on a feature branch before any production merge.

## Preserved from the latest team snapshot

- The full `data/` directory, source snapshots, import/quality scripts and data documentation.
- The clearer invalid-cost messages for missing, negative, non-numeric, zero and over-precision values.
- The expanded presentation of historical repair outcomes, barriers and evidence coverage.
- Existing responsive, accessibility and safety-questionnaire work.

## Added or restored by the integration

- Flask application factory, API routes, database repository and safe transformations.
- Same-origin frontend/API deployment using Gunicorn.
- Optional brand and exact model input.
- Manually reviewed recall-product and identifier tables.
- Category-only and brand-only insufficient-information results.
- Exact normalized model matching without fuzzy or partial matching.
- Fail-closed handling when public data is unavailable.
- Read-only role/migration instructions, backend tests, learning guide, security-plan draft and AI-use acknowledgement.

## Important review points

- Do not replace exact-model matching with family/category matching.
- Do not reintroduce a static recall or provider fixture as a production outage fallback.
- Do not describe an unmatched search as proof that a product is not recalled.
- Do not describe imported location records as verified providers or confirmed appliance acceptance.
- Keep user appliance, warning, area and cost values in browser memory; the API remains GET-only.

## Contribution record

The student must update the final contribution log using team evidence. The GitHub uploader is not automatically the author of every file in the snapshot. Record Haochen's frontend contribution, Dilan's database/data work, and the student's own review/integration/testing changes accurately.
