# Public Main and protected review-site access

## Main public release, 12 October 2026

The user approved publishing the reviewed I3 family site on `fixforward.me` for everyone. This Main branch therefore sets `SITE_ACCESS_ENABLED=False` internally in the application factory. It is a source-level release decision, not a URL, header or environment bypass. Main opens Home, Learn, Explore, Decide, the film and read-only public-data APIs without a visitor password or access cookie. Old login and logout links safely return to a current page, and the footer no longer offers Lock website. Missing team-password credentials do not prevent this intentionally public release from opening.

Only the approved runtime files and model artifacts are served. Private files, unsupported write methods and retired `/quest` and `/legacy` paths remain blocked; the retired paths return HTTP 404. Trusted hosts are Main's two custom domains and original Render hostname, plus local review addresses. CSP, model integrity, generic errors and read-only Neon access remain enabled. No authentication-store reads or writes are needed for public requests. Browser learning records stay on the visitor's device.

The `iteration-3` branch and review service retain their password gate. The retained optional gate in Main has its own cookie name/audience and is covered by protected-app regression tests; production Main does not use it. The historical setup and evidence below describe protected deployments and do not mean that this approved public Main release needs a password. Main publishing requires a manual deployment and live verification, separately from committing or pushing.

## Protected review-site password setup

FixForward asks visitors for a shared website password before serving the application. The check runs in Flask, protecting the HTML, application JavaScript and data APIs. It does not require an individual account or store the visitor's appliance answers.

The actual shared password is configured privately. It is not included in this document, frontend code, committed examples or the GitHub branch.

## Where to configure each value

| Setting | Purpose | Local `.env` | HTTPS hosting |
|---|---|---|---|
| `SITE_PASSWORD` | Shared password visitors enter | Set privately | Set privately in service environment settings |
| `SECRET_KEY` | Signs access and CSRF cookie state | Random value of at least 32 characters | Generated random value; the Render blueprint generates one |
| `SESSION_COOKIE_SECURE` | Restricts cookie transmission to HTTPS | `false` only for local HTTP testing | `true` |
| `DATABASE_URL` | SELECT-only Neon/PostgreSQL connection | Set privately when available | Set privately; independent of visitor access |

On the protected I3 branch, website access is enabled by default. Missing or invalid password/signing-key settings produce an access-unavailable response; they do not open the application to visitors. The public `/api/health` route still responds so the host can check process liveness.

## Local website

The original workspace has a private, ignored `.env` prepared with local access settings. In a fresh checkout, copy `.env.example` to `.env`, fill in the private settings, and generate a signing key once:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Put that generated value after `SECRET_KEY=` in the private `.env`. Do not commit it. Use `SESSION_COOKIE_SECURE=false` only while testing the local HTTP server. Environment variables already set by the shell override `.env` values.

