export function validateAppliance(input, families) {
  const family = families.find((item) => item.id === input.family);
  const errors = {};
  if (!family) errors.family = "Select one of the six supported appliance families.";
  if (!input.category || !family?.categories.includes(input.category)) errors.category = "Select an appliance category from the chosen family.";
  if (String(input.brand || "").length > 100) errors.brand = "Brand must be 100 characters or fewer.";
  if (String(input.model || "").length > 100) errors.model = "Model must be 100 characters or fewer.";
  return errors;
}

// Product identifiers appear with spaces, punctuation and mixed letter case.
// Converting "BVC-160" and "bvc 160" to "BVC160" makes exact comparison
// tolerant of formatting without allowing unsafe partial matches.
export function normalizeIdentifier(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeWords(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function matchRecall(appliance, recalls, dataAvailable = true) {
  if (!dataAvailable) return { status: "unavailable", match: null, matches: [], limited: true, reason: "data-unavailable" };

  const categoryCandidates = recalls.filter((recall) => recall.categoryCodes?.includes(appliance.categoryCode));
  const brand = normalizeWords(appliance.brand);
  const model = normalizeIdentifier(appliance.model);

  // Category alone can only narrow the search; it cannot identify a product.
  if (!brand && !model) {
    return { status: "insufficient", match: null, matches: [], limited: true, reason: "category-only" };
  }

  const brandCandidates = brand
    ? categoryCandidates.filter((recall) => normalizeWords(recall.brand) === brand)
    : categoryCandidates;

  // Brand-only results are possible notices, never a recalled/not-recalled verdict.
  if (!model) {
    return { status: "insufficient", match: null, matches: brandCandidates, limited: true, reason: "model-required" };
  }

  const exactMatches = brandCandidates.filter((recall) =>
    (recall.identifiers || []).some((identifier) =>
      ["model", "sku"].includes(identifier.type) && normalizeIdentifier(identifier.normalizedValue || identifier.value) === model
    )
  );

  return exactMatches.length
    ? { status: "possible", match: exactMatches[0], matches: exactMatches, limited: true, reason: "exact-model" }
    : { status: "none", match: null, matches: [], limited: true, reason: "no-limited-dataset-match" };
}

export function evaluateSafety(answers) {
  const entries = Object.entries(answers || {});
  const yes = entries.filter(([, answer]) => answer === "yes").map(([id]) => id);
  const unsure = entries.filter(([, answer]) => answer === "unsure").map(([id]) => id);
  return { status: yes.length ? "high" : unsure.length ? "uncertain" : "clear", yes, unsure };
}

export function journeyDecision(recallStatus, safetyStatus) {
  if (recallStatus === "unavailable") return { allowCost: false, allowNextSteps: false, kind: "data-unavailable", pathway: "official-search" };
  if (safetyStatus === "high") return { allowCost: false, allowNextSteps: recallStatus !== "possible", kind: recallStatus === "possible" ? "recall-high" : "high", pathway: recallStatus === "possible" ? "official-guidance" : "professional" };
  if (safetyStatus === "uncertain") return { allowCost: false, allowNextSteps: recallStatus !== "possible", kind: recallStatus === "possible" ? "recall-uncertain" : "uncertain", pathway: recallStatus === "possible" ? "official-guidance" : "professional" };
  if (recallStatus === "possible") return { allowCost: false, allowNextSteps: false, kind: "recall", pathway: "official-guidance" };
  return { allowCost: true, allowNextSteps: true, kind: "clear-to-pathways", pathway: "pathway" };
}

export function parseMoney(value) {
  if (value === "" || value === null || value === undefined) return { valid: false, reason: "missing" };
  const cleaned = String(value).trim();
  if (!cleaned) return { valid: false, reason: "missing" };
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { valid: false, reason: "not-number" };
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return { valid: false, reason: "not-number" };
  if (amount < 0) return { valid: false, reason: "negative" };
  if (amount === 0) return { valid: false, reason: "zero" };
  if ((cleaned.split(".")[1] || "").length > 2) return { valid: false, reason: "precision" };
  return { valid: true, amount };
}

export function compareCosts(repairInput, replacementInput) {
  const repair = parseMoney(repairInput);
  const replacement = parseMoney(replacementInput);
  const errors = {};
  const messages = {
    repair: {
      missing: "Enter your repair quote before comparing costs.",
      negative: "Repair quote cannot be negative. Enter an amount greater than $0.",
      "not-number": "Repair quote must contain numbers only, for example 180 or 180.00.",
      zero: "Repair quote must be greater than $0.",
      precision: "Repair quote can have no more than two decimal places."
    },
    replacement: {
      missing: "Enter an estimated replacement price before comparing costs.",
      negative: "Replacement price cannot be negative. Enter an amount greater than $0.",
      "not-number": "Replacement price must contain numbers only, for example 320 or 320.00.",
      zero: "Replacement price must be greater than $0.",
      precision: "Replacement price can have no more than two decimal places."
    }
  };
  if (!repair.valid) errors.repair = messages.repair[repair.reason];
  if (!replacement.valid) errors.replacement = messages.replacement[replacement.reason];
  if (Object.keys(errors).length) return { valid: false, errors };
  const difference = Math.abs(repair.amount - replacement.amount);
  const lower = repair.amount === replacement.amount ? "equal" : repair.amount < replacement.amount ? "repair" : "replacement";
  return { valid: true, repair: repair.amount, replacement: replacement.amount, difference, lower };
}

export function getLocations(area, pathway, locations, limit = 8) {
  const query = normalizeWords(area);
  if (!query) return [];
  return locations
    .filter((location) => location.pathway === pathway)
    .filter((location) => {
      const suburb = normalizeWords(location.suburb || location.area);
      const postcode = String(location.postcode || "").trim();
      return suburb.includes(query) || postcode === String(area).trim();
    })
    .slice(0, limit);
}
