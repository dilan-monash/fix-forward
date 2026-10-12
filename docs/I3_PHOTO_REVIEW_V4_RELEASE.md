# Iteration 3 single-photo review v4 release

The previous I3 policy suppressed eight supported appliance types. The reviewed
v4 flow can offer all 19 types, and asks the person to choose when two or three
types are close. A suggestion never changes the appliance form without an
explicit confirmation. Manual selection, file preview and friendly errors remain.

The user tested the local preview and explicitly authorised deployment to
Iteration 3 on 10 October 2026. This is an experimental suggestion helper, not a
claim of perfect recognition. Recorded development evidence, including wrong
suggestions and rejected photos, is retained in `APPLIANCE_REVIEW_V4.md` and
`appliance-review-v4-evidence.json`.

## Release scope

- GitHub repository: `dilan-monash/fix-forward`, branch `iteration-3` only.
- Application: Render Python service `fix-forward-iteration-3`, service ID
  `srv-db413bij9qps73foqd50`.
- Live application: `https://fix-forward-iteration-3-r4sh.onrender.com/`.
- Single-photo classification only. No OWL detector weights, multi-item model,
  research server, training images or local test harness are included.
- Main, Iterations 1/2, Quest content, shared database and service settings are
  outside this change. Model weights, vector files and runtime binaries are
  byte-for-byte unchanged.

## How the pieces connect

The adult action page and legacy guide mount `src/photo-helper.js`. It reads
the same-origin model manifest, validates the selected file, and invokes
`classifyWithSiglipCandidate` in `src/siglip-appliance-classifier.js`. The
validated manifest selects the v4 scorer in `src/appliance-review-policy.js`.
The scorer checks the strongest appliance against unrelated-image evidence,
then returns up to three nearby types for the one pictured appliance.

The UI renders explicit type buttons. Only a confirmation calls the form's
`onConfirm` handler. Changing photos, leaving the page or choosing manually
invalidates older results. The no-store policy is checked again after inference;
revoked or changed policies must not display stale suggestions.

## Deployment verification

Pre-deployment checks on 10 October 2026: `npm.cmd run check` passed all
523 JavaScript tests; the relevant app, Quest, access, world-route and release
configuration pytest suites passed all 57 backend tests. These are functional
checks, not measurements of image-recognition accuracy.

Run the complete JavaScript check and relevant backend route/access tests from
the isolated release checkout on E:. Record the resulting commit, push only
`iteration-3`, then manually deploy that exact commit on the application service.
A GitHub push alone does not publish this Render service. Verify the deployed
commit, v4 manifest, adult photo flow and Quest route before reporting it live.
