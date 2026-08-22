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

/**
 * Whether a file will play, and its duration if the browser can determine
 * one — two different questions this used to conflate into one.
 *
 * The old version rejected a file outright whenever `duration` came back as
 * anything other than a finite positive number, and treated "unknown
 * duration" and "actually broken" as the same failure. That's wrong on two
 * counts:
 *
 *   Many real, playable files — VBR-encoded MP3s especially, which is what
 *   a phone's voice memo app and a lot of web downloads produce — report
 *   `duration: Infinity` until the browser has scanned toward the end of the
 *   file. Nothing is wrong with the file; the browser just hasn't finished
 *   measuring it yet. Rejecting on Infinity meant rejecting ordinary MP3s.
 *
 *   Some formats load and play fine but never resolve a duration at all in
 *   this API. Not knowing the length isn't a reason to refuse the file —
 *   it's a reason to show "—" instead of a number and let the person hear
 *   for themselves whether it's right.
 *
 * `playable` is the only thing that gates whether a save is allowed now, and
 * it's false ONLY on a genuine decode error or a timeout with zero signal at
 * all — not on an odd or missing duration.
 */
/**
 * The actual decision, pulled out as a pure function so it's testable
 * without a real `Audio` element and browser events. probeAudio's job is
 * just wiring browser events to this.
 */
export function resolvePlayability({ duration, errored, sawAnySignal }) {
  if (errored) return { playable: false, duration: 0 };
  if (Number.isFinite(duration) && duration > 0) return { playable: true, duration };
  // No usable duration, but something loaded without erroring — still
  // counts as playable. The length just isn't known, which is common enough
  // for real files that it shouldn't block the save.
  return { playable: sawAnySignal, duration: 0 };
}

export function probeAudio(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    let settled = false;
    let sawAnySignal = false;

    const done = (result) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const finalize = () => {
      const result = resolvePlayability({ duration: a.duration, errored: false, sawAnySignal });
      if (result.playable && result.duration > 0) { done(result); return true; }
      return false;
    };

    a.onloadedmetadata = () => {
      sawAnySignal = true;
      if (finalize()) return;
      if (a.duration === Infinity) {
        // The classic VBR MP3 quirk: seeking far forward forces the browser
        // to scan the file and resolve the real duration, reported via
        // ontimeupdate once the seek lands.
        a.currentTime = 1e7;
        return;
      }
      done(resolvePlayability({ duration: a.duration, errored: false, sawAnySignal }));
    };
    a.ondurationchange = () => { if (!settled) finalize(); };
    a.ontimeupdate = () => {
      a.ontimeupdate = null;
      a.currentTime = 0;
      if (!finalize()) done(resolvePlayability({ duration: a.duration, errored: false, sawAnySignal }));
    };
    a.oncanplaythrough = () => { sawAnySignal = true; };
    a.onerror = () => done(resolvePlayability({ duration: 0, errored: true, sawAnySignal }));
    // Some formats neither load nor error — they just never fire anything.
    // Without a timeout the picker would sit on a spinner forever. If we saw
    // ANY signal before timing out, treat it as playable with an unknown
    // length rather than failing a file that was clearly loading.
    setTimeout(() => done(resolvePlayability({ duration: 0, errored: false, sawAnySignal })), 8000);
  });
}

/** Kept for any caller that only wants a number. Prefer probeAudio()  — this
    can't tell "unknown length" apart from "won't play." */
export async function probeDuration(blob) {
  const { duration } = await probeAudio(blob);
  return duration;
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
