/**
 * The only browser save adapter for Quest. It stores one small JSON record on
 * this device; there is no account, server sync or upload here. The engine owns
 * field validation, while this file handles unavailable or damaged storage.
 * Tests can supply a storage-shaped object instead of using browser localStorage.
 */
import { createState, hydrateState, STATE_VERSION } from './engine.js';

// Keep child progress separate from the adult journey and other same-site data.
export const STORAGE_KEY = 'fixforward.quest.v1';
// Refuse unexpectedly large input before parsing a save that should contain only IDs.
const MAX_SAVE_LENGTH = 40000;

/** Return { state, status } without writing; any read failure leaves play available. */
export function loadProgress(storage) {
  let text;
  try {
    // Accessing localStorage itself can throw under a browser privacy/storage policy.
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return { state: createState(), status: 'unavailable' };
    text = target.getItem(STORAGE_KEY);
  } catch {
    return { state: createState(), status: 'unavailable' };
  }
  if (text === null) return { state: createState(), status: 'empty' };
  if (typeof text !== 'string' || text.length > MAX_SAVE_LENGTH) return { state: createState(), status: 'invalid' };
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== STATE_VERSION) return { state: createState(), status: 'invalid' };
    // A supported outer version can still contain bad fields; the engine repairs those.
    return { state: hydrateState(raw), status: 'restored' };
  } catch {
    return { state: createState(), status: 'invalid' };
  }
}

/** Write only the engine's approved fields; return false if saving is blocked or full. */
export function saveProgress(state, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    // Use the same reconstruction on writes so accidental UI fields cannot leak in.
    target.setItem(STORAGE_KEY, JSON.stringify(hydrateState(state)));
    return true;
  } catch {
    return false;
  }
}

/** Remove Quest's single key after the UI confirms reset; leave all other data alone. */
export function clearProgress(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    target.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
