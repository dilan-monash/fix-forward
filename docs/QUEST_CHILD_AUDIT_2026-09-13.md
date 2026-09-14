# Quest child usability audit decisions

Source: the user-supplied `Quest Through a Child's Hands.pdf`, dated 13 September
2026. Its recommendations were reviewed against Iteration 2 at `489df149` before
implementation. The report describes an earlier build in several places; its
measurements are observations from that report, not measurements of this release.

The user's accepted design, artwork, permanent animation and musical wins remain
the baseline. This release belongs only to Iteration 2. Unrelated local adult
audit edits, Main and historical Iteration 1 are excluded.

| Audit | Decision and resulting behavior |
| --- | --- |
| C-01 | Partly already fixed: animation was already always on and its toggle removed. New adventures now also enable sound, unlocked by the first real gesture. Removed the remaining sound invitation banner. Explicit saved mute choices survive. |
| C-02 | Automatic story reading starts with play for a new adventure; loading a page alone stays quiet. The HUD says Read to me, with Pause/Resume/Stop available. Kept the existing recorded voice rather than regenerating the approved recordings. No spoken winning congratulations. |
| C-03 | Accepted readability problem, adapted the proposed scale: child reading and choices use 16px on phones and 18px on larger screens; secondary labels use 16px. Preserved the layout and artwork rather than forcing every label to 22px. |
| C-04 | Story action pictures now use the same drag behavior as sorting. Only their artwork lifts; words remain in place. Tap and keyboard alternatives remain. |
| C-05 | Sorting reserves a row for destinations and scrolls the clue card within available phone/tablet space. Visible voice controls reserve their own space. Expanded transcripts become normal-flow reading panels on these layouts instead of covering choices. |
| C-06 | Added brief pickup, destination-entry, drop, choice, page and Spark tones. A destination-entry tone fires only when entering a new target. Incidental tones cannot interrupt a win or level melody. |
| C-07 | Win chimes were already independent of narration. Preserved that fix and also allow the retry tone alongside its explanation. |
| C-08 | Confirmed: Guided showed one clue, not all clues. Both modes now require all authored clues. Guided's Next clue button shows the next fact; Challenge points to the missing numbered clue. The facts tick is earned before planning. |
| C-09 | An incomplete-plan button stays focusable and responds with the missing next step. The engine still refuses an incomplete submission, without attempts, penalties or points. |
| C-10 | Added brief optional native touch feedback on supported devices. It has its own saved setting, independent of Sound; unsupported hardware or browser failures do not affect play. |
| C-11 | Confirmed and fixed: login preserves a known Quest/parent entry in the individual form. An exact page allowlist prevents external redirects, path tricks and another tab replacing the destination. Existing session/CSRF controls remain. |
| C-12 | Difficult words in clue/feedback sentences now open a meaning beside the sentence. Hear the meaning and Back to the clue preserve reading position. The full glossary remains available. |
| C-13 | Deferred: installation and offline caching are a separate feature. An authenticated application needs a deliberate cache, expiry and update design; a service worker is not a small usability correction. No offline promise added. |
| C-14 | Back targets are at least 44px, with readable labels. |
| C-15 | Kept the approved gentle volume. The numeric gain alone does not establish real tablet loudness; raising it arbitrarily could make feedback startling. Physical-device listening remains necessary. |
| C-16 | Sound, automatic reading and optional touch feedback are available in Settings; Sound also remains in the HUD. Animation remains permanently on, as requested. |
| C-17 | Kept the celebration, story projector and picture question. Choose another mission is the clear next action; making, replaying, Discovery Book and finishing are inside a native expandable section. |
| C-18 | Preserved the family introduction and preferred purpose/learning sections. Added the intended age range and a clearly labeled 5-10 minute planning estimate, with untimed play and stopping allowed. Did not restore the rejected age-debate section. |

## Validation

- 204 Quest tests passed, including all-clue progression, direct action-picture
  dragging, helpful incomplete-plan behavior, saved settings, musical wins,
  inline word help, sound priorities and unsupported-device handling.
- 73 backend tests passed, including Quest/parent login returns and rejection of
  untrusted return destinations. Existing password controls were also checked.
- Browser checks cover a fresh adventure, saved Sparks, phone/tablet layout,
  normal and expanded voice controls, and the preserved desktop design.
- DOM tests exercise input behavior; they do not establish perceived voice quality
  or vibration on a physical tablet. No shared database writes or new audio services.

## Platform references used for implementation

- [Browser audio and autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay):
  audio must respect the browser's gesture requirements and failure paths.
- [Native vibration](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate):
  support and hardware vary; vibration can have no effect and must stay optional.
