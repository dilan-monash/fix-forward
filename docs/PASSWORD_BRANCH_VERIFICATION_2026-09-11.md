# Password access and branch verification

Verified on 11 September 2026 for `dilan-monash/fix-forward`, branch `feature/password-and-retail-prices`.

## Result and scope

The update adds a shared website password enforced by Flask before application pages, JavaScript files and data APIs are returned. The actual password is set in the original workspace's private `.env`; it is not in the Git branch. A separate random signing key is also private. The protected local website runs at `http://127.0.0.1:5000/`.

The branch also contains the reviewed favicon, page titles, 28 dated AUD price observations across 19 appliance types, and the earlier usability fixes. See [price catalogue verification](PRICE_CATALOGUE_VERIFICATION_2026-09-11.md) and [usability findings](USABILITY_REVIEW_2026-09-11.md). This report supersedes their earlier missing-Flask and pending-repository status: Flask dependencies were installed and the full backend suite now executes.

The repository's `main` at `0101bd6` and v1.6 branch at `e9bf5ce` share `48776d6`. The new branch combines both histories. The three overlapping files (`src/app.js`, `styles.css`, `test/logic.test.js`) retain the current v1.6 implementation and main's separate overview/appliance-selection behaviour. A DOM regression check confirms Home has choices first, then appliance selection, with return navigation.

No main-branch update or production deployment is part of this branch change. Commit and remote-push identifiers are verified separately through Git; the contents of this report alone do not prove deployment.

## Password behaviour verified

- Unauthenticated application pages and direct JavaScript URLs redirect to the password form.
- Every data API, including readiness and the price catalogue, requires access. `/api/health` and the minimal login assets remain public.
- Incorrect, missing or whitespace-altered passwords do not open the website. The actual password is never echoed in the form.
- Correct entry opens Home. Login always returns to the local Home route and ignores untrusted redirect destinations.
- Login and logout require CSRF tokens. The Lock website link first asks for confirmation; confirming ends access.
- Signed access lasts at most four hours, with no extension on each request. Tampered or expired cookies and cookies issued for a different password are rejected.
- Cookies are HttpOnly and SameSite=Lax; Secure is enabled by default for HTTPS hosting. Only the private local HTTP configuration disables Secure.
- Gated responses use `private, no-store`, overriding the former public API cache policy.
- Missing access credentials or an insufficient signing key fail closed. Backend files, credentials and traversal paths remain unavailable after login.
- Internal database diagnostics bypass visitor login only inside an explicit test app instance. There is no URL, header or environment-based public bypass.

An additional defect found during review was fixed: clearing the whole anonymous session on a denied background request could invalidate a pending login form. Denied requests now remove only stale authorisation. Two regression tests cover pending login and expired-session re-entry.

## Automated validation

Commands run in the isolated Git checkout with the installed local virtual environment:

```powershell
npm.cmd run check
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py test_backend
python data/scripts/build_price_catalogue.py
git diff --check
git diff --cached --check
```

- JavaScript: **124 passed, 0 failed**. This includes 36 DOM journey checks and the new overview/selection regression.
- Python: **54 passed, 0 failed, 0 skipped**, including 20 access-gate checks and the three price API tests previously skipped.
- The first run of the added overview test inspected browser Back before its asynchronous history event completed. The test now waits for the event; the application behaviour was correct.
- Catalogue build/read-back: **28 records**, separate public SQLite snapshot and generated browser module.
- Python compilation and final Git whitespace/conflict checks are required before commit; the branch is reviewed without environment files, dependency folders, temporary scripts or private signing keys.

These tests use repository fakes for Neon-backed routes. They do not prove a live PostgreSQL connection. The original local `DATABASE_URL` remains unconfigured, and no hosted database was contacted or changed.

## Chrome walkthrough

On the real Flask server, an unauthenticated visit displayed the branded password form. An incorrect password produced an error and kept focus at the password field. The requested shared password opened Home with the FixForward title and Lock website link.

Lock website displayed its confirmation; submitting it returned to login. A subsequent direct visit to `/src/app.js` also returned to login. After signing in again, cost exploration loaded the two kettle examples through the authenticated price catalogue endpoint and retained the uncertainty guidance.

The desktop login page was visually inspected. At a requested 320-pixel viewport, browser zoom produced a measured 355 CSS-pixel viewport with no horizontal overflow; the password field was 278 pixels wide and the submit button was 48 pixels high. The mobile screenshot command timed out, so this is responsive DOM measurement rather than a physical-phone visual test. The viewport override was reset.

## Hosting configuration still required

The public GitHub source and a static port-5500/GitHub Pages copy cannot enforce this Flask gate. The intended protected site must run through Flask/Render.

For the hosted service, set `SITE_PASSWORD` privately to the agreed value, provide a stable random `SECRET_KEY`, and keep `SESSION_COOKIE_SECURE=true`. The Render blueprint declares these settings and regenerates the price database during its build. An existing service must have its environment checked and the updated branch deployed before its public URL can be claimed password protected. See [website access setup](WEBSITE_ACCESS.md).

The protected local preview, committed source and deployed website are separate verification outcomes. No deployment or live Neon claim is made here.

Implementation reference: [Flask security guidance](https://flask.palletsprojects.com/en/stable/web-security/).
