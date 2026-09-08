# FixForward v1.5 — Known limitations

1. This is a non-final UX prototype; goal-specific safety depth and geolocation are scope changes requiring team/mentor approval.
2. Recall coverage is intentionally limited and cannot provide recall clearance.
3. Service listings may be incomplete/out of date; provider qualification, appliance acceptance, phone and opening hours are shown only when source data provides them.
4. Manual suburb search is area matching, not a true nearest search unless device coordinates are used.
5. Straight-line distance is not travel distance.
6. Leaflet/OpenStreetMap are third-party dependencies; the list remains usable if the map fails.
7. Repair-history statistics are category-level community-event history, not model-specific repair probability.
8. Automatic brand/model repair and replacement pricing is not enabled because governed model-level price evidence is insufficient.
9. No image recognition, OCR, barcode scanning, account, saved history or payment feature is included.
10. Exact device location is optional and held only in browser memory by FixForward, but normal infrastructure/map requests still expose ordinary network metadata to service providers.
11. The packaging environment did not have Flask/psycopg, so the complete Flask suite must be rerun in the project's local `.venv`.
12. Automated contract tests do not replace observed usability testing, mobile visual inspection, keyboard testing or screen-reader testing.
