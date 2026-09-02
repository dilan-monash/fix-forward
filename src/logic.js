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
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { valid: false, reason: "invalid" };
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return { valid: false, reason: amount < 0 ? "negative" : "zero" };
  return { valid: true, amount };
}

export function compareCosts(repairInput, replacementInput) {
  const repair = parseMoney(repairInput);
  const replacement = parseMoney(replacementInput);
  const errors = {};
  if (!repair.valid) errors.repair = repair.reason === "missing" ? "A repair quote is required for a direct comparison. You can leave and return after obtaining one." : "Enter a repair quote greater than $0 using numbers only.";
  if (!replacement.valid) errors.replacement = replacement.reason === "missing" ? "Enter an estimated replacement price before comparing." : "Enter a replacement price greater than $0 using numbers only.";
  if (Object.keys(errors).length) return { valid: false, errors };
  const difference = Math.abs(repair.amount - replacement.amount);
  const lower = repair.amount === replacement.amount ? "equal" : repair.amount < replacement.amount ? "repair" : "replacement";
  return { valid: true, repair: repair.amount, replacement: replacement.amount, difference, lower };
}

export function getLocations(area, pathway, locations) {
  return locations.filter((location) => location.area === area && location.pathway === pathway);
}
