import { SAFETY_RULES, SAFETY_APPLICABILITY } from "./data.js";

export function validateAppliance(input, families) {
  const family = families.find((item) => item.id === input.family);
  const errors = {};
  if (!family) errors.family = "Select one of the six supported appliance families.";
  if (!input.category || !family?.categories.includes(input.category)) errors.category = "Select an appliance category from the chosen family.";
  if (String(input.brand || "").length > 100) errors.brand = "Brand must be 100 characters or fewer.";
  if (String(input.model || "").length > 100) errors.model = "Model number must be 100 characters or fewer.";
  return errors;
}

export function normalizeIdentifier(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeWords(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function levenshtein(a, b) {
  const left = normalizeIdentifier(a);
  const right = normalizeIdentifier(b);
  if (!left || !right) return Infinity;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[right.length];
}

/**
 * Recall matching is model-first within the chosen appliance category.
 * Brand is supporting evidence, not a gate that can accidentally hide an exact
 * model hit. Close/partial identifiers are never treated as recall matches.
 */
export function matchRecall(appliance, recalls, dataAvailable = true) {
  if (!dataAvailable) return { status: "unavailable", match: null, matches: [], limited: true, reason: "data-unavailable" };

  const categoryCandidates = recalls.filter((recall) => recall.categoryCodes?.includes(appliance.categoryCode));
  const brand = normalizeWords(appliance.brand);
  const model = normalizeIdentifier(appliance.model);

  if (!brand && !model) {
    return { status: "insufficient", match: null, matches: categoryCandidates, limited: true, reason: "category-only" };
  }

  if (!model) {
    const brandCandidates = brand ? categoryCandidates.filter((recall) => normalizeWords(recall.brand) === brand) : categoryCandidates;
    return { status: "insufficient", match: null, matches: brandCandidates, limited: true, reason: "model-required" };
  }

  const exactMatches = categoryCandidates.filter((recall) =>
    (recall.identifiers || []).some((identifier) =>
      ["model", "sku"].includes(identifier.type) && normalizeIdentifier(identifier.normalizedValue || identifier.value) === model
    )
  );

  if (exactMatches.length) {
    const match = exactMatches[0];
    const brandConflict = Boolean(brand && normalizeWords(match.brand) && normalizeWords(match.brand) !== brand);
    return { status: "possible", match, matches: exactMatches, limited: true, reason: "exact-model", brandConflict };
  }

  const near = categoryCandidates.flatMap((recall) => (recall.identifiers || []).map((identifier) => ({ recall, identifier })))
    .filter(({ identifier }) => ["model", "sku"].includes(identifier.type))
    .map(({ recall, identifier }) => ({ recall, identifier, distance: levenshtein(model, identifier.normalizedValue || identifier.value) }))
    .filter(({ distance, identifier }) => distance === 1 && normalizeIdentifier(identifier.normalizedValue || identifier.value).length >= 5)
    .slice(0, 3);

  return { status: "none", match: null, matches: [], near, limited: true, reason: "no-limited-dataset-match" };
}

export function applicableSafetySigns(category, signs) {
  return signs.filter(([id]) => {
    const limitedTo = SAFETY_APPLICABILITY[id];
    return !limitedTo || limitedTo.includes(category);
  });
}

export function evaluateSafety(answers, rules = SAFETY_RULES) {
  const yes = [];
  const unsure = [];
  const critical = [];
  const caution = [];
  Object.entries(answers || {}).forEach(([id, answer]) => {
    if (answer === "yes") {
      yes.push(id);
      if (rules[id]?.severity === "critical") critical.push(id); else caution.push(id);
    } else if (answer === "unsure") {
      unsure.push(id);
    }
  });
  const status = critical.length ? "high" : (caution.length || unsure.length) ? "uncertain" : "clear";
  return { status, yes, unsure, critical, caution };
}

export function journeyDecision(recallStatus, safetyStatus) {
  if (safetyStatus === "high") return { allowCost: false, allowNextSteps: true, kind: recallStatus === "possible" ? "recall-high" : "high", pathway: recallStatus === "possible" ? "official-guidance" : "professional" };
  if (safetyStatus === "uncertain") return { allowCost: false, allowNextSteps: true, kind: recallStatus === "possible" ? "recall-uncertain" : "uncertain", pathway: recallStatus === "possible" ? "official-guidance" : "professional" };
  if (recallStatus === "possible") return { allowCost: false, allowNextSteps: true, kind: "recall", pathway: "official-guidance" };
  if (recallStatus === "unavailable") return { allowCost: true, allowNextSteps: true, kind: "recall-unavailable", pathway: "pathway" };
  return { allowCost: true, allowNextSteps: true, kind: "clear-to-pathways", pathway: "pathway" };
}

export function parseMoney(value) {
  if (value === "" || value === null || value === undefined) return { valid: false, reason: "missing" };
  const cleaned = String(value).trim();
  if (!cleaned) return { valid: false, reason: "missing" };
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { valid: false, reason: "not-number" };
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return { valid: false, reason: "not-number" };
  if (amount <= 0) return { valid: false, reason: amount === 0 ? "zero" : "negative" };
  if ((cleaned.split(".")[1] || "").length > 2) return { valid: false, reason: "precision" };
  if (amount > 100000) return { valid: false, reason: "too-large" };
  return { valid: true, amount };
}

export function compareCosts(repairInput, replacementInput) {
  const repair = parseMoney(repairInput);
  const replacement = parseMoney(replacementInput);
  const errors = {};
  const messages = {
    repair: { missing: "Enter a repair quote to compare costs.", negative: "Repair quote cannot be negative.", "not-number": "Use numbers only, for example 180 or 180.00.", zero: "Repair quote must be greater than $0.", precision: "Use no more than two decimal places.", "too-large": "Check the amount entered." },
    replacement: { missing: "Enter a replacement price to compare costs.", negative: "Replacement price cannot be negative.", "not-number": "Use numbers only, for example 320 or 320.00.", zero: "Replacement price must be greater than $0.", precision: "Use no more than two decimal places.", "too-large": "Check the amount entered." }
  };
  if (!repair.valid) errors.repair = messages.repair[repair.reason];
  if (!replacement.valid) errors.replacement = messages.replacement[replacement.reason];
  if (Object.keys(errors).length) return { valid: false, errors };
  const difference = Math.abs(repair.amount - replacement.amount);
  const lower = repair.amount === replacement.amount ? "equal" : repair.amount < replacement.amount ? "repair" : "replacement";
  return { valid: true, repair: repair.amount, replacement: replacement.amount, difference, lower, repairRatio: repair.amount / replacement.amount };
}

export function getLocations(area, pathway, locations, limit = 8) {
  const query = normalizeWords(area);
  if (!query) return { matches: [], total: 0 };
  const filtered = locations
    .filter((location) => location.pathway === pathway)
    .filter((location) => {
      const suburb = normalizeWords(location.suburb || location.area);
      const postcode = String(location.postcode || "").trim();
      return suburb.includes(query) || postcode === String(area).trim();
    });
  return { matches: filtered.slice(0, limit), total: filtered.length };
}
