# FixForward Quest: creative refresh

13 September 2026. This refinement responds to the user's correction that Quest is **for children aged 7–12** and should feel more imaginative, with less repeated “grown-up” framing. It changes the local child experience. The existing adult route stays available as a separate comparison baseline. Nothing has been published, pushed or merged, and no production database or hosting settings were changed.

This document records the implemented direction, current code contracts and completed verification. Automated checks and specific desktop browser journeys pass; the remaining phone, download-file, pointer-drop, motion and zoom gaps are listed below. It does not claim observed child engagement, educational effectiveness, retention gains or assessment marks.

## What changed for the player

| Part of play | Current behaviour | Why it was changed |
|---|---|---|
| First minute | Tap Pip or Flo beside the neighbourhood for a short reply; choose a mission or place. | Give the child a character to respond to and a choice to make. |
| Story voice | Pip/Flo has different first-person lines for meeting, finding clues, planning, success, retry and the outcome. | Reduce repetitive procedure text and connect a decision to the character's story. |
| Fictional people | Sam is a named adult owner/helper; Jo is a qualified repairer; Bea is the receiving household in reuse stories. | Keep practical responsibility clear without repeatedly directing the child to an unnamed grown-up. |
| Clue pocket | Discovered clues become compact labelled buttons, available during exploration and planning. | Make collected evidence visible and easy to reopen. |
| Story projector | At an outcome, switch between Before your choice and The next chapter. | Let the child compare the consequence with the original scene. |
| Story passport | Eight distinct stamps correspond to the eight mission stories. Unearned stamps open stories; earned stamps open their postcard designer. | Make progression visible and provide a choice of what to explore or create. |
| Postcard studio | Choose sunshine, starlight or mint; add a star, leaf or spark sticker; keep the design or request an SVG download. | Offer a bounded creative activity with an immediate visible result. |
| Neighbourhood decorating | Existing earned tree, flowers, flag and bench choices remain placeable in three spaces. | Keep a second way to make the fictional place personal. |
| Supporting information | About this adventure is in the footer. Secret envelope is optional within the kettle story. | Keep sources and practical adult tools available without making them the centre of ordinary child play. |

The current opening boundary is **“Your adventure stays on screen. Real appliances need adult help.”** Warning and missing-information decisions still clearly ask for trusted-adult help. The sorting destination is labelled **Pause & ask**; its feedback identifies that trusted help. No child is asked to touch, diagnose, repair, open or transport a real electrical appliance or battery.

## Content and state contracts

`quest/content.js` adds `guideLines` with `intro`, `explore`, `plan`, `success`, `retry` and `outcome`, plus one `postcardLine` per mission. All 17 clues have a `shortLabel` of at most three words. The eight mission IDs, accepted plans, 12 sorting-card IDs, scored answers, source IDs, source rules and checked dates remain intact. Named people and dialogue are authored fiction, not new imported product data.

The story passport uses completed mission IDs. A sorting discovery can unlock an explanation or decoration, but it does not award a mission stamp. The before/after viewer is a presentation state; changing it does not award progress or alter the accepted plan.

`quest/postcard-options.js` defines three themes and three stickers. `DESIGN_POSTCARD` accepts these fixed choices only for a completed mission. `postcards[missionId]` saves its `{theme, sticker}` in the existing versioned Quest storage. A valid earlier save with no postcard field opens with default choices. Missing, malformed or blocked storage keeps the existing fallback behaviour. The UI does not collect a name, free-text signature or personal image.

`quest/postcard.js` creates a **900 × 640 standalone SVG** containing original local art, authored text and the selected design. **Save my postcard** uses the browser's download mechanism; the file is named `fixforward-quest-<mission-id>.svg`. This requests a file on the current device, not sharing or uploading. A button click alone is not proof that a particular browser saved the file; verification must locate and inspect it. Download URLs are cleaned up during navigation, a new download or page exit.

Selecting a theme/sticker saves the choice when browser storage is available. Downloading the SVG is separate and optional. The game does not promise offline availability: first access and site assets may still need the applicable server/connection. Browser speech synthesis retains its existing availability and possible online-voice limits.

## Motion and accessible controls

