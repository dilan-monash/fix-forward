/** Fix-it Station rules and stories. Pure data and functions, so every rule can be
 * tested without a browser or 3D graphics. Stories are fictional; they teach how
 * to read clues, never how to judge or open a real appliance.
 * The game follows the waste ladder: repair and reuse first, then recycling or
 * compost, and the rubbish bin last. Electrical things and batteries never go in
 * a home bin. */

/** The four workshop stations, keys 1–4. */
export const STATIONS = Object.freeze([
  { id: 'repair', key: '1', kind: 'station', name: 'Repair Café', label: 'Repair Café', short: 'Repair', colour: '#1e8e5a',
    about: 'A Repair Café is a friendly meet-up where volunteers help people fix broken things: toys, clothes, bikes and appliances. Electrical items are fixed by a qualified repairer, never by children.' },
  { id: 'reuse', key: '2', kind: 'station', name: 'Reuse & Share', label: 'Reuse & Share', short: 'Reuse', colour: '#176dc4',
    about: 'Things that still work can go to someone who needs them: a cousin, a neighbour, a school or a charity. An adult checks them first.' },
  { id: 'ewaste', key: '3', kind: 'station', name: 'E-waste drop-off', label: 'E-waste drop-off', short: 'E-waste', colour: '#6a4f9a',
    about: 'When an electrical thing or a battery can’t be fixed, an e-waste drop-off recovers its metal, plastic and glass so they can be used again.' },
  { id: 'adult', key: '4', kind: 'station', name: 'Ask an adult', label: 'Ask an adult', short: 'Ask an adult', colour: '#c9771a',
    about: 'Danger signs like a puffy battery, a burning smell or bare wires mean stop. Do not touch it. Tell an adult straight away.' },
]);
/** The three kerbside bins in the Bin corner, keys 5–7. `lid` is the 3D lid colour;
 * `colour` is a darker shade that keeps white label text readable. */
export const BINS = Object.freeze([
  { id: 'recycle', key: '5', kind: 'bin', name: 'Recycling bin', label: 'Recycle', short: 'Recycling', colour: '#8a6400', lid: '#f2c12e',
    about: 'Clean, empty cans, bottles, jars, paper and cardboard go in the yellow-lid bin, loose, not in a bag. They are sorted and made into new things. Never electrical things or batteries.' },
  { id: 'compost', key: '6', kind: 'bin', name: 'Food & garden bin', label: 'Compost', short: 'Food & garden', colour: '#3f7a1a', lid: '#8cc63f',
    about: 'Food scraps and garden clippings go in the green-lid bin. They become compost that feeds the soil, instead of making a planet-warming gas in landfill.' },
  { id: 'bin', key: '7', kind: 'bin', name: 'Rubbish bin', label: 'Rubbish', short: 'Rubbish', colour: '#a8322b', lid: '#d8392b',
    about: 'Rubbish goes to landfill and is lost for good, so it is the last choice. It is only for things that can’t be repaired, reused, recycled or composted. Never electrical things or batteries.' },
]);
export const TARGETS = Object.freeze([...STATIONS, ...BINS]);
/** The rubbish bin. */
export const BIN = BINS[2];
export const targetById = id => TARGETS.find(target => target.id === id) || null;
export const stationById = targetById;
export const isHomeBin = id => BINS.some(bin => bin.id === id);

/** Discovery cards. Each correct sort unlocks the story's card; putting an electrical
 * thing in a home bin unlocks "Never in home bins", so a mistake still teaches. */
