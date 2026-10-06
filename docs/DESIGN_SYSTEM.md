# FixForward design system

FixForward's adult guide (`/`), Quest (`/quest`), the Quest parent guide (`/quest?view=parents`), the error pages and the password page all use one design system. It adapts the FixForward Quest design system from the separate `fix-forward-quest` project (Baloo 2 and Nunito, green-neutral ink, meadow, aqua and sky actions, tinted status panels, pill buttons and rounded cards).

## Where it lives

| File | Role |
|---|---|
| [`brand.css`](../brand.css) | The single source of tokens (`--ff-*`), the bundled `@font-face` rules, the shared logo (`.ff-brand`) and the status badge. Every page loads it first. |
| [`favicon.svg`](../favicon.svg) | The shared mark: a glossy meadow tile with a forward arrow. Both headers and the password page use it as their logo. |
| [`fonts/`](../fonts/README.md) | Baloo 2 and Nunito variable fonts (Latin subset, SIL OFL), served locally so no font request leaves the website. |
| [`styles.css`](../styles.css) | The adult guide. Its older variable names (`--ink`, `--green-900`, `--mint`) now point at `--ff-*` tokens. |
| [`quest/quest.css`](../quest/quest.css) and later Quest layers | Quest maps its short names (`--ink`, `--teal`, `--paper`) onto the same tokens. |
| [`backend/access.css`](../backend/access.css) | Password page layout on top of `brand.css`. |

To change a colour, font or radius for the whole product, edit `brand.css`. Do not add new hex values to feature rules when a token applies.

`brand.css`, `favicon.svg` and the two font files are the only frontend files served before sign-in (see `PUBLIC_BRAND_PATHS` in `backend/access.py`). They contain no content, and the password page needs them.

## Tokens

- **Type:** Baloo 2 (800) for headings, Nunito (400 to 900) for body text, labels and buttons. Headings use natural letter spacing.
- **Ink and neutrals:** ink `#17352d`, body `#3f5c50`, muted `#5d7568`, card border `#e1eee4`, neutral fill `#edf2ee`, white page.
- **Actions (meadow theme):** primary `#a8eb5b → #32c978` (decide, continue), aqua `#8feee0 → #41d7d7` (find a place), sky `#8fc8ff → #57b8ff` (learn, compare, explore). Ghost buttons use border `#cfebdb` and text `#1f7a4c`.
- **Status panels:** mint (safe), sky (information), caution (check or verify), danger (stop). Unverified facility notes use the unverified tint. Colour always repeats a message that is also written in words.
- **Shape:** feature cards 32px, cards 20px, panels 18px, pills 999px. Targets are at least 44px, and 52px for primary actions.
- **Motion:** buttons squash quickly when pressed and spring back (`--ff-spring`). Hover lift applies only to precise pointers.

## Decisions that differ from the source design system

These were deliberate choices for accessibility, safety or existing research findings.

1. **Dark ink text on glossy buttons.** White text on the light meadow gradient is about 2.3:1, which fails WCAG AA. Glossy buttons use ink `#17352d` text (about 6:1).
2. **Darker focus ring.** The source ring `#57b8ff` is under 3:1 on white. FixForward uses a 3px ink outline with a white halo.
3. **Darker faint text and field borders.** `--ff-faint` is `#6b8378` for readable disclaimers; `--ff-border-field` is `#7f978a` so input boundaries reach 3:1. The original `#8aa096` remains as `--ff-faint-mark` for decoration only.
4. **Danger fill for white-text buttons.** `--ff-danger-fill` `#c22e3c` keeps the danger hue with AA contrast. The system's `#d83a4a` is still the danger border.
5. **Calm danger screens.** When a result screen contains a serious warning or recall, its buttons become solid ink with no gloss or bounce, and the warning heading uses the danger reds.
6. **Gold still means "touch this" in child play.** Quest's child audit found that warm, labelled surfaces help children tell playable items from scenery. Child play buttons therefore use the design system's citrus gradient (`#ffd873 → #f5a623`) in the same glossy bubble finish, and sorting targets use the warm `#fff3d6` tint. The parent guide uses the standard meadow buttons.
7. **Illustrations are kept.** The source project used diagonal-hatch placeholders because of its own checklist. FixForward keeps its existing appliance and Quest illustrations; the hatch appears only for locked or empty placeholders.
8. **Adult motion is milder.** The adult guide uses a smaller hover lift and press squash than the children's game.

## Migration notes

A first pass shifted Quest's warm paper, teal and navy colours, and the adult guide's hard-coded navy colours, into the green-neutral family. Each replacement kept the original colour's WCAG luminance, so existing text and background contrast ratios were preserved. Warning, retry, recall and danger rules kept their original warm and red colours. Component rules were then rewritten by hand to use tokens.

## Quest child screens carry only what is needed to play

Each child screen shows the task and the controls for it, nothing else:

- **Home:** "Pick a story", the story map (islands with titles and a stamp count), a Sorting game button, and Continue when a story is in progress.
- **Story:** back link, title, the story sentence, the character's line, the picture, and one next action. The plan step shows one question and one status line that says what to tap.
- **Ending:** the stamp with what was learned, the picture question, and Next story / Play again. Postcards and decorations stay in My creations, reached from the Discovery Book.
- **Sorting:** back link, one question, the round dots, the picture with its clues, and the three places.

Slogans, repeated instructions, points previews, step trackers, scene captions and duplicate buttons were removed. Read to me, Sound and Settings live only in the top bar. Explanations for adults belong in the parent guide, not on child screens.