Start Flask from the project folder:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000/` and enter the shared password. On this workspace's MSYS2 environment, use `.\.venv\bin\python.exe` instead of `python`; a standard Windows virtual environment uses `.\.venv\Scripts\python.exe`.

A blank `DATABASE_URL` does not prevent sign-in or the reviewed local price catalogue. The Neon-backed reference routes will report unavailable until the connection is configured. See [database connection checks](DATABASE_CONNECTION_CHECK.md).

VS Code Live Server on port 5500, an HTML file opened directly, and GitHub Pages cannot execute this password check. Share the Flask/Render website URL when access protection is required. Publishing this public source repository does not make any separately hosted static copy password protected.

## Render website

Use the Python web service in `render.yaml`, which installs the requirements, rebuilds the public price catalogue and runs Gunicorn. The blueprint declares:

- `SITE_PASSWORD` with `sync: false`, so the actual value is supplied privately.
- `DATABASE_URL` with `sync: false`, also supplied privately.
- `SECRET_KEY` with `generateValue: true`.
- `SESSION_COOKIE_SECURE` set to `true`.
- `/api/health` as the public health-check path.

For an existing Render service, verify those values in its environment settings; committing the blueprint alone does not prove the running service has changed. Redeploy or restart after setting them. Check the exact HTTPS domain in a private browser window: the application should first show the password form, and direct data API requests should require access.

## What a visitor experiences

The first protected page redirects to `/login`. A correct password opens Home; a wrong password gives a plain error on the form. Sign-in lasts at most four hours from the original successful entry. Requests do not extend that deadline.

The **Lock website** action in the current page footer opens a confirmation page. Confirming submits a CSRF-protected POST, revokes the server session record and clears the access cookie. A copy of that cookie cannot reopen the website after locking. Merely opening the confirmation link does not lock the site. After the session expires or is revoked, protected page requests return to sign-in; protected API requests return `401` with `access_required`.

The login limiter reserves at most eight password attempts per verified client address in ten minutes, including concurrent submissions and requests sent to different workers. A ninth attempt returns `429` and a `Retry-After` header. A successful login clears its attempt bucket. On the exact I3 Render public service it uses the edge-provided Cloudflare address; locally it uses the socket address and ignores caller-supplied forwarding headers. This is a shared-password gate, not individual parent/child accounts.

If access settings are absent or invalid, visitors see a generic `503` access-unavailable page. An API response uses error code `access_unavailable`, distinguishing this from unavailable database data.

## Cookies and privacy

The `fixforward_i3_access` cookie contains signed, I3-specific access state, its issue time, a random session ID and a CSRF token. It does not contain the shared password, database URL, appliance details, safety answers, costs or location. It is host-only, HttpOnly, SameSite=Lax and Secure on HTTPS. The signed marker also includes the I3 audience, so merely renaming an older iteration's cookie does not authorize I3 access. Application responses use `private, no-store` so caches are not used to retain protected content after locking.

Sign-in and sign-out write only keyed client/session digests, attempt counts and expiry times to a private, bounded instance-local SQLite access store. No raw IP addresses, passwords or cookies are saved there, and no Neon writes are introduced. Both Gunicorn workers share this store; a new instance with an empty store requires visitors to sign in again. Corrupt or unavailable access storage fails closed with a generic `503` response. Multiple application instances need shared access storage before horizontal scaling.

Appliance choices remain in browser memory. Optional game progress and parent feedback stay in browser storage and can be cleared or edited by that browser's owner. Validation rejects malformed/impossible histories and derives correctness from the game's authored answers; it cannot prove that an entire plausible history was genuinely played. These are learning records, not tamper-proof assessment grades. The read-only SQLite price catalogue remains separate from both the access store and Neon.

Changing the shared password or signing key invalidates existing access cookies. Restart/redeploy after a change so every running worker uses the same values.

## Verification

Use the [current branch verification report](PASSWORD_BRANCH_VERIFICATION_2026-09-11.md) for actual test and browser results. Check unauthenticated page/API access, wrong and correct passwords, missing settings, cookie flags, the four-hour expiry and CSRF-protected locking. A passing local check does not prove that an existing deployed URL is already protected.

## Security review, 12 October 2026

This review used the I3 release worktree based on `14900fe`, synthetic credentials/repository fixtures for adversarial tests, and bounded read-only requests to the I3 review service for a live baseline. It did not change shared Neon data, other iterations, Render configuration or the live deployment. The older verification report above is historical evidence.

Final release validation: **936 tests passed** (559 repository JavaScript checks, 200 family/game checks and 177 backend checks), including 63 new security regressions. The release follow-up resolved the initial proxy concern with seven tests for Render's documented client-address boundary. Backend checks use Werkzeug 3.1.9 from an isolated temporary package folder; the global Python installation is unchanged. `npm audit` reported zero known vulnerabilities after the lockfile update. The live baseline recorded 24 bounded requests before these fixes. A limited pattern scan of 362 tracked text files found no credential patterns; excluded paths and detector limitations mean this is not proof that every secret is absent. Database-role metadata verification was skipped because this workspace did not supply a verified Neon target; live role grants remain unverified.

| Area | Finding and local result |
|---|---|
| Old I3 interfaces | Authenticated `/quest` served the earlier Quest document. It now redirects to current Learn, preserving the parent destination. `/legacy` and the retired world document also redirect. Old controllers/styles and arbitrary new `src` modules are excluded from public assets. This was an obsolete route, not an unauthenticated entry into I2. |
| Login abuse | Added an atomic, bounded attempt store and tested simultaneous guesses, multiple workers, new browser cookies, forged forwarding headers, expiry and failed storage. Render client addresses are separated even when they share one proxy connection; see the verified ingress rule below. |
| Session lifecycle | Scoped the cookie/marker to I3 and added server revocation. Tests reject expired, missing, corrupt, foreign-audience and logged-out session tokens, including copied tokens sent to another worker. |
| URL and header input | An inherited object key such as `#decide?appliance=constructor` could crash Decide. Only authored own keys now select a device. Untrusted Host values are rejected before login; forwarded Host cannot redirect a visitor elsewhere. |
| Files and APIs | Traversal, encoded separators, private files, forged authorization headers and unsupported write methods are rejected. Query injection tests use repository mocks; runtime database reads remain fixed/parameterized, read-only transactions. No live injection payload was sent to Neon. |
| Browser content | Malicious listing HTML is rendered as text; executable link schemes and lookalike recall hosts are rejected. CSP permits the exact SRI-pinned Leaflet script rather than the entire CDN. Camera/location remain user-initiated; microphone and XR tracking are disabled. |
| Learning records | Fix-it derives solved/finished state from valid, ordered attempts. Corrupt/oversized histories are rejected while genuine retries, unfinished rounds and old version-one rounds survive reload. |
| Photo input | Regression checks reject script formats, forged image content and excessive decoded dimensions before image decoding. They do not establish real-camera accuracy or model quality. |
| Dependencies | Raised Werkzeug's minimum to 3.1.9 for its Windows file-path advisory, and updated the development-only `source-map-js` lock entry to 1.2.2. npm auditing does not cover manually vendored browser libraries. |

**Resolved Render proxy boundary:** [Render explicitly documents that Cloudflare overwrites `CF-Connecting-IP` on public web-service requests](https://render.com/articles/host-pocketbase-on-render#making-pocketbase-see-the-real-client-ip). The limiter trusts this single address only when the built-in server environment identifies Render, a public web service, and the exact I3 hostname. Local clients cannot enable that mode with request headers. Missing or malformed trusted values fail closed; equivalent IPv6/IPv4-mapped addresses share one budget. `X-Forwarded-For` remains ignored. These changes require no hosting setting changes or public IP-debugging endpoint. Verify a successful login through the real public ingress after deployment, while retaining the single-instance requirement for the private access store.

The trusted Host list covers the current I3 service and local loopback previews. [Render health checks use a verified custom domain when present](https://render.com/docs/health-checks); recheck the service's domain configuration before deployment. A new approved I3 domain needs a corresponding reviewed allowlist change. Main and I2 are intentionally absent.

Reproduce the application checks in this worktree:

```powershell
npm.cmd run check
python -m unittest discover -s test_backend -v
npm.cmd audit
```

The added adversarial cases are in `test_backend/test_security_audit.py`, `test_security_routes.py`, `test_security_headers.py`, and `prototypes/i3-five-games/security.test.js`. This is a source and regression review, not independent penetration-test certification. Load/DDoS testing, real-device camera behavior, infrastructure permissions and shared-database role grants were not exercised.
