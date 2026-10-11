/** Scrapworks rules engine. Pure data and functions only, so every rule can be
 * tested without a browser. Points, tokens and stars are fictional game values,
 * not real carbon or material-savings estimates. */

export const DESTINATIONS = Object.freeze(['reuse', 'repair', 'recycle', 'hold']);
export const DESTINATION_LABELS = Object.freeze({ reuse: 'Reuse', repair: 'Repair', recycle: 'Specialist Recycle', hold: 'Safety Hold', bin: 'Household bin' });
export const POINTS = Object.freeze({ reuseWorking: 4, repairBase: 3, recycleUsable: 1, recycleEndOfLife: 3, safetyHold: 3 });
export const HAZARD_MESSAGE = 'Stop—an adult or specialist must handle this.';
export const SAVE_KEY = 'fixforward-scrapworks-v1';

// One helper keeps the 49 scenario rows readable. Extra field `clue` is what
// Inspect reveals; `explanation` is the one-sentence result of the best route.
const item = (id, name, illustration, condition, { hazard = false, personalData = false, repairCost = 0, lifeBonus = 0 } = {}, clue, explanation) =>
  Object.freeze({ id, name, illustration, condition, hazard, personalData, repairCost, lifeBonus, clue, explanation });

export const ITEMS = Object.freeze(Object.fromEntries([
  // Levels 1–2: inspection and the four destinations. No hazards or personal data yet.
  item('library-tablet', 'Library tablet', 'tablet', 'working', {}, 'Staff already reset it. The screen and battery work well.', 'This tablet still works. Reusing it keeps the whole device in use.'),
  item('frayed-headphones', 'Headphones with a worn cable', 'headphones', 'minor_fault', { repairCost: 1, lifeBonus: 1 }, 'One ear goes quiet because the cable is worn. A repairer can swap the cable.', 'A repairer swaps the cable, so the headphones get a longer life.'),
  item('dead-dvd-player', 'DVD player that will not spin', 'player', 'end_of_life', {}, 'The motor and circuit board have failed and parts are no longer made.', 'Specialist recycling recovers its metals and plastics safely.'),
  item('spare-keyboard', 'Spare keyboard', 'keyboard', 'working', {}, 'Every key works. It was replaced by a newer one.', 'A working keyboard can go straight to someone who needs it.'),
  item('crackly-speaker', 'Speaker with a crackle', 'speaker', 'minor_fault', { repairCost: 2, lifeBonus: 2 }, 'The sound crackles. A repairer says the volume dial needs replacing.', 'A new dial from a repairer keeps a good speaker playing for years.'),
  item('game-controller', 'Game controller', 'controller', 'working', {}, 'All buttons respond. The family has an extra one.', 'Passing on a working controller means nobody has to make a new one.'),
  item('jammed-printer', 'Printer beyond repair', 'printer', 'end_of_life', {}, 'A repairer found the main board has burnt out. No replacement exists.', 'Specialist recyclers separate its metal, plastic and circuit board.'),
  item('flicker-lamp', 'Desk lamp that flickers', 'lamp', 'minor_fault', { repairCost: 1, lifeBonus: 1 }, 'The switch is loose. A repairer can fit a new one quickly.', 'A small switch repair turns a flickering lamp into a reliable one.'),
  item('kitchen-radio', 'Kitchen radio', 'radio', 'working', {}, 'It tunes in clearly. The owner is moving and does not need it.', 'A working radio can keep playing in a new home.'),
  // Levels 3–4: hazards always win, and personal data pauses routing.
  item('swollen-phone', 'Phone with a swollen battery', 'phone', 'minor_fault', { hazard: true, personalData: true, repairCost: 1, lifeBonus: 2 }, 'The back is bulging. A swollen battery can overheat or catch fire.', 'Safety Hold lets an adult or specialist take care of the battery.'),
  item('family-laptop', 'Family laptop', 'laptop', 'working', { personalData: true }, 'It works well, but it still holds family photos and schoolwork.', 'Once an adult cleared the data, the laptop can be reused safely.'),
  item('puffy-powerbank', 'Power bank that feels puffy', 'powerbank', 'end_of_life', { hazard: true }, 'The case is puffed up and warm. Damaged batteries are a fire risk.', 'Safety Hold keeps a damaged battery away from bins and trucks.'),
  item('sticky-watch', 'Smartwatch with a sticky button', 'watch', 'minor_fault', { personalData: true, repairCost: 1, lifeBonus: 2 }, 'One button sticks. It still stores health and message data.', 'With data cleared, a repairer can fix the button for another wearer.'),
  item('old-monitor', 'Old monitor with no picture', 'monitor', 'end_of_life', {}, 'The screen stays black and a repairer says it cannot be fixed.', 'Specialist recycling keeps its glass and metals out of landfill.'),
  item('holiday-camera', 'Holiday camera', 'camera', 'working', { personalData: true }, 'It takes sharp pictures, and its memory card is full of holiday photos.', 'After an adult cleared the photos, the camera can capture new memories.'),
  item('cracked-ereader', 'E-reader with a cracked screen', 'ereader', 'minor_fault', { personalData: true, repairCost: 2, lifeBonus: 1 }, 'The screen is cracked but works. It still has the owner’s account.', 'A new screen from a repairer gives the e-reader another chapter.'),
  item('scorched-charger', 'Charger with exposed wires', 'charger', 'end_of_life', { hazard: true }, 'Bare wire is showing and the plug looks scorched.', 'Safety Hold keeps exposed wires away from hands and bins.'),
  item('retired-router', 'Retired internet router', 'router', 'end_of_life', {}, 'It is too old to connect to today’s internet and has no updates.', 'Specialist recyclers recover the small metals inside.'),
  item('spare-mouse', 'Spare computer mouse', 'mouse', 'working', {}, 'It clicks and scrolls perfectly.', 'A working mouse can help another desk straight away.'),
  item('old-phone', 'Old phone that will not turn on', 'phone', 'end_of_life', { personalData: true }, 'It no longer powers on, and it may still hold messages and photos.', 'After an adult dealt with the data, specialists recycle the phone.'),
  // Levels 5–6: limited repair tokens. Pick the repairs that are worth the most.
  item('slow-laptop', 'Laptop with a broken hinge', 'laptop', 'minor_fault', { repairCost: 2, lifeBonus: 3 }, 'The hinge has snapped, but the rest of the laptop is strong.', 'A new hinge saves a whole laptop, a big win for a small repair.'),
  item('quiet-headphones', 'Headphones with a loose ear pad', 'headphones', 'minor_fault', { repairCost: 1, lifeBonus: 1 }, 'An ear pad has come away. Replacement pads are easy for a repairer to fit.', 'New pads make the headphones comfortable again.'),
  item('noisy-console', 'Game console with a noisy fan', 'console', 'minor_fault', { repairCost: 2, lifeBonus: 2 }, 'The fan rattles. A repairer can replace it.', 'A new fan keeps the console cool for many more games.'),
  item('broken-remote', 'TV remote with a cracked board', 'remote', 'end_of_life', {}, 'The circuit board inside has cracked and the remote is very old.', 'Specialist recycling is the right ending for a remote this broken.'),
  item('shared-ereader', 'E-reader full of library books', 'ereader', 'working', { personalData: true }, 'It works perfectly but is still signed in to someone’s account.', 'With the account cleared, the e-reader can be passed on to a new reader.'),
  item('old-speaker', 'Bluetooth speaker', 'speaker', 'working', {}, 'It pairs and plays clearly.', 'This speaker still works, so reuse keeps the music going.'),
  item('cracked-phone', 'Phone with a cracked screen', 'phone', 'minor_fault', { personalData: true, repairCost: 2, lifeBonus: 3 }, 'The screen is cracked but the phone works. It still holds messages.', 'A new screen saves a whole phone for someone else.'),
  item('tired-tablet', 'Tablet with a weak charging port', 'tablet', 'minor_fault', { repairCost: 2, lifeBonus: 2 }, 'It only charges at certain angles. A repairer can replace the port.', 'A new charging port brings the tablet back to full use.'),
  item('stuck-watch', 'Smartwatch with a faded strap', 'watch', 'minor_fault', { repairCost: 1, lifeBonus: 1 }, 'The watch works, but the strap has split. A new strap fixes it.', 'A fresh strap keeps the watch on someone’s wrist.'),
  item('sticky-keyboard', 'Keyboard with three stuck keys', 'keyboard', 'minor_fault', { repairCost: 1, lifeBonus: 2 }, 'Three keys stick. A repairer can replace the key switches.', 'A few new switches make this keyboard fully useful again.'),
  item('scooter-battery', 'E-scooter battery that smells hot', 'battery', 'end_of_life', { hazard: true }, 'The battery smells hot and has a dent. Large damaged batteries are dangerous.', 'Safety Hold sends this battery to trained specialists.'),
  item('school-camera', 'School camera', 'camera', 'working', {}, 'It works and the school already cleared its card.', 'Reusing the camera lets another class take pictures.'),
  item('ink-printer', 'Printer with a cracked case', 'printer', 'end_of_life', {}, 'The case is split and the paper feeder is broken beyond repair.', 'Specialist recycling recovers what a broken printer still holds.'),
  // Levels 7–8: every mechanic together with tighter budgets.
  item('gaming-laptop', 'Laptop with a worn keyboard', 'laptop', 'minor_fault', { repairCost: 2, lifeBonus: 3 }, 'The keyboard is worn out, but the screen and battery are strong.', 'A replacement keyboard keeps a powerful laptop working.'),
  item('mini-speaker', 'Mini speaker with a loose button', 'speaker', 'minor_fault', { repairCost: 1, lifeBonus: 1 }, 'The power button wobbles. A repairer can replace it.', 'A new button gets the mini speaker playing again.'),
  item('drift-console', 'Console with a faulty disc tray', 'console', 'minor_fault', { repairCost: 2, lifeBonus: 3 }, 'The disc tray will not open. A repairer can swap the tray part.', 'A new tray keeps the console in the family.'),
  item('reading-lamp', 'Reading lamp with a bent arm', 'lamp', 'minor_fault', { repairCost: 1, lifeBonus: 2 }, 'The arm is bent, so it will not stay up. A repairer can replace the arm.', 'A new arm turns this lamp back into a great reading light.'),
  item('melted-charger', 'Charger with a melted plug', 'charger', 'end_of_life', { hazard: true }, 'The plug has melted and smells burnt.', 'Safety Hold keeps a damaged charger out of anyone’s hands.'),
  item('spare-phone', 'Spare phone in a drawer', 'phone', 'working', { personalData: true }, 'It works, but it still holds old photos and contacts.', 'Once an adult cleared the data, the phone can be reused.'),
  item('flat-monitor', 'Monitor with dead pixels everywhere', 'monitor', 'end_of_life', {}, 'Most of the screen has dead pixels. A repairer says it is not worth fixing.', 'Specialist recycling recovers its metals and glass.'),
  item('office-router', 'Office router', 'router', 'working', {}, 'It still works and supports current internet speeds.', 'A working router can connect another home.'),
  item('art-tablet', 'Drawing tablet with a cracked glass', 'tablet', 'minor_fault', { personalData: true, repairCost: 2, lifeBonus: 3 }, 'The glass is cracked. It still holds someone’s drawings.', 'A new glass panel saves a whole tablet.'),
  item('kindle-reader', 'E-reader with a stuck page button', 'ereader', 'minor_fault', { repairCost: 1, lifeBonus: 2 }, 'One page button sticks. A repairer can replace it.', 'One small button repair keeps an e-reader in use.'),
  item('bud-headphones', 'Headphones with a broken headband', 'headphones', 'minor_fault', { repairCost: 1, lifeBonus: 1 }, 'The headband has snapped. A replacement band fits easily.', 'A new headband means the headphones can be worn again.'),
  item('drift-controller', 'Controller with a drifting stick', 'controller', 'minor_fault', { repairCost: 2, lifeBonus: 2 }, 'The thumbstick moves on its own. A repairer can replace the stick.', 'A new thumbstick makes the controller reliable again.'),
  item('hot-powerbank', 'Power bank that gets very hot', 'powerbank', 'minor_fault', { hazard: true, repairCost: 1, lifeBonus: 1 }, 'It gets too hot to hold while charging. That is a warning sign.', 'Safety Hold lets specialists check a battery that overheats.'),
  item('swollen-laptop', 'Laptop with a lifted trackpad', 'laptop', 'minor_fault', { hazard: true, personalData: true, repairCost: 2, lifeBonus: 3 }, 'The trackpad is being pushed up from below, a sign of a swollen battery.', 'Safety Hold comes first. An adult handles the battery and the data.'),
  item('static-radio', 'Radio with a broken circuit board', 'radio', 'end_of_life', {}, 'Only static plays. A repairer says the board cannot be fixed.', 'Specialist recycling is the right ending for this radio.'),
  item('fitness-watch', 'Fitness watch', 'watch', 'working', { personalData: true }, 'It works well, but it still holds the owner’s fitness records.', 'With data cleared, the watch can help someone new get moving.'),
].map(entry => [entry.id, entry])));

