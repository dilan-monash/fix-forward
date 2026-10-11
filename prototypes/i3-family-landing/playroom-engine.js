// Two different kinds of play share one learning record. Materials are digital
// models and room changes are pretend; adults manage care of real appliances.
export const PLAYROOM_KEY = 'fixforward.playroom.v1';
export const PLAYROOM_VERSION = 1;
export const MAX_GAME_SESSIONS = 20;
export const MAX_GAME_ATTEMPTS = 500;

// Keep the original content embedded: old rounds must replay against the words
// and answers that were actually shown, even when a newer game is published.
const ORIGINAL_GAMES = [
  {
    id: 'materials', title: 'Materials Rescue', subtitle: 'Sort it. Build a second life.', age: '7–12', time: '4–6 min',
    learning: 'Electronics contain several materials. Specialist recycling can recover some of them for possible new uses.',
    talkPrompt: 'Why do we send a whole old device to a suitable collection service instead of opening it ourselves?',
    levels: [
      {
        id: 'recover', title: 'Catch the useful materials', topic: 'Materials inside electronics',
        instruction: 'Sort the six digital materials into their matching groups.',
        story: 'Welcome to our pretend recycling lab. Specialists have already separated these illustrated materials. Real electronics stay closed.',
        help: 'Copper, aluminium, steel and gold are metals. Screen glass belongs with glass; the plastic shell belongs with plastic.',
        targets: [{ id: 'metals', label: 'Metals', kind: 'metal' }, { id: 'glass', label: 'Glass', kind: 'glass' }, { id: 'plastics', label: 'Plastics', kind: 'plastic' }],
        pieces: [
          { id: 'copper-wire', label: 'Copper wire', kind: 'copper', answer: 'metals', correct: 'Copper is a metal. Specialists can recover useful metals from some discarded electronics.', wrong: 'This wire represents copper, a metal. Send it to the metal group.' },
          { id: 'aluminium-frame', label: 'Aluminium frame', kind: 'aluminium', answer: 'metals', correct: 'Aluminium is a light metal. Suitable recycling can help it become useful again.', wrong: 'Aluminium belongs with metals, even when it feels light. Try the metal group.' },
          { id: 'steel-screw', label: 'Steel screw', kind: 'steel', answer: 'metals', correct: 'Steel is a metal used in many screws. These are digital pieces, not a disassembly activity.', wrong: 'This screw represents steel, which is a metal. Match it with the metal group.' },
          { id: 'screen-glass', label: 'Screen glass', kind: 'glass', answer: 'glass', correct: 'This model represents glass. Real electronic screens need specialist handling, not a glass bottle bin.', wrong: 'Our screen piece represents glass. Match it with glass in this digital lab.' },
          { id: 'plastic-shell', label: 'Plastic shell', kind: 'plastic', answer: 'plastics', correct: 'This shell represents plastic. Mixed electronic plastics need suitable specialist recycling, not an ordinary household bin.', wrong: 'This illustrated shell is plastic. Find its matching material group.' },
          { id: 'circuit-gold', label: 'Tiny gold contact', kind: 'gold', answer: 'metals', correct: 'Some electronics contain tiny amounts of gold. Specialists may recover valuable metals through suitable recycling.', wrong: 'Gold is a metal, even in tiny amounts. Send this pretend contact to the metal group.' }
        ]
      },
      {
        id: 'build', title: 'Build a possible second life', topic: 'Using recovered materials',
        instruction: 'Match each recovered material to the object it could help make.',
        story: 'Our lab recovered three useful materials. Match them to possible new uses. What can be made depends on specialist processing.',
        help: 'Copper can carry electricity in a cable. Aluminium can make a light bicycle frame. Suitable recycled plastic can make a bench.',
        targets: [{ id: 'cable', label: 'Cable inside', kind: 'cable' }, { id: 'bicycle', label: 'Bicycle frame', kind: 'bike' }, { id: 'bench', label: 'Outdoor bench', kind: 'bench' }],
        pieces: [
          { id: 'copper', label: 'Recovered copper', kind: 'copper', answer: 'cable', correct: 'Copper carries electricity, so suitable recovered copper can help make the inside of a cable.', wrong: 'Copper can carry electricity. Try matching it to the inside of the cable.' },
          { id: 'aluminium', label: 'Recovered aluminium', kind: 'aluminium', answer: 'bicycle', correct: 'Aluminium is light and useful for bicycle frames. Recovered material needs suitable processing first.', wrong: 'Aluminium is a light metal. Match it with our possible new bicycle frame.' },
          { id: 'plastic', label: 'Recovered plastic', kind: 'plastic', answer: 'bench', correct: 'Suitable recycled plastic can become a bench. Not every electronic plastic can be recovered this way.', wrong: 'Our recycled plastic could help make an outdoor bench. Specialist processing decides which uses are suitable.' }
        ]
      }
    ]
  },
  {
    id: 'care', title: 'Care Crew', subtitle: 'Make a room that helps things last.', age: '7–12', time: '5–7 min',
    learning: 'Dry spaces, clear airflow and planned care can help useful items last. Adults follow the maker’s instructions and handle faults.',
    talkPrompt: 'Which small change could help an appliance in our home, and what would we ask an adult to do?',
    levels: [
      {
        id: 'desk', room: 'desk', title: 'The busy study desk', topic: 'A better space for electronics',
        instruction: 'Give each desk item a better place or plan.',
        story: 'A drink sits near the laptop. Books crowd its air space. Move the pretend items and set a care reminder.',
        help: 'Keep drinks on a separate tray away from electronics. Put books on the shelf. Give the care reminder to an adult.',
        targets: [{ id: 'away-tray', label: 'Away from electronics', kind: 'tray' }, { id: 'bookshelf', label: 'Book shelf', kind: 'shelf' }, { id: 'adult-plan', label: 'Adult care plan', kind: 'calendar' }],
        pieces: [
          { id: 'drink', label: 'Open drink', kind: 'cup', answer: 'away-tray', correct: 'Keeping drinks away helps prevent spills near electronics. These room changes are pretend.', wrong: 'A drink needs a separate place away from electronics. Find the tray away from the laptop.' },
          { id: 'books', label: 'Books blocking air space', kind: 'books', answer: 'bookshelf', correct: 'A clear space helps airflow. Follow the maker’s guidance for where the real device belongs.', wrong: 'Books belong on the shelf. Keep the device’s air space clear, following its maker’s instructions.' },
          { id: 'care-calendar', label: 'Care reminder', kind: 'calendar', answer: 'adult-plan', correct: 'A reminder helps an adult plan suitable care using the instructions for this exact device.', wrong: 'This is a reminder to plan care. Give it to the adult care plan.' }
        ]
      },
      {
        id: 'kitchen', room: 'kitchen', title: 'The kitchen care team', topic: 'Water, crumbs and warning signs',
        instruction: 'Plan a dry place, safe care and help for a warning.',
        story: 'Our pretend toaster is near a sink. Its care reminder is due, and a separate cord-warning card needs adult attention.',
        help: 'Plan a dry place away from water. An adult follows the maker’s unplugging and cleaning instructions. Leave damaged items alone and tell an adult.',
        targets: [{ id: 'dry-counter', label: 'Dry place away from water', kind: 'counter' }, { id: 'adult-care', label: 'Adult follows instructions', kind: 'care' }, { id: 'stop-adult', label: 'Stop and tell an adult', kind: 'adult' }],
        pieces: [
          { id: 'toaster', label: 'Pretend toaster', kind: 'toaster', answer: 'dry-counter', correct: 'Plan a dry location away from water. An adult handles real appliances and follows the maker’s placement instructions.', wrong: 'Water and electrical appliances need separation. Choose the planned dry place; let an adult manage the real item.' },
          { id: 'crumbs-note', label: 'Crumb-cleaning reminder', kind: 'note', answer: 'adult-care', correct: 'An adult follows the maker’s unplugging and cleaning instructions. Children can help plan, not reach inside appliances.', wrong: 'Give this care reminder to an adult. They follow the maker’s instructions before cleaning the real toaster.' },
          { id: 'cord-warning', label: 'Damaged cord warning card', kind: 'warning', answer: 'stop-adult', correct: 'Leave the damaged item alone and tell an adult. Do not test, clean or try to repair it.', wrong: 'A damaged cord is a stop sign. Leave the real item alone and tell an adult.' }
        ]
      },
      {
        id: 'family', room: 'family', title: 'The family room refresh', topic: 'Care before replacement',
        instruction: 'Keep useful items working with the right next plan.',
        story: 'The vacuum works. A checked speaker is wanted by a neighbour. Match the care and reuse plans, then find the instructions.',
        help: 'Working items can stay useful. Adults manage maintenance and check a wanted reuse handover. The maker’s guide explains suitable care.',
        targets: [{ id: 'adult-maintenance', label: 'Adult maintenance plan', kind: 'care' }, { id: 'reuse-plan', label: 'Wanted second home', kind: 'reuse' }, { id: 'maker-guide', label: 'Follow the maker’s guide', kind: 'book' }],
        pieces: [
          { id: 'vacuum', label: 'Working vacuum', kind: 'vacuum', answer: 'adult-maintenance', correct: 'A working vacuum can stay useful. An adult follows the maker’s maintenance instructions instead of replacing it just for age.', wrong: 'This vacuum still works. Choose an adult maintenance plan using its maker’s instructions.' },
          { id: 'speaker', label: 'Checked, wanted speaker', kind: 'speaker', answer: 'reuse-plan', correct: 'The checked speaker has a willing new owner. An adult manages the handover and any personal data.', wrong: 'Someone wants this checked speaker. An adult can arrange a suitable second home.' },
          { id: 'care-guide', label: 'Maker’s care instructions', kind: 'book', answer: 'maker-guide', correct: 'Use instructions for the exact appliance. Adults handle electrical care; children can help plan and remember.', wrong: 'The maker’s guide explains care for this appliance. Match these instructions to that guide.' }
        ]
      }
    ]
  }
];