export const CARDS = Object.freeze([
  { id: 'repair-cafe', title: 'What is a Repair Café?', text: 'A friendly meet-up where volunteers help fix broken things, often for free. Electrical repairs need a qualified repairer.' },
  { id: 'reuse', title: 'Pass it on', text: 'A working thing you don’t need can help someone else. Then nobody has to make a new one.' },
  { id: 'materials', title: 'Treasure inside', text: 'Appliances hold metals like copper, steel and aluminium. E-waste recycling recovers them to make new things.' },
  { id: 'batteries', title: 'Puffy battery? Stop!', text: 'A swollen or hot battery can catch fire. Never touch it. Tell an adult straight away.' },
  { id: 'never-bin', title: 'Never in home bins', text: 'Electrical things and batteries never go in home bins, not even recycling. They can start fires in bins and trucks, and their metals are lost.' },
  { id: 'cords', title: 'Bare wires are dangerous', text: 'If a cord is frayed and wires show, don’t touch it. An adult switches it off and gets it checked.' },
  { id: 'care', title: 'Care makes things last', text: 'Small jobs, like cleaning a vacuum filter, help things work well for longer.' },
  { id: 'ask-first', title: 'Find out first', text: 'If nobody knows why something stopped, an adult can ask a repairer to check before you decide.' },
  { id: 'data', title: 'Photos and messages', text: 'Laptops and phones hold private things. An adult clears them before the device goes to a new home.' },
  { id: 'drop-off', title: 'Where does e-waste go?', text: 'Councils and some shops have e-waste drop-off points. An adult checks what they accept first.' },
  { id: 'small-parts', title: 'One small part', text: 'Many repairs just swap one small part, like a switch, a spring or a pump.' },
  { id: 'smell', title: 'A burning smell is a warning', text: 'If something smells like burning, stop using it and tell an adult.' },
  { id: 'recycle', title: 'Round and round', text: 'Recycling turns old cans, bottles and paper into new things. Rinse them and put them in the bin loose, not in a bag.' },
  { id: 'compost', title: 'Food feeds the soil', text: 'Food scraps and garden clippings become compost, which helps new plants grow.' },
  { id: 'rubbish-last', title: 'Rubbish is the last choice', text: 'Landfill keeps things forever. First try repair, reuse, recycling or compost. Rubbish comes last.' },
  { id: 'battery-drop', title: 'Batteries have their own drop-off', text: 'Many shops and councils collect old batteries so their metals can be saved. An adult can help take them.' },
  { id: 'paper-trees', title: 'Paper comes from trees', text: 'Recycling cardboard and paper means fewer trees are cut down to make new boxes.' },
  { id: 'mend', title: 'Mending isn’t just for machines', text: 'Repair Café volunteers sew teddies, patch clothes and fix bikes. Mending keeps things out of landfill.' },
  { id: 'reusable', title: 'Choose things that last', text: 'A reusable cup or bottle can be used again and again. Less rubbish means less landfill.' },
  { id: 'methane', title: 'Food in landfill warms the planet', text: 'Buried food makes methane, a gas that traps heat. Composting food helps fight climate change.' },
]);
export const cardById = id => CARDS.find(card => card.id === id) || null;

// `model` is a 3D model id from models.js (appliances) or waste-models.js (everyday things).
// `part` names a semantic group in that model that glows during the clue.
// `tone` is fault (red), danger (amber) or ok (green) for that glow.
// `misses` give a specific hint for a common wrong choice.
const story = (id, model, name, answer, card, part, tone, clues, why, { electrical = true, misses = {} } = {}) =>
  Object.freeze({ id, model, name, answer, card, part, tone, clues: Object.freeze(clues), why, electrical, misses: Object.freeze(misses) });
const everyday = misses => ({ electrical: false, misses });

