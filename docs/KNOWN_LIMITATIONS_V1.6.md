# FixForward v1.6 — Known Limitations

This document is deliberately explicit. A prototype limitation should be visible to the team rather than hidden behind a polished interface.

## Recall coverage

- The product-specific reviewed recall index remains very small.
- Exact BVC 160/BVC 165 examples demonstrate the matching logic; they do not represent complete Australian recall coverage.
- No indexed match is never proof that a product is not recalled.
- Brand/model absence reduces product-specific matching.
- Official Product Safety/ACCC recall information remains authoritative.

## Safety

- The questionnaire is warning-sign triage, not diagnosis.
- A user may misunderstand or fail to notice a sign.
- A clear questionnaire result does not prove the appliance is safe.
- Goal-specific question limits are a UX experiment and must be reviewed against the safety acceptance criteria.
- Caution-level cost planning and controlled hazard-disposal planning are scope changes requiring approval.

## Repair evidence

- Open Repair Alliance outcomes describe recorded community-repair attempts and can use broader categories than the exact FixForward appliance category.
- They are not a probability that the user's exact model can be repaired.
- Self-selected repair-event data has representativeness limits.

## Repair/service locations

- Public/imported service records may be incomplete or stale.
- Phone, hours, website and appliance-acceptance fields are displayed only when present; absence cannot be repaired by invention.
- A location record does not prove a provider is licensed/qualified for a hazardous appliance unless a source establishes that.
- Community Repair Cafés are intentionally excluded from caution/high-risk professional-assessment contexts.
- Distance is straight-line approximation, not driving time.

## Suburb/postcode autocomplete

- Suggestions come from the project's cleaned Melbourne-area index, not a live authoritative Australia Post autocomplete service.
- Coverage is intentionally prototype/Melbourne-focused.
- Postcode/suburb boundaries and names can change; source/version governance remains required.

## Geolocation

- Optional browser geolocation is a prototype scope change relative to the earlier manual-only I1 requirement.
- Coordinates are kept in application memory and not sent to Neon, but the browser/OS and map provider can still process normal technical/location-related network information.
- Permission can be denied or time out; manual search remains required.

## Map

- Leaflet/OSM is a third-party dependency.
- The app has an eight-second script timeout and keeps the text list, but map tiles can still be slow, blocked or unavailable.
- Production traffic must comply with the chosen tile provider's terms and capacity expectations.

## Cost helper

- v1.6 is not an automatic exact repair quote system.
- The entered model is not verified against a governed price catalogue.
- The problem classifier is deterministic keyword grouping, not diagnosis and not AI.
- National Appliance Repairs and One Touch pricing are commercial published examples from different service models. They are shown separately and must not be treated as one market range.
- Parts, travel, extra labour and appliance eligibility can change final repair cost.
- No approved/current model-level replacement-price feed is connected.
- The old weak three-observations-per-category snapshot is not used as a trustworthy model market benchmark.
- A real automatic cost engine requires source permission, freshness, comparability, model/entity resolution and governance.

## Privacy

- No accounts or saved journey history are implemented.
- Journey data is held in browser memory, but normal hosting/map network logs can still exist outside FixForward's application storage.
- Do not claim absolute “no tracking/no logging” without reviewing hosting/CDN/provider behavior.

## Security testing

- Automated tests are not a penetration test.
- The exact preview/live release still needs safe external testing, dependency review, response-header verification and DB-role evidence.
- Full Flask suite must be rerun in the team's normal `.venv` for this exact candidate.

## Usability evidence

- Automated/browser-flow heuristic checks are not human-participant usability testing.
- The team still needs observed participant sessions, notes, consent/process evidence, issue prioritisation and retesting.

## Scope/governance

The following are experimental until explicitly approved:

- goal-first journey;
- geolocation;
- goal-specific safety depth;
- Not sure continuation semantics;
- caution-cost planning;
- hazard-disposal planning;
- local autocomplete;
- smart cost helper and commercial price references.

LeanKit, PGP, user stories, security criteria and diagrams must be updated together if these are accepted.