// Repair tokens: levels 1–4 cover every repairable item; levels 5–8 do not.
// `tutorialBin` shows the tempting household bin once, on the first item only.
export const LEVELS = Object.freeze([
  { id: 1, title: 'First shift', intro: 'Inspect each item, then choose where it goes.', tokens: 1, tutorialBin: true, town: 'Community garden', items: ['library-tablet', 'frayed-headphones', 'dead-dvd-player', 'spare-keyboard'] },
  { id: 2, title: 'Four destinations', intro: 'Some items work, some need a repair, and some are at the end of their life.', tokens: 3, town: 'Repair café', items: ['crackly-speaker', 'game-controller', 'jammed-printer', 'flicker-lamp', 'kitchen-radio'] },
  { id: 3, title: 'Warning signs', intro: 'New: hazards and personal data. A hazard always goes to Safety Hold.', tokens: 1, town: 'Street trees', items: ['swollen-phone', 'family-laptop', 'puffy-powerbank', 'sticky-watch', 'old-monitor'] },
  { id: 4, title: 'Private things', intro: 'Devices with personal data need an adult to clear them before they move on.', tokens: 2, town: 'Solar roofs', items: ['holiday-camera', 'cracked-ereader', 'scorched-charger', 'retired-router', 'spare-mouse', 'old-phone'] },
  { id: 5, title: 'Short on tokens', intro: 'New: you cannot repair everything. Spend tokens where they help most.', tokens: 3, town: 'Clean pond', items: ['slow-laptop', 'quiet-headphones', 'noisy-console', 'broken-remote', 'shared-ereader', 'old-speaker'] },
  { id: 6, title: 'Choose wisely', intro: 'Compare repair cost with the life bonus before you spend.', tokens: 3, town: 'Bike lane', items: ['cracked-phone', 'tired-tablet', 'stuck-watch', 'sticky-keyboard', 'scooter-battery', 'school-camera', 'ink-printer'] },
  { id: 7, title: 'Busy hub', intro: 'Everything at once: hazards, data and a tight budget.', tokens: 3, town: 'Library garden', items: ['gaming-laptop', 'mini-speaker', 'drift-console', 'reading-lamp', 'melted-charger', 'spare-phone', 'flat-monitor', 'office-router'] },
  { id: 8, title: 'Town festival', intro: 'The biggest shift yet, with only two tokens. The flashiest repair is not always best.', tokens: 2, town: 'Wind turbine', items: ['art-tablet', 'kindle-reader', 'bud-headphones', 'drift-controller', 'hot-powerbank', 'swollen-laptop', 'static-radio', 'fitness-watch'] },
].map(level => Object.freeze({ ...level, items: Object.freeze([...level.items]) })));