export const STORIES = Object.freeze(Object.fromEntries([
  // Round 1: one story for each workshop station.
  story('fan-works', 'fan', 'Breezy the fan', 'reuse', 'reuse', 'blades', 'ok', ['It works perfectly.', 'The family bought a new one.', 'The neighbour needs a fan.'], 'Breezy still works, so the neighbour can use it. Reuse keeps the whole fan in use.'),
  story('kettle-switch', 'kettle', 'Kiki the kettle', 'repair', 'repair-cafe', 'handle', 'fault', ['The switch is loose.', 'Jo the repairer says she can fix it.'], 'Jo can fix the switch at the Repair Café, so Kiki can keep boiling water.'),
  story('toaster-dead', 'toaster', 'Pop the toaster', 'ewaste', 'materials', 'body', 'fault', ['The heating wires burnt out.', 'Jo says it can’t be fixed.'], 'Pop can’t be fixed, so the e-waste drop-off recovers its metal and plastic.'),
  story('laptop-battery', 'laptop', 'Lumi the laptop', 'adult', 'batteries', 'battery', 'danger', ['The battery is puffy.', 'The case is lifting up.'], 'A puffy battery is a danger sign. Don’t touch it. An adult takes care of it.'),
  // Round 2: bin day. Everyday things and the three kerbside bins.
  story('banana-peel', 'banana', 'Nana the banana peel', 'compost', 'compost', 'peel', 'ok', ['It’s left over from a snack.', 'It’s food, so it will rot.'], 'Food scraps go in the food and garden bin. They turn into compost that helps new plants grow.',
    everyday({ bin: 'Food in the rubbish bin rots in landfill and makes a gas that warms the planet. Is there a better bin?', recycle: 'Recycling is for clean packaging, not food.' })),
  story('drink-can', 'can', 'Fizz the drink can', 'recycle', 'recycle', 'body', 'ok', ['It’s empty and rinsed.', 'It’s made of aluminium metal.'], 'Clean cans go in the recycling bin. Aluminium can be made into new cans again and again.',
    everyday({ bin: 'A can isn’t rubbish! Its metal can become a brand-new can.', compost: 'Metal doesn’t rot, so it can’t become compost.' })),
  story('broken-mug', 'mug', 'Chip the mug', 'bin', 'rubbish-last', 'crack', 'fault', ['It’s cracked right through.', 'It can’t hold a drink any more.', 'Mugs aren’t made of recycling glass.'], 'A broken mug can’t be fixed, reused, recycled or composted, so it goes in the rubbish bin. Rubbish is the last choice.',
    everyday({ recycle: 'Mugs look like glass, but broken china spoils the glass that gets recycled.', repair: 'It’s cracked right through, so it can’t be fixed safely.', reuse: 'A cracked mug can leak and cut fingers, so nobody can use it.' })),
  story('teddy-torn', 'teddy', 'Bear-y the teddy', 'repair', 'mend', 'seam', 'fault', ['A seam is torn and stuffing pokes out.', 'A volunteer can sew it up.'], 'Repair Cafés mend toys and clothes too! A few stitches and Bear-y is ready for more hugs.',
    everyday({ bin: 'A torn seam is easy to mend! Who could sew it?' })),
  story('cardboard-box', 'box', 'Boxy the box', 'recycle', 'paper-trees', 'flaps', 'ok', ['It’s clean and dry.', 'It’s made of cardboard.', 'You can squash it flat.'], 'Clean, flat cardboard goes in the recycling bin. It becomes new boxes and paper.',
    everyday({ bin: 'Cardboard isn’t rubbish! It can become new boxes.', compost: 'Clean cardboard can become new boxes. Which bin makes new things?' })),
  story('aa-battery', 'battery', 'Zap the battery', 'ewaste', 'battery-drop', 'body', 'fault', ['It’s flat and doesn’t work.', 'Batteries can spark if they’re squashed.'], 'Old batteries go to a battery or e-waste drop-off. Their metals are saved, and no bin truck catches fire.'),
  // Round 3: clue detectives.
  story('blender-unwanted', 'blender', 'Whizz the blender', 'reuse', 'reuse', 'jug', 'ok', ['It works well.', 'Nobody at home uses it.', 'The school kitchen wants one.'], 'Whizz still works and the school wants it. That’s a perfect reuse.'),
  story('vacuum-filter', 'vacuum', 'Dusty the vacuum', 'repair', 'care', 'filter', 'fault', ['It stopped sucking up dust.', 'The filter is clogged.', 'A new filter will fix it.'], 'A new filter fixes Dusty. Small care jobs make things last longer.'),
  story('foam-cup', 'cup', 'Puff the foam cup', 'bin', 'reusable', 'cup', 'fault', ['It’s a used foam cup.', 'Foam can’t be recycled here.'], 'Foam can’t be recycled here, so the cup goes in the rubbish bin. A reusable cup is a better choice next time!',
    everyday({ recycle: 'Foam looks like plastic, but it can’t be recycled here.', compost: 'Foam never rots, so it can’t become compost.' })),
  story('microwave-old', 'microwave', 'Mo the microwave', 'ewaste', 'drop-off', 'door', 'fault', ['The door is broken.', 'It is very old.', 'Jo says a repair isn’t safe.'], 'Mo can’t be repaired safely, so an adult takes it to an e-waste drop-off.'),
  story('hairdryer-cord', 'hairdryer', 'Swish the hairdryer', 'adult', 'cords', 'handle', 'danger', ['The cord is frayed.', 'You can see the wires.'], 'Bare wires are dangerous. Don’t touch. Tell an adult straight away.'),
  story('coffee-pump', 'coffeemachine', 'Bean the coffee machine', 'repair', 'small-parts', 'tank', 'fault', ['The pump is noisy.', 'A volunteer can swap the pump.'], 'Swapping one small part fixes Bean. The Repair Café can help.'),
  story('ricecooker-unknown', 'ricecooker', 'Sunny the rice cooker', 'adult', 'ask-first', 'control', 'danger', ['It stopped working.', 'Nobody knows why.'], 'We don’t know what went wrong. An adult can ask a repairer to check first.'),
  // Round 4: workshop expert.
  story('mixer-moving', 'mixer', 'Twirl the mixer', 'reuse', 'reuse', 'bowl', 'ok', ['It works well.', 'The family is moving to a tiny flat.', 'A friend loves baking.'], 'Twirl works and a friend will bake with it. Reuse gives it a new home.'),
  story('airfryer-smell', 'airfryer', 'Crispy the air fryer', 'adult', 'smell', 'heater', 'danger', ['It smells like burning plastic.'], 'A burning smell is a warning sign. Stop and tell an adult.'),
  story('apple-core', 'apple', 'Crunch the apple core', 'compost', 'methane', 'core', 'ok', ['Someone ate the apple.', 'Only the core is left.'], 'Apple cores go in the food and garden bin. Compost feeds the soil instead of making gas in landfill.',
    everyday({ bin: 'Food in landfill makes methane, a gas that warms the planet. Which bin turns food into soil?' })),
  story('toaster-lever', 'toaster', 'Bounce the toaster', 'repair', 'small-parts', 'lever', 'fault', ['The lever won’t stay down.', 'A repairer can replace the spring.'], 'A new spring fixes the lever. One small part, one happy toaster.'),
  story('fan-motor', 'fan', 'Whirly the fan', 'ewaste', 'materials', 'motor', 'fault', ['The motor burnt out.', 'Its parts aren’t made any more.'], 'Whirly can’t be fixed, so its metals are recovered at e-waste.'),
  story('laptop-cousin', 'laptop', 'Bit the laptop', 'reuse', 'data', 'screen', 'ok', ['It still works.', 'A cousin needs it for school.', 'An adult will clear the photos first.'], 'Bit works, and an adult clears the data first. Then the cousin can use it.'),
  story('kettle-cracked', 'kettle', 'Drip the kettle', 'ewaste', 'drop-off', 'body', 'fault', ['The body is cracked.', 'Water leaks out.', 'Jo says it can’t be fixed.'], 'A cracked kettle can’t be fixed, so it goes to an e-waste drop-off.'),
].map(item => [item.id, item])));

