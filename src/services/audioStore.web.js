/**
 * audioStore.web.js — Walk-up songs, stored on the device.
 *
 * ── Why local instead of Cloud Storage ──────────────────────────────────────
 *
 * Cloud Storage needs Blaze. But sitting with the constraint, local storage is
 * the better design regardless:
 *
 *   • Only ONE device matters. The scorekeeper's phone is the one plugged into
 *     the park speaker. Syncing audio to thirty parents' phones so that
 *     twenty-nine of them never play it is pure waste.
 *   • No upload wait. Pick a song, it's ready.
 *   • No network at the park. The most common failure mode for walk-up audio
 *     is a dead zone behind the backstop; a local blob can't miss.
 *   • No storage bill. Fifteen 20-second clips is about 5 MB, which would
 *     otherwise be egress every single game.
 *
 * The tradeoff is honest: songs live on the device that set them. A parent
 * can't pick their kid's song from their own phone yet. When Storage is
 * available, the clip config in Firestore (which IS synced) becomes the
 * pointer and this becomes a cache.
 *
 * Blobs go in IndexedDB. localStorage is a 5 MB string store and would choke
 * on the first song.
 * ────────────────────────────────────────────────────────────────────────────
 */

const DB_NAME = 'fanfare-audio';
const STORE = 'clips';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  }));
}

export const audioSupported = () =>
  typeof indexedDB !== 'undefined' && typeof Audio !== 'undefined';

export const saveClip = (playerId, blob) => tx('readwrite', (s) => s.put(blob, playerId));
export const deleteClip = (playerId) => tx('readwrite', (s) => s.delete(playerId));
export const getClip = (playerId) => tx('readonly', (s) => s.get(playerId));

export async function listClipIds() {
  const keys = await tx('readonly', (s) => s.getAllKeys());
  return keys || [];
}

export async function hasClip(playerId) {
  const blob = await getClip(playerId).catch(() => null);
  return !!blob;
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

let current = null;
let objectUrl = null;

/**
 * Play from `startSeconds` and fade out after `durationSeconds`.
 *
 * Fade rather than cut: a song stopping dead mid-bar sounds like a mistake,
 * and at a ballpark people assume the equipment failed.
 */
export async function playClip(playerId, { startSeconds = 0, durationSeconds = 15, volume = 1 } = {}) {
  stopClip();
  const blob = await getClip(playerId).catch(() => null);
  if (!blob) return false;

  objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  audio.currentTime = startSeconds;
  audio.volume = volume;
  current = audio;

  try {
    // Browsers block audio until the page has had a user gesture. The
    // scorekeeper has tapped a hundred buttons by then, so this only fails on
    // the very first play of a session.
    await audio.play();
  } catch {
    stopClip();
    return false;
  }

  const fadeStart = Math.max(0, durationSeconds - 1.5);
  setTimeout(() => {
    if (current !== audio) return;
    const step = audio.volume / 15;
    const id = setInterval(() => {
      if (current !== audio) { clearInterval(id); return; }
      audio.volume = Math.max(0, audio.volume - step);
      if (audio.volume <= 0.01) { clearInterval(id); stopClip(); }
    }, 100);
  }, fadeStart * 1000);

  return true;
}

export function stopClip() {
  if (current) { current.pause(); current = null; }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
}

export const isPlaying = () => !!current && !current.paused;

/** Duration of a picked file, so the trim UI knows its bounds. */
export function probeDuration(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(v);
    };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => done(0);
    // Some formats neither load nor error — they just never fire. Without a
    // timeout the picker would sit on a spinner forever.
    setTimeout(() => done(0), 8000);
  });
}

/** Total bytes held, so the roster screen can warn before a phone fills up. */
export async function storageUsed() {
  const ids = await listClipIds();
  let bytes = 0;
  for (const id of ids) {
    const b = await getClip(id).catch(() => null);
    if (b) bytes += b.size;
  }
  return bytes;
}
