# FixForward I3 — 3D world frontend

This is the unified Iteration 3 family frontend: understand an appliance, explore its parts and impact, and choose a practical next step. Adults can go straight to **Take action** without playing a game. Children can explore and practise decisions with an adult. The folder keeps its development name, but Flask now serves this interface at the I3 website root.

This frontend is now the Iteration 3 entry page served by Flask behind the existing password gate. The previous adult app remains at `/legacy` and the original Quest remains at `/quest`. Main and Iteration 2 are unchanged. This folder has its own styles and saved progress and reuses the earlier sorting module and existing public-data/AI adapters.

## Run locally

For the complete application, use the normal repository Flask startup and configured environment described in the root README. The existing website password gate and same-origin read-only APIs apply. No database migration or import is required by this frontend.

For an isolated design review with operational data deliberately disconnected:

From the repository root, in PowerShell:

```powershell
node prototypes/i3-world-preview/serve.mjs
```

Open **http://localhost:5533/prototypes/i3-world-preview/**. Keep that terminal running; press `Ctrl+C` to stop it. Use the repository's supported Node version, as specified in the root `package.json`.

The local server binds to `127.0.0.1`. It is a review server on this computer, not a public deployment or a phone-accessible LAN server. Opening `index.html` directly through `file://` will not provide the module/API routing this preview expects.

## What is in this version

- All 32 Explore items have their own real WebGL model with selectable and separable parts. The room overview preserves the original twelve-item home; the picker and cards reach all 32. Geometry is created locally without downloading separate model files.
- Twenty additional models adapt reusable geometry from the reference Site and add new product-specific shapes. See [model and content sources](../../docs/EXPLORE_3D_SOURCES.md) for provenance and care/energy references.
- Room overview, orbit/zoom, selectable parts, animated separation of parts, and a reset view. The first-person walking controls have been removed from the interface.
- **Parts / Care / Energy & CO₂e** panels for each product, with continuity into adult actions.
- Camera AR through WebXR on supported devices, with honest support/permission feedback.
- A prominent adult action centre for recall checks, repair, recycling and reuse. A personal task/date can be saved on this browser.
- The existing sorting interaction with practice, picture-only dragging, immediate retries and explanatory feedback.
- Optional activity sounds, reward animation and saved learning cards. No automatic voice, child account or public leaderboard.

Models are simplified educational illustrations. Their separated parts are not instructions to open a real appliance. Care guidance is general; an adult must follow the exact model's manufacturer instructions.

## Click-to-code guide for an interview

