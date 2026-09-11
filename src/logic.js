import { SAFETY_RULES, SAFETY_APPLICABILITY, CATEGORY_SAFETY_PRIORITY, SAFETY_PLAN_LIMITS } from "./data.js";

export function normalizeIdentifier(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeWords(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function validateBrand(value) {
  const text = String(value ?? "").trim();
  if (!text) return { valid: true, value: "" };
  if (text.length > 60) return { valid: false, reason: "too-long", message: "Keep the brand to 60 characters or fewer." };
  if (!/\p{L}/u.test(text)) return { valid: false, reason: "needs-letter", message: "Enter a brand name with at least one letter, or leave it blank." };
  if (!/^[\p{L}\p{N} &.'’()+\-]+$/u.test(text)) return { valid: false, reason: "characters", message: "Use letters, numbers, spaces and common brand punctuation only." };
  return { valid: true, value: text };
}

export function validateModel(value) {
  const text = String(value ?? "").trim();
  if (!text) return { valid: true, value: "" };
  if (text.length > 50) return { valid: false, reason: "too-long", message: "Keep the model number to 50 characters or fewer." };
  if (!/[\p{L}\p{N}]/u.test(text)) return { valid: false, reason: "content", message: "Enter a model using letters or numbers, or leave it blank." };
  if (!/^[\p{L}\p{N} ._\/#()+\-]+$/u.test(text)) return { valid: false, reason: "characters", message: "Use letters, numbers, spaces, dashes, dots or slashes for the model number." };
  return { valid: true, value: text };
}

export function validateProblem(value) {
  const text = String(value ?? "").trim();
  if (text.length < 5) return { valid: false, reason: "too-short", message: "Tell us a little more — at least 5 characters." };
  if (text.length > 300) return { valid: false, reason: "too-long", message: "Keep the problem description to 300 characters or fewer." };
  if ((text.match(/\p{L}/gu) || []).length < 3) return { valid: false, reason: "not-meaningful", message: "Describe what you noticed in a few words, for example 'will not start'." };
  // People naturally use new lines in a text area. Only reject controls that
  // cannot be part of a normal typed or pasted description.
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) return { valid: false, reason: "control", message: "Remove unsupported control characters." };
  return { valid: true, value: text };
}

export function classifyProblem(value) {
  const text = normalizeWords(value);
  const groups = [
    ["battery / charging", ["battery", "charge", "charging", "charger", "swollen"]],
    ["water / leak", ["leak", "leaking", "water", "wet", "moisture", "drip"]],
    ["heat / temperature", ["hot", "heat", "overheat", "cold", "temperature", "warm"]],
    ["noise / movement", ["noise", "noisy", "rattle", "vibrate", "vibration", "spin", "motor", "suction", "movement", "moving"]],
    ["power / electrical", ["power", "start", "turn on", "switch", "electric", "trip", "breaker", "spark", "fuse"]]
  ];
  for (const [label, words] of groups) {
    if (words.some((word) => text.includes(word))) return { code: label.split(" /")[0].replace(/ /g, "-"), label };
  }
  return { code: "general", label: "general performance" };
}

export function findSuburbSuggestions(query, index, limit = 8) {
  const raw = String(query ?? "").trim();
  if (raw.length < 2) return [];
  const numeric = /^\d+$/.test(raw);
  const q = normalizeWords(raw);
  const rows = Array.isArray(index) ? index : [];
  const ranked = rows
    .map((item) => {
      const suburb = normalizeWords(item.suburb);
      const postcode = String(item.postcode || "");
      let score = 99;
      if (numeric && postcode.startsWith(raw)) score = postcode === raw ? 0 : 1;
      else if (!numeric && suburb === q) score = 0;
      else if (!numeric && suburb.startsWith(q)) score = 1;
      else if (!numeric && suburb.includes(q)) score = 2;
      return { ...item, score, label: `${postcode} — ${item.suburb}` };
    })
    .filter((item) => item.score < 99)
    .sort((a, b) => a.score - b.score || String(a.postcode).localeCompare(String(b.postcode)) || String(a.suburb).localeCompare(String(b.suburb)));
  const seen = new Set();
  const output = [];
  for (const item of ranked) {
    const key = `${item.postcode}|${normalizeWords(item.suburb)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

export function resolveAreaInput(query, index) {
  const raw = String(query ?? "").trim();
  if (!raw) return { valid: false, reason: "missing", message: "Type a suburb or 4-digit postcode." };
  if (raw.length > 50) return { valid: false, reason: "too-long", message: "Keep the suburb or postcode to 50 characters or fewer." };
  const rows = Array.isArray(index) ? index : [];
  const postcodeMatch = raw.match(/^(\d{4})(?:\s*[—-]\s*(.+))?$/);
  let matches = [];
  if (postcodeMatch) {
    matches = rows.filter((item) => String(item.postcode) === postcodeMatch[1]);
    if (postcodeMatch[2]) {
      const name = normalizeWords(postcodeMatch[2]);
      matches = matches.filter((item) => normalizeWords(item.suburb) === name);
    }
  } else if (/^\d+$/.test(raw)) {
    return { valid: false, reason: "partial-postcode", message: "Enter all 4 postcode digits or choose a suggestion." };
  } else {
    const q = normalizeWords(raw.replace(/^\d{4}\s*[—-]\s*/, ""));
    if (!q || !/\p{L}/u.test(raw)) return { valid: false, reason: "format", message: "Enter a suburb name or 4-digit postcode." };
    matches = rows.filter((item) => normalizeWords(item.suburb) === q);
  }
  if (!matches.length) return { valid: false, reason: "not-found", message: "Choose a suburb/postcode from the suggestions so we can place it on the map." };
  const latitude = matches.reduce((sum, item) => sum + Number(item.latitude), 0) / matches.length;
  const longitude = matches.reduce((sum, item) => sum + Number(item.longitude), 0) / matches.length;
  const postcode = String(matches[0].postcode);
  const suburb = matches.length === 1 ? matches[0].suburb : "";
  return { valid: true, latitude, longitude, postcode, suburb, label: suburb ? `${postcode} — ${suburb}` : postcode };
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

  const safeAppliance = appliance && typeof appliance === "object" ? appliance : {};
  const safeRecalls = Array.isArray(recalls) ? recalls : [];
  const categoryCode = String(safeAppliance.categoryCode || "").trim();
  const categoryCandidates = safeRecalls.filter((recall) => Array.isArray(recall?.categoryCodes) && recall.categoryCodes.includes(categoryCode));
  const brand = normalizeWords(safeAppliance.brand);
  const model = normalizeIdentifier(safeAppliance.model);

  if (!brand && !model) {
    return { status: "insufficient", match: null, matches: categoryCandidates, limited: true, reason: "category-only" };
  }

  if (!model) {
    const brandCandidates = brand
      ? categoryCandidates.filter((recall) => normalizeWords(recall?.brand) === brand)
      : categoryCandidates;
    return { status: "insufficient", match: null, matches: brandCandidates, limited: true, reason: "model-required" };
  }

  const exactMatches = categoryCandidates.filter((recall) => {
    const identifiers = Array.isArray(recall?.identifiers) ? recall.identifiers : [];
    return identifiers.some((identifier) => {
      const value = identifier && typeof identifier === "object" ? identifier : null;
      return value && ["model", "sku"].includes(value.type) && normalizeIdentifier(value.normalizedValue || value.value) === model;
    });
  });

  if (exactMatches.length) {
    const match = exactMatches[0];
    const brandConflict = Boolean(brand && normalizeWords(match?.brand) && normalizeWords(match.brand) !== brand);
    return { status: "possible", match, matches: exactMatches, limited: true, reason: "exact-model", brandConflict };
  }

  const near = categoryCandidates
    .flatMap((recall) => {
      const identifiers = Array.isArray(recall?.identifiers) ? recall.identifiers : [];
      return identifiers.map((identifier) => ({ recall, identifier }));
    })
    .filter(({ identifier }) => identifier && ["model", "sku"].includes(identifier.type))
    .map(({ recall, identifier }) => ({
      recall,
      identifier,
      distance: levenshtein(model, identifier.normalizedValue || identifier.value)
    }))
    .filter(({ distance, identifier }) => Number.isFinite(distance) && distance === 1 && normalizeIdentifier(identifier.normalizedValue || identifier.value).length >= 5)
    .slice(0, 3);

  return { status: "none", match: null, matches: [], near, limited: true, reason: "no-limited-dataset-match" };
}

export function applicableSafetySigns(category, signs) {
  const safeSigns = Array.isArray(signs) ? signs : [];
  const safeCategory = String(category || "");
  return safeSigns.filter(([id]) => {
    const limitedTo = SAFETY_APPLICABILITY[id];
    if (!limitedTo) return true;
    return Array.isArray(limitedTo) && limitedTo.includes(safeCategory);
  });
}

/**
 * Return a short, goal-specific safety plan. All selected question IDs must be
 * valid for the chosen appliance. The direct paths deliberately ask fewer
 * questions than the guided path, while still keeping the most consequential
 * warning signs first.
 */
export function safetyPlanFor(category, intent, signs) {
  const safeCategory = String(category || "");
  const safeIntent = String(intent || "guide");
  const applicable = applicableSafetySigns(safeCategory, signs);
  const byId = new Map(applicable.map((entry) => [entry[0], entry]));
  const availableIds = applicable.map(([id]) => id);
  const categoryPriority = Array.isArray(CATEGORY_SAFETY_PRIORITY[safeCategory]) ? CATEGORY_SAFETY_PRIORITY[safeCategory] : [];
  const core = safeIntent === "recycle"
    ? ["burning", ...(byId.has("battery") ? ["battery"] : ["electrical"])]
    : ["burning", "electrical"];
  const ordered = [...core, ...categoryPriority, ...availableIds]
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => byId.has(id));
  const limit = SAFETY_PLAN_LIMITS[safeIntent] || SAFETY_PLAN_LIMITS.guide;
  return ordered.slice(0, limit).map((id) => byId.get(id));
}

export function evaluateSafety(answers, rules = SAFETY_RULES) {
  const yes = [];
  const unsure = [];
  const critical = [];
  const caution = [];
  const safeRules = rules && typeof rules === "object" ? rules : {};
  Object.entries(answers || {}).forEach(([id, answer]) => {
    if (answer === "yes" || answer === true) {
      yes.push(id);
      if (safeRules[id]?.severity === "critical") critical.push(id);
      else caution.push(id);
    } else if (answer === "unsure") {
      unsure.push(id);
    }
  });
  const status = critical.length ? "high" : unsure.length ? "uncertain" : caution.length ? "caution" : "clear";
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
      allowCost: recallStatus !== "possible",
      allowCommunityRepair: false,
      allowRepairExploration: recallStatus !== "possible",
      exploratoryOnly: true,
      allowNextSteps: true,
      kind: recallStatus === "possible" ? "recall-uncertain" : "uncertain",
      pathway: recallStatus === "possible" ? "official-guidance" : "professional"
    };
  }
  if (safetyStatus === "caution") {
    return {
      allowCost: recallStatus !== "possible",
      allowCommunityRepair: false,
      allowNextSteps: true,
      kind: recallStatus === "possible" ? "recall-caution" : "caution",
      pathway: recallStatus === "possible" ? "official-guidance" : "assessment"
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

export function parseMoney(value, { allowZero = false } = {}) {
  if (value === "" || value === null || value === undefined) return { valid: false, reason: "missing" };
  const raw = String(value).trim();
  if (!raw) return { valid: false, reason: "missing" };
  // Accept a price copied from an Australian quote or shop, while requiring
  // conventional grouping so a typo such as 1,80 is not silently made 180.
  const cleaned = raw.replace(/^(?:AUD\s*\$?\s*|A\$\s*|\$\s*)/i, "");
  if (/^-/.test(cleaned)) return { valid: false, reason: "negative" };
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(cleaned)) return { valid: false, reason: "not-number" };
  const amount = Number(cleaned.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return { valid: false, reason: "not-number" };
  if (amount === 0 && !allowZero) return { valid: false, reason: "zero" };
  if ((cleaned.split(".")[1] || "").length > 2) return { valid: false, reason: "precision" };
  if (amount > 100000) return { valid: false, reason: "too-large" };
  return { valid: true, amount };
}

export function compareCosts(repairInput, replacementInput) {
  const repair = parseMoney(repairInput, { allowZero: true });
  const replacement = parseMoney(replacementInput);
  const errors = {};
  const messages = {
    repair: {
      missing: "Enter the repair quote you were given.",
      negative: "The repair quote cannot be negative.",
      "not-number": "Enter an amount such as 180, $180.00 or 1,200. Use 0 for a free repair quote.",
      zero: "Enter 0 or more for the repair quote.",
      precision: "Use no more than two decimal places.",
      "too-large": "Please check this amount."
    },
    replacement: {
      missing: "Enter the replacement price you found.",
      negative: "The replacement price cannot be negative.",
      "not-number": "Enter an amount such as 320, $320.00 or 1,200.",
      zero: "The replacement price must be more than $0.",
      precision: "Use no more than two decimal places.",
      "too-large": "Please check this amount."
    }
  };
  if (!repair.valid) errors.repair = messages.repair[repair.reason];
  if (!replacement.valid) errors.replacement = messages.replacement[replacement.reason];
  if (Object.keys(errors).length) return { valid: false, errors };

  // Compare cents, avoiding results such as 0.19999999999999998 dollars.
  const difference = Math.abs(Math.round(repair.amount * 100) - Math.round(replacement.amount * 100)) / 100;
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

function finiteCoordinate(value, maximum) {
  if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= maximum ? number : null;
}

export function distanceKm(from, to) {
  const lat1 = finiteCoordinate(from?.latitude, 90);
  const lon1 = finiteCoordinate(from?.longitude, 180);
  const lat2 = finiteCoordinate(to?.latitude, 90);
  const lon2 = finiteCoordinate(to?.longitude, 180);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

  const radiusKm = 6371.0088;
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.min(1, Math.max(0, Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2));
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getLocations(area, pathway, locations, limit = 12) {
  const query = normalizeWords(area);
  const safeLocations = Array.isArray(locations) ? locations : [];
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Number(limit)) : 0;
  if (!query) return { matches: [], total: 0, mode: "area" };
  const filtered = safeLocations
    .filter((location) => location && location.pathway === pathway)
    .filter((location) => {
      const suburb = normalizeWords(location.suburb || location.area);
      const postcode = String(location.postcode || "").trim();
      return suburb.includes(query) || postcode === String(area).trim();
    });
  return { matches: filtered.slice(0, safeLimit), total: filtered.length, mode: "area" };
}

export function getNearbyLocations(userLocation, pathway, locations, options = {}) {
  const safeLocations = Array.isArray(locations) ? locations : [];
  const safeOptions = options && typeof options === "object" ? options : {};
  const requestedRadius = Number(safeOptions.radiusKm ?? 10);
  const radiusKm = Number.isFinite(requestedRadius) ? Math.max(0, requestedRadius) : 10;
  const providerType = String(safeOptions.providerType || "all");
  const requestedLimit = Number(safeOptions.limit ?? 12);
  const limit = Number.isFinite(requestedLimit) ? Math.max(0, Math.floor(requestedLimit)) : 12;

  const ranked = safeLocations
    .filter((location) => location && location.pathway === pathway)
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
  return finiteCoordinate(location?.latitude, 90) !== null && finiteCoordinate(location?.longitude, 180) !== null;
}
