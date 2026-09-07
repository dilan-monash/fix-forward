# FixForward v1.3 Redesign - Deployment Checklist

## Before push
- [ ] `npm test` passes.
- [ ] `node --check src/app.js src/logic.js src/data-service.js` (run individually) passes.
- [ ] Python files compile (`python -m compileall backend app.py`).
- [ ] Review diff; confirm no `.env`, DB URL, passwords or tokens are committed.
- [ ] Confirm `RELEASE_VERSION=iteration-1-v1.3.0-redesign`.

## Neon
- [ ] Application role remains SELECT-only.
- [ ] Existing migrations are present; no destructive migration is introduced by this redesign.
- [ ] Capture a redacted screenshot of roles/branch for PGP Backup & Recovery evidence.
- [ ] Document point-in-time restore / branch rollback procedure and test it on a non-production branch.

## Render
- [ ] Deploy to preview/feature branch first.
- [ ] `/api/health` returns process liveness quickly even if Neon is slow.
- [ ] `/api/ready` returns database readiness.
- [ ] Confirm HTTPS and security headers.
- [ ] Inspect safe logs for request path/failure class without secrets.

## Live smoke journeys
- [ ] Cold page load shows loading UI immediately.
- [ ] Category list remains locked until family selected.
- [ ] Vacuum Cleaner + Mistral + BVC 160 -> exact model identifier found.
- [ ] BVC 161 -> not exact; near-match warning only.
- [ ] Recall API failure -> safety screening still available.
- [ ] Burning/smoke Yes -> critical guidance; no Repair Cafe result.
- [ ] Heat Yes only -> assessment recommended, not identical to fire/shock result.
- [ ] `3032` repair search -> if data exists, cards render in FixForward with verification labels.
- [ ] Unknown area -> no invented provider.
- [ ] Cost errors focus the first invalid input.
- [ ] Browser Back returns through FixForward steps rather than unexpectedly leaving.

## Accessibility/mobile
- [ ] Keyboard-only walkthrough.
- [ ] 200% zoom.
- [ ] 360x800 mobile viewport.
- [ ] Dynamic location result announcement with screen reader.
- [ ] External links communicate new-tab behavior.

## Mentor evidence
- [ ] Before/after landing screenshots.
- [ ] High-risk no-Repair-Cafe screenshot.
- [ ] Partial API failure screenshot/video.
- [ ] Test output attached.
- [ ] Teaching feedback register updated from Implemented -> Closed only where evidence exists.
