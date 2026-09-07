import { SAFETY_RULES, SAFETY_APPLICABILITY } from "./data.js";

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
 * Product-safety matching is deliberately conservative. Exact model/SKU
 * identifiers are checked within the selected category. Brand supports the
 * match but cannot hide an exact model hit. Near matches are suggestions only.
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
    const brandCandidates = brand
      ? categoryCandidates.filter((recall) => normalizeWords(recall.brand) === brand)
      : categoryCandidates;
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

  const near = categoryCandidates
    .flatMap((recall) => (recall.identifiers || []).map((identifier) => ({ recall, identifier })))
    .filter(({ identifier }) => ["model", "sku"].includes(identifier.type))
    .map(({ recall, identifier }) => ({
      recall,
      identifier,
      distance: levenshtein(model, identifier.normalizedValue || identifier.value)
    }))
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
      if (rules[id]?.severity === "critical") critical.push(id);
      else caution.push(id);
    } else if (answer === "unsure") {
      unsure.push(id);
    }
  });
  const status = critical.length ? "high" : (caution.length || unsure.length) ? "uncertain" : "clear";
  return { status, yes, unsure, critical, caution };
}

export function journeyDecision(recallStatus, safetyStatus) {
  if (safetyStatus === "high") {
    return {
      allowCost: false,
      allowCommunityRepair: false,
      allowNextSteps: true,
      kind: recallStatus === "possible" ? "recall-high" : "high",
      pathway: recallStatus === "possible" ? "official-guidance" : "professional"
    };
  }
  if (safetyStatus === "uncertain") {
    return {
      allowCost: false,
      allowCommunityRepair: false,
      allowNextSteps: true,
      kind: recallStatus === "possible" ? "recall-uncertain" : "uncertain",
      pathway: recallStatus === "possible" ? "official-guidance" : "professional"
    };
  }
  if (recallStatus === "possible") {
    return { allowCost: false, allowCommunityRepair: false, allowNextSteps: true, kind: "recall", pathway: "official-guidance" };
  }
  if (recallStatus === "unavailable") {
    return { allowCost: true, allowCommunityRepair: true, allowNextSteps: true, kind: "recall-unavailable", pathway: "options" };
  }
  return { allowCost: true, allowCommunityRepair: true, allowNextSteps: true, kind: "clear-to-options", pathway: "options" };
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
    repair: {
      missing: "Enter the repair quote you were given.",
      negative: "The repair quote cannot be negative.",
      "not-number": "Use numbers only, for example 180 or 180.00.",
      zero: "The repair quote must be more than $0.",
      precision: "Use no more than two decimal places.",
      "too-large": "Please check this amount."
    },
    replacement: {
      missing: "Enter the replacement price you found.",
      negative: "The replacement price cannot be negative.",
      "not-number": "Use numbers only, for example 320 or 320.00.",
      zero: "The replacement price must be more than $0.",
      precision: "Use no more than two decimal places.",
      "too-large": "Please check this amount."
    }
  };
  if (!repair.valid) errors.repair = messages.repair[repair.reason];
  if (!replacement.valid) errors.replacement = messages.replacement[replacement.reason];
  if (Object.keys(errors).length) return { valid: false, errors };

  const difference = Math.abs(repair.amount - replacement.amount);
  const lower = repair.amount === replacement.amount ? "equal" : repair.amount < replacement.amount ? "repair" : "replacement";
  return {
    valid: true,
    repair: repair.amount,
    replacement: replacement.amount,
    difference,
    lower,
    repairRatio: repair.amount / replacement.amount
  };
}

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function distanceKm(from, to) {
  const lat1 = finiteCoordinate(from?.latitude);
  const lon1 = finiteCoordinate(from?.longitude);
  const lat2 = finiteCoordinate(to?.latitude);
  const lon2 = finiteCoordinate(to?.longitude);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

  const radiusKm = 6371.0088;
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getLocations(area, pathway, locations, limit = 12) {
  const query = normalizeWords(area);
  if (!query) return { matches: [], total: 0, mode: "area" };
  const filtered = locations
    .filter((location) => location.pathway === pathway)
    .filter((location) => {
      const suburb = normalizeWords(location.suburb || location.area);
      const postcode = String(location.postcode || "").trim();
      return suburb.includes(query) || postcode === String(area).trim();
    });
  return { matches: filtered.slice(0, limit), total: filtered.length, mode: "area" };
}

export function getNearbyLocations(userLocation, pathway, locations, options = {}) {
  const radiusKm = Number(options.radiusKm || 10);
  const providerType = String(options.providerType || "all");
  const limit = Number(options.limit || 12);

  const ranked = locations
    .filter((location) => location.pathway === pathway)
    .filter((location) => providerType === "all" || location.providerType === providerType)
    .map((location) => ({ ...location, distanceKm: distanceKm(userLocation, location) }))
    .filter((location) => Number.isFinite(location.distanceKm))
    .filter((location) => location.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    matches: ranked.slice(0, limit),
    total: ranked.length,
    mode: "nearby",
    radiusKm
  };
}

export function locationHasCoordinates(location) {
  return finiteCoordinate(location?.latitude) !== null && finiteCoordinate(location?.longitude) !== null;
}
