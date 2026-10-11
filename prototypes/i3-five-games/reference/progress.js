/** Device-only learning pocket. It stores learning cards and unique reward IDs,
 * never photos, appliance identifiers, adult search details, names or locations. */
export const STORAGE_KEY = 'fixforward-world-preview-v1';

/** Start fresh if storage is blocked or malformed. Optional progress must never block play. */
export function readProgress(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    const awards = Object.fromEntries(Object.entries(raw.awards || {}).filter(([key, value]) =>
      /^[\w:-]{1,100}$/.test(key) && Number.isInteger(value) && value > 0 && value <= 100).slice(0, 80));
    const lessons = Array.isArray(raw.lessons) ? raw.lessons.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string').slice(0, 30) : [];
    return { awards, lessons, sound: raw.sound === true, familyStep: raw.familyStep === true };
  } catch { return { awards: {}, lessons: [], sound: false, familyStep: false }; }
}

/** Reward identities make replays safe: solving the same card again cannot farm points. */
export function addAward(progress, id, amount) {
  if (!/^[\w:-]{1,100}$/.test(id) || !Number.isInteger(amount) || amount < 1 || amount > 100 || Object.hasOwn(progress.awards, id)) return false;
  progress.awards[id] = amount;
  return true;
}

/** Lessons are a record of concepts encountered, not a claim that a child has mastered them. */
export function addLesson(progress, lesson) {
  if (!lesson || typeof lesson.id !== 'string' || typeof lesson.title !== 'string') return false;
  if (progress.lessons.some(item => item.id === lesson.id)) return false;
  progress.lessons.push(Object.fromEntries(['id', 'title', 'detail', 'appliance', 'pathway'].map(key => [key, String(lesson[key] || '').slice(0, 350)])));
  return true;
}

/** Persist only this preview's small state, leaving the approved Quest save completely separate. */
export function saveProgress(storage, progress) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(progress)); return !!storage; } catch { return false; }
}

/** Derive points from awards instead of trusting a separately editable total. */
export function totalSparks(progress) { return Object.values(progress.awards).reduce((sum, value) => sum + value, 0); }
