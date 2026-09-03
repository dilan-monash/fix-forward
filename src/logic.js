export function validateAppliance(input, families) {
  const family = families.find((item) => item.id === input.family);
  const errors = {};
  if (!family) errors.family = "Select one of the six supported appliance families.";
  if (!input.category || !family?.categories.includes(input.category)) errors.category = "Select an appliance category from the chosen family.";
  return errors;
}

export function matchRecall(appliance, recalls, dataAvailable = true) {
  if (!dataAvailable) return { status: "unavailable", match: null, limited: true };
  const match = recalls.find((recall) => recall.family === appliance.family && recall.category === appliance.category);
  return { status: match ? "possible" : "none", match: match || null, limited: Boolean(match) };
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

export function getLocations(area, pathway, locations) {
  return locations.filter((location) => location.area === area && location.pathway === pathway && location.verified === true);
}
