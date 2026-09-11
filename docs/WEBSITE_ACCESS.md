# Website password setup

FixForward asks visitors for a shared website password before serving the application. The check runs in Flask, protecting the HTML, application JavaScript and data APIs. It does not require an individual account or store the visitor's appliance answers.

The actual shared password is configured privately. It is not included in this document, frontend code, committed examples or the GitHub branch.

## Where to configure each value

| Setting | Purpose | Local `.env` | HTTPS hosting |
|---|---|---|---|
| `SITE_PASSWORD` | Shared password visitors enter | Set privately | Set privately in service environment settings |
| `SECRET_KEY` | Signs access and CSRF cookie state | Random value of at least 32 characters | Generated random value; the Render blueprint generates one |
| `SESSION_COOKIE_SECURE` | Restricts cookie transmission to HTTPS | `false` only for local HTTP testing | `true` |
| `DATABASE_URL` | SELECT-only Neon/PostgreSQL connection | Set privately when available | Set privately; independent of visitor access |

Website access is enabled by default. Missing or invalid password/signing-key settings produce an access-unavailable response; they do not open the application to visitors. The public `/api/health` route still responds so the host can check process liveness.

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

The **Lock website** action opens a confirmation page. Confirming submits a CSRF-protected POST and clears the access cookie. Merely opening the confirmation link does not lock the site. After the session expires or is cleared, protected page requests return to sign-in; protected API requests return `401` with `access_required`.

If access settings are absent or invalid, visitors see a generic `503` access-unavailable page. An API response uses error code `access_unavailable`, distinguishing this from unavailable database data.

## Cookies and privacy

The `fixforward_access` cookie contains signed access state, its issue time and a CSRF token. It does not contain the shared password, database URL, appliance details, safety answers, costs or location. It is HttpOnly, SameSite=Lax and Secure on HTTPS. Application responses use `private, no-store` so caches are not used to retain protected content after locking.

Sign-in and sign-out are the only new form submissions. Appliance journeys remain in browser memory, with no saved journey history or new database writes. The SQLite price endpoint is protected by the same gate; it remains separate from Neon.

Changing the shared password or signing key invalidates existing access cookies. Restart/redeploy after a change so every running worker uses the same values.

## Verification

Use the [current branch verification report](PASSWORD_BRANCH_VERIFICATION_2026-09-11.md) for actual test and browser results. Check unauthenticated page/API access, wrong and correct passwords, missing settings, cookie flags, the four-hour expiry and CSRF-protected locking. A passing local check does not prove that an existing deployed URL is already protected.
