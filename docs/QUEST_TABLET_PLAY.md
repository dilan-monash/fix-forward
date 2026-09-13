# FixForward Quest: tablet play refinement

13 September 2026. This local build responds to the user's request for a more playful, tablet-first adventure for **children aged 7–12**, simpler English and a clear explanation for parents. It adds picture choices, four levels, Sparks, a short clue reflection and more expressive finite art sequences. These are design and implementation changes; they do not establish that children understand more or enjoy the experience more.

This document supersedes the feature descriptions in [QUEST_CREATIVE_REFRESH.md](QUEST_CREATIVE_REFRESH.md) for this refinement, including its earlier 580 ms motion limit. Earlier dated test totals and browser observations remain historical evidence in [QUEST_IMPLEMENTATION.md](QUEST_IMPLEMENTATION.md). The automated results and specific browser checks from this refinement are recorded below, with the remaining review limits. Those local checks did not change production hosting or databases and are not evidence of a live release.

The current release branch is `iteration-2`. Keep the existing `main` branch and its current Render website as Iteration 1, and use a separate Iteration 2 service and URL for the mentor comparison. Confirm that separate deployment before reporting it live.

## Open the local build

Use the existing `tmp/child-quest-prototype` checkout on `iteration-2`. Run `npm.cmd run dev:quest` from that folder and keep the terminal open. The [implementation guide](QUEST_IMPLEMENTATION.md) has the full Windows path and commands.

| Entry | Local URL | Purpose |
|---|---|---|
| Child adventure | http://127.0.0.1:5502/quest | Story quests, sorting and creations |
| Parent guide | http://127.0.0.1:5502/quest?view=parents | Why Quest exists, learning intentions, help, privacy and sources |
| Adult FixForward | http://127.0.0.1:5502/ | Separate household appliance journey |

The preview runs on the same loopback-only helper as before. Its adult test records are explicitly labelled synthetic examples. Quest uses authored stories. This helper is not a production server. Normal Flask `/quest` routes and their assets retain the existing access gate.

## What the child can do

The home has three large choices: **Story quests**, **Sorting game** and **My creations**. The illustrated map and Pip/Flo greetings remain available. Stories still follow meeting a character, finding clues, making a plan and seeing what happens. Every story remains available at every level.

Plan choices now combine a picture and a short label. In a story with one plan space, tapping a picture fills that space immediately. The child can change the choice, then use **See what happens** to check the plan. The two-item moving-day story keeps two steps: choose a picture, then choose the toaster or cardboard space. Either item can go first. Optional **Move** handles still support dragging. Sorting destinations can also be chosen directly, and decorating keeps its choose-an-item, choose-a-place controls.

Discovered evidence stays in **Your clue pocket** and can be reopened. Eight completed stories still award eight distinct stamps. The story projector retains its before/after controls and adds **Play ending** for a deliberate replay. Postcard themes, stickers, saved designs, local SVG download requests and neighbourhood decorations remain part of **My creations**. Playing an ending, changing a design or replaying a story does not create another reward for the same completed item.

## Four levels and the exact Spark rules

The local rules are defined in [progression.js](../quest/progression.js). The progress strip shows the current level, Sparks and the amount needed for the next level. Tapping the badge opens **Your Spark adventure**.

| Level | Title | Starts at |
|---|---|---|
| 1 | Clue Scout | 0 Sparks |
| 2 | Story Solver | 60 Sparks |
| 3 | Next-Chapter Maker | 140 Sparks |
| 4 | Quest Guide | 240 Sparks |

| First valid achievement | Sparks | What counts |
|---|---|---|
| Finish a story | 20 | One completed authored mission ID |
| Find an idea | 5 | One distinct concept ID, found through a story or sorting |
| Answer a story's picture question | 10 | The correct reflection for a completed mission |

Hints and retries earn **the same rewards**. Helped and independent answers can still be distinguished in the existing feedback, but assistance never reduces Sparks. Wrong choices do not subtract points. Repeated stories, repeated discoveries and repeated correct reflections cannot count twice. Sorting awards new concept discoveries; finishing a five-card round has no separate Spark bonus.

