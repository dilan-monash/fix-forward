# FixForward: five-game family review

Run from the repository root:

```powershell
node prototypes/i3-five-games/serve.mjs
```

Open **http://127.0.0.1:5537/**. This loopback server is a local review only: its operational APIs deliberately return unavailable. The Iteration 3 Flask entry point serves the same reviewed interface with the existing protected, read-only APIs. Starting this Node server does not deploy the site or change ports 5535/5536.

## What is connected

| Screen | Route | Main code |
| --- | --- | --- |
| Teaching-first landing, activity finder, narrated film and FAQ | `#home` | `landing.js`, `landing.css` |
| Exactly five activities, age/time/mode filters | `#learn` | `activities.js`, `activities.css` |
| Graphical practice for each game | `#howto?game=fix-it`, `materials`, `care`, `scrapworks`, `choices` | `activities.js`, `tutorial-art.js` |
| Existing beginner Fix-it Station | `#learn?game=fix-it` | `reference/fixit.js`, `reference/fixit-engine.js`, `reference/fixit-3d.js` |
| Materials Rescue (previous colourful wheeled targets retained) | `#learn?game=materials` | Existing `../i3-family-landing/playroom-*` modules, read in place |
| Care Crew | `#learn?game=care` | The same playroom engine with the Care boards |
| Scrapworks: eight shifts, immediate item outcomes and a growing town | `#scrapworks` | `scrapworks.js`, `scrapworks-art.js`, original `reference/scrapworks-engine.js` |
| Circular Choices: ten illustrated real-life stories | `#learn?game=choices` | `choices-engine.js`, `choices.js`, `choices.css` |
| Parent record directory and exact game records | `#parents` | `app.js` and each game's own record renderer |
| Photo, camera, manual device selection and confirmed 3D details | `#explore` | `explore.js`, `explore.css`, `support/*` |
| Rotatable room, without walking, My Space or AR | `#explore?view=world` | Existing renderer in `reference/world-engine.js` |
| Appliance identification, safety, repair, costs and drop-off planning | `#decide` | Scoped `decide.js`, `decide.css`, `support/photo-helper.js` |

`app.js` mounts one route and disposes the previous route. Home, `shell.css` and `site-theme.css` now follow the **5535 reference**: white and pale blue-grey backgrounds, navy text and blue actions. The three numbered learning questions are responsive live text, followed by all five pastel activity cards. Home and Decide contain no Pip mascot. The four navigation destinations are Home, Learn together, Explore and Decide. Old `#action`/`#act` links resolve to Decide with their appliance context retained; they do not bypass its identity or safety steps.

Site motion is enabled by default, with no header motion toggle or saved site-pause preference. The OS reduced-motion preference is still respected. Individual games keep their own accessibility controls. Game feedback uses shapes/text as well as colour. The normal tablet game layouts keep feedback and Next visible; narrow phones and large text can grow vertically. Gameplay is silent; the existing product film plays narration only when requested.

`result-reveal.js` waits for a completed photo result to render, then focuses and scrolls it into view. Both Explore and Decide use it for suggestions, uncertainty and errors, without confirming an appliance automatically. Aborts, route changes and manual selection cancel pending work so a late result cannot steal focus. In 3D, clicking a mesh, numbered marker or part-list button opens one matching part card. The card updates on the next selection; Care and CO2e remain whole-appliance information. Changing appliance, opening the room or changing lesson tabs clears the card.

## Scores and parent feedback

Circular Choices counts **first attempts** out of ten. A wrong first choice followed by a correct retry stays a retry. Correct answers earn 15 Sparks unaided on the first attempt, or 10 after a retry/hint. Hints remain visible in the learning record; using one does not turn a first attempt into a second attempt. The screen always waits for Next. Saved scores are reconstructed from the authored stories and ordered attempts, not trusted totals. Histories are bounded to 20 rounds.

Scrapworks preserves the original eight shifts, repair-token rules, route scores and star unlocks. The fictional assessment appears immediately. Every accepted or rejected route gives feedback; an accepted choice changes the item's illustration and town before the explicit Next action. A separate bounded journal records choices, explanations and data-clearing steps, including an unfinished current item.

Materials/Care keep their existing per-move records, hints, parent filtering and original progress keys. Fix-it keeps its original discovery cards and learning record. Parent notes describe attempts and useful conversations; they do not claim mastery or compare unlike game scores.

LocalStorage is isolated by browser origin, including port. Progress on 5535/5536 is not automatically present on 5537, and no older storage is cleared or migrated.

## Runtime provenance and local boundaries

Small runtime files in `reference/` and `support/` came from the reviewed I3 commit **682b65f**, already present in `tmp/i3-learn-release`. This matches the newer live beginner game without copying an older working directory over the dirty checkout. The Scrapworks and Fix-it engines are unchanged. Reference adapters change import paths, enable direct parent-record entry, and silence integrated Fix-it audio while preserving optional supported-device haptics. The scoped Decide flow came from the current 5535 reference and removes its mascot; the original 5535 files stay untouched. The scoped adult photo helper adds cancellable result reveal while preserving the reviewed classifier policy.