export const ROUNDS = Object.freeze([
  { id: 1, title: 'Meet the stations', copy: 'One appliance for each workshop station. Learn where things go.', stories: ['fan-works', 'kettle-switch', 'toaster-dead', 'laptop-battery'] },
  { id: 2, title: 'Bin day', copy: 'Recycling, compost or rubbish? Sort everyday things.', stories: ['banana-peel', 'drink-can', 'broken-mug', 'teddy-torn', 'cardboard-box', 'aa-battery'] },
  { id: 3, title: 'Clue detectives', copy: 'Read every clue. Some are tricky!', stories: ['blender-unwanted', 'vacuum-filter', 'foam-cup', 'microwave-old', 'hairdryer-cord', 'coffee-pump', 'ricecooker-unknown'] },
  { id: 4, title: 'Workshop expert', copy: 'Danger signs, repairs, bins and new homes. Can you sort them all?', stories: ['mixer-moving', 'airfryer-smell', 'apple-core', 'toaster-lever', 'fan-motor', 'laptop-cousin', 'kettle-cracked'] },
].map(round => Object.freeze({ ...round, stories: Object.freeze([...round.stories]) })));
export const roundById = id => ROUNDS.find(round => round.id === Number(id)) || null;

/** Hints point back to the clues without giving the answer away. */
const HINTS = {
  repair: 'Does a repairer say it can be fixed?',
  reuse: 'Does it still work? Does someone need it?',
  ewaste: 'Is it electrical? Can it be fixed at all?',
  adult: 'Is there a danger sign, or a missing clue?',
  recycle: 'Is it clean packaging, like a can, bottle, paper or cardboard?',
  compost: 'Is it food, or from the garden?',
  bin: 'Can it be fixed, reused, recycled or composted? If not, what is the last choice?',
};