const MATERIALS_V1 = { ...ORIGINAL_GAMES[0], contentVersion: 1 };
const CARE_V1 = { ...ORIGINAL_GAMES[1], contentVersion: 1 };
const MATERIALS_V2 = {
  ...MATERIALS_V1, contentVersion: 2,
  subtitle: 'Spot clues. Make possibilities. Choose a useful next stop.',
  learning: 'Electronics contain several materials. Specialist recycling can recover some. Whole unrepairable electronics and loose batteries need suitable collection routes checked by an adult.',
  talkPrompt: 'Why do a whole old phone and a loose battery need different collection checks?',
  childLearning: 'We sorted materials, found new uses and chose special collection.',
  childTalkPrompt: 'Where do this broken phone and the loose battery go?',
  levels: [
    {
      id: 'recover', title: 'Spot the material clues', topic: 'Materials inside electronics',
      instruction: 'Look closely. Match each pretend piece to a material group.',
      story: 'We are inside a recycling factory. These are pretend pieces. Keep real devices closed.',
      help: 'The orange wire and silver frame are metals. The clear sheet and lens are glass. The cover and button are plastics.',
      targets: [{ id: 'metals', label: 'Metals', kind: 'metal' }, { id: 'glass', label: 'Glass', kind: 'glass' }, { id: 'plastics', label: 'Plastics', kind: 'plastic' }],
      pieces: [
        { id: 'copper-wire', label: 'Curled orange wire', revealedLabel: 'Copper wire', kind: 'copper', answer: 'metals', correct: 'Copper is a metal. You found its group!', wrong: 'Look at the shiny wire. Try the metal group.', parentExplanation: 'This illustrated wire represents copper, a useful metal found in electronics. Specialists may recover it; children do not open real devices.' },
        { id: 'aluminium-frame', label: 'Light silver frame', revealedLabel: 'Aluminium frame', kind: 'aluminium', answer: 'metals', correct: 'Aluminium is a light metal. Another useful discovery!', wrong: 'This light silver frame is metal. Try that group.', parentExplanation: 'Our frame represents aluminium. A metal can be light in weight. Suitable specialist recycling can recover some metals from discarded electronics.' },
        { id: 'screen-glass', label: 'Clear flat sheet', revealedLabel: 'Screen glass', kind: 'glass', answer: 'glass', correct: 'This screen piece is glass. Look through it!', wrong: 'This clear screen piece belongs with glass.', parentExplanation: 'The digital screen piece represents glass. Real electronic screens can contain several materials and need a suitable specialist service, not a glass bottle bin.' },
        { id: 'camera-lens', label: 'Clear curved lens', revealedLabel: 'Glass lens', kind: 'lens', answer: 'glass', correct: 'Our clear curved lens is glass too!', wrong: 'Our lens is glass. Find the clear-material group.', parentExplanation: 'This particular illustrated lens represents glass. Lenses can be made from different materials; the game does not claim every real lens is glass.' },
        { id: 'plastic-shell', label: 'Bumpy outer cover', revealedLabel: 'Plastic shell', kind: 'plastic', answer: 'plastics', correct: 'The outer shell is plastic. You spotted it!', wrong: 'This bumpy cover belongs with plastics.', parentExplanation: 'This illustrated casing represents plastic. Electronic plastics may contain additives and mixed types, so not every plastic can be recovered for the same uses.' },
        { id: 'plastic-button', label: 'Colourful button', revealedLabel: 'Plastic button', kind: 'button', answer: 'plastics', correct: 'You found another plastic piece!', wrong: 'Our colourful button is plastic. Try its matching group.', parentExplanation: 'This digital button is made of plastic in the model. The illustration gives a story clue; appearance alone does not reliably identify every real material.' }
      ]
    },
    {
      id: 'build', title: 'Build a possible second life', topic: 'Using recovered materials',
      instruction: 'Match each material to something it can help make.',
      story: 'Help make a cable, a bicycle frame and a park bench.',
      help: 'Copper goes inside the cable. Aluminium makes a light bicycle frame. Our plastic helps make the bench.',
      targets: [{ id: 'cable', label: 'Cable inside', kind: 'cable' }, { id: 'bicycle', label: 'Light bicycle frame', kind: 'bike' }, { id: 'bench', label: 'Park bench', kind: 'bench' }],
      pieces: [
        { id: 'copper', label: 'Recovered copper', revealedLabel: 'Recovered copper', kind: 'copper', answer: 'cable', correct: 'Copper carries electricity. Your cable has a useful inside!', wrong: 'For this blueprint, match copper to the cable.', parentExplanation: 'Suitable recovered copper can be processed for electrical conductors. These blueprints show possible uses, not a guarantee that a particular discarded device becomes a particular product.' },
        { id: 'aluminium', label: 'Recovered aluminium', revealedLabel: 'Recovered aluminium', kind: 'aluminium', answer: 'bicycle', correct: 'Aluminium makes a light frame. Your bicycle takes shape!', wrong: 'For this blueprint, match aluminium to the bicycle frame.', parentExplanation: 'Aluminium is used in some bicycle frames. Recovery, alloy suitability and specialist processing determine possible reuse. Aluminium has many other uses too.' },
        { id: 'plastic', label: 'Recovered plastic', revealedLabel: 'Recovered plastic', kind: 'plastic', answer: 'bench', correct: 'This plastic helps make a new place to sit!', wrong: 'For this blueprint, match plastic to the outdoor bench.', parentExplanation: 'Suitable recycled plastics can be processed into products such as benches. Not all electronic plastics can be recovered or used this way.' }
      ]
    },
    {
      id: 'battery-stop', title: 'A battery needs its own stop', topic: 'Battery collection',
      instruction: 'Move the battery picture to the right next stop.',
      story: 'This picture shows a loose, undamaged battery. Move only the picture. An adult checks the real battery’s collection rules.',
      help: 'A battery needs a service that accepts its type. Ask an adult to check battery collection; do not put it in rubbish or our materials factory.',
      targets: [{ id: 'battery-dropoff', label: 'Adult + battery drop-off', kind: 'battery' }, { id: 'factory', label: 'Material factory', kind: 'factory' }, { id: 'rubbish', label: 'Household rubbish', kind: 'rubbish' }],
      pieces: [{ id: 'battery-picture', label: 'Loose battery picture', revealedLabel: 'Loose, undamaged battery picture', kind: 'battery', answer: 'battery-dropoff', correct: 'Batteries can start fires in bins. Ask an adult about collection.', wrong: 'Batteries need their own collection, away from bins and crates.', parentExplanation: 'This picture shows a loose, undamaged battery. Batteries can cause fires in collection trucks and facilities when damaged or mishandled. An adult checks a service accepts its type and follows preparation and handling rules. Damaged, swollen or leaking batteries need specialist advice; they must not be treated as ordinary battery drop-offs. Children do not handle real batteries.' }]
    },
    {
      id: 'phone-choice', title: 'Choose the phone’s next stop', topic: 'Whole-device collection',
      instruction: 'Keep the phone whole. Choose its next stop.',
      story: 'A repairer cannot fix this phone. An adult cleared its data. Its battery stays inside.',
      help: 'Keep the unrepairable phone whole, with its battery inside. An adult checks a suitable e-waste service accepts it. Household rubbish is not its route.',
      targets: [{ id: 'ewaste-dropoff', label: 'E-waste collection', kind: 'ewaste' }, { id: 'rubbish', label: 'Household rubbish', kind: 'rubbish' }],
      pieces: [{ id: 'old-phone', label: 'Old phone', revealedLabel: 'Whole, unrepairable phone', kind: 'phone', answer: 'ewaste-dropoff', correct: 'This phone needs e-waste drop-off. Go with a grown-up.', wrong: 'In rubbish, useful materials are lost. Try e-waste drop-off.', parentExplanation: 'In this story, a qualified repairer has assessed the phone as unrepairable and an adult has already handled its data. Keep the whole phone and its built-in battery together. An adult checks an appropriate collection service accepts it and follows any damaged-device instructions. This is not advice to switch on a damaged phone.' }]
    }
  ]
};

