# Check whether your website is connected to PostgreSQL

## What was verified in this checkout

On 11 September 2026, a private local `.env` file was created with `DATABASE_URL=`
left blank. Put your URL immediately after that equals sign, save, then restart
Flask. No live Neon connection has been verified. Recall, repair and location data
still use PostgreSQL; they do not silently switch to SQLite when it is unavailable.

The new retail-price catalogue is a separate public SQLite snapshot, already built
at `data/catalogue/replacement-prices.sqlite`. It contains retailer observations,
not user details, and needs no database URL. The static website can display a saved
copy of those prices. Neither mode proves the main PostgreSQL database is linked.

The browser's reference-data API setting is enabled. The Flask website now requires
a shared website password before serving the application and database routes.
A static preview such as VS Code Live Server cannot enforce that password or run
the Python database API. Displaying the website alone is not evidence of a working
database connection.

## Set up the local application

Use a current Python installation and run these commands in the project folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The local `.env` is already prepared in this workspace. If using a fresh checkout,
copy `.env.example` to `.env` first. Open `.env` in your
editor and set `DATABASE_URL` to your application's pooled
PostgreSQL connection string. Use its SELECT-only role, not an owner/admin/import
credential. Keep `sslmode=require` for Neon. Never put this URL into frontend
JavaScript or paste it into chat. `.env` is ignored by Git and is not served by Flask.

The backend now loads this local `.env` consistently. Environment variables already
set by a shell or hosting provider take precedence over `.env`. Restart Flask after
changing the connection setting.

Website access has separate settings: `SITE_PASSWORD`, a random `SECRET_KEY` of at
least 32 characters, and `SESSION_COOKIE_SECURE`. These do not belong inside the
database URL. They are configured privately for local use in this workspace; a
fresh checkout must set them before the browser can enter the application. Set
`SESSION_COOKIE_SECURE=false` only for local HTTP development and keep it true for
HTTPS hosting. Follow the [website access guide](WEBSITE_ACCESS.md).

Run the read-only diagnostic:

```powershell
.\.venv\Scripts\python.exe -m backend.check_database
```

It checks the database connection and the actual recall, source, repair-evidence
and location routes. It prints HTTP status and row counts only, not database URLs,
passwords, database errors or row contents. Database reads use read-only transactions
with a ten-second per-statement timeout. The diagnostic writes nothing to PostgreSQL.
It uses an internal Flask test application that bypasses only the visitor access
gate, so it can diagnose the database independently of sign-in. This does not
disable access protection on a running website.

- Exit `0`: this local Flask configuration read all four nonempty datasets.
- Exit `1`: setup, connection, permission, schema or API failure needs attention.
- Exit `2`: connected, but one or more public datasets are empty; review imports.

The existing command `python data/scripts/test_neon_connection.py` runs this same
diagnostic. It no longer prints raw connection exceptions.

## Open the real Flask website

```powershell
.\.venv\Scripts\python.exe app.py
```

Open `http://127.0.0.1:5000/` and enter the shared website password. Use this port
for protected, database-backed local testing. The Python server must remain
running. A `:5500` static preview or GitHub Pages deployment does not run this
server-side access gate.

In this machine's MSYS2-created virtual environment the executable is
`.\.venv\bin\python.exe` instead of `.\.venv\Scripts\python.exe`.
Python dependencies have now been installed for the password-gate update. Earlier
verification reports describe the previous dependency-installation blocker; see
the [current branch verification report](PASSWORD_BRANCH_VERIFICATION_2026-09-11.md)
for final checks. Installing dependencies does not verify live Neon connectivity.

## Verify the exact website you are using

Sign in first, then open these paths on the same origin as the website, including
the same port. `/api/health` is the only data API route that does not require access:

| Path | What a successful response proves |
|---|---|
| `/api/health` | Flask is responding. This does not check PostgreSQL or website-access configuration. |
| `/api/ready` | A database query succeeded using that running server's configuration. |
| `/api/recalls` | The reviewed recall query and JSON transformation succeeded. |
| `/api/sources` | The source-register query succeeded. |
| `/api/repair-evidence` | The repair-statistics and barriers queries succeeded. |
| `/api/locations` | The locations query succeeded. |
| `/api/replacement-prices` | The separate public price SQLite snapshot can be read. This does not check PostgreSQL. |

Expect JSON, not an HTML page. `/api/ready` should report `"database":"available"`.
HTTP `401` with `access_required` means the access cookie is missing or expired;
sign in again before assessing the database. HTTP `503` with `access_unavailable`
means the server's website-password/signing-key settings need attention. These
access responses do not report a PostgreSQL query result.
All four dataset routes should return the documented arrays. A connection can pass
`/api/ready` while a dataset route fails because of missing migrations or permissions;
that is why the diagnostic checks both. Empty arrays do not prove the data was imported.

For a deployed website, put `DATABASE_URL` and `SITE_PASSWORD` in that hosting
service's protected environment settings, configure a strong `SECRET_KEY`, and
keep `SESSION_COOKIE_SECURE=true`. The Render blueprint declares the two private
values and generates the signing key. Restart/redeploy as appropriate, sign in,
then check these paths on the public domain. A passing local diagnostic does not
prove the deployment is connected.

If anything fails, you can safely share the diagnostic's PASS/FAIL lines and row
counts. Keep the complete connection string and any raw database error private.
