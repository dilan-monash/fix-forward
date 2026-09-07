# FixForward — Iteration 1 v1.3.0 redesign candidate

FixForward is an anonymous decision-support web application for Victorian households deciding what to do with a faulty small appliance. This redesign implements the teaching-team/usability feedback as a coherent product journey rather than patching individual screens.

## Product story

**Identify -> Understand -> Act -> Compare**

1. **Identify** — choose one of six supported appliance families, then an alphabetised category.
2. **Understand** — screen the limited recall index, optionally refine with brand/model, then answer category-relevant safety questions.
3. **Act** — follow official recall guidance, professional safety assessment, community repair (only when appropriate), or responsible e-waste pathways.
4. **Compare** — where safety/recall does not block it, compare a real repair quote against a user-supplied comparable replacement value. Automatic retail benchmarking is intentionally not claimed until the dataset is defensible.

The application is guidance only. It does not diagnose a fault, certify safety, provide recall clearance or give DIY repair instructions.

## What changed in v1.3 redesign

- Proper landing page explaining purpose, environmental value, coverage and privacy before the form.
- Immediate loading screen so Render/Neon cold starts never look like a blank/broken website.
- Independent public-data loading with `Promise.allSettled()`; one failed endpoint does not disable unrelated data.
- Recall-index failure no longer prevents the static safety questionnaire.
- Retry public data without restarting the assessment.
- Model-first exact recall matching within the chosen category; brand mismatch is a warning, not a reason to hide an exact model hit.
- One-character/near model identifiers are never promoted to exact recall matches.
- Safety questions are tailored by appliance and split into critical vs caution severity; not every “Yes” becomes the same high-risk outcome.
- High-risk/uncertain appliances can never be routed to a community Repair Cafe as professional safety assessment.
- Repair evidence is explained in plain language with metrics and expandable limitations.
- Location results render inside FixForward with verification labels and explicit Melbourne/exact-area limitations.
- Dedicated Back buttons + browser Back support.
- Restart confirmation after assessment progress exists.
- Accessibility improvements: invalid focus, live location results, external-link new-tab labels, stronger contrast/visual hierarchy.
- Grouped Sources/privacy dialog with infrastructure-aware privacy wording.
- `/api/health` is process liveness; `/api/ready` checks Neon readiness.
- Short public-response caching and explicit Gunicorn workers/threads reduce avoidable deployment pressure.

## Architecture

```text
Browser UI ──GET public data──> Flask API ──SELECT only──> Neon PostgreSQL
    │
    ├── family/category/brand/model remain in browser memory
    ├── safety answers remain in browser memory
    ├── suburb/postcode remains in browser memory
    └── cost inputs remain in browser memory
```

See:

- `docs/ARCHITECTURE_I1_REDESIGN.md`
- `docs/SECURE_ARCHITECTURE_I1.md`
- `docs/TEACHING_FEEDBACK_ACTION_REGISTER.md`
- `docs/KNOWN_LIMITATIONS_V1.3.md`
- `docs/DEPLOYMENT_CHECKLIST_V1.3.md`

## Recall safety rule

| Input / condition | Result |
|---|---|
| Category only | Insufficient product information; never “recalled/not recalled” |
| Brand only | Possible category notices may be visible; model still requested |
| Exact normalized model in selected category | “Exact model identifier found”; verify official notice |
| Exact model but entered brand differs | Preserve possible match + explicit brand-conflict warning |
| One-character/partial model | No exact match; may show a re-check warning, never a recall verdict |
| No exact match | No match in the limited index — never “not recalled” |
| Recall API unavailable | Recall remains unknown; official ACCC link + safety screening continues |
| Critical warning sign | Stop-use/professional guidance; community Repair Cafe hidden |
| Caution/unsure warning | Assessment recommended; cost comparison blocked |

## Local setup

Requirements: Python 3.11+, Node.js 20+, and a PostgreSQL/Neon connection string for a SELECT-only application role.

```sh
python -m venv .venv
```

Activate it, then install:

```sh
python -m pip install -r requirements.txt
```

Set `DATABASE_URL` in the environment. Never commit or screenshot the credential.

Start the integrated application:

```sh
flask --app app run --debug
```

Open `http://127.0.0.1:5000`.

## Tests

Frontend/decision/UX contract:

```sh
npm test
```

Backend tests (after Python dependencies are installed):

```sh
python -m unittest discover -s test_backend -v
```

Syntax/compile check:

```sh
python -m compileall -q backend app.py test_backend
node --check src/app.js
node --check src/logic.js
node --check src/data-service.js
```

The redesign package currently passes all 23 Node tests. Live Render/Neon behavior is still a manual release gate and must be verified after deployment.

## Demonstration recall case

The existing seed data contains a narrow reviewed example:

- Family: Cleaning
- Category: Vacuum cleaner
- Brand: Mistral
- Model: BVC 160 or BVC 165

Expected result: exact model identifier found, with official ACCC verification required. This is a demonstration subset, not complete Australian recall coverage.

## Data and scope limitations

- Recall coverage is limited and curated.
- Repair evidence is self-selected category-level historical evidence, not a personal prediction.
- Melbourne service matching is exact suburb/postcode text matching, not genuine nearest-distance search.
- Professional repair businesses are not currently represented by a verified directory.
- Automatic geolocation is deferred until approved data/privacy design exists.
- Assessment history remains out of scope because I1 intentionally stores no journey history.
- Automatic retail-price benchmarking is not claimed without a sufficiently diverse, governed price dataset.

Do not “solve” these gaps by inventing data or weakening the limitation wording.