| What someone does | Where to show the code | How it connects |
| --- | --- | --- |
| Clicks Home, Explore or Take action | `app.js`: `onNavigate()` and `renderRoute()` | A hash route selects the page. The page module loads only when needed. Native browser Back/Forward still works. A generation token prevents a slow old page from replacing the new page. |
| Opens the 3D homepage | `app.js`: `mountHome()` → `world-engine.js`: `createWorld()` | The root app supplies a canvas. The engine builds the room, camera, lights and meshes, then renders them with Three.js. |
| Chooses a product card | `explore.js`: `chooseAppliance()` → `world-engine.js`: `setAppliance()` | One product ID selects both its visible model and the matching teaching content in `catalogue.js`. The selected item also travels to Take action. |
| Taps an actual model or part | `world-engine.js`: `hitAt()`, `findPart()`, `setSelectedPart()` → `explore.js`: `choosePart()` | A ray is cast through the tap into the scene. Mesh metadata identifies the product/part. The same state also drives the accessible text buttons and explanation. |
| Opens the room overview | `world-engine.js`: `showRoom()` | The camera shows the shared room; selecting an appliance opens its close-up. First-person walking helpers remain in the engine but are not exposed by the current interface. This is separate from camera AR. |
| Separates the digital parts | `world-engine.js`: `setExploded()` and frame `render()`; `models.js`: `part()` and `models-expanded-*.js` builders | Each part has its own geometry and an exploded offset. The frame loop moves it towards that offset instead of swapping in a flat picture. |
| Clicks “View in my room” | `world-engine.js`: `enterAR()` | After support detection and a user action, the browser requests an `immersive-ar` session and surface hit testing. A detected surface positions the reticle; a select event places the model. |
| Changes power, time or grid | `explore.js`: `renderImpact()` and `updateImpact()` → `catalogue.js`: `calculateImpact()` | Validated numeric inputs produce a transparent electricity-use estimate. No AI guesses the footprint. |
| Answers a discovery or sorting question | `explore.js` or `../i3-family-preview/sorting.js` → `app.js`: `onLearn()` / `onAward()` | The activity explains the answer. Stable reward IDs in `progress.js` stop repeated clicks from earning the same reward twice. The shell updates the total and animates Sparks. |
| Checks a brand/model | `action.js`: `bindRecall()` → `showRecall()` → `../../src/logic.js`: `matchRecall()` | The form preserves free text. The existing pure matcher compares supplied identifiers with available recall records. Editing an identifier invalidates the old result immediately. |
| Searches for a repair/recycling place | `action.js`: `bindServices()` → `showServices()` | The existing suburb index resolves the area. Ambiguous postcodes prompt a suburb choice. Existing location rules filter available data; unavailable data never becomes invented providers. |
| Saves a personal next step | `action.js`: `bindPlanner()`, `saveActionPlan()` and `readActionPlan()` | Only appliance name, task and optional date are saved locally. This is a personal plan, not a completed repair, booking, reminder or measured carbon saving. |
| Leaves a page | Feature cleanup returned to `app.js`: `renderRoute()` | Event listeners, pending requests, observers, rendering and GPU resources are released. This prevents stale actions and avoids leaving an old scene running. |

Each authored JavaScript file has comments above its main functions and around important state, safety and lifecycle decisions. CSS comments explain layout groups. The small function map above is a guide to those inline comments, not a substitute for them.

## How the existing AI connects to the frontend

In `action.js`, `bindRecall()` mounts the existing `../../src/photo-helper.js` through `mountPhotoHelper()`.

The chain is:

1. The existing classifier policy checks `model/appliance-siglip/model_manifest.json`.
2. Only if that policy permits recognition does the optional browser photo helper become available.
3. Its confirmed suggestion sets the appliance category field.
4. The owner separately enters/confirms brand and model, then explicitly checks recall records.

The current photo policy remains paused. This preview does not enable a model, download its weights while paused, retrain it, or claim improved accuracy. A category suggestion is not OCR, a fault diagnosis, a recall decision or a safety certificate. The 3D models are original geometry and do not depend on the classifier.

## Live application data versus the optional design server

`action.js` calls the existing `../../src/data-service.js` adapter with **GET requests only**. `src/config.js` supplies same-origin `/api/recalls`, `/api/sources`, `/api/repair-evidence` and `/api/locations` endpoints. The adapter's normal deadline is retained, including time for cold database reads.

**When served by Flask:** the Action Centre consumes the actual API responses. `backend/api.py` reads reviewed recalls through `repository.reviewed_recall_products()` and household electrical service candidates through `repository.relevant_locations()`. The browser matches identifiers and filters distances. It does not substitute static recall/location fixtures. `PRICE_SNAPSHOT` is used only to assist brand/model typing; it does not supply recall decisions or provider listings.

**When served by `serve.mjs`:** `/api/*` deliberately returns **503**, so this isolated design review never connects to Neon. Recall/location records display an unavailable state and official source links. The loopback server does not load database credentials, run migrations or expose environment files.

In both modes, successful records, an empty successful response and an unavailable response remain distinct. Fallback arrays have `availability: false`; they cannot turn an outage into a reassuring no-match result. Tests cover both positive API-shaped responses and outage states. Live database availability still requires a live service check; a passing synthetic test is not evidence of current Neon health.