export const levelById = id => LEVELS.find(level => level.id === Number(id));

/** Decide one routing attempt. Rules are checked in the brief's order: inspect,
 * bin, hazard precedence, data clearance, then condition. `ok:false` results
 * never consume the item or any tokens; the caller simply lets the player retry. */
export function evaluateChoice(entry, destination, { tokens = 0, inspected = false, dataCleared = false } = {}) {
  const fail = (reason, message) => ({ ok: false, reason, message, points: 0, cost: 0 });
  if (!inspected) return fail('inspect', 'Inspect the item first to see its clues.');
  if (destination === 'bin') return fail('bin', 'Electronics never go in a household bin. Batteries can start fires and useful materials are lost. Try another destination.');
  if (!DESTINATIONS.includes(destination)) return fail('unknown', 'Choose one of the four destinations.');
  if (entry.hazard) return destination === 'hold'
    ? { ok: true, points: POINTS.safetyHold, cost: 0, message: entry.explanation }
    : fail('hazard', HAZARD_MESSAGE);
  if (entry.personalData && !dataCleared) return fail('data', 'Pause—this device still holds personal data. Ask an adult to clear it first.');
  if (destination === 'hold') return fail('no-hazard', 'Safety Hold is for dangerous items. Inspection found no hazard here.');
  if (entry.condition === 'working') {
    if (destination === 'reuse') return { ok: true, points: POINTS.reuseWorking, cost: 0, message: entry.explanation };
    if (destination === 'recycle') return { ok: true, points: POINTS.recycleUsable, cost: 0, message: 'Recycled safely, but this working device could have stayed in use.' };
    return fail('invalid', 'It already works, so there is nothing to repair.');
  }
  if (entry.condition === 'minor_fault') {
    if (destination === 'repair') {
      if (entry.repairCost > tokens) return fail('tokens', `This repair needs ${entry.repairCost} token${entry.repairCost > 1 ? 's' : ''} and you have ${tokens}. Specialist recycling is still open.`);
      return { ok: true, points: POINTS.repairBase + entry.lifeBonus, cost: entry.repairCost, message: entry.explanation };
    }
    if (destination === 'recycle') return { ok: true, points: POINTS.recycleUsable, cost: 0, message: 'Recycled safely, but a repair could have kept it going.' };
    return fail('invalid', 'It has a fault, so it needs a repair before anyone can reuse it.');
  }
  if (destination === 'recycle') return { ok: true, points: POINTS.recycleEndOfLife, cost: 0, message: entry.explanation };
  return fail('invalid', destination === 'repair' ? 'A repairer says this one cannot be fixed.' : 'It no longer works, so it cannot be reused.');
}

