# Recall coverage scope (Iteration 1)

## What we have

- An ACCC Product Safety **RSS** snapshot in `recalls`: 100 records covering
  published dates **2026-04-16 to 2026-08-27**, retrieved 2026-09-03.
- Snapshot coverage, record count and limitations recorded once in
  `data_import_runs`, not repeated on every recall row.
- 81 reviewed **active** patterns in `appliance_recall_patterns` (two microwave
  patterns from an earlier draft are retained as inactive for audit).
- Candidate matches in `recall_category_matches`, each recording the pattern
  that fired, the text it matched, and whether that text came from the **title**
  or the **summary**.

## What we do not claim

- Full historical ACCC recall coverage.
- Confirmation that a specific appliance is, or is not, under recall.
- That "no match" means "recall-free".

## How matching works, and why it changed

Matching previously compared category aliases to recall text with
`ILIKE '%term%'`. With no word boundaries it reported six matches, of which
**four were infant products** caught by the alias `fan` matching "in**fan**ts"
("Nuby Foldable Bathtub for babies and infants", "Pull String Interactive Toys",
"5-in-1 nursery center", "Joolz Aer2 car seat adapter"), and one was a
vacuum-**insulated** food jar caught by the alias `vacuum`. Only the Mistral
Barrel Cyclonic Vacuum Cleaner was genuine.

The matcher now:

- Reads **title and summary only**. `match_keywords` is a sorted, de-duplicated
  bag of words, so word order there is meaningless and phrases cannot be trusted
  against it.
- Uses whole-word boundaries, and tolerates hyphens inside a phrase so
  "vacuum-cleaner" matches "vacuum cleaner".
- Applies `excluded_context`, which is what rejects the food jar:
  `vacuum insulated`, `vacuum flask`, `vacuum-sealed` and similar.
- Drops bare terms that proved unsafe: `fan`, `mixer`, `trimmer`, `jug`,
  `portable ac`. Each is replaced by qualified phrases such as `desk fan`,
  `pedestal fan`, `tower fan`, `fan heater`, `stand mixer`, `hand mixer`,
  `kitchen mixer`, `beard trimmer`, `electric jug`.
- Keeps bare `vacuum` only at **low** confidence and only with the exclusions
  applied.
- Excludes `ceiling fan`, which is fixed wiring rather than a portable
  appliance.

Result on the current snapshot: **1 candidate**, the Mistral vacuum cleaner,
matched by the pattern `vacuum cleaner` on the title text `Vacuum Cleaner`
(`matched_field = title`). It remains `unreviewed` until a named person
compares it with the official notice using `06_review_recall_match.py`.

## Microwaves are out of Iteration 1 scope

Microwaves are **not** in the air-fryer category and do not have a category of
their own. ORA v0.3 has no microwave, oven or fryer product category, so there
is no repair evidence to attach. Displaying air-fryer / small-kitchen-item
statistics beside a microwave recall would be misleading. Deep fryers stay in
`Air fryer and other complex kitchen`; microwave aliases and patterns have
been removed.

## Product requirements

1. Label every candidate as **Possible recall match — not confirmation**.
2. Always link the recall's `official_url`.
3. Show this text whether or not there is a match:

   > FixForward checks a limited ACCC data snapshot. No match does not prove
   > that the product is recall-free.

4. Always offer the official search: https://www.productsafety.gov.au/recalls
5. Keep the possible-match banner visible through safety triage.

## Reviewing a candidate

`recall_category_matches.review_status` is `unreviewed`, `confirmed` or
`false_positive`. Human decisions survive re-running `06_match_recalls.py`, so a
false positive can be marked once and stays marked. A status other than
`unreviewed` requires `reviewed_by` and `reviewed_at`.

To review candidates:

```bash
python data/scripts/06_review_recall_match.py --list
python data/scripts/06_review_recall_match.py   # interactive; records a named decision
```

Leaving the Mistral vacuum candidate unreviewed is a deliberate human sign-off
gate, not an oversight.

## Regression tests

`06_regression_tests.py` fails the build if "infant" ever matches `fan`, if the
vacuum-insulated food jar ever matches `vacuum_cleaner`, if the Mistral recall
stops matching, or if any stored candidate lacks the pattern that produced it.