For example, completing Flo's reuse story on a fresh save adds 20 story Sparks and 5 for the new reuse idea. Its correct picture reflection adds 10 more, making 35. If reuse was already discovered in sorting, the story adds only its 20 completion Sparks. With the current eight missions, eight concepts and eight reflections, the finite maximum is **280 Sparks**. Level 4 starts at 240; it does not mean every story and reflection has been completed.

The meter measures progress within the current level, rounded to a percentage. At level 4 it shows the four badges as earned. Sparks are recomputed from valid local completion, discovery and reflection records. A separate points total is not stored or uploaded. The total describes game progress, not ability, a school mark, safety knowledge or real waste saved. There is no leaderboard, countdown, daily streak or level-based story lock.

## A small picture reflection

Each earned story outcome offers exactly two picture choices about its evidence. This appears after the story is complete, so it does not remove the earned stamp or block creating a postcard, choosing another story or finishing for now. The correct option depends on what that story said. In Kiki's story, for example, the report says a repair **is possible**; it does not say the repair **is finished**.

A wrong choice shows a friendly explanation and permits another try. The same 10 Sparks remain available. Only a correct response to an already completed mission is saved, once per mission. An old valid save without reflections starts with none recorded. This is a short practice interaction, not a validated comprehension assessment.

## Shorter words, visible help and narration

The content pass shortened story, clue, action, feedback, concept and sorting sentences, and removed decision jargon such as “diagnosis”, “assessment” and “handover” from those child-facing fields. Each mission has a child summary of no more than 12 words and a separate parent-readable learning goal. The content audit checks short sentences, retained warning decisions and unchanged authored plans/source references. A sentence-length check is an editing aid; it does not prove an age-appropriate reading level or comprehension.

Sam is the fictional adult helper/owner, Jo is a qualified repairer and Bea is the receiving household in reuse stories. Warning and missing-information choices still call for trusted-adult help. No child is asked to handle or repair a real electrical item. The opening boundary remains: **Your adventure stays on screen. Real appliances need adult help.**

**Word help** opens **Little words, big ideas**, explaining reuse, repair, recycle, e-waste and a qualified repairer. **Hear it**, **Hear the story**, **Hear this clue**, **Hear the question** and **Read these words** provide contextual speech controls. Words remain visible. The browser may have no usable voice, and some voices may use an online service. The existing read-aloud and movement settings remain available; narration is cancelled when leaving its context.

## Tablet layouts and input choices

[tablet-play.css](../quest/tablet-play.css) adds large picture cards, clue controls, a progress strip, reflection choices and a responsive sorting board. These are code-level layout rules, not physical-device observations:

- At widths of at least 760 CSS pixels and heights of at least 600, exploration places the scene beside the clue controls.
- At widths of at least 800 and heights up to 800, sorting can place the item beside its destinations, using landscape space.
- Single-space plans show three picture choices across on wider screens. At widths up to 600, they stack as shorter horizontal cards. Parent content, the progress strip and reflection choices also reflow at narrower sizes.
- Clue hotspots have declared minimum dimensions of 56 CSS pixels on larger screens and 52 on narrow screens. Picture action buttons, reflection options and separate drag handles have larger declared target areas. These declarations must still be checked as rendered, including spacing, labels and zoom.

The tap alternatives follow the intent of W3C's [Dragging Movements guidance, SC 2.5.7 (AA)](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): a non-drag pointer method is needed independently of keyboard support. The larger targets also draw on [Target Size (Enhanced), SC 2.5.5 (AAA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), which specifies 44 × 44 CSS pixels with stated exceptions. These official pages were checked on 13 September 2026. They are design references, not a claim that the whole prototype meets WCAG AA or AAA.

## Finite, more expressive art

[play-effects.css](../quest/play-effects.css) now has longer Pip/Flo greetings, an unfolding envelope, a neighbour's welcome, separate packaging movement, a planned-call illustration, reward tokens and level-badge sequences. The longest current art sequence finishes within **1,050 ms including its delay**. Effects run once per trigger; they do not loop or control scoring. The tablet surface also adds short arrival, selection and sorting feedback effects.