/** A shift is the mutable state of one level attempt. */
export function createShift(levelId) {
  const level = levelById(levelId);
  if (!level) throw new Error(`Unknown level ${levelId}`);
  return { levelId: level.id, index: 0, tokens: level.tokens, score: 0, inspected: false, dataCleared: false, binShown: !level.tutorialBin, results: [] };
}

export const currentItem = shift => ITEMS[levelById(shift.levelId).items[shift.index]] || null;
export const isShiftComplete = shift => shift.index >= levelById(shift.levelId).items.length;

export function inspect(shift) { if (!isShiftComplete(shift)) shift.inspected = true; return shift.inspected; }

/** The in-game adult step. Allowed only after inspection reveals the data warning. */
export function clearData(shift) {
  const entry = currentItem(shift);
  if (!entry || !shift.inspected || !entry.personalData || entry.hazard) return false;
  shift.dataCleared = true;
  return true;
}

/** Apply a choice; only a valid choice advances the queue, spends tokens or scores. */
export function applyChoice(shift, destination) {
  const entry = currentItem(shift);
  if (!entry) return { ok: false, reason: 'complete', message: 'This shift is finished.', points: 0, cost: 0 };
  const result = evaluateChoice(entry, destination, shift);
  if (destination === 'bin') shift.binShown = true;
  if (!result.ok) return result;
  shift.tokens = Math.max(0, shift.tokens - result.cost);
  shift.score += result.points;
  shift.results.push({ id: entry.id, destination, points: result.points, cost: result.cost });
  Object.assign(shift, { index: shift.index + 1, inspected: false, dataCleared: false, binShown: true });
  return { ...result, item: entry, destination };
}

