"""
Pattern definitions and matching logic for ACCC recall candidates.

Imported by 06_build_recall_patterns.py (seeds the table), 06_match_recalls.py
(writes candidates) and 06_regression_tests.py (asserts known cases). Keeping
the logic here means the tests exercise the same code the loader uses.

Why patterns instead of substring search
----------------------------------------
The previous matcher compared category aliases to recall text with
ILIKE '%term%'. Without word boundaries the alias "fan" matched "babies and
inFANts" and the alias "vacuum" matched a VACUUM-insulated food jar. Four of
the six reported matches were infant products.

Matching rules
--------------
- Patterns are evaluated against the recall title and summary only. The
  match_keywords column is a sorted, de-duplicated bag of words, so word
  adjacency there is meaningless and phrases cannot be trusted against it.
- 'exact_phrase' patterns are converted to a whole-word regex that tolerates
  hyphens and extra whitespace, so "vacuum cleaner" also matches
  "vacuum-cleaner".
- 'word_regex' patterns are Python re syntax authored below. (The Postgres
  equivalent of \\b is \\y, if a pattern is ever evaluated in SQL.)
- excluded_context rejects a match when the surrounding text shows the word is
  being used for something else, e.g. "vacuum insulated".
- required_context demands a supporting word before a match is accepted.
- Absence of a match NEVER means the product is recall-free. It means this
  limited snapshot contained no candidate.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2}

# Rejects "vacuum" when the word describes insulation or packaging rather than
# a cleaning appliance. This is what excludes the Stainless King food jar.
VACUUM_NOT_APPLIANCE = (
    r"vacuum[\s\-]*(insulat|flask|seal|bottle|jug|jar|mug|tumbler|"
    r"pack|pump|thermos|storage|bag)"
)

# "Kettle Chips" is a snack brand, not an appliance.
KETTLE_NOT_APPLIANCE = r"kettle[\s\-]*(chips?|corn|bell)"


@dataclass(frozen=True)
class Pattern:
    category_code: str
    pattern: str
    pattern_type: str            # 'exact_phrase' | 'word_regex'
    confidence: str              # 'high' | 'medium' | 'low'
    required_context: str | None = None
    excluded_context: str | None = None
    notes: str | None = None


def _phrase(category: str, phrase: str, confidence: str = "high", **kw) -> Pattern:
    return Pattern(category, phrase, "exact_phrase", confidence, **kw)


def _word(category: str, regex: str, confidence: str = "medium", **kw) -> Pattern:
    return Pattern(category, regex, "word_regex", confidence, **kw)


PATTERNS: list[Pattern] = [
    # --- kettle -------------------------------------------------------------
    # "jug" alone is deliberately absent: it matches vacuum jugs, measuring
    # jugs and water jugs, none of which are electric kettles.
    _phrase("kettle", "electric kettle"),
    _phrase("kettle", "cordless kettle"),
    _phrase("kettle", "electric jug"),
    _phrase("kettle", "tea kettle"),
    _phrase("kettle", "water boiler", "medium",
            notes="Can also describe fixed hot-water units, which are out of scope."),
    _word("kettle", r"\bkettles?\b", "medium", excluded_context=KETTLE_NOT_APPLIANCE,
          notes="Excludes the Kettle Chips snack brand."),

    # --- toaster ------------------------------------------------------------
    _phrase("toaster", "toaster oven"),
    _phrase("toaster", "sandwich toaster"),
    _word("toaster", r"\btoasters?\b", "high"),

    # --- rice cooker and small kitchen appliances ---------------------------
    _phrase("rice_cooker_and_small_kitchen_appliances", "rice cooker"),
    _phrase("rice_cooker_and_small_kitchen_appliances", "rice maker"),
    _phrase("rice_cooker_and_small_kitchen_appliances", "bread maker"),
    _phrase("rice_cooker_and_small_kitchen_appliances", "breadmaker"),
    _phrase("rice_cooker_and_small_kitchen_appliances", "sandwich press"),
    _phrase("rice_cooker_and_small_kitchen_appliances", "sandwich maker"),
    _phrase("rice_cooker_and_small_kitchen_appliances", "popcorn machine"),
    _phrase("rice_cooker_and_small_kitchen_appliances", "popcorn maker"),

    # --- blender, mixer and food processor ----------------------------------
    # Bare "mixer" is deliberately absent: cement mixers, concrete mixers and
    # mixer taps are all common recall subjects.
    _phrase("blender_mixer_and_food_processor", "food processor"),
    _phrase("blender_mixer_and_food_processor", "stick blender"),
    _phrase("blender_mixer_and_food_processor", "hand blender"),
    _phrase("blender_mixer_and_food_processor", "immersion blender"),
    _phrase("blender_mixer_and_food_processor", "stand mixer"),
    _phrase("blender_mixer_and_food_processor", "hand mixer"),
    _phrase("blender_mixer_and_food_processor", "kitchen mixer"),
    _word("blender_mixer_and_food_processor", r"\bblenders?\b", "high"),
    _word("blender_mixer_and_food_processor", r"\bjuicers?\b", "high"),

    # --- coffee machine -----------------------------------------------------
    _phrase("coffee_machine", "coffee machine"),
    _phrase("coffee_machine", "coffee maker"),
    _phrase("coffee_machine", "espresso machine"),
    _phrase("coffee_machine", "coffee pod machine"),
    _phrase("coffee_machine", "filter coffee machine"),
    _word("coffee_machine", r"\bnespresso\b", "high"),

    # --- air fryer and other complex kitchen --------------------------------
    # Microwaves are out of Iteration 1 scope. ORA v0.3 has no microwave,
    # oven or fryer category, so there is no repair evidence to attach, and
    # showing air-fryer statistics beside a microwave recall would be
    # misleading. Deep fryers stay: they belong in this category.
    _phrase("air_fryer_and_other_complex_kitchen", "air fryer"),
    _word("air_fryer_and_other_complex_kitchen", r"\bairfryers?\b", "high"),
    _phrase("air_fryer_and_other_complex_kitchen", "deep fryer"),
    _phrase("air_fryer_and_other_complex_kitchen", "deep fryers"),

    # --- vacuum cleaner -----------------------------------------------------
    _phrase("vacuum_cleaner", "vacuum cleaner"),
    _phrase("vacuum_cleaner", "vacuum cleaners"),
    _phrase("vacuum_cleaner", "robot vacuum"),
    _phrase("vacuum_cleaner", "robotic vacuum"),
    _phrase("vacuum_cleaner", "stick vacuum"),
    _phrase("vacuum_cleaner", "barrel vacuum"),
    _phrase("vacuum_cleaner", "cylinder vacuum"),
    _phrase("vacuum_cleaner", "upright vacuum"),
    _phrase("vacuum_cleaner", "handheld vacuum"),
    _word("vacuum_cleaner", r"\bvacuums?\b", "low",
          excluded_context=VACUUM_NOT_APPLIANCE,
          notes="Bare 'vacuum' only, so low confidence. Excludes vacuum-insulated "
                "and vacuum-sealed products such as flasks and food jars."),
    _word("vacuum_cleaner", r"\bhoovers?\b", "medium"),
    _phrase("vacuum_cleaner", "steam cleaner", "medium"),

    # --- hair and beauty appliances -----------------------------------------
    # Bare "trimmer" is deliberately absent: hedge and line trimmers are
    # frequently recalled garden tools.
    _phrase("hair_and_beauty_appliances", "hair straightener"),
    _phrase("hair_and_beauty_appliances", "hair straighteners"),
    _phrase("hair_and_beauty_appliances", "curling iron"),
    _phrase("hair_and_beauty_appliances", "curling wand"),
    _phrase("hair_and_beauty_appliances", "electric shaver"),
    _phrase("hair_and_beauty_appliances", "electric toothbrush"),
    _phrase("hair_and_beauty_appliances", "hair clipper"),
    _phrase("hair_and_beauty_appliances", "hair clippers"),
    _phrase("hair_and_beauty_appliances", "beard trimmer"),
    _phrase("hair_and_beauty_appliances", "hair trimmer"),
    _word("hair_and_beauty_appliances", r"\bstraighteners?\b", "medium"),
    _word("hair_and_beauty_appliances", r"\bshavers?\b", "medium"),

    # --- hair dryer ---------------------------------------------------------
    _phrase("hair_dryer", "hair dryer"),
    _phrase("hair_dryer", "hair dryers"),
    _phrase("hair_dryer", "hairdryer"),
    _phrase("hair_dryer", "hair drier"),
    _phrase("hair_dryer", "blow dryer"),
    _phrase("hair_dryer", "blowdryer"),

    # --- fan ----------------------------------------------------------------
    # Bare "fan" is deliberately absent. It is the pattern that matched
    # "babies and infants", "Pull String Interactive Toys", a nursery centre
    # and a car seat adapter. Ceiling fans are fixed wiring, not portable
    # appliances, so they are out of scope for FixForward.
    _phrase("fan", "desk fan"),
    _phrase("fan", "pedestal fan"),
    _phrase("fan", "tower fan"),
    _phrase("fan", "electric fan"),
    _phrase("fan", "standing fan"),
    _phrase("fan", "box fan"),
    _phrase("fan", "bladeless fan"),
    _phrase("fan", "fan heater"),
    _phrase("fan", "portable fan"),
    _phrase("fan", "cooling fan", "low",
            notes="Can describe a vehicle or computer cooling fan rather than a "
                  "household appliance."),

    # --- dehumidifier and portable air conditioner --------------------------
    # "portable ac" is deliberately absent: it matches "portable AC adapter".
    _word("dehumidifier_and_portable_air_conditioner", r"\bdehumidifiers?\b", "high"),
    _phrase("dehumidifier_and_portable_air_conditioner", "portable air conditioner"),
    _phrase("dehumidifier_and_portable_air_conditioner", "portable air conditioners"),
    _phrase("dehumidifier_and_portable_air_conditioner", "portable aircon"),
    _phrase("dehumidifier_and_portable_air_conditioner", "evaporative cooler"),
]


def phrase_to_regex(phrase: str) -> str:
    """Whole-word regex for a phrase, tolerating hyphens and extra spaces."""
    words = [re.escape(w) for w in phrase.split()]
    return r"\b" + r"[\s\-]+".join(words) + r"\b"


def pattern_regex(pattern: str, pattern_type: str) -> str:
    if pattern_type == "exact_phrase":
        return phrase_to_regex(pattern)
    if pattern_type == "word_regex":
        return pattern
    raise ValueError(f"Unknown pattern_type: {pattern_type}")


def searchable_text(title: str | None, summary: str | None) -> str:
    """Title and summary only. See the module docstring for why."""
    return " ".join(p for p in (title, summary) if p)


def match_one(text: str, pattern: Pattern) -> str | None:
    """Return the matched substring, or None if the pattern does not apply."""
    if not text:
        return None

    hit = re.search(pattern_regex(pattern.pattern, pattern.pattern_type), text, re.IGNORECASE)
    if not hit:
        return None

    if pattern.excluded_context and re.search(pattern.excluded_context, text, re.IGNORECASE):
        return None

    if pattern.required_context and not re.search(pattern.required_context, text, re.IGNORECASE):
        return None

    return hit.group(0)


def match_fields(
    title: str | None, summary: str | None, pattern: Pattern
) -> tuple[str, str] | None:
    """Return (matched_field, matched_text), preferring a title hit."""
    title_hit = match_one(title or "", pattern)
    if title_hit:
        return "title", title_hit
    summary_hit = match_one(summary or "", pattern)
    if summary_hit:
        return "summary", summary_hit
    return None


def best_matches(
    title: str | None, summary: str | None, patterns: list[Pattern]
) -> dict[str, dict]:
    """Best match per category: highest confidence wins, ties keep the first.

    `title` and `summary` are searched separately so the stored candidate can
    record which field produced the hit. A title match wins over a summary
    match for the same pattern.
    """
    results: dict[str, dict] = {}
    for pattern in patterns:
        hit = match_fields(title, summary, pattern)
        if hit is None:
            continue
        field, matched = hit
        current = results.get(pattern.category_code)
        if current is not None:
            current_rank = CONFIDENCE_ORDER[current["confidence"]]
            new_rank = CONFIDENCE_ORDER[pattern.confidence]
            if current_rank > new_rank:
                continue
            if current_rank == new_rank and not (
                field == "title" and current["matched_field"] == "summary"
            ):
                continue
        results[pattern.category_code] = {
            "pattern": pattern.pattern,
            "pattern_type": pattern.pattern_type,
            "confidence": pattern.confidence,
            "matched_text": matched,
            "matched_field": field,
        }
    return results
