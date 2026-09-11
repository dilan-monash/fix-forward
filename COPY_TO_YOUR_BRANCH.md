# Bring the FixForward update into your GitHub branch

The supplied destination is `dilan-monash/fix-forward`. A separate clone under `tmp/github-update` contains the new `feature/password-and-retail-prices` branch, combining main and the v1.6 history. See [branch verification](docs/PASSWORD_BRANCH_VERIFICATION_2026-09-11.md) and [GitHub handoff](docs/GITHUB_UPDATE.md) for the reviewed import and validation.

This update adds server-side website access. Configure its private settings using [website password setup](docs/WEBSITE_ACCESS.md); a static preview cannot enforce the gate.

## Use the existing repository history

Start from a clean clone or an isolated worktree of the confirmed repository and base branch. Check `git remote -v`, `git branch --show-current` and `git status --short` before importing files. Preserve existing commits and any earlier prototype branches.

If a new branch is wanted, the proposed name is `feature/retail-price-catalogue-usability`. If the user supplies an existing destination branch, inspect and use that branch instead. Do not initialize a new repository inside this package, replace remote history, reset an existing branch or guess the destination from an email address.

## Import reviewed changes

Compare this package with the checkout and copy only the reviewed application, catalogue source data, builder, tests and documentation. Resolve overlapping changes while retaining teammates' work and remote-only files. Merge shared configuration such as `.gitignore`, dependency manifests, deployment settings and existing migrations deliberately.

Exclude `.git`, real `.env` files, credentials, `.venv`, `venv`, `node_modules`, `tmp`, browser profiles, logs, caches, machine-specific files and database dumps. Keep the placeholder `.env.example`. The public `*-observations.json` files and source notes belong in version control; rebuild the SQLite catalogue from those inputs rather than copying an arbitrary local database.

The update adds a favicon, page-specific browser titles, recorded retail examples with exact-brand/model and brand/type labels, explicit selection of a replacement amount, and the September usability fixes. Prices are dated examples, not a live feed or a historical price trend.

## Build and validate

Use the clean checkout's Python environment:

```powershell
python data/scripts/build_price_catalogue.py
npm.cmd test
npm.cmd run check
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py test_backend
git diff --check
```

The catalogue builder creates `data/catalogue/replacement-prices.sqlite` and `src/price-snapshot.js`. Ensure the deployment build also generates these artifacts before Flask starts.

Use the [current verification report](docs/PRICE_CATALOGUE_VERIFICATION_2026-09-11.md) for the final local test totals and limitations. Rerun tests after merging into the team's repository; earlier packaged test counts do not validate the combined changes. Record dependency-related blocks explicitly instead of treating an unrun Flask suite as passed.

## Configure PostgreSQL privately

This workspace's private `.env` is prepared with a blank `DATABASE_URL=`. In a fresh checkout, copy `.env.example` to `.env`, then put the real SELECT-only PostgreSQL connection string after `DATABASE_URL=`. Keep the actual file ignored by Git. Never put the URL in browser code, a commit, a screenshot or chat.

Restart Flask after changes. The separate public SQLite price catalogue needs no URL and does not replace the existing Neon recall, source, repair-evidence or location datasets.

```powershell
python -m backend.check_database
python app.py
```

Check these paths on `http://127.0.0.1:5000`:

- `/` — the Flask website;
- `/api/health` — process liveness only;
- `/api/ready` — main PostgreSQL readiness;
- `/api/recalls`, `/api/sources`, `/api/repair-evidence`, `/api/locations` — actual main database reads;
- `/api/replacement-prices` — the independent public price catalogue.

A working price endpoint or saved-copy preview is not proof that Neon is connected. Use the [database guide](docs/DATABASE_CONNECTION_CHECK.md) to interpret results and keep the database connection check separate from the local catalogue tests.

## Journey checks before publishing

Use the [current verification report](docs/PRICE_CATALOGUE_VERIFICATION_2026-09-11.md), [usability review](docs/USABILITY_REVIEW_2026-09-11.md) and [deployment checklist](docs/DEPLOYMENT_CHECKLIST_V1.6.md). Exercise:

- Repair, Compare, Recycle and I'm not sure, including uncertain answers followed by the remaining questions;
- possible recall, a near model, critical Yes, all Yes and unable-to-check behavior;
- repair hub, postcode/suburb keyboard navigation, geolocation Allow/Deny and map failure;
- the favicon and page titles, including Home and Start again;
- exact brand/model, partial model, different brand and no matching appliance prices;
- explicit price selection, retained repair quote, source note and manual price edits;
- saved-copy labels, older or out-of-stock observations, manual money validation and late responses;
- continued safety restrictions and cautious disposal guidance on desktop and mobile.

## Review the staged change

```powershell
git status --short
git diff --stat
git diff
```

Stage reviewed paths explicitly. Then inspect `git diff --cached --stat`, `git diff --cached` and `git diff --cached --check`. Confirm secrets, dependency folders, temporary files, unrelated deletions and teammate changes are not staged.

Commit the reviewed update and push the confirmed branch using normal Git history. Create a pull request against the confirmed base branch with the actual validation results. Keep live deployment checks and real-parent usability testing distinct from local automated checks.