The new `quest/play-effects.css` contains one-shot greetings, evidence/route reveals and stamp effects. Each declared story effect lasts **580 ms or less**. No animation completion callback decides whether a mission is complete. Scenes, instructions and stamps are already visible in their final states without animation.

Effects require normal-motion settings and the device's no-preference media query. **Settings → Less movement** and the operating system's reduced-motion preference suppress them. The JavaScript scrolling path also uses the reduced-motion check. Warning objects and ordinary fan blades stay still; guide-character motion is distinct from manipulating a real appliance. Replacing a screen removes outgoing CSS effects, and navigation cancels narration and active dragging.

Clue-pocket controls, passport entries, projector choices, theme/sticker choices and downloads are buttons or ordinary links. They do not require dragging. Existing mission/sorting/decorating drag alternatives remain. Current desktop screenshots and narrow-screen DOM geometry were checked; actual phone screenshots, 200% zoom, an assistive-technology session and the browser-created SVG still need review.

## Verification status for this refresh

**The final full JavaScript run passed 187 tests (144 adult + 43 Quest), with exit code 0; the backend suite passed 66 tests.** The final JavaScript log is `tmp/quest-creative-check.log`. The latest focused Quest run also passed all 43 tests. These current results replace earlier prototype totals for this refresh. See [QUEST_IMPLEMENTATION.md](QUEST_IMPLEMENTATION.md) for the commands and separate historical record.

The current browser evidence is specific:

- Chrome desktop screenshots of the refreshed home and a **starlight/leaf** postcard were visually inspected. The scene stayed within its frame after the SVG sizing fix.
- Flo's reuse story completed in the browser. Its clue pocket advanced **0 → 1 → 2**; the before/after viewer switched labels and scene without changing the book count of **1**. **Mint/leaf** choices survived reload, return to the book and reopening the earned postcard.
- At **390 × 844** and **320 × 800 CSS pixels**, DOM measurements found no horizontal overflow. Theme/sticker targets were **109 × 75** and **86 × 75 CSS pixels**. The 390-pixel passport had two columns and a **12.48 CSS pixel** title. Phone screenshot captures timed out; phone visual appearance is not verified by these measurements.
- **Follow my device** resolved to reduced motion in Chrome, with Flo's computed animation `none`. Normal-motion effects have code/CSS review only.
- A real sorting drag at 320 pixels showed wrong-placement feedback and permitted retry. Keyboard **Enter** on **Pause & ask** correctly placed the card. A precise successful pointer drop after the final font change remains unconfirmed.
- The download button displayed its expected status, but the download-event wait timed out and no file was found in Downloads. Renderer/XML and export unit checks pass; an actual browser-created SVG has not been located and visually inspected.
- The separate adult tab retained **Toaster**, safety Q1 **Not sure**, and **1 of 4 answered**. The refreshed child home and adult tab remained available, and the browser viewport override was reset.

Remaining checks are actual phone screenshots, browser export-file creation and visual inspection, a precise successful pointer drop with the final typography, observed normal-motion effects, physical touch and assistive-technology use, and the earlier **200% browser zoom** gap. Do not describe automated story coverage as manual completion of every journey or every theme/sticker combination.

No child participant session was conducted for this refresh. Use the course's appropriate consent, assent and research process for later observation. The refreshed [comparison worksheet](QUEST_COMPARISON_WORKSHEET.md) records choices and difficulties without tracking the child in the product.

## Handover

Run the same local commands and URLs in [QUEST_IMPLEMENTATION.md](QUEST_IMPLEMENTATION.md). The refreshed [mentor demo](QUEST_DEMO.md) includes a story, retry, clue pocket, projector, stamp, postcard creation/download, sorting and the separate adult baseline.

AI assistance for this refinement includes dialogue rewriting, local SVG/stamp/postcard design support, implementation, test support and documentation. Preserve the team's [AI-use acknowledgement](../AI_USE_ACKNOWLEDGEMENT.md), review it against actual course requirements and record human contribution accurately. New creative wording does not establish safety approval or participant validation.

Useful next work is to observe whether children can start and reason independently, whether dialogue helps or overloads the decision, and whether they choose to create, continue or finish. Refine from observations rather than treating more animation, stamps or downloads as evidence of learning.
