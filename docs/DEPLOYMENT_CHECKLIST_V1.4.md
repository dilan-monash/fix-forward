# FixForward v1.4 goal-first prototype — deployment checklist

## Before push
- [ ] `npm test` passes (expected current suite: 29 tests).
- [ ] `npm run check` passes.
- [ ] `python -m compileall -q backend app.py test_backend` passes.
- [ ] `python -m unittest discover -s test_backend -v` passes in the team `.venv`.
- [ ] Review `git diff`; no `.env`, DATABASE_URL, passwords, tokens or personal coordinates are committed.
- [ ] `RELEASE_VERSION=iteration-1-v1.4.0-goal-first`.

## Scope/governance gate
- [ ] Record v1.4 as a prototype branch, not silent replacement of the approved flow.
- [ ] Decide with BA/mentor whether browser geolocation belongs in final I1 or is deferred.
- [ ] Update LeanKit/user stories/AC if the goal-first routing is approved.
- [ ] Update threat model/privacy notes for geolocation + external map dependency if approved.

## Neon/API
- [ ] Application role remains SELECT-only.
- [ ] `/api/locations` returns latitude/longitude where data provides them.
- [ ] Provider type, phone, opening hours and URL are not fabricated.
- [ ] `/api/health` returns quickly.
- [ ] `/api/ready` confirms database readiness.

## Map/geolocation
- [ ] Browser asks location permission only after button click.
- [ ] Denying permission leaves manual suburb/postcode search usable.
- [ ] Network inspection shows coordinates are not sent to FixForward/Neon.
- [ ] 5/10/25/50 km filters update results.
- [ ] Provider-type filter updates repair results.
- [ ] Results are sorted nearest-first in geolocation mode.
- [ ] Leaflet CDN loads with SRI; CSP permits only the intended CDN/map assets.
- [ ] Map failure leaves the text service list usable.
- [ ] OpenStreetMap attribution is visible.
- [ ] Tile requests carry a valid browser Referer/origin; do not switch the final site back to `Referrer-Policy: no-referrer`.

## Safety journeys
- [ ] Mistral BVC 160 → possible recall + official notice.
- [ ] BVC 161 → not exact; near warning only.
- [ ] Burning/smoke Yes → stop-use; no community Repair Café.
- [ ] Caution/unsure → assessment guidance; no cost/community shortcut.
- [ ] Recall endpoint failure → safety questions still work.
- [ ] Repair/Compare/Recycle goals route directly to the chosen tool only after clear gate.

## Usability
- [ ] New user can explain “product recall” in their own words after seeing the page.
- [ ] No primary service card says “dataset” or leads with “unverified.”
- [ ] Service card shows practical fields first: where / call / directions / hours if available.
- [ ] Mobile 360/390 px and tablet/desktop tested.
- [ ] Keyboard-only journey tested.
- [ ] 200% zoom tested.
- [ ] Browser Back and dedicated Back tested.

## Cost boundary
- [ ] No automatic dollar value is shown without a governed source.
- [ ] AI/fuzzy language never claims AI created the price.
- [ ] Manual fallback validates positive numeric values and remains neutral.

## Render preview
- [ ] Deploy feature branch/preview before main.
- [ ] Cold start has loading UI, not blank content.
- [ ] Check security headers over HTTPS.
- [ ] Test map, geolocation permission, directions link and data partial-failure behavior on HTTPS.
