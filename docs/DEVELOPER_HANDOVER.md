# FixForward: read the code, trace a feature, explain the system

Prepared on 13 September 2026 for this adult/Quest checkout, now on `iteration-2`. This guide explains the code that exists here. It supports a developer handover and a pre-deployment walkthrough; it does not certify a production release or claim to reproduce a course rubric.

Iteration 2 is the ongoing development and review website. Main at `fixforward.me` stays at the approved release until the user explicitly approves a reviewed I2 commit for promotion; Iteration 1 remains preserved separately. Follow the canonical [branch roles](../README.md#branches-and-websites), [manual I2 review workflow](../README.md#development-and-review-workflow) and [shared database boundary](../README.md#shared-database-boundary). A local check or Git push does not prove deployment.

## Start here, even if you do not write code

FixForward contains two experiences in one project. The adult household guide helps someone consider warning signs, costs and local services. FixForward Quest is an illustrated learning game for children aged 7–12. The two experiences have separate screens and separate journey state.

Read this guide first. Then open a source file and follow its opening comment. Comments beginning with `//` in JavaScript, `#` in Python, `/* ... */` in CSS and `<!-- ... -->` in HTML are explanations for people. They do not add a game rule or a screen. Comments describe functions, decisions and connections; repeated records and obvious statements are not individually narrated.

| Word in the code | Plain meaning | Example here |
|---|---|---|
| Function | A named piece of work that can be reused | `renderHome()` builds the home-screen markup |
| Parameter / argument | Information supplied to that piece of work | A clue ID passed to `clue(id)` |
| Return value | The result the function gives its caller | `transition()` returns the next game state |
| Object | A group of named values | `{ type: 'START_MISSION' }` describes an action |
| Array | An ordered list | `MISSIONS` holds the authored stories |
| ID | A stable internal name connecting records | `flo-next-home` connects a story, completion and stamp |
| State | What the application currently remembers | Current story, collected clues and settings |
| Event / handler | Something happened / the function that responds | A tap triggers a button's click handler |
| Render / DOM | Build the screen / the browser's page elements | `render()` replaces the Quest content area |
| Module / import | A file with a responsibility / using another file's exports | The screen imports rules from `engine.js` |
| API / endpoint | A server interface / one address on that interface | `/api/locations` returns public service records |
| JSON | A text format for lists and named values | Saved Quest progress and API responses |
| Promise / async / await | Work that finishes later / ways to wait for it | An adult reference-data request |
| Pure function | A calculation that does not itself save, fetch or redraw | The Quest state transition function |
| Validation | Checking that input follows the allowed rules | Rejecting an unknown mission ID in a save |
| Test fixture | Invented input used for a repeatable test | The preview helper's synthetic kettle recall |

For a source example, open [Quest's screen controller](../quest/app.js) and find `dispatch`. Its action goes to `transition`, the returned state goes to `persist`, and `render` shows the result. This is the central connection to understand before following individual button handlers.

## Which folder should another developer receive?

The current work is in **`tmp/child-quest-prototype` underneath the supplied workspace**, not the older files at the outer workspace root. Open that inner folder as the project. Its entry files are `package.json`, `app.py`, `index.html`, `src/` and `quest/`.

This folder is a Git worktree linked to `tmp/github-update`. Its `.git` file points to the parent repository; copying that pointer alone does not create an independent Git repository. Many Quest files are currently untracked. A handover made only from the starting commit, or only from `git diff`, would omit them.

For a future source handover, include the current authored source and documentation, `package.json`, `package-lock.json`, requirements files, relevant reviewed data inputs and deployment configuration. Check new/untracked files as well as tracked modifications. Exclude `.env`, credentials, `.venv`, `node_modules`, local test logs, downloaded caches and the `tmp/` working area. Transfer source through the team's agreed repository or a reviewed source export; do not copy this worktree's `.git` pointer as though it were a standalone repository. No commit, push or deployment was made as part of the comment pass.

## The connection map

The browser loads JavaScript directly as native ES modules. There is no React/Vite frontend, bundling step or automatic hot reload in this checkout.

```mermaid
flowchart TD
  A["app.py: application entry"] --> B["backend.create_app: routes, access and headers"]
  B --> C["Adult /: index.html"]
  B --> D["Child /quest: quest/index.html"]
  C --> E["src/app.js: adult screens and events"]
  E --> F["src/logic.js: local decision rules"]
  E --> G["data-service.js and price-catalogue.js"]
  G --> H["backend/api.py: reference-data responses"]
  H --> I["repository.py and db.py: read-only queries"]
  I --> J["Neon PostgreSQL: public reference records"]
  H --> K["backend/price_catalogue.py: reviewed SQLite snapshot"]
  D --> L["quest/app.js: child screens and events"]
  L --> M["content.js: authored stories and answers"]
  L --> N["engine.js: permitted state changes"]
  L --> O["storage.js: browser save"]
  O --> N
  L --> P["progression.js: derived Sparks and levels"]
  L --> Q["art.js, postcard.js and CSS: pictures and presentation"]
  L --> R["drag.js: optional pointer input"]
  L --> S["picture-help.js and feedback.js: explain the current clues and choices"]
  L --> T["narration.js: recorded voice or device speech"]
  T --> U["story-audio.js and audio manifest: exact transcript lookup"]
  U --> V["quest/audio: packaged MP3 recordings"]
```

The arrow from `storage.js` to `engine.js` means saved data is reconstructed and checked by the engine. It is not trusted merely because it came from this browser. Quest's rules and interactions make no game-data API requests. Initial access to its page and assets still depends on the server, and browser speech voices may use an online service.

The diagram describes the Flask application. The Node preview described below is a separate, local test helper that substitutes invented adult API responses. It does not connect to Neon or exercise the website-access gate.

## Follow one child action from start to finish

Open [app.js](../quest/app.js), [engine.js](../quest/engine.js), [storage.js](../quest/storage.js), [progression.js](../quest/progression.js) and [content.js](../quest/content.js) beside each other.

1. `quest/index.html` loads the screen controller. `loadProgress()` reads the `fixforward.quest.v1` browser-storage key. `hydrateState()` reconstructs allowed fields; missing or invalid saves receive safe defaults.
2. `render()` chooses the current screen and writes its markup into `#quest-app`. `bind()` attaches handlers to the new buttons. A `data-*` attribute links a button to its action. The separate `#q-game-hud` container in `quest/index.html` stays inside the sticky `.q-game-chrome`; `updateHud()` refreshes its contents without moving the score into the scrolling game screen.
3. A story button supplies a mission ID. Its handler calls `dispatch({ type: 'CHOOSE_MISSION', id })`. The engine checks that the authored mission exists before returning a new state.
4. Tapping a clue calls `clue(id)`, which dispatches `COLLECT_CLUE`. The engine checks the current mission and step and prevents duplicate clue collection. `picture-help.js` links numbered scene markers to a larger drawing and the exact clue text on the same screen. Opening a plan's picture recap changes temporary presentation, not the saved answer or points.
5. Plan buttons or successful drags dispatch `SET_PLAN`. `CHECK_PLAN` compares the filled spaces with the mission's `acceptedPlans`. `planFeedback()` uses those authored plans to explain each item separately. The engine remains the authority for advancing and completing the story; a green presentation marker does not grant completion. Retry retains both selected actions, and a previously correct item keeps its marker only while its selected action is unchanged.
6. After a correct checked plan, `COMPLETE_MISSION` records the story and concept discoveries. The optional picture reflection uses `CHECK_REFLECTION`; only a valid correct response to an earned story is saved.
7. `dispatch()` compares the old and new derived progress, saves the new state and renders it. It restores focus and optionally reads the next task. For new Sparks, the HUD briefly shows the previous total while the earned stars travel towards it.
8. `rewardFx.play()` controls only the decorative flight. Its guarded `onArrive` callback calls `collectSparks()` to show the true total and animate the meter. The effect never changes an answer, writes storage or adds points. Cancelling it on navigation removes the decoration; the next screen reads the latest engine progress. Reduced motion or unavailable/rejected animations show the same earned total immediately.

For a concrete points example, Flo's next-home story on a fresh save earns 20 Sparks for completion and 5 for its new concept. A correct reflection adds 10, making 35. Replaying the same story or animation does not earn those rewards again. Assistance and retries do not reduce the reward.

### Why the pieces are separate

| File | Responsibility | Important connection |
|---|---|---|
| [content.js](../quest/content.js) | Story text, clues, allowed actions, accepted plans, reflections and source references | Stable IDs are used by the engine, art and saved progress |
| [engine.js](../quest/engine.js) | Create, update and reconstruct valid game state | `transition` owns allowed changes; `hydrateState` checks saves |
| [progression.js](../quest/progression.js) | Derive Sparks and level information | Counts valid unique achievements; no independent saved balance |
| [feedback.js](../quest/feedback.js) | Explain each plan item, preview available rewards and vary celebration copy | Reads authored plans and derived progress; never saves an answer or awards points |
| [storage.js](../quest/storage.js) | Load, save and clear one Quest storage key | Calls the engine's reconstruction before accepting/saving records |
| [app.js](../quest/app.js) | Screens, events, dialogs, focus, narration and orchestration | Connects a UI event to the engine and the next render |
| [navigation.js](../quest/navigation.js) | Browser Back/Forward adapter | Stores validated presentation routes, with no saved scores; explicit replacement repairs obsolete entries |
| [picture-help.js](../quest/picture-help.js) | Scene markers, enlarged clue pictures and illustrated sorting help | Uses the current authored clue; opening or closing help cannot decide an answer |
| [narration.js](../quest/narration.js) | Play, pause, resume and stop a matching recording or device speech | Generation checks ignore stale media/voice callbacks; one control contract covers both sources |
| [story-audio.js](../quest/story-audio.js), [story-manifest.js](../quest/audio/story-manifest.js) | Conversational invitations and exact transcript-to-MP3 lookup | Changed text cannot silently select an outdated safety recording |
| [generate-story-audio.mjs](../scripts/generate-story-audio.mjs) | Development-only creation of the fixed narration files | Reads reviewed story text; model tools/cache remain outside the public application |
| [sounds.js](../quest/sounds.js) | Short original Web Audio tones for presses, wins, retries and levels | Sound is opt-in and gesture-guarded; it never changes narration settings or progress |
| [reward-fx.js](../quest/reward-fx.js) | Finite SVG star burst and flight to the HUD | Calls `onArrive` at most once; it has no access to game scoring or storage |
| [parent-guide.js](../quest/parent-guide.js) | Family welcome, illustrated learning example, purpose, FAQs and fictional preview | Returns markup; the preview button changes pictures without game rewards |
| [drag.js](../quest/drag.js) | Pointer movement, hit testing and cleanup | Calls the same logical action used by a tap alternative |
| [art.js](../quest/art.js) | Original SVG drawing functions | Named groups connect to CSS animation; art does not score |
| [postcard-options.js](../quest/postcard-options.js) | Allowed theme and sticker IDs | Shared by validation and postcard rendering |
| [postcard.js](../quest/postcard.js) | Self-contained SVG postcard and safe filename | Uses completed story content and allowed creative choices |
| [quest.css](../quest/quest.css) | Base child styles, focus and responsive layout | Loaded only on the child entry |
| [play-effects.css](../quest/play-effects.css) | Finite character, outcome and reward sequences | Trigger classes come from the controller; no scoring callbacks |
| [tablet-play.css](../quest/tablet-play.css) | Tablet/phone refinements and larger picture controls | Extends the base layout and art styles |
| [game-feel.css](../quest/game-feel.css) | Persistent score frame, touch feedback, star overlay and restored parent layout | Extends the base styles; visible decoration remains separate from scoring and respects reduced motion |
| [clue-play.css](../quest/clue-play.css) | Scene-linked clue panels, direct-touch artwork and item-specific feedback | Follows game-feel.css; its picture controls retain tap/keyboard access |
| [family-guide.css](../quest/family-guide.css) | Dimensional Pip/Flo welcome and the three-step learning example | Loads last and is scoped to the parent guide |

`state` is saved game information. Values such as `picker`, `selectedAction`, `pictureView`, `checkedPlan`, `sortPicked`, `postcardId`, `lastReward`, open dialogs and character greeting text are temporary display information. Keeping them separate avoids saving an open clue picture, picked-up item or celebration banner as if it were a new achievement.

The current local review separates **Story quests** (solve an authored story), **My creations** (design earned postcards and decorate the map), and **Discovery Book** (read earned learning ideas). Guided exploration puts numbered markers on the current scene and shows one enlarged clue with its exact words. Matching tabs let the child view each clue. Opening a Guided plan records the available facts through the same engine clue action. The plan uses a compact recap; `showFacts()` expands its scene and illustrated clues inline without changing choices or rewards. Challenge hotspots use the same picture panel instead of a text-only modal. Explicit help records assistance, but it does not reduce rewards.

The sorting illustration is itself a semantic `[data-sort-picture]` button bound to `bindDrag()`. A finger can start dragging on the picture without first pressing Move. A simple tap calls `pickSortPicture()`, which only highlights the selected card; the child then taps a destination. The separate Move control remains an alternative. Both drop and destination tap ultimately dispatch `ANSWER_SORT`; a cancelled or off-target drag awards nothing. Wrong results keep the card until the child chooses Try again.

`currentRoute` stores a page and optional story step, never an old score. `restoreRoute` keeps the latest earned records and same-story help/facts, canonicalizes the current history entry, and renders without awarding anything. Each story step is a Back destination; choices within a step replace that entry. Sorting is one activity entry, so Back leaves the activity and a return resumes its latest round. Reset advances a history epoch so old entries cannot restore a cleared attempt. `pageshow` rebinds drag listeners after browser page-cache restoration.

The persistent voice dock is duplicated inside the native dialog because the page behind a modal is not interactive. `readScene()` chooses an authored invitation, story line, selected fact or feedback explanation, rather than reading button labels and scores. `speakText()` keeps the spoken words available in the dock. `narration.js` asks `storyAudioFor()` for an exact transcript match and plays its packaged MP3 when available. Otherwise it uses device speech. Pause/Resume retain the same recording position or speech utterance; Stop and navigation cancel playback and invalidate late callbacks. A blocked playback request offers a visible retry rather than surprising the child with delayed audio. All narration has a visible text equivalent.

### Maintaining the story voice and its assets

The narration was generated during development with **Kokoro 82M v1.0**, the `af_heart` voice and pinned Kokoro.js tools. It is an AI voice, not a live actor or a cloned family member. The parent FAQ explains its origin, while the voice dock distinguishes story recordings from device speech. [The audio notes](../quest/audio/README.md) record generation details and upstream sources; [KOKORO-LICENSE.txt](../quest/audio/KOKORO-LICENSE.txt) preserves the supplied Apache-2.0 licence. The MP3 encoder and development-only dependency information are documented beside the generation code. Keep those notices with a source handover; do not describe externally licensed generation tools as original FixForward code.

[scripts/generate-story-audio.mjs](../scripts/generate-story-audio.mjs) reads `content.js`, `STORY_LINES` and the reviewed feedback combinations, hashes each normalized transcript and creates the MP3 plus manifest metadata. Its opening comments give the pinned tool-install and run commands. Tools and the downloaded model cache live in ignored `tmp/quest-voice-build`, not in the deployed page or runtime requirements. Regeneration can resume completed clips; `--sample` generates a review sample, and `--force` is for a deliberate voice/model-setting change. Review pronunciation and timing before accepting newly generated files.

The browser downloads only the needed recording from the application. There is no microphone capture, model execution or child-data upload for narration. Some fallback device voices may use an online service. Matching normalizes whitespace and quotation marks only: changing the words of a safety fact makes the old recording ineligible. After editing story text, regenerate its recordings and review `story-manifest.js`, source-control additions, asset routing and narration tests together. The manifest stores the transcript, hash, URL, duration and voice; tests verify these links and MP3 integrity, not whether the delivery sounds engaging to a child.

### Presentation, parent guidance and rewards

Game tones use a separate `settings.sound` preference, off by default. The Sound button saves that choice and requests the browser's audio unlock from the user's gesture. A saved preference after reload still needs a real pointer or keyboard activation. `sounds.js` generates short local oscillator tones; it does not fetch music or queue missed sounds. Mute, navigation and narration stop current tones. Reading controls take priority so an explanation is not covered by a win sound. An unavailable audio device leaves the game playable with visible feedback.

The parent page again begins with **For parents and curious families**. Pip the toaster and Flo the fan appear on an original dimensional paper stage, followed by a **Look → Choose → Discover** example that explains how a child uses evidence and sees the result. The fan example includes completed sharing checks and Bea wanting it; a working fan alone is not enough to justify giving it away. The preferred “Throw it away” purpose, four illustrated learning aims, “Let your child lead” invitation, optional preview and FAQs remain. The age-question panel has been removed at the user's request. Ages 7–12 remain the design scope, not a measured learning claim. Pictures and game effects use local SVG/CSS, native Web Animations and Web Audio; packaged MP3s add narration without changing the Flask/native-module stack.

Movement defaults to `settings.motion = 'auto'`: **Follow my device** respects `prefers-reduced-motion`. The top-bar Settings button opens an explicit **Game animations** choice (`full`) that allows finite effects even on a device requesting reduced motion. **Less movement** (`reduce`) always chooses still feedback; switching back to **Follow my device** restores device control. `reduced()` applies this same rule to JavaScript effects and the root `data-motion` attribute used by CSS. Hydration preserves only these reviewed choices; an unknown or missing saved value uses `auto`. This is a presentation preference, not a different scoring mode.

Sparks are **20 per unique completed mission, 5 per unique discovered concept and 10 per unique correct reflection**. Level thresholds are **0, 60, 140 and 240**. The current eight missions, eight concepts and eight reflections permit 280 Sparks. All missions remain available at every level. These are game-progress rules, not an ability assessment or a tamper-proof currency; browser storage remains editable by someone controlling that browser.

`rewardPreview()` derives what is still available from the current save, using the same progression calculation as the HUD. Its label separates finishing the story from the optional reflection. `celebrationCopy()` varies short joy messages by story/activity and receives the actual awarded difference; it never invents an extra prize on replay. The screen can stay encouraging while honestly saying an idea was earned already. Neither helper owns the stored reward rules.

## Follow an adult decision and data request

The adult entry [index.html](../index.html) loads [src/app.js](../src/app.js). Its `emptyState()` describes a new household journey. A user chooses an intent, identifies an appliance, answers the relevant safety questions, then receives permitted planning options.

The controller calls pure helpers in [logic.js](../src/logic.js): `matchRecall`, `safetyPlanFor`, `evaluateSafety`, `journeyDecision`, `compareCosts`, and location-filtering functions. Those helpers return decisions or values; the controller handles screen changes. Brand/model suggestions come from [product-suggestions.js](../src/product-suggestions.js) and existing reference/price records, not a universal product search.

`reloadPublicData()` calls [loadPublicData](../src/data-service.js). The loader requests public datasets separately, validates their response shapes and tracks each dataset's availability. `Promise.allSettled` allows useful successful datasets to survive another request's failure. `loadGeneration` lets only the latest public-data refresh replace the dataset snapshot. The returned data is deliberately applied to the current appliance, and recall/render checks run again. Separately, `geoGeneration` and `journeyId` reject outdated device-location replies. Static safety definitions and page structure are available without treating unavailable live records as a successful check.

A locations request follows this chain:

```text
src/app.js
  -> src/data-service.js: GET /api/locations
  -> backend/access.py: check website access
  -> backend/api.py: locations()
  -> backend/repository.py: relevant_locations()
  -> backend/db.py: bounded, parameterised read-only query
  -> Neon rows
  -> backend/transform.py: build_location()
  -> JSON response
  -> browser validation, local filtering and service cards
```

The user's typed brand/model, safety answers, costs, suburb and optional device coordinates are not submitted to these reference-data endpoints. Location filtering and distance calculation happen in browser memory. External map tiles or an external directions link have their own requests; “not sent to the FixForward API” does not mean the browser never contacts another provider.

| Adult code | What to read it for |
|---|---|
| [src/app.js](../src/app.js) | Screens, navigation, form handlers, async updates, maps and restart |
| [src/logic.js](../src/logic.js) | Validation, recall/safety decisions, costs and distance calculations |
| [src/data-service.js](../src/data-service.js) | Endpoint loading, bounded retries, validation and individual failure states |
| [src/data.js](../src/data.js) | Static categories, safety definitions, guidance and source context |
| [src/config.js](../src/config.js) | Public API paths and browser request configuration |
| [src/product-suggestions.js](../src/product-suggestions.js) | Category-aware optional brand/model suggestions |
| [src/price-catalogue.js](../src/price-catalogue.js) | Validate, load and match reviewed retail examples locally |
| [src/price-snapshot.js](../src/price-snapshot.js) | Labelled saved price observations; generated by the catalogue build |
| [src/suburb-index.js](../src/suburb-index.js) | Generated local suburb/postcode lookup data |
| [src/icons.js](../src/icons.js), [styles.css](../styles.css) | Adult pictograms and presentation |
| [src/learning.js](../src/learning.js) | Retained legacy picture-story code; the main invitation now opens Quest |

## Server, website access and databases

| File | Responsibility |
|---|---|
| [app.py](../app.py) | Creates `app` for Gunicorn; can start local Flask when run directly |
| [backend/__init__.py](../backend/__init__.py) | Application factory, routes, asset allowlists, error pages and response headers |
| [backend/access.py](../backend/access.py) | Shared-password login, signed access cookie, CSRF, expiry and fail-closed access |
| [backend/config.py](../backend/config.py) | Reads environment/private `.env` settings without putting secrets in the frontend |
| [backend/api.py](../backend/api.py) | JSON endpoints and generic client-facing error responses |
| [backend/repository.py](../backend/repository.py) | The application's public-data SQL reads |
| [backend/db.py](../backend/db.py) | Read-only transactions, bounded connections and transaction-local query timeout |
| [backend/transform.py](../backend/transform.py) | Converts database fields to the browser's response shape |
| [backend/price_catalogue.py](../backend/price_catalogue.py) | Validates/builds/reads the separate reviewed-price SQLite snapshot |
| [backend/check_database.py](../backend/check_database.py) | Separate diagnostic; it is not the children's game or preview server |
| [backend/templates/access.html](../backend/templates/access.html) | Login/logout/error form presentation |
| [render.yaml](../render.yaml) | Declared Render build/start commands and environment-setting names |

There are **two data stores for adult reference information**. Neon PostgreSQL provides recalls, source records, repair evidence and locations. A separately built SQLite file provides the reviewed price catalogue. Price fallback never substitutes SQLite records for missing Neon recalls or locations. Quest's browser save is a third, separate storage mechanism for game progress, not a backend database table.

The shared website password is server-side. The signed cookie represents access; it is not a child account. Missing access settings close the gate. Protected APIs return an access error rather than a login page disguised as a valid dataset. The final access/header layer makes protected responses private and non-cacheable even where an API blueprint has an earlier public-data cache default. Read [API_CONTRACT.md](../API_CONTRACT.md) for exact routes, status codes and response fields.

`/api/health` proves the Flask process can respond. It does not prove database readiness. The protected `/api/ready` endpoint performs a database query; it does not prove that every record is current, the price snapshot exists, or the whole release is approved.

### How reference data reaches the server

[data/scripts](../data/scripts) contains maintenance tools, not code run by a child's click. Their file comments distinguish downloading, cleaning, database-writing imports, diagnostics, migrations and tests. [database](../database) and [data/scripts/migrations](../data/scripts/migrations) contain SQL changes. The numeric prefixes describe the broad pipeline; they are not permission to execute every file in filename order against a live database.

In general, external records are downloaded, cleaned and imported with their source details; review is a separate step and some location candidates remain unverified. Repository queries select the records the app may expose. In particular, `data/scripts/migrations/005_recall_matching.sql` supports category-matching candidates, while `database/001_i1_recall_matching.sql` defines the separate reviewed product/identifier structure used by the public recall API. Importing a category candidate does not approve an exact product match. Read each script's arguments and write behavior before maintenance. Runtime read-only access and maintenance write access serve different purposes. Never put a privileged import connection into the web app merely to make an import work.

Some maintenance names need particular care during handover because they do more than read:

| File | Actual effect to understand before running it |
|---|---|
| [apply_schema.py](../data/scripts/apply_schema.py) | Drops application tables with `CASCADE` before rebuilding the schema; it is a destructive reset, not a harmless readiness check |
| [06_regression_tests.py](../data/scripts/06_regression_tests.py) | Can perform temporary writes to the configured database before rolling back; it is separate from the mocked/local `test_backend` suite |
| [06_fix_location_verification.py](../data/scripts/06_fix_location_verification.py) | Resets existing facility-verification fields, including records that may have received later manual review |
| [06_seed_safety_rule_sources.py](../data/scripts/06_seed_safety_rule_sources.py) | Can commit source upserts before reporting missing hazard rules with exit code 1; non-strict URL checking can also permit writes despite reported URL failures |
| [build_price_catalogue.py](../data/scripts/build_price_catalogue.py) | Builds local price outputs from reviewed inputs; it does not populate Neon |

These scripts were read and commented during this pass, not executed.

The Render build declared here installs runtime requirements and runs `data/scripts/build_price_catalogue.py`. That step builds the reviewed-price SQLite and JavaScript snapshot. **It does not automatically run the Neon download/import/migration pipeline.** Generated price/suburb outputs should be changed through their source/build process; manual comments in generated outputs may need to be retained or re-added after regeneration.

## Run and verify the code locally

For a source-only UI demo, open the correct inner checkout and run:

```powershell
npm.cmd ci
# Current review port; omit this setting to use the helper's default 5502.
$env:PORT = '5504'
npm.cmd run dev:quest
```

`npm.cmd ci` installs the versions recorded in `package-lock.json`. The preview helper itself uses Node's built-in modules; the tests also use jsdom. **For the full installed test stack, use a supported Node version from the locked jsdom requirement:** `^22.22.2 || ^24.15.0 || >=26.0.0`. This machine runs Node 24.16.0. The project's `package.json` currently declares the broader `>=20` floor, which is insufficient to describe the test dependency. This mismatch is documented here and was not changed in this comments-only pass; reconcile the declared requirement before a release handover.

| View | Preview URL |
|---|---|
| Child game | http://127.0.0.1:5504/quest |
| Parent guide | http://127.0.0.1:5504/quest?view=parents |
| Adult household guide | http://127.0.0.1:5504/ |
| Explanation of invented adult data | http://127.0.0.1:5504/test-fixture-info |

The [preview helper](../test_helpers/serve-usability.mjs) binds to `127.0.0.1`, serves only allowed files and clearly labels invented adult records. It requires no database or password and must not be used as the production server. The current review uses port 5504; 5502 remains the default when `PORT` is unset. Refresh after editing code. Stop the process with Ctrl+C. Changing the port changes the browser-storage origin, so saves at 5502, 5503 and 5504 are separate. This game-feedback review is local only: nothing has been pushed or published, and Main and Iteration 1 remain unchanged.

For Flask, use a Python environment with [requirements.txt](../requirements.txt) installed and privately configure the settings described in [WEBSITE_ACCESS.md](WEBSITE_ACCESS.md). Run that environment's interpreter with `-m flask --app app run --host 127.0.0.1 --port 5000`. Adult reference-data functionality additionally needs the intended read-only database and reviewed price snapshot. Do not copy this machine's absolute interpreter path into another developer's setup.

Run the project checks from the same checkout:

```powershell
npm.cmd run check
# Use the Python executable belonging to your installed virtual environment:
python -m unittest discover -s test_backend
git diff --check
```

On the current machine the Python executable is the outer workspace's `.venv/bin/python.exe`; the ordinary `python` command is a Windows Store alias. [QUEST_IMPLEMENTATION.md](QUEST_IMPLEMENTATION.md) contains the exact machine-specific PowerShell command. A different developer should use their own interpreter. The per-command `safe.directory` option in that guide addresses this machine's Git ownership mismatch, not a general application requirement.

| Evidence | What it establishes | What it does not establish |
|---|---|---|
| `test/quest-engine`, `quest-content`, `quest-progression` | Authored plans, allowed transitions, save validation and reward rules | Child comprehension or learning improvement |
| `test/quest-ui`, `quest-touch`, `quest-postcard` | Simulated screen journeys, direct-art dragging, per-item retries, inline clue help, pointer edge cases and SVG generation | Every physical tablet, assistive technology or actual downloaded file |
| `test/quest-narration` | Recording/device fallback, Pause/Resume/Stop races, exact transcripts and MP3 integrity | Natural delivery, clear pronunciation, audible hardware output or child preference |
| `test/quest-parent-guide`, `quest-feedback` | Family copy boundaries, retained FAQs, per-item explanation and honest reward previews | Parent satisfaction or measured learning improvement |
| Adult JavaScript tests | Local decision rules, loaders and simulated adult journeys | Current live data coverage or production networking |
| `test_backend` | Flask access/routes, transformation and mocked/local data behavior | Live Neon permissions, deployment or a penetration test |
| Earlier comment-pass source comparison | Comments in that earlier pass did not change executable source/parsed Python structure | Functional equivalence after subsequent feature work or full release readiness |

Earlier comment-pass verification is recorded in [HANDOVER_VERIFICATION.md](HANDOVER_VERIFICATION.md). The earlier feature and browser evidence is in [QUEST_TABLET_PLAY.md](QUEST_TABLET_PLAY.md). Keep dated evidence separate from checks performed on a later release.

**Review evidence, 13 September 2026:** Earlier game-feedback browser walkthroughs at 1024×768 and 768×1024 verified the reward popup/meter, retry controls fitting the screen, no browser errors, and sound reporting ready after opt-in. DOM inspection also found the expected star particles with full motion selected. Those observations predate the current scene-linked clues, direct artwork dragging, family welcome and packaged story voice; they must not be presented as browser verification of those new features.

**Current local evidence:** `npm.cmd run check` passes 301 JavaScript checks; the 9 Quest Flask route tests pass, including MP3 authentication, byte-range and HEAD behavior. Automated cases exercise exact clue text, inline help without answer loss, direct-art touch events, mixed-plan feedback and retained choices, reward previews, recorded-audio integrity and media-control races.

Chrome review of this update verified the restored parent welcome, the actual empty-report clue picture and matching scene number, portrait/landscape tablet layouts without horizontal overflow, and visible next actions for the reviewed clues. A two-item plan showed separate correct/retry explanations, kept the correct toaster choice, and awarded the advertised 30 Sparks once the box choice was corrected. Directly dragging the jug artwork to the wrong target showed a cross; retrying by tapping the jug and then Pause & ask earned 5 Sparks. A recorded story and the character greetings played through the story-voice route; Pause, Resume, matching visible transcripts and Stop worked, and no browser errors or warnings appeared during these journeys.

Playback status is not an audible quality judgment. Naturalness, pronunciation, physical-tablet sound/feel, parent reactions and children's comprehension remain human-review work. This uncommitted source update is local only; Main and Iteration 1 were not changed, and no deployment or shared database write occurred.

## Questions a reviewer can ask

| Question | Answer and where to demonstrate it |
|---|---|
| What happens after I tap a button? | Its handler in `bind()` passes an action to `dispatch`; the engine checks it, storage saves the result and `render` updates the page. Follow `COLLECT_CLUE` as an example. |
| Where is the correct answer? | In each authored mission's `acceptedPlans` and `reflection` record in `content.js`; `engine.js`/`progression.js` validate it. It is not selected by an AI model. |
| Can animation award points repeatedly? | No. `progression()` derives points from unique valid records; animation only illustrates the difference after a transition. |
| Why does the reward preview differ on replay? | `rewardPreview()` calculates only rewards still available in this save. Previously earned story/concept points are not promised again; an unearned reflection can still be available. |
| Why does one choice get a tick while the other needs another try? | `planFeedback()` compares both items with one coherent authored plan. Retry keeps both selections and marks an unchanged correct one; editing it removes that old marker. The engine still requires a fully correct plan. |
| What does picture help show? | The current scene’s numbered clue, a larger illustration and the exact authored explanation. `pictureView` is temporary; closing the expansion returns focus without clearing the child’s choices. |
| Does using a hint reduce the score? | No. Assistance is tracked for feedback/practice while the same unique rewards remain available. |
| Does a level lock children out? | No. Thresholds change the badge; all authored stories remain available. |
| What if a saved adventure is broken? | Storage checks format/version/length; `hydrateState` reconstructs permitted records. Invalid or unavailable storage has a fresh/session-play path. |
| Where does Reset act? | `clearProgress()` removes only `fixforward.quest.v1`, and the controller resets its in-memory Quest state. It does not clear adult answers or website-access cookies. |
| Why are some internal names still `grownups`? | They identify the optional parent-guide view. Changing a saved-state enum is different from editing child-facing wording; the intended players remain ages 7–12. |
| Is a drag compulsory? | No. A child can drag the sorting picture directly, use Move, or tap the picture then its destination. Plan and decoration buttons also provide alternatives. Cancelled/off-target drags do not record an answer. |
| Does the child’s tablet run the voice model? | No. Development generates fixed MP3s with Kokoro. The browser plays the matching file and exposes Pause/Resume/Stop; device speech is the fallback for other words. |
| What happens when someone edits a spoken clue? | Exact transcript lookup no longer matches the old recording. Device speech reads the new words until a matching recording is generated and reviewed. There is no fuzzy substitution of safety facts. |
| What prevents a second finger from interfering? | `drag.js` tracks the active pointer ID, handles cancellation and removes listeners on cleanup. The touch suite covers multiple-finger and pointer-ID-zero cases. |
| How is reduced motion respected? | The app combines its saved movement setting with the device preference. CSS effects require full motion and still have explicit reduced-motion rules. |
| Can children use this to test a real appliance? | No. Reports and scenarios are fictional teaching content. Real appliance decisions belong to the separate adult guide and appropriate adult/professional help. |
| Is there a scanner or live image diagnosis here? | No. Quest uses authored SVG art and stories. Do not describe earlier scanner feedback as an implemented classifier. |
| What happens if one adult API fails? | Each dataset has its own availability state. The app preserves useful data and shows bounded recovery/uncertainty; an outage is never recall clearance. |
| Is a no-match recall result proof of safety? | No. Matching is conservative and coverage limited. `matchRecall` and its tests preserve this distinction. |
| Does the website send household answers to Neon? | The reference-data API loads public lists. Household answers and location filtering stay in browser memory; there is no corresponding journey-write endpoint. |
| Why use SQLite as well as Neon? | SQLite is the separate reviewed-price snapshot. Neon supplies the other public reference datasets. Their availability and evidence are separate. |
| What is saved after refreshing? | Quest progress/settings/designs can return from browser storage. Adult journey answers are in memory and do not have the same persistence promise. |
| Does a working local demo prove deployment readiness? | No. The preview uses invented data and no production gate. Verify the actual Flask release/configuration and outstanding manual checks separately. |
| Can a new developer explain their changes? | They should trace the input, rule, saved/result value and visible result, then show the relevant test. Comments and this guide are a starting point for that explanation. |

## Make a future change without breaking the connections

For story wording, start in `content.js`. Keep stable IDs unless you also plan how old saves are reconstructed. A new mission needs its clues, slots, permitted actions, accepted plans, feedback, reflection, concepts, sources and artwork connections. Review the content and UI tests, scene marker/art connections, per-item feedback, passport labels and reward assumptions together. Regenerate changed narration through the commented script, inspect the exact transcript/manifest match, and listen before accepting the replacement recording.

For points or thresholds, start in `progression.js`, then update the rules shown by `levelInfo()` and the parent/documentation explanations. A visual badge change belongs in `art.js`; it should not change the engine's result.

For a layout or animation change, use the child CSS files and named SVG groups. Preserve focus, readable text, tap alternatives, scrolling outside drag handles, finite effects and reduced motion. For adult decision changes, start with `logic.js` and its safety/uncertainty tests rather than hiding a rule inside screen markup.

For a new server endpoint, connect the access gate, route, bounded repository query, transformation, API contract, browser validation and tests. Do not return sensitive connection details in an error or serve a private file through the asset route. A new Quest asset also needs the explicit Flask allowlist and route test reviewed.

When a rule changes, update its nearby comment, relevant test and this guide in the same review. Comments that explain old behavior are worse than missing comments. Generated datasets, dependency code and opaque SVG coordinates need a responsibility/schema explanation, not a sentence attached to every value.

Before an actual release, tie evidence to the exact reviewed source revision. Re-run applicable automated checks, exercise the real Flask access/data routes, and complete the outstanding physical-device, zoom, assistive-technology and download checks described in the current feature report. Record live configuration/data verification and the team's release decision separately. No deployment or database maintenance is performed by reading this handover.
