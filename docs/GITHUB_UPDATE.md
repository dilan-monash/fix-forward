# GitHub update handoff

Prepared 11 September 2026. The user confirmed the repository [dilan-monash/fix-forward](https://github.com/dilan-monash/fix-forward) and requested a new branch and commit. The update branch is `feature/password-and-retail-prices`. Commit, push and deployment outcomes belong in the [branch verification report](PASSWORD_BRANCH_VERIFICATION_2026-09-11.md); this handoff does not claim an upload or deployment.

## Repository integration

The original working folder is a downloaded package. A separate clone under the ignored `tmp/github-update` directory preserves the team's Git history.

The reviewed remote history has `main` at `0101bd6` and `feature/i1-usability-lab-v1.6` at `e9bf5ce`, sharing ancestor `48776d6`. The new branch combines main with the v1.6 branch before importing the reviewed local updates. Main's separate overview and appliance-selection behavior is retained in the newer v1.6 landing and identify screens, including return-home and restart navigation. Overlapping application, stylesheet and test changes must be resolved around that behavior rather than reverting the newer journey.

## Included changes

- A Flask-enforced shared website password, with CSRF-protected sign-in/sign-out and a four-hour access cookie. The real password and signing key stay in private environment settings.
- A FixForward favicon and page-specific browser titles.
- Reviewed AUD retail-price observations with brand, model, appliance type, retailer, source link, date and comparison limits.
- Matching that distinguishes exact brand/model results from brand or appliance-type examples.
- A read-only SQLite price snapshot and Flask endpoint, separate from the existing Neon reference datasets.
- Repair, cost-comparison and recycling exploration for "Not sure," while serious-warning and possible-recall restrictions remain visible.
- Database setup, diagnostics, deployment configuration and evidence-based verification notes.

The catalogue is a small set of recorded examples, not a live retailer feed or a complete historical price database. Showing prices does not prove Neon connectivity. See [catalogue sources](../data/catalogue/SOURCES.md), [database setup](DATABASE_CONNECTION_CHECK.md) and [website access](WEBSITE_ACCESS.md).

## Files that stay private or local

Do not copy or stage `.env`, credentials, `.venv/`, `node_modules/`, `tmp/`, caches, private database dumps or local browser profiles. Keep the existing repository's `.git` directory and history. Retain the placeholder `.env.example`.

The reviewed public artifact `data/catalogue/replacement-prices.sqlite` is intentionally included, along with its source observations and rebuild script. It contains retail observations only. Other local SQLite databases remain ignored.

## Validation before commit

Run from the integrated checkout using the selected interpreter:

```powershell
python data/scripts/build_price_catalogue.py
npm run check
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py test_backend
git diff --check
```

Inspect the sign-in flow, wrong password, expired access, logout confirmation, API protection, page identity, recorded-price matching, "Not sure" paths and serious-warning restrictions. A static file-server preview cannot test the server-side password. Run `python -m backend.check_database` to assess the local Neon configuration separately; record missing credentials or failures explicitly.

Review `git status --short`, `git diff --stat` and the actual diff. Stage reviewed paths, then inspect `git diff --cached`, `git diff --cached --stat` and `git diff --cached --check`. The staged contents must exclude the real shared password, signing key and database URL.

The user supplied `sbha0098@student.monash.edu` as their email. If needed, configure that email only in this checkout; retain the verified author name. Commit identity is separate from GitHub authentication.

## Commit and publication

Suggested commit title:

```text
Add protected website access, retail price examples and usability fixes
```

Commit on `feature/password-and-retail-prices` using normal Git history. A branch push is separate from a live deployment and must be verified against the remote. Do not force-push or merge into `main` as part of this feature-branch update.

The Render website requires private `SITE_PASSWORD` and `DATABASE_URL` values and a generated `SECRET_KEY`. A public repository does not enforce access to a deployed website, and GitHub Pages cannot run this Flask gate. Configure the Python web service described in [website access setup](WEBSITE_ACCESS.md) before describing the public deployment as password protected.
