# FixForward Quest: local implementation and handover

13 September 2026. FixForward Quest is an adventure **for children aged 7–12**, alongside the adult website. The creative refresh gives children more character dialogue, visual discoveries and choices about what they make. Playing with a companion is optional. The current release branch is `iteration-2`; the dated verification below describes local checks, not a verified live deployment. Those implementation checks did not change production databases or hosting settings.

Use `iteration-2` for ongoing development and review. Main at `fixforward.me` stays stable until the user explicitly approves the reviewed release, and `iteration-1` remains the preserved original website. Follow the canonical [site roles](../README.md#branches-and-websites), [I2 manual deployment workflow](../README.md#development-and-review-workflow) and [shared database boundary](../README.md#shared-database-boundary). The dated implementation evidence below remains separate from current deployment verification.

The new creative controls are implemented and the current automated checks pass. Desktop browser checks, saved postcard choices, reduced motion and adult-state isolation were also verified. Phone screenshots, actual downloaded-file inspection, a precise successful pointer drop after the final font change and 200% zoom remain unverified. See [QUEST_CREATIVE_REFRESH.md](QUEST_CREATIVE_REFRESH.md) for the rationale and evidence limits.

## Open and run this exact checkout

Open this folder in VS Code:

```text
C:\Users\sansk\Downloads\FixForward-v1.6-Usability-Lab-Prototype\fixforward_human_first_v1_6\tmp\child-quest-prototype
```

In a PowerShell terminal:

```powershell
$questRoot = 'C:\Users\sansk\Downloads\FixForward-v1.6-Usability-Lab-Prototype\fixforward_human_first_v1_6\tmp\child-quest-prototype'
Set-Location -LiteralPath $questRoot
npm.cmd run dev:quest
```

Keep that terminal running. Open these in separate tabs:

| Experience | Local URL |
|---|---|
| Child Quest | http://127.0.0.1:5502/quest |
| Existing adult FixForward | http://127.0.0.1:5502/ |
| Explanation of adult test records | http://127.0.0.1:5502/test-fixture-info |

The single Node preview process serves both entry points on **127.0.0.1:5502**. No separate frontend server, Flask process, database or credentials are required for this review. Node 20+ is required; this machine was checked with Node 24.16.0. Use `npm.cmd` because this PowerShell environment blocks `npm.ps1`.

This helper is an isolated, loopback-only test fixture. The adult page clearly labels its invented recall, repair-count and location records. These are not live service results and must not inform a real appliance decision. Quest's footer **About this adventure** also identifies the review data. Quest's authored stories do not use those API responses. Never deploy this helper as the protected website.

Stop with **Ctrl+C**. After restarting the computer, open the same folder and run the same command again. The server starts afresh; browser Quest progress remains under the same origin/profile unless cleared or blocked. Refresh the browser after editing source files: this legacy module uses native ES modules and manual refresh, with no bundling or hot-module-reload step. No offline cache is implemented.

If port 5502 is occupied, stop the earlier copy in its terminal. Alternatively set `$env:PORT = '5503'` before starting and use port 5503 in both URLs. Different ports are different browser-storage origins, so an adventure saved at 5502 will not automatically appear at 5503.

## Authenticated Flask integration

The normal Flask app now serves `/quest`, `/quest/` and an explicit child asset allowlist through the **existing website-access gate**. The adult `/` route remains in place. This checkout has no `.env`; the preview does not create or copy one.

For a separate full-site local review, configure the existing private website-access settings using [WEBSITE_ACCESS.md](WEBSITE_ACCESS.md), then run from the same checkout:

```powershell
$questPython = 'C:\Users\sansk\Downloads\FixForward-v1.6-Usability-Lab-Prototype\fixforward_human_first_v1_6\.venv\bin\python.exe'
& $questPython -m flask --app app run --host 127.0.0.1 --port 5000
```

That interpreter exists on this machine (Python 3.12.11). Its `bin` path is intentional; the ordinary `python` command here is a Windows Store alias. Flask URLs are http://127.0.0.1:5000/quest and http://127.0.0.1:5000/. Sign in using privately configured site access. Do not paste credentials into a terminal transcript or documentation. Adult reference-data functions additionally need their configured read-only database connection. Quest interactions do not need it after the assets and required access are available. Missing configuration still fails closed; no production access controls were relaxed.

## Starting state and implementation decisions

- The supplied workspace root was an unversioned legacy Flask/vanilla-JavaScript copy. The mentioned React/Vite ZIP and its `SortTheStream.tsx` were not present; `sunny/` was empty. Existing legacy learning and adult decision logic were inspected. No project migration was attempted.
- The tracked baseline was the clean `main` checkout in `tmp/github-update`, at **c203c3827acfb3b8ef1124a7f643943dad9ff6b6**. Implementation began in a separate worktree on **feature/child-quest-prototype**; this same worktree now uses **iteration-2**. Existing root and baseline work were preserved. No applicable `AGENTS.md` was found in the inspected workspace hierarchy.
- Keep this worktree and `tmp/github-update` in place: Git worktrees reference their parent repository. Use `git -c safe.directory="$questRoot" status --short` to review tracked changes and new files. The per-command safe-directory option handles this machine's ownership mismatch without changing global Git configuration.
- Child styling and imports are separate. The adult page gains only a small **Quest for kids** link opening a new tab. **About this adventure**, in Quest's footer, opens a fresh adult `/` tab without parameters. It cannot carry a fictional condition, assessment or recall result into the adult state. The original adult tab retains its in-memory answers while it stays open; adult reload is a separate operation.

## Implemented behaviour and changed files

| Files | Responsibility |
|---|---|
| `quest/index.html`, `quest/quest.css`, `quest/app.js` | Separate entry, character greetings/dialogue, clue pocket, story projector, focus, tap/keyboard alternatives, narration, settings and footer About view |
| `quest/art.js`, `quest/play-effects.css` | Original local SVG Pip/Flo, appliances, three locations, eight story stamps, scene consequences, decoration slots and finite story motion |
| `quest/content.js` | Eight authored missions with stage dialogue and postcard closures, 17 short clue labels, 12 sorting cards, eight concepts, nine sources and content validation |
| `quest/postcard.js`, `quest/postcard-options.js` | Standalone SVG postcard creation, three fixed themes/stickers and filenames derived from authored mission IDs |
| `quest/engine.js` | Pure mission/sorting transitions, retries, duplicate-safe completion, practice suggestions, earned decorations and validated postcard choices |
| `quest/storage.js` | Versioned `fixforward.quest.v1` save, including postcard choices, whitelist validation, corrupt/old/unavailable-storage fallback and child-only reset |
| `quest/drag.js` | Real pointer ghost and DOM-rectangle hit testing using viewport coordinates, cancellation and navigation cleanup |
| `backend/__init__.py`, `index.html` | Protected child routes/assets and small adult-to-child link |
| `test_helpers/serve-usability.mjs`, `package.json` | Documented local preview and Quest verification commands |
| `test/quest-*.test.js`, `test_backend/test_quest_routes.py` | Content, engine, pointer, rendered UI and authenticated route regression checks |
| Quest documents and `AI_USE_ACKNOWLEDGEMENT.md` | Sources, implementation evidence, demo, comparison worksheet and AI-use handover |

The reusable story loop is intro → explore → plan → feedback → outcome. Pip or Flo speaks at each stage, reacts to a retry and offers a short closing line. Children choose the mission and plan; Sam, a fictional adult owner/helper, and Jo, a qualified repairer, take responsibility for practical actions within the story. Repeated adult-directed prompts have been reduced; explicit trusted-adult help remains part of warning and uncertainty decisions.

The **clue pocket** collects short labelled buttons for discovered evidence. A child can reopen those clues while exploring or planning. Wrong plans can retry or revisit clues. Moving-day slots identify different items and accept either placement order. Both Guided and Challenge retain the same reviewed rules; hints remain available. **Secret envelope** appears only in the optional shared kettle story. It contains Jo's fictional report and can be opened solo or with a companion.

Sorting has five unique cards per round. Its deterministic selection guarantees all three destinations in the first three cards, then adds two other cards. Previously valid saved rounds preserve their order. Correct placement displays the object inside the selected destination; a wrong answer reveals a clue and permits another choice. Off-target or cancelled dragging records no answer. Independent and helped answers are kept separate without a time limit, leaderboard or speed reward.

The **story passport** has eight stamps, one per completed mission, and appears on the map and in the Discovery Book. An unearned stamp opens its story; an earned stamp opens that story's postcard designer. Stamps are separate from concept discoveries, which sorting can also unlock. The book retains explanations and optional tree/flower/flag/bench decorations for three neighbourhood spaces.

At a mission outcome, **Your story projector** switches between **Before your choice** and **The next chapter**. This views the same fictional scene; it is not another scored decision. **Create my story postcard** opens a designer with **sunshine**, **starlight** and **mint** themes, and **star**, **leaf** and **spark** stickers. Choices update the preview and save with the completed mission when storage is available. Older valid saves without postcard choices use defaults. **Save my postcard** requests a local `.svg` download named `fixforward-quest-<mission-id>.svg`; it does not post or share anything. Browser settings determine the download location. No name or free-text signature is requested.

Suggestions use a small deterministic practice rule, not AI inference or a validated ability score. Every mission remains selectable. No camera, barcode, chatbot, multiplayer, score upload, player-name fetch or analytics flow was added.

Narration uses browser speech synthesis with visible text and an unavailable-voice fallback. A voice may use an online service; local-only processing is not promised. Navigation and modal dismissal cancel narration. Character greetings, evidence arrival, route reveal and stamp effects are finite CSS animations, each **580 ms or shorter**, with no looping celebration or animation-driven award. Both **Less movement** and device reduced-motion preferences suppress them; JavaScript scrolling also respects the preference. Text and final scenes remain visible without motion. Warning objects stay still. Pointer-following movement remains direct input feedback, and screen removal cancels outgoing CSS effects.

The adult explanation and sources live under footer **About this adventure**. They do not interrupt every mission. The secret envelope is an optional play choice; adult availability is not required to finish a round.

## Sources and content boundaries

See [QUEST_CONTENT_SOURCES.md](QUEST_CONTENT_SOURCES.md) for exact URLs, publishers, jurisdictions, real check dates, unknown licences, access limitations and mission/card traceability. Rules draw on Energy Safe Victoria, CFA, Merri-bek and Sustainability Victoria. UNICEF and W3C inform interaction design, not scored appliance safety claims. Stories, illustrations and fictional assessments are original authored content, not imported appliance records or certifications.

The sorting paper/cardboard context is Merri-bek. Appliance glass teaches uncertainty; no universal household-bin system is claimed. No scraper, public submissions, copied map listings, new data collection, invented price or environmental-impact figure was added. Existing adult recall uncertainty and safety logic are untouched.

## Verification commands and current evidence status

```powershell
Set-Location -LiteralPath $questRoot
npm.cmd run check
npm.cmd run check:quest
& $questPython -m unittest discover -s test_backend
git -c safe.directory="$questRoot" diff --check
```

The preview needs only Node's built-ins. Automated UI tests also need the existing jsdom development dependency. It was already available from this workspace's parent installation. On a fresh checkout, run `npm.cmd ci` before the tests.

### Creative-refresh verification, 13 September 2026

- The final full JavaScript run passed **187 tests: 144 existing adult tests and 43 Quest tests**, with exit code 0. Its local log is `tmp/quest-creative-check.log`. The latest focused Quest run also passed all 43 tests. The backend suite passed **66 tests**. Renderer/XML and export unit checks pass; these are automated evidence, not proof of a browser-created download file.
- Actual Chrome desktop screenshots of the refreshed home and a **starlight/leaf** postcard were visually inspected. The postcard scene stayed within its frame after the global SVG sizing fix.
- A browser journey completed Flo's reuse mission. The clue pocket progressed **0 → 1 → 2**. **Before your choice** and **The next chapter** toggled their labels and scene view while the Discovery Book count stayed at **1**. Selected **mint/leaf** choices persisted after reload, returning to the book and reopening the earned story's designer.
- DOM measurements at **390 × 844** and **320 × 800 CSS pixels** found no horizontal overflow. Theme targets measured **109 × 75** and sticker targets **86 × 75 CSS pixels**. At 390 pixels the passport used two columns, with a measured title font size of **12.48 CSS pixels**. Phone screenshot captures timed out, so these measurements are not a visual review of the current phone screens.
- In the real browser, **Follow my device** resolved to reduced motion, and Flo's computed animation was `none`. Normal-motion effects were reviewed in code/CSS only; their timing and appearance were not observed in this refresh.
- At 320 pixels, a real sorting drag produced wrong-placement feedback and allowed retry. Keyboard **Enter** on **Pause & ask** then correctly placed the card. A precise successful pointer drop after the final font change was not confirmed; earlier successful-drop evidence remains historical below.
- **Save my postcard** displayed its expected status. The download-event wait timed out and the file was not found in Downloads. Actual browser export-file creation and visual inspection therefore remain unverified, despite passing renderer/XML and export unit checks.
- The original adult tab remained on **Toaster**, safety question 1, with **Not sure** selected and **1 of 4 answered** after the child checks. The refreshed child home and that adult tab were preserved; the browser viewport override was reset. No child participant session or actual 200% zoom check was conducted.

These checks cover the specific browser interactions described, not manual completion of every mission, variant or creative choice. The following record belongs to the earlier prototype and is not verification of newly changed screens.

### Previous verification record, before the creative refresh

- The earlier run recorded **176 passing JavaScript tests**, including 144 adult baseline tests and 32 Quest content/engine/UI tests, plus passing syntax checks. Those focused checks covered all eight rendered story paths, every accepted plan, wrong/retry/revisit, two-item placement order, five-card rounds, duplicate actions, resumed sorting, hints, saving/reload/reset and blocked/corrupt storage.
- The earlier run recorded **66 passing backend tests**, including eight new Quest route checks for the unchanged gate, expiry, fail-closed configuration, security/cache headers, MIME types, explicit assets, adult entry and unavailable-data independence.
- Pointer tests exercise actual cloned ghosts and simulated pointer cancellation/Escape/resize/navigation, off-target bounds, stacked rectangles and duplicate releases. UI fixtures deliberately make data fetching fail and assert **zero Quest fetch calls** throughout the rendered journeys. These are automated tests, not child observations.
- Real Chrome interaction completed Flo's reuse story with keyboard activation and a wrong-plan recovery. Its outcome changed the scene and survived reload. A full mixed sorting round was completed with actual Tab/Enter navigation, including a wrong jug answer and retry; the result was **4 independent / 1 with help**.
- Real pointer drops passed at desktop, at **390 × 844 CSS pixels**, and at **320 × 800** with vertically stacked destinations after scrolling about 225 CSS pixels. The stacked paper drop deliberately used the left part of the second target, so horizontal-third classification could not pass it. A phone off-target drop recorded no answer; dragging again after resizing worked. Tap decoration placement and a real flower drag to the Studio slot passed.
- Phone and desktop screenshots were inspected, and DOM measurements checked reading order, current objects, targets and horizontal overflow. The 390-pixel sorting object and all destinations fitted together. The phone entry showed its start action and illustrated neighbourhood without horizontal clipping.
- A second fan mission completed in **Challenge + Less movement** mode. Its action tile was dropped into the plan with a real pointer at 390 pixels after scrolling. The assessment outcome remained visible with `animation-name: none`. Plan reflow checks at **640 × 400**, **844 × 390** and **768 × 1025** found no horizontal overflow or play buttons smaller than 44 CSS pixels. The 640-pixel reflow check is not a claim of actual 200% zoom testing.
- The cooperative kettle card displayed its actual fictional repair report with a solo return path. The companion opened a separate adult tab with no appliance preselected. A deliberately named local test toaster journey retained its **Not sure** answer while Quest navigated and reset. The adult no-match wording still explicitly denied recall clearance.
- Real reset checks covered cancel (six discoveries remained), confirm and reload (fresh entry, zero discoveries). Only the adventure created during that verification was cleared. At the end of that earlier check, Quest was at its fresh start screen, both comparison tabs were open and the loopback preview was running. Browser overrides were reset. This describes that check's end state, not the browser state during the creative refresh.

## Remaining review limits and useful Iteration 3 work

Actual touch hardware, an assistive-technology screen-reader session and observed children were unavailable. Pointer cancellation and resize-during-drag were exercised with focused event tests; the browser drag API performs a whole drag atomically. Do not describe these as physical touch tests.

Actual **200% browser zoom was not verified**: keyboard zoom did not change the browser's zoom, and browser security policy blocked the settings page. Responsive/reflow checks are separate evidence. A reviewer should manually use Chrome's menu to set 200%, complete a story and a sorting choice, inspect the book/dialogs, then restore the prior setting. This is an outstanding accessibility check, not a failed game path.

For the creative refresh, also inspect actual phone screenshots and a browser-created SVG file, observe normal-motion effects, and confirm a precise successful pointer drop with the final typography. The current desktop screenshots, DOM geometry, reduced-motion observation and automated export checks do not replace those specific checks.

No production release or live-database verification belongs to this local build. No learning-effectiveness or retention claim is established. Before involving children, follow the course's appropriate consent, assent and research process. Students still need to review AI-assisted content and complete their own contribution/declaration evidence.

Useful I3 work: observe whether children independently start, use the clue pocket, explain a changed condition and choose to create or finish; refine dialogue and visual detail from those observations; check postcards and scenes on physical touch devices and with assistive technology; conduct the manual zoom check; add further reviewed optional cooperative stories and condition variants; have an appropriate human reviewer assess the teaching rules. The separate redesigned adult product and camera/barcode investigation remain future work.

Use [QUEST_DEMO.md](QUEST_DEMO.md) for the mentor walkthrough and [QUEST_COMPARISON_WORKSHEET.md](QUEST_COMPARISON_WORKSHEET.md) for a fair, untracked formative comparison.