**Play ending** intentionally restarts the consequence illustration. Before/after viewing and animation replay do not award Sparks. Changing screens removes outgoing CSS effects, and the plan/outcome text remains available without waiting for motion. Warning objects and ordinary fan blades stay still. **Less movement** and the device's reduced-motion preference suppress the effects; JavaScript scrolling also checks that preference. The browser honoured the operating system's reduced-motion setting during this review. Full-motion sequences were checked in code only; their appearance and timing were not observed in this browser session.

## A clearer reason for parents

**Why Quest?** in the child header and **About this adventure** in the footer open the parent guide. Its direct entry is `/quest?view=parents`. The guide explains the intended practice: noticing evidence, explaining a choice, separating an item from its packaging and asking when an answer is missing. If a mission is active, it shows that mission's learning goal and discussion prompt. Parents can support a child without taking over, and the game can also be played solo.

The adult landing page's earlier Appliance Detective invitation is replaced with **Play FixForward Quest** and **Why Quest? A guide for parents** links. Both open separate tabs. This changes the invitation, not the adult appliance decision rules. The legacy learning implementation may remain in the code; this is not a claim that every historical function was removed.

The guide separates fictional stories from real appliance decisions and links to the adult `/` journey without transferring a story's answers. Quest saves its own progress, correct reflections, designs and settings in this browser. It asks for no player names, photos or contact details and adds no child-score or analytics upload. Blocked storage still permits session play. Reset clears Quest's local adventure. Browser storage clearing can remove progress, and offline availability is not promised.

## Current verification, 13 September 2026

The final `npm.cmd run check` completed with **214 tests, 214 passed, 0 failed, exit code 0**. Its local log is `tmp/quest-tablet-final-check.log`. The backend unittest suite passed **66 tests**, also with exit code 0. These are this refinement's results; earlier creative-refresh totals remain historical.

Browser QA used a separate loopback preview on **port 5503**, leaving the user's **5502 game untouched**. The current observed checks were:

- Home and mission views at **1024 × 768 CSS pixels**, clues at **768 × 1024**, and sorting at **390 × 844** had no horizontal overflow. The sorting source and destinations stayed visible together, including with long clues. A real pointer drag placed the glass jug correctly in **Pause and ask**.
- A **320 × 800** sorting screenshot was visually inspected. Its document width was **305 CSS pixels**, within the 320-pixel viewport, with no horizontal overflow. At this smallest width, destinations stack below the source; they are not all visible at once. The final drawing paths computed to `fill: none` as intended.
- Flo's story and picture reflection were exercised through wrong-choice feedback, retry and a correct answer, reaching **35 Sparks**. Replay did not add Sparks, and reload preserved progress.
- The quiet-fan story reached **Level 2 at 60 Sparks**; its correct reflection brought the total to **70**.
- The parent guide and the adult page's new-tab Quest/parent links were checked. The startup regression is fixed and passes: opening plain `/quest` after saving the parent view opens the child home and can continue the same mission. The explicit `?view=parents` entry opens the parent guide without rewriting the child save.
- A final browser check of plain `/quest` showed **Help Pip and Flo find a next chapter**, with the QA adventure's **Level 2 / 75 Sparks** intact. The QA tab's console query returned no warnings or errors.
- The operating system requested `prefers-reduced-motion: reduce`, and the browser honoured it. Full-motion art sequences received code review only.

These are specific browser journeys and viewport checks, not manual completion of every mission, creative option or input method. A physical tablet, an assistive-technology session and a child comprehension study were not used. Actual **200% browser zoom** was not verified; resizing a viewport does not establish that result. The earlier browser-created postcard file inspection gap remains open, and full-motion appearance still needs direct observation.

No engagement, learning improvement or reading comprehension has been validated with children. Later observation should follow the course's consent and assent process and record what children actually do and explain.

See the [source register](QUEST_CONTENT_SOURCES.md), [implementation handover](QUEST_IMPLEMENTATION.md) and [AI-use acknowledgement](../AI_USE_ACKNOWLEDGEMENT.md). The comparison worksheet remains a draft observation aid; it is not participant evidence.