/** Decide one drop. Wrong drops never end the story; the child tries again. */
export function judge(storyItem, target) {
  const place = targetById(target);
  if (!place) return { ok: false, reason: 'unknown', title: 'Drop it on a station or a bin.', text: 'Choose one of the workshop stations or bins.' };
  if (target === storyItem.answer) return { ok: true, card: storyItem.card, title: celebrate(target), text: storyItem.why };
  if (place.kind === 'bin' && storyItem.electrical) return { ok: false, reason: 'bin', card: 'never-bin', title: `Not the ${place.short.toLowerCase()} bin!`, text: 'Electrical things and batteries never go in home bins. They can start fires in bins and trucks.' };
  return { ok: false, reason: 'wrong', title: 'Hmm, look at the clues again.', text: storyItem.misses[target] || HINTS[storyItem.answer] };
}
function celebrate(target) {
  return { repair: 'Fixed at the Repair Café!', reuse: 'A new home!', ewaste: 'Materials saved!', adult: 'Good safety thinking!', recycle: 'Into the recycling loop!', compost: 'Food for the soil!', bin: 'Good sorting!' }[target];
}

/** A round in progress. First-try answers earn stars; retries still teach. */
export function createRound(roundId) {
  const round = roundById(roundId);
  if (!round) throw new Error(`Unknown round ${roundId}`);
  return { roundId: round.id, index: 0, tried: false, firstTry: 0, solved: [], cards: [], binTried: false, attempts: [] };
}
export const currentStory = state => STORIES[roundById(state.roundId).stories[state.index]] || null;
export const isRoundDone = state => state.index >= roundById(state.roundId).stories.length;

/** Apply a drop. Returns the judgement plus any newly unlocked card and whether it
 * was a first try. Only a correct drop advances the round. */
export function drop(state, target) {
  const item = currentStory(state);
  if (!item) return { ok: false, reason: 'done' };
  const result = judge(item, target);
  state.attempts.push({ story: item.id, target, ok: result.ok });
  let unlocked = null;
  if (result.card && !state.cards.includes(result.card)) { state.cards.push(result.card); unlocked = result.card; }
  if (result.reason === 'bin') state.binTried = true;
  if (!result.ok) { state.tried = true; return { ...result, unlocked, item, firstTry: false }; }
  const firstTry = !state.tried;
  if (firstTry) state.firstTry++;
  state.solved.push(item.id);
  state.index++; state.tried = false;
  return { ...result, unlocked, item, firstTry };
}

/** Finishing always earns at least one star: 3 = every first try, 2 = most. */
export function starsFor(firstTry, total) {
  if (total <= 0) return 0;
  if (firstTry >= total) return 3;
  return firstTry / total >= 0.6 ? 2 : 1;
}

