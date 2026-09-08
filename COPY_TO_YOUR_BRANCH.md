# Copy this v1.5 prototype into a separate feature branch

This package is a **non-final prototype candidate**. Preserve v1.4 before copying it and do not overwrite `main` directly.

## 1. Preserve your current v1.4 work

In the real Git clone:

```powershell
cd C:\Users\sansk\Downloads\FixForward-I1-Redesign
git status
git branch -vv
```

If `feature/i1-goal-first-v1.4` contains uncommitted work you want to keep, test/commit/push that checkpoint first.

## 2. Create the v1.5 branch

```powershell
git switch feature/i1-goal-first-v1.4
git switch -c feature/i1-human-first-v1.5
```

## 3. Copy this package

Copy the **contents of `fixforward_human_first_v1_5`** into the root of your Git clone. Replace matching project files. Do not delete/copy over `.git` or your `.venv`.

## 4. Test before staging

```powershell
npm test
npm run check
python -m unittest discover -s test_backend -v
python -m compileall -q backend app.py test_backend
```

Expected Node result for this package: **46 passed, 0 failed**.

Set the development Neon connection only in your current shell, never in Git:

```powershell
$env:RELEASE_VERSION = "iteration-1-v1.5.0-human-first"
python -m flask --app app run --debug
```

Check:

```text
http://127.0.0.1:5000/
http://127.0.0.1:5000/api/health
http://127.0.0.1:5000/api/ready
```

Then follow `docs/USABILITY_TEST_SCRIPT_V1.5.md` and `docs/V1.5_USABILITY_AUDIT_AND_FIXES.md`.

## 5. Do not commit until the local journeys look right

After local/manual testing:

```powershell
git status
git diff --check
git add -A
git diff --cached --check
git commit -m "Prototype human-first FixForward v1.5 UX"
git push -u origin feature/i1-human-first-v1.5
```

Use a non-production Render preview before considering a merge into `main`.