`serve.mjs` uses an explicit public-asset map and loopback listener. It reuses existing Three.js files, the narrated product film, and the pinned classifier assets **in place**. It does not copy/download model weights or install dependencies. Small reviewed source modules are included in the new folder; adult helper source/model aliases use `tmp/i3-learn-release` when present and the repository root in a clean release checkout. This folder alone is not a standalone deployment bundle: Flask uses the exact public manifest in `backend/family_frontend.py` and aliases Three.js to the existing vendor files.

The actual reviewed classifier policies and both Explore/adult embeddings are served unchanged. The browser processes the selected photo locally; the user must confirm a device suggestion. A suggestion identifies a type, not safety, damage, brand or exact model. The camera starts only from an explicit button, stops after capture/exit, and has upload/manual fallbacks. Model loading is optional and can be cancelled.

Operational recall/location API calls return **503 unavailable** locally. No credentials or Neon data are loaded. This does not verify the live adult API or a deployment. The production integration keeps authentication, CSP, classifier integrity, the earlier `/legacy` and `/quest` routes, and read-only database access unchanged. The standalone `/film.html` player uses an external module under the same CSP. Publish only after the release checks and explicit authorization, by pushing `iteration-3` and manually deploying the reviewed commit to the I3 Python service. Do not change Main or service settings.

## Release validation

The assembled Iteration 3 candidate was checked on 2026-10-12: `npm run check` passed 559 repository tests plus 184 family tests; the full backend suite passed 130 tests. The assembly starts from `682b65f` and retains its classifier, model, vendor, API and Render settings. These are local test results; a Git push and an actual Render deployment are separate release steps.

## Validation

```powershell
node --test --test-concurrency=1 prototypes/i3-five-games/*.test.js
node --test --test-concurrency=1 prototypes/i3-family-landing/playroom*.test.js
npm.cmd run check
```

The focused suite exercises scoring/retries, current-item resume, data validation, exact parent feedback, all five tutorial handoffs, camera denial/capture/cancellation with synthetic dependencies, 32 catalogue mappings, enabled classifier policy, HTTP allowlisting, byte-range video seeking and refusal of private files/writes. The family suite covers the reused Materials/Care logic.

Local results on **2026-10-12**: **140 focused tests and 497 repository checks passed**. No backend behavior or shared database was changed. The unchanged reused Materials/Care suite passed 41 tests in the previous 2026-10-11 review. New tests cover selected-part identity, callout dismissal and focus, whole-appliance lessons, result scrolling and cancellation, manual choice during inference, the four-link navigation, legacy routes and the new homepage sections.

Browser review on 2026-10-11 covered Home/Learn and film playback, graphical tutorial interaction, Fix-it 3D initialization and result, Scrapworks' first full shift and parent notes, Circular Choices' immediate wrong/right feedback, and manual Explore search/confirmation/3D care/room. Layout evidence includes 1024×768, 768×1024 and a 390px phone; Scrapworks was also checked at 1024×650. Screenshots are in `.artifacts/i3-five-games-review/`.

The 2026-10-12 follow-up checked the revised Home at 1280×800, 1024×768, 768×1024 and 390×844, plus Decide at desktop and phone sizes. No horizontal overflow was found; all five Home cards, filters and tutorial handoffs worked. Selecting Kettle in Decide brought the brand/model fields and Next into view on both desktop and phone. Proofs use the `home-*-blue-*` and `decide-*-blue-*` names in the artifact folder. Live 3D review checked direct mesh clicks, numbered marker taps, part-list selection and whole-appliance Care/CO2e. The docked explanation is fully visible on both tablet orientations and repeated selection does not move the page. 3D proofs are in `.artifacts/five-games-review/explore-parts/`. A global pressed-button transform had moved numbered markers under the pointer; shell press feedback is now restricted to shell links and the marker anchor is preserved explicitly.

A non-personal homepage screenshot was uploaded through the real model in both Explore and Decide on 2026-10-12. Both returned uncertainty without selecting a device, and both automatically scrolled/focused the useful message: Explore feedback top 164px at scrollY 644.8, Decide feedback top 24.4px at scrollY 1072 (1280×720 browser). This verifies the negative-input result path, not recognition accuracy on supported appliances. Success, error, reduced-motion and late-result paths are exercised with synthetic dependencies in the tests. Chrome Work's file-upload extension permission was unavailable; the successful checks used the in-app browser without changing permissions. Camera hardware and physical iPad Safari/haptics were not tested; media lifecycle is covered by synthetic tests. An iPad does not provide the phone-style vibration assumed by some Android browsers; visible feedback remains the essential signal.

Learning references: [Victorian Government e-waste guidance](https://www.environment.vic.gov.au/household-waste-recycling/ewaste), [ACCC battery guidance](https://www.productsafety.gov.au/consumers/handle-chemicals-and-poisons-safely/lithium-ion-batteries-guide), and [Repair Café](https://www.repaircafe.org/en/about/). Figma file access was unavailable; the supplied Explore screenshots guided this local adaptation.