export const GAMES = [MATERIALS_V2, CARE_V1];
export const gameById = id => GAMES.find(game => game.id === id) ?? null;
const versionedGame = (id, version) => id === 'materials' ? (version === 1 ? MATERIALS_V1 : version === 2 ? MATERIALS_V2 : null) : id === 'care' && version === 1 ? CARE_V1 : null;
export const gameForState = state => versionedGame(state?.gameId, state?.contentVersion ?? 1);
export const currentLevel = state => gameForState(state)?.levels[state?.levelIndex] ?? null;
const copy = value => JSON.parse(JSON.stringify(value));
const timestamp = value => { const date = new Date(value ?? Date.now()); return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString(); };
export function createGame(gameId = 'materials', { id, now, contentVersion } = {}) {
  const definition = versionedGame(gameId, contentVersion ?? gameById(gameId)?.contentVersion);
  if (!definition) return null;
  const at = timestamp(now);
  return { id: typeof id === 'string' && id.trim() ? id.slice(0, 80) : globalThis.crypto?.randomUUID?.() ?? `play-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, gameId, contentVersion: definition.contentVersion, levelIndex: 0, points: 0, status: 'playing', attempts: [], hints: [], completed: {}, startedAt: at, updatedAt: at };
}

// A missed drop never calls this function. Valid but different choices are
// recorded with the same brief explanation shown to the child and parent.
export function attemptMove(state, pieceId, targetId, { now } = {}) {
  const game = gameForState(state), level = currentLevel(state);
  const ignore = text => ({ state, accepted: false, correct: false, points: 0, text, levelComplete: false });
  if (!level || state.status !== 'playing') return ignore('This part is done. Continue when you are ready.');
  const piece = level.pieces.find(item => item.id === pieceId), target = level.targets.find(item => item.id === targetId);
  if (!piece || !target || state.completed[pieceId]) return ignore('Choose an unfinished item and one of its places.');
  if (state.attempts.length >= MAX_GAME_ATTEMPTS) return ignore('This adventure’s move history is full. Start a fresh game to keep exploring.');
  const next = copy(state), correct = piece.answer === targetId;
  const prior = state.attempts.filter(attempt => attempt.levelId === level.id && attempt.pieceId === pieceId).length;
  const hintUsed = state.hints.some(hint => hint.levelId === level.id);
  const points = correct ? 10 + (!prior && !hintUsed ? 5 : 0) : 0;
  const expected = level.targets.find(item => item.id === piece.answer), at = timestamp(now);
  const text = correct ? piece.correct : piece.wrong;
  next.attempts.push({ gameId: game.id, gameTitle: game.title, contentVersion: game.contentVersion, levelId: level.id, levelTitle: level.title, topic: level.topic, instruction: level.instruction, pieceId, pieceLabel: piece.label, itemRevealedName: piece.revealedLabel ?? piece.label, parentExplanation: piece.parentExplanation ?? text, targetId, targetLabel: target.label, expectedTargetId: expected.id, expectedTargetLabel: expected.label, correct, firstTry: prior === 0, hintUsed, attemptNumber: prior + 1, points, text, at });
  if (correct) next.completed[pieceId] = true;
  next.points += points;
  next.updatedAt = at;
  const levelComplete = level.pieces.every(item => next.completed[item.id]);
  if (levelComplete) next.status = 'level-complete';
  return { state: next, accepted: true, correct, points, text, levelComplete };
}

export function hintGame(state, { now } = {}) {
  const level = currentLevel(state), game = gameForState(state);
  if (!level || state.status !== 'playing' || state.hints.some(hint => hint.levelId === level.id)) return state;
  const next = copy(state), at = timestamp(now);
  next.hints.push({ gameId: game.id, gameTitle: game.title, contentVersion: game.contentVersion, levelId: level.id, levelTitle: level.title, topic: level.topic, text: level.help, beforeAttempt: state.attempts.length, at });
  next.updatedAt = at;
  return next;
}

export function advanceGame(state, { now } = {}) {
  if (state?.status !== 'level-complete') return state;
  const next = copy(state);
  next.updatedAt = timestamp(now);
  if (state.levelIndex === gameForState(state).levels.length - 1) next.status = 'complete';
  else { next.levelIndex += 1; next.completed = {}; next.status = 'playing'; }
  return next;
}

export const completedGameLevels = state => (gameForState(state)?.levels ?? []).filter(level => level.pieces.every(piece => state.attempts.some(attempt => attempt.levelId === level.id && attempt.pieceId === piece.id && attempt.correct))).map(level => level.id);

// Rebuild scores and progress from legal moves instead of trusting editable
// browser values. Incompatible or damaged records are skipped safely.
export function validateGame(candidate) {
  if (!candidate || typeof candidate.id !== 'string' || !candidate.id.trim() || candidate.id.length > 80 || !gameForState(candidate) || !Array.isArray(candidate.attempts) || !Array.isArray(candidate.hints) || candidate.attempts.length > MAX_GAME_ATTEMPTS || candidate.hints.length > gameForState(candidate).levels.length || !Number.isFinite(Date.parse(candidate.startedAt)) || !Number.isFinite(Date.parse(candidate.updatedAt))) return null;
  let state = createGame(candidate.gameId, { id: candidate.id, now: candidate.startedAt, contentVersion: candidate.contentVersion ?? 1 });
  const reach = record => {
    if (!record || record.gameId !== state.gameId || !Number.isFinite(Date.parse(record.at))) return false;
    if (currentLevel(state).id !== record.levelId && state.status === 'level-complete') state = advanceGame(state, { now: record.at });
    return currentLevel(state)?.id === record.levelId && state.status === 'playing';
  };
  if (candidate.hints.some(hint => !hint || !Number.isInteger(hint.beforeAttempt) || hint.beforeAttempt < 0 || hint.beforeAttempt > candidate.attempts.length)) return null;
  for (let index = 0; index <= candidate.attempts.length; index += 1) {
    for (const hint of candidate.hints.filter(item => item.beforeAttempt === index)) {
      if (!reach(hint)) return null;
      const next = hintGame(state, { now: hint.at });
      if (next === state) return null;
      state = next;
    }
    if (index === candidate.attempts.length) break;
    const attempt = candidate.attempts[index];
    if (!reach(attempt)) return null;
    const result = attemptMove(state, attempt.pieceId, attempt.targetId, { now: attempt.at });
    if (!result.accepted) return null;
    state = result.state;
  }
  if (state.status === 'level-complete' && (candidate.levelIndex !== state.levelIndex || candidate.status === 'complete')) state = advanceGame(state, { now: candidate.updatedAt });
  if (state.levelIndex !== candidate.levelIndex || state.status !== candidate.status) return null;
  state.updatedAt = timestamp(candidate.updatedAt);
  return state;
}

function bounded(records) {
  if (!Array.isArray(records)) return [];
  const kept = [], ids = new Set();
  let attempts = 0;
  for (const record of records.slice(-MAX_GAME_SESSIONS).reverse()) {
    const state = validateGame(record);
    if (!state || ids.has(state.id) || attempts + state.attempts.length > MAX_GAME_ATTEMPTS) continue;
    ids.add(state.id); attempts += state.attempts.length; kept.unshift(state);
  }
  return kept;
}
export function loadGames(storage) {
  try { const raw = storage?.getItem(PLAYROOM_KEY); if (!raw || raw.length > 2_000_000) return []; const data = JSON.parse(raw); return data?.version === PLAYROOM_VERSION ? bounded(data.sessions) : []; } catch { return []; }
}
export function saveGames(storage, sessions) {
  try { if (!storage?.setItem) return false; storage.setItem(PLAYROOM_KEY, JSON.stringify({ version: PLAYROOM_VERSION, sessions: bounded(sessions) })); return true; } catch { return false; }
}

export function summarizeGames(sessions = []) {
  const records = bounded(sessions);
  const versionDetails = state => {
    const earlierRound = state.contentVersion < gameById(state.gameId).contentVersion;
    return { contentVersion: state.contentVersion, earlierRound, versionLabel: `${earlierRound ? 'Earlier round · ' : ''}Version ${state.contentVersion}` };
  };
  const exactAttempts = records.flatMap(session => session.attempts.map(attempt => ({ ...attempt, ...versionDetails(session), sessionId: session.id, sessionStartedAt: session.startedAt })));
  const exactHints = records.flatMap(session => session.hints.map(hint => ({ ...hint, ...versionDetails(session), sessionId: session.id, sessionStartedAt: session.startedAt })));
  const definitions = [...new Map(records.map(state => [`${state.gameId}:${state.contentVersion}`, gameForState(state)])).values()];
  const topics = definitions.flatMap(game => game.levels.map(level => {
    const matches = item => item.gameId === game.id && item.contentVersion === game.contentVersion && item.levelId === level.id;
    const attempts = exactAttempts.filter(matches), hints = exactHints.filter(matches);
    return { gameId: game.id, gameTitle: game.title, ...versionDetails({ gameId: game.id, contentVersion: game.contentVersion }), levelId: level.id, levelTitle: level.title, topic: level.topic, attemptCount: attempts.length, wrongCount: attempts.filter(item => !item.correct).length, hintCount: hints.length, correctCount: attempts.filter(item => item.correct).length, learning: game.learning, talkPrompt: game.talkPrompt, needsPractice: attempts.some(item => !item.correct) || hints.length > 0 };
  })).filter(topic => topic.attemptCount || topic.hintCount);
  return { sessionCount: records.length, completedSessions: records.filter(state => state.status === 'complete').length, totalPoints: records.reduce((sum, state) => sum + state.points, 0), attemptCount: exactAttempts.length, correctCount: exactAttempts.filter(item => item.correct).length, wrongCount: exactAttempts.filter(item => !item.correct).length, firstTryUnaidedCount: exactAttempts.filter(item => item.correct && item.firstTry && !item.hintUsed).length, retryCount: exactAttempts.filter(item => item.attemptNumber > 1).length, hintCount: exactHints.length, exactAttempts, exactHints, topics, needsPractice: topics.filter(topic => topic.needsPractice), sessions: records.map(state => ({ id: state.id, gameId: state.gameId, gameTitle: gameForState(state).title, ...versionDetails(state), startedAt: state.startedAt, status: state.status, points: state.points, attemptCount: state.attempts.length, hintCount: state.hints.length, completedLevels: completedGameLevels(state) })) };
}