The 3D catalogue includes Laptop, which is outside the existing reviewed recall-category list. The Action Centre retains Laptop and sends the owner to the official register; it does not silently replace it with Kettle or report “no recall”.

Brand/model/location drafts stay in module memory for the current tab. Learning uses the separate key `fixforward-world-preview-v1`. The optional adult task uses `fixforward-world-adult-plan-v1`. Existing Quest saves are untouched. A blocked browser store leaves the UI usable and reports a failed task save.

## What the CO₂e numbers mean

Power and daily time are editable examples, not measured averages for every product. The calculation is:

```text
electricity (kWh) = watts ÷ 1,000 × daily minutes ÷ 60 × days
estimated electricity emissions (kg CO₂e) = kWh × grid factor
```

`catalogue.js` holds the state-specific **scope 2** factors and source link to the Australian Government's [National Greenhouse Accounts Factors 2026](https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2026), Table 1. The default Victorian factor is **0.74 kg CO₂e/kWh**. A custom factor is explicitly labelled as custom.

This estimates generation associated with grid electricity use. It excludes manufacturing, transport, disposal, upstream fuel and network losses. It is not the appliance's complete lifecycle footprint, and no verified emissions saving is credited to a user. The assumptions and source are available in the visible impact panel.

## 3D, AR and performance boundaries

The renderer uses locally hosted **Three.js 0.180.0** and `OrbitControls`, with upstream MIT licensing retained in `vendor/`. See `vendor/README.md` for provenance and the two import-path adaptations. Application logic belongs in the commented authored files, not the generated vendor library.

The app lazy-loads feature modules. Models are built from local geometry instead of downloading large model/texture packs. The loopback server compresses and caches vendor files; authored preview files stay uncached for review. The renderer caps pixel ratio, skips hidden/offscreen views and idle frames, and disposes resources when leaving a route. Reduced-motion preferences are respected.

**Camera AR still needs physical-device verification.** It requires a compatible browser/device, a secure context and the device's permission. Desktop 3D and mocked tests do not prove real surface detection, camera permissions, placement scale or AR tracking. Use the HTTPS I3 application on a compatible device for that check; the loopback-only design server is not a remote tablet URL. Flask allows same-origin camera/spatial-tracking features, but browser/device permission is still required. Unsupported devices retain the 3D studio and clear feedback.

## Tests and review

From the repository root:

```powershell
node --test prototypes/i3-world-preview/*.test.js
```

These tests cover model/part contracts, catalogue calculations, UI state, route cleanup, recall-data states, selected-item continuity, suburb disambiguation and local planning. They use synthetic fixtures where operational records are needed. They do not establish production data accuracy, image-model accuracy or physical AR performance.

Also review the running preview on desktop and tablet-sized layouts: open each product, tap a part, separate/reset it, read Care, change the impact inputs, follow Take action, retry a sorting answer, and use browser Back/Forward. A real device is required to validate actual touch feel, GPU performance and camera AR.

When Flask serves this frontend at `/`, its same-origin APIs use the existing read-only backend. Only the optional loopback design server returns the deliberate 503 states described above. Publishing this frontend is restricted to Iteration 3 under the repository's `AGENTS.md` workflow.

## Review the completed 32-item model catalogue locally

For the existing Explore AI review on port 5580, keep its terminal running and open
`http://127.0.0.1:5580/prototypes/i3-world-preview/#explore`.
No Main, Iteration 2 or hosted Site deployment is performed by editing these files.

The local-only `models-gallery.html` review page renders all 32 real models into a
contact sheet with one WebGL renderer. Toggle Whole / Separated parts to inspect
model silhouettes and interiors. This is a developer check, not a second customer
journey. `engine.test.js` checks matching semantic parts, finite geometry and a
per-model triangle budget; `explore.test.js` checks UI/learning/photo-confirmation
and the adult handoff. Camera AR still requires a supported physical device.
