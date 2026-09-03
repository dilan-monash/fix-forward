# FixForward Iteration 1 v1.2.0 — Acceptance Results

Run date: 4 September 2026

## Automated result

| Check | Command | Result |
|---|---|---|
| Frontend syntax, decision logic and static acceptance checks | `npm run check` | **54 passed, 0 failed** |
| Flask contracts, safe failures, protected files and transformations | `python -m unittest discover -s test_backend -v` | **9 passed, 0 failed** |
| Python compilation | `python -m compileall -q backend app.py` | **Passed** |

The automated suite verifies exact normalized model matching, category-only and brand-only limitations, wrong-brand/partial-model rejection, safety precedence, detailed cost errors, category repair evidence, browser-only area filtering, fail-closed API behavior, URL validation, generic database errors, security headers and responsive/accessibility source checks.

## Integration result

The integrated candidate combines:

- the latest team GitHub snapshot, including the existing `data/` pipeline;
- the Flask read-only API and Render service definition;
- optional brand/model collection and exact identifier matching;
- the latest cost-validation and repair-evidence presentation improvements;
- the documented, fail-closed production behavior.

The older category-only recall verdict and static KitchenAid production fallback are not included.

## Database evidence completed on the Neon development branch

| Evidence | Observed result |
|---|---|
| Branch | `iteration-1-backend-test` selected; migrations were not run on production |
| UI category seed | 19 rows |
| Recall application tables | Four expected tables present |
| Reviewed identifier seed | Mistral `BVC 160`/`BVC160` and `BVC 165`/`BVC165` |
| Application role | `fixforward_app` exists with all administrative flags false |
| Table access | SELECT true; INSERT, UPDATE and DELETE false |
| Owner credential | Administrator reported the previously exposed password rotated |

## Manual release gates still required

- Set the pooled `fixforward_app` URL as local `DATABASE_URL` without storing it in source control.
- Start Flask and confirm `/api/health` reports `database: available`.
- Inspect all four public-data endpoints against the live Neon development branch.
- Complete the Rice cooker, Mistral/BVC 160, wrong model, high-risk, uncertain, cost and simulated-outage journeys.
- Review the combined changes with the frontend and database contributors.
- Apply the approved application migrations to the production database using the team process.
- Configure the protected production `DATABASE_URL` and deploy the reviewed Git commit.
- Recheck endpoints, security headers and the complete journey on the deployed HTTPS URL.
- Personalize the AI-use acknowledgement and retain team-contribution evidence.

This is a tested integrated candidate, not evidence of a live deployment.
