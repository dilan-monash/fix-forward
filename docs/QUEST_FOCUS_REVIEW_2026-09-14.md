# Quest focus review — 14 September 2026

This change applies only to the Iteration 2 Quest. It evaluates the supplied
*What Quest Needs Next* audit against the current game and the user's earlier
choices. It does not redesign the parent guide or adult appliance journey.

## Decisions and evidence

| Recommendation | Decision in this release | Reason and practical limit |
| --- | --- | --- |
| Remove duplicate ways to reach the same stories | Home has one start/resume button and one chapter trail. The trail opens or replays every story. Sorting remains a distinct activity. | NN/g observed redundant navigation confusing children. Fewer equally prominent doors make the first choice clearer; this still needs observation with children. |
| Move Guided/Challenge out of the first screen | Both remain in Settings. Home offers Challenge after two distinct stories solved without help, and remembers acceptance or dismissal. | A child can make an informed choice after trying play. No automatic difficulty switch and no points penalty. |
| Hide locked creations | The Home creation tile appears after a completed story or an earned discovery supplies something usable. | Avoid advertising an empty activity at the first visit. The Discovery Book and completed postcards remain available. |
| Remove Move handles | Story action pictures and sorting pictures are the drag targets. Their labels stay in place. Tap and keyboard selection still work. | One visible object has one manipulation target; a fine motor gesture is never the only way to answer. |
| Teach the sorting gesture | A four-second paper-to-practice-box example uses the existing card area. Skip, replay, a real gesture, narration and navigation stop or control it. | NN/g cognitive guidance supports showing a concrete gesture sequence. The example is independent of the current answer and earns no points. No extra board row pushes destinations down. |
| More animation during interaction, calm teaching | Keep physical drag/drop feedback, finite greetings, win chimes and star flights into the score bar. Stop decorative CSS motion while reading clues, choosing, retrying, using the Discovery Book or listening. Remove the clue-lens burst and perpetual scenery loops. | The seductive-details research concerns interesting **irrelevant** learning material. Our context rule is a design inference, not a measured improvement in Quest learning outcomes. |
| Warm means touchable | Use the existing gold and peach family on picture rims, primary actions and every available destination equally. Keep labels, borders and keyboard focus. | Consistent affordances can be learned. Warm paint must not reveal which answer is correct, and colour is never the only cue. |
| Simplify the projector | One prominent Replay ending button; before/after comparison remains in a disclosure. | Comparing consequences has learning value, so it is retained without three equal controls. |
| Harder reasoning in simple words | Add optional ninth story, “A fan nobody wants”: first find someone who wants it; if someone says yes, arrange the sharing checks. | Working does not mean wanted, or ready to hand over. The ending honestly leaves the search unresolved. No age gate; original eight stories retain their IDs and text. |
| Smaller level display | Keep the existing small badge control and make its numeral readable. | The audit quoted internal SVG units, not the number's rendered pixel size. Shrinking those units would make an already small number harder to read. |

## Research checked, and what it does not prove

- [NN/g: Children's Websites — Usability Issues](https://www.nngroup.com/articles/childrens-websites-usability-issues/)
  describes three rounds of observation with 125 children aged 3–12. It supports
  responsive pictures and avoiding redundant navigation. It is not a test of
  this Quest release or a guarantee that more motion improves learning.
- [NN/g: Designing for Kids — Cognitive Considerations](https://www.nngroup.com/articles/kids-cognition/)
  supports concrete goals, clear instructions and demonstrated gesture sequences.
  The new story uses more connected reasoning without increasing vocabulary difficulty.
- [Sundararajan and Adesope: Keep it Coherent](https://link.springer.com/article/10.1007/s10648-020-09522-4)
  is the primary meta-analysis referenced by the audit. Its accessible abstract
  reports learning costs from seductive details and substantial moderators. The
  supplied numeric effect size was not independently checked in the paywalled
  full text; this release does not claim a particular effect size for Quest.
- [Frontiers in Psychology: colour-preference eye-tracking study](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1205213/full)
  studied children aged **4–7**, rather than the full 7–12 audience. The authors
  caution that hue, brightness and saturation are confounded and the warm-area
  results do not conclusively establish a warm-hue preference. Our affordance
  rule is a consistent design choice, not proof this palette suits every child.

## Deliberately deferred

The user's existing choice keeps game animation enabled; this release does not
restore a motion switch. Instead, context determines when decorative motion is
appropriate. It preserves sound settings and available voice Pause/Resume/Stop.

No louder default, background music, new paid voice service, external animation
library, PWA cache or freeform map-placement system is added. These are separate
product changes with loading, listening or interaction tradeoffs; they are not
necessary to fix the immediate navigation and attention problems. The original
recorded story clips and win chimes remain. New story text falls back to an
available device voice, with visible words when speech is unavailable.

## Developer map and release boundary

`app.js` turns engine state into screens and owns ephemeral overlays.
`motion-context.js` returns the quiet-learning policy; `learning-focus.css`
applies it and paints interactive surfaces. `sort-demo.js` owns only a finite
practice animation, while `engine.js` validates saved onboarding choices.
`content.js` owns the new mission facts and accepted plan; `feedback.js` explains
each ordered step. Scores remain derived by `progression.js` from unique saved
achievements. An interrupted visual effect cannot award or remove progress.

Existing version-1 saves receive defaults for optional onboarding fields.
Previously earned story IDs, concepts, postcards and points stay valid. The
original eight completed stories plus reflections still total 280 Sparks;
completing the ninth and its reflection brings that total to 310. Replays do not
award them again. All twelve distinct sorting cards bring the combined maximum
to 370. These are game rewards, not measurements of a child's ability.

Validation covers old saves, all new ordered-plan combinations, repeat-safe
scoring, Challenge eligibility, demo timing/cancellation, direct picture
interaction, narration coexistence, quiet states and authenticated asset routes.
The fixture server uses synthetic data and never connects to shared Neon.

Only reviewed Quest files, route allowlists, tests and this note belong in the
Iteration 2 commit. The dirty adult-audit files are separate work. Publishing
GitHub does not prove Render deployment; verify the exact manually deployed I2
commit before calling the review website updated. Main and Iteration 1 are
outside this release.
