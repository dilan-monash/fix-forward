# Copy v1.6 into a separate Git branch

This package is a **usability-lab prototype**. Keep v1.5 preserved and test v1.6 on its own branch.

## Recommended branch

From the existing FixForward repository, first confirm v1.5 is committed/pushed and the working tree is clean. Then create:

```powershell
git switch -c feature/i1-usability-lab-v1.6
```

Copy the contents of this package into the repository root. Do **not** delete or overwrite `.git` or `.venv`, and do not copy a real `.env` file into Git.

## Test before staging

```powershell
npm test
npm run check
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py test_backend
```

Expected Node result for the packaged candidate: **66 tests, 66 pass, 0 fail**.

The complete Flask/backend suite must pass in the project's normal Windows `.venv` before the branch is committed.

## Run locally with Neon

Never paste the real `DATABASE_URL` into Git or chat. Load it into the shell environment and set the candidate release label:

```powershell
$env:RELEASE_VERSION = "iteration-1-v1.6.0-usability-lab"
python -m flask --app app run --debug
```

Check:

- `http://127.0.0.1:5000/`
- `http://127.0.0.1:5000/api/health`
- `http://127.0.0.1:5000/api/ready`

## Manual usability/safety checks before commit

Use `docs/DEPLOYMENT_CHECKLIST_V1.6.md` and `docs/USABILITY_TEST_SCRIPT_V1.6.md`. At minimum, exercise:

- Repair / Compare / Recycle / I'm not sure;
- BVC 160 possible recall and BVC 161 near-model behavior;
- Not sure followed by the remaining safety questions;
- one critical Yes + other No answers;
- all Yes;
- unable-to-check;
- repair hub → location and cost branches;
- `312` postcode autocomplete by mouse and keyboard;
- current location Allow/Deny;
- map failure fallback;
- serious-warning recycling transport caution;
- cost-source wording and manual money validation.

## Stage only after testing

```powershell
git status
git diff --check
git add -A
git status
git diff --cached --check
```

Confirm `.env`, `.venv`, secrets and generated private credentials are not staged.

Then, only after review:

```powershell
git commit -m "Prototype FixForward v1.6 usability lab"
git push -u origin feature/i1-usability-lab-v1.6
```

Do not merge directly to `main`. Use a preview deployment and mentor/team review first.