/** Each item tried in a round, in order: the places chosen and whether it was sorted. */
export function roundSummary(state) {
  return roundById(state.roundId).stories.map(id => {
    const tries = state.attempts.filter(attempt => attempt.story === id).map(attempt => attempt.target);
    return tries.length ? { story: id, tries, solved: state.solved.includes(id) } : null;
  }).filter(Boolean);
}

/** The grown-ups' learning record keeps the latest rounds, newest first. It stores
 * what happened (item, places chosen, in order) and never a name or a score of
 * the child. */
export const HISTORY_LIMIT = 30;
export function recordHistory(save, state, { finished = true, at = new Date().toISOString() } = {}) {
  const items = roundSummary(state);
  if (!items.length) return null;
  const entry = { roundId: state.roundId, at, finished, items };
  save.history = [entry, ...(save.history || [])].slice(0, HISTORY_LIMIT);
  return entry;
}
/** Totals and the "talk together" list: the latest try of each item that needed
 * more than one try or wasn't finished. */
export function learningRecord(history = []) {
  const items = history.flatMap(entry => entry.items.map(item => ({ ...item, roundId: entry.roundId, at: entry.at })));
  const solved = items.filter(item => item.solved), seen = new Set(), talk = [];
  for (const item of items) {
    if (seen.has(item.story)) continue;
    seen.add(item.story);
    if (item.tries.length > 1 || !item.solved) talk.push(item);
  }
  return { rounds: history.length, sorted: solved.length, firstTries: solved.filter(item => item.tries.length === 1).length, retried: items.filter(item => item.tries.length > 1).length, talk };
}

/** Progress lives only in this browser: best stars per round, cards found, whether
 * the how-to-play intro has been seen, and the grown-ups' learning record. */
export const SAVE_KEY = 'fixforward-fixit-v1';
function readHistory(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(entry => roundById(entry?.roundId) && typeof entry.at === 'string' && Array.isArray(entry.items)).slice(0, HISTORY_LIMIT).map(entry => ({
    roundId: Number(entry.roundId), at: entry.at.slice(0, 40), finished: entry.finished !== false,
    items: entry.items.filter(item => STORIES[item?.story] && Array.isArray(item.tries)).map(item => ({ story: item.story, tries: item.tries.filter(target => targetById(target)).slice(0, 12), solved: item.solved === true })).filter(item => item.tries.length),
  })).filter(entry => entry.items.length);
}
export function readSave(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(SAVE_KEY) || '{}');
    // Version 1 had three rounds; its rounds 2 and 3 are now rounds 3 and 4.
    const saved = raw?.version === 1 ? { 1: raw.stars?.[1], 3: raw.stars?.[2], 4: raw.stars?.[3] } : raw?.stars;
    const stars = {};
    for (const round of ROUNDS) { const value = saved?.[round.id]; if (Number.isInteger(value) && value >= 1 && value <= 3) stars[round.id] = value; }
    const cards = Array.isArray(raw?.cards) ? [...new Set(raw.cards.filter(id => cardById(id)))] : [];
    return { stars, cards, intro: raw?.intro === true, history: readHistory(raw?.history) };
  } catch { return { stars: {}, cards: [], intro: false, history: [] }; }
}
export function writeSave(storage, save) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify({ version: 2, stars: save.stars, cards: save.cards, intro: Boolean(save.intro), history: save.history || [] })); return !!storage; } catch { return false; }
}
/** Merge a finished round into the save without ever lowering earlier stars. */
export function recordRound(save, state) {
  const total = roundById(state.roundId).stories.length, stars = starsFor(state.firstTry, total);
  const first = !(save.stars[state.roundId] >= 1);
  save.stars[state.roundId] = Math.max(save.stars[state.roundId] ?? 0, stars);
  for (const id of state.cards) if (!save.cards.includes(id)) save.cards.push(id);
  return { stars, first };
}