/** Best achievable score with the level's token budget. Fixed items take their top
 * route; repairable items are a 0/1 knapsack between repair and recycle. */
export function bestScore(levelId) {
  const level = levelById(levelId);
  let fixed = 0;
  const repairs = [];
  for (const id of level.items) {
    const entry = ITEMS[id];
    if (entry.hazard) fixed += POINTS.safetyHold;
    else if (entry.condition === 'working') fixed += POINTS.reuseWorking;
    else if (entry.condition === 'end_of_life') fixed += POINTS.recycleEndOfLife;
    else { fixed += POINTS.recycleUsable; repairs.push(entry); }
  }
  const gains = new Array(level.tokens + 1).fill(0);
  for (const entry of repairs) {
    const gain = POINTS.repairBase + entry.lifeBonus - POINTS.recycleUsable;
    for (let budget = level.tokens; budget >= entry.repairCost; budget--)
      gains[budget] = Math.max(gains[budget], gains[budget - entry.repairCost] + gain);
  }
  return fixed + gains[level.tokens];
}

/** 1 star ≥ 60%, 2 stars ≥ 80%, 3 stars ≥ 95% of the best possible score. */
export function starsFor(score, best) {
  if (!(best > 0)) return 0;
  const ratio = score / best;
  return ratio >= 0.95 ? 3 : ratio >= 0.8 ? 2 : ratio >= 0.6 ? 1 : 0;
}

/** Progress lives only in this browser: best stars per level, nothing personal. */
export function readSave(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(SAVE_KEY) || '{}');
    const stars = {};
    for (const level of LEVELS) {
      const value = raw?.stars?.[level.id];
      if (Number.isInteger(value) && value >= 0 && value <= 3) stars[level.id] = value;
    }
    return { stars };
  } catch { return { stars: {} }; }
}

export function writeSave(storage, save) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify({ version: 1, stars: save.stars })); return !!storage; } catch { return false; }
}

export function resetSave(storage) {
  try { storage?.removeItem(SAVE_KEY); } catch { /* Blocked storage already means a fresh start. */ }
  return { stars: {} };
}

/** Keep the best result; a weaker replay never lowers saved stars. */
export function recordStars(save, levelId, stars) {
  const previous = save.stars[levelId];
  save.stars[levelId] = Math.max(previous ?? 0, stars);
  return save.stars[levelId] !== previous;
}

export const isUnlocked = (save, levelId) => Number(levelId) === 1 || (save.stars[Number(levelId) - 1] ?? 0) >= 1;
export const restoredCount = save => LEVELS.filter(level => (save.stars[level.id] ?? 0) >= 1).length;
