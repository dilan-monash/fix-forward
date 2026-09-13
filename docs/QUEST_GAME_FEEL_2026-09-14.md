# Quest graphical game feedback — 14 September 2026

This Iteration 2 change makes the existing learning game respond more clearly to
children's touches. Story facts, scoring rules, parents content, recorded voices
and the original win melodies remain the same. Main and Iteration 1 are separate
releases; this change does not promote either one.

## What the child sees

- Eight illustrated story islands replace the home passport grid. Any unfinished
  story can be opened; a completed island opens its existing postcard editor.
  The visible stamp meter uses validated completion records, not visited pages.
- Meet, Look, Plan and Discover become illustrated stepping stones. A wrong
  choice stays at Plan, and only a completed story reaches Discover.
- Pressing a game button gives a brief ring and picture squish. Finding a clue
  shows a lens around its exact authored picture. Words and warning art stay still.
- Sorting destinations respond to drag hover equally, without revealing the
  correct answer. A checked choice shows a tick and arriving picture, or a cross
  and returning picture. The card and its teaching words remain in place.
- Existing pickup/result haptics continue on supported touch devices. Ordinary
  button sounds now work after narration finishes or is paused. Semantic actions
  own their own sound, preventing a duplicated generic tap. Wins use music, not
  automatic congratulatory speech.

## How the files connect

`quest/app.js` still sends actions to `engine.js` before showing results. It calls
`renderAdventureTrail()` for the home islands, `storyTrail()` for mission steps,
and `createTouchFx()` for temporary decoration. None of those helpers can award
points, save progress, answer a question or move keyboard focus.

`adventure-world.js` and its CSS create the small island scenes from existing
SVG drawings. `scene-play.css` animates guide nods and destination pictures without
changing layout. `touch-fx.js` owns its own overlays and animations. Navigation,
new renders and page exit cancel them. A rejected animation API leaves the real
game usable. `index.html` loads the new styles; Flask and the local review helper
explicitly allow those assets.

The sorting effect uses the destination **button** for geometry. The original
destination drawing becomes hidden after a correct answer, so measuring that
drawing would wrongly send particles to the corner of the screen.

## Loading and limits

The five new asset files total 32,408 bytes before compression (12,187 bytes when
individually gzip-compressed locally; this is an estimate, not a production
transfer measurement). They use native SVG, CSS and Web Animations, with no new
framework, fonts, video, image downloads or continuous JavaScript polling.

At most ten new decorative pieces and thirteen associated animations can run
at once; each touch/clue/drop effect is cleaned up within 820 ms. Existing reward
stars have their separate bounded controller. Story audio still loads only the
requested clip. These checks bound additional client work; they do not measure
or change Render's server cold-start delay.

## Validation

- `npm run check:quest`: 224 tests passed, including all story/sorting journeys,
  saved progress, narration, sounds, touch gestures and new helper behavior.
- One additional actual-app sorting regression passed after review: visible
  destination targeting, retry/correct effects, exactly-once scoring, no spoken
  win and cancellation during navigation. This brings coverage to 225 tests.
- `python -m unittest discover -s test_backend`: 73 tests passed, including access
  control and delivery of the newly allowed Quest assets.
- Chrome review at 376 × 812, 769 × 1025 and 1000 × 767: no horizontal overflow;
  product picture, three destinations and paused voice toolbar remain separate.
  Phone story islands use two columns and 16px labels. Desktop trail inspected.
- Actual local play: wrong story choice stays at Plan; retry reaches the ending;
  25 Sparks settle into the score bar; completed story appears as an earned island.
  Warning/quiet fan artwork remains static. Sound and vibration API behavior is
  covered by silent test doubles; physical tablet vibration was not measured.

No shared database write, Main promotion or unrelated adult-audit change belongs
to this release. Git publication and Render deployment must be verified separately.
