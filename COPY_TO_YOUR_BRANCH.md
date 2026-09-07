# Copy this v1.4 prototype into your feature branch

This package is a **prototype candidate**, not a final release. Do not overwrite `main` directly.

## 1. Confirm your branch

In your real Git clone:

```powershell
cd C:\Users\sansk\Downloads\FixForward-I1-Redesign
git switch feature/i1-feedback-redesign
git status
```

The working tree should be clean before copying a new candidate. If it is not clean, commit/stash the work you want to preserve first.

## 2. Copy the package contents

Copy the **contents of this folder** into the root of your Git clone. Do not copy an outer wrapper folder and do not touch `.git`.

## 3. Test before committing

```powershell
npm run check
.\.venv\Scripts\Activate.ps1
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py test_backend
```

Then set your development Neon `DATABASE_URL` in the current terminal and run:

```powershell
$env:RELEASE_VERSION = "iteration-1-v1.4.0-goal-first"
python -m flask --app app run --debug
```

Test `http://127.0.0.1:5000/api/health` and `http://127.0.0.1:5000/api/ready`.

## 4. Test the real user journeys

Use `docs/USABILITY_TEST_SCRIPT_V1.4.md` and `docs/DEPLOYMENT_CHECKLIST_V1.4.md`. In particular, test recall BVC 160/BVC 161, serious warning paths, denied/allowed geolocation, map failure fallback, manual suburb search, mobile/keyboard access and the cost prototype.

## 5. Only then stage/commit/push

Do this only after you and your team have reviewed the diff and live behaviour:

```powershell
git add .
git commit -m "Prototype goal-first FixForward v1.4 UX"
git push -u origin feature/i1-feedback-redesign
```

Create a non-production Render preview before merging to `main`.
