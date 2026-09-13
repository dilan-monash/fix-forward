# Draft AI-use acknowledgement — student review required

Do not submit this file unchanged. Confirm it against the exact Moodle wording, add the required names/dates/tool version, attach any required prompt transcript or screenshots, and rewrite the reflection in your own words.

## Suggested disclosure

Generative AI assistance was used during the Iteration 1 integration work for FixForward. OpenAI Codex assisted with:

- reviewing the supplied frontend, public-data CSV exports and existing automated tests;
- identifying that family/category matching could not support a recalled/not-recalled result;
- proposing a read-only Flask and PostgreSQL integration design;
- scaffolding backend configuration, routes, repository queries and response transformations;
- drafting an idempotent schema migration for manually reviewed recall products, category links and identifiers;
- revising the frontend to collect optional brand/model details and use exact normalized model matching;
- adding output escaping, URL validation, fail-closed data behavior and security headers;
- drafting and running automated frontend and backend tests;
- drafting technical documentation, a learning guide and this acknowledgement.

## Human review and responsibility

The student/team remains responsible for every submitted decision and must be able to explain and test the code. Before submission, record the real human verification here:

| Item | Student verification to record | Evidence link |
|---|---|---|
| Recall rule | Explain why category-only is insufficient and manually test every branch | `[add PGP link]` |
| Identifier normalization | Explain how `BVC-160` becomes `BVC160` and why partial matching is rejected | `[add test link]` |
| Database migration | Review every table/key, run scripts on a Neon development branch, verify row counts | `[add SQL evidence]` |
| Read-only access | Create the application role and verify SELECT succeeds while INSERT fails | `[add redacted evidence]` |
| API contract | Open and inspect all five endpoints; compare fields with `API_CONTRACT.md` | `[add API evidence]` |
| Frontend integration | Complete the rice-cooker, Mistral, no-match, high-risk and outage journeys | `[add video/screenshots]` |
| Security | Check no secrets are committed, inspect headers, review output escaping and error messages | `[add security evidence]` |
| Accessibility/usability | Complete keyboard/mobile tests and record defects/retests | `[add testing evidence]` |

## Decisions that must be attributed accurately

- Aleena created and governed the LeanKit cards/requirements.
- Dilan created and cleaned the Neon PostgreSQL datasets.
- Haochen created the original frontend.
- Record the actual person who reviewed, integrated and tested each change in this version. Do not replace individual contribution evidence with “the team” if the rubric asks for personal contribution.

## Prompt/evidence register

If Moodle requires detailed AI artefacts, add one row per meaningful session rather than claiming “AI was used” without traceability.

| Date | Tool | Purpose/prompt summary | Output used | Human checks/changes | Final artefact |
|---|---|---|---|---|---|
| 3–4 Sep 2026 | OpenAI Codex | Review recall logic, build the Flask backend, and integrate the latest team snapshot | Flask/API/schema/frontend/test and integration drafts | `[write what you inspected, rejected or changed]` | Files in integrated candidate v1.2.0 |

Attach or link the original conversation export/screenshots if required by the unit. Remove passwords, database URLs, tokens, email addresses and unrelated private information before placing screenshots in the PGP.

## Student reflection prompts

### FixForward Quest assistance — 13 September 2026

OpenAI Codex assisted with implementing the user-supplied FixForward Quest brief: legacy-stack inspection, isolated child module, authored mission adaptation, original SVG illustrations, source comparison, deterministic state/drag/storage code, focused regression tests, browser walkthroughs and local handover documents. The source register records exactly which guidance was checked and its access limitations. The implementation report distinguishes automated tests and an agent walkthrough from child-participant research. No child study or human safety review is claimed.

The subsequent child-focused refinement added Pip/Flo dialogue, collectible clue labels, eight illustrated stamps, a before/after scene viewer, saved postcard palettes and stickers, local SVG export code, finite accessible motion and updated comparison/demo documents. Codex assisted with code, art, test and browser review. Recorded checks distinguish visible desktop review and phone DOM measurements from unverified browser file saving and child research.

The later tablet-first refinement responded to the user's request for simpler English, more playful interaction and a clear parent explanation. Codex assisted with shortening authored child text while preserving scored rules, adding picture reflections and learning-goal fields, local Sparks/level logic, larger tap choices, word help, contextual narration, finite art sequences, the parent guide and the revised adult invitation. Assistance also covered implementation checks and the [tablet build handover](docs/QUEST_TABLET_PLAY.md). That document records the refinement's completed checks and remaining verification limits; earlier totals must not be presented as current results. Sentence-length checks and expert/agent review do not establish children's comprehension, engagement or learning outcomes. The W3C references are design guidance, not an accessibility certification.

The subsequent handover pass added plain-English source comments and a [developer walkthrough and review Q&A](docs/DEVELOPER_HANDOVER.md). Codex inspected the current code, documented function/module connections and distinguished runtime reads from database-writing maintenance scripts. No maintenance scripts or live database changes were executed. [Handover verification](docs/HANDOVER_VERIFICATION.md) records the source comparison and automated checks. The explanations require student/developer review and do not substitute for demonstrating personal understanding or approving a release.

The work began on `feature/child-quest-prototype`, starting from `c203c3827acfb3b8ef1124a7f643943dad9ff6b6`, and is now prepared on `iteration-2`. The existing `main` branch and Render website remain the Iteration 1 comparison baseline; Iteration 2 uses a separate service when deployed. This acknowledgement does not verify a live deployment. See [Quest implementation evidence](docs/QUEST_IMPLEMENTATION.md) and [authored-content/source register](docs/QUEST_CONTENT_SOURCES.md). Preserve the supplied build brief and this conversation as prompt/output evidence if the course requires it, after removing unrelated private information. Students must record their own review, accepted/rejected changes and individual contributions; these remain uncompleted student responsibilities. This note does not substitute for their declaration below.

### Prompts for the student's own reflection

Write these answers yourself:

1. Which AI suggestion did I verify most carefully, and why?
2. Which part did I change after understanding the project data or requirements?
3. How did the tests demonstrate that the recall rule was safer than category matching?
4. What limitation remains even after exact model matching?
5. What could fail in production that the automated tests here do not cover?

## Declaration placeholder

> I acknowledge the use of `[tool and version]` for the purposes listed above. I reviewed the generated material, tested the accepted code, corrected it where necessary, and take responsibility for the submitted work. The attached evidence records the prompts, outputs and my verification in accordance with the assessment instructions.

Name: `[student name]`  
Student ID: `[student ID]`  
Date reviewed: `[date]`
