/**
 * soundboardCatalog.js — What sounds exist, and where they come from.
 *
 * Deliberately split from stadiumSounds.web.js. This file is pure data and
 * pure functions — no AudioContext, no IndexedDB — so it can be tested in
 * plain Node. The synthesis and playback engine (which needs a browser) reads
 * this catalog rather than duplicating the list of what exists.
 *
 * ── Why built-in sounds are synthesized, not sampled ────────────────────────
 *
 * There's no source of licensed stadium sound effects to bundle, and no way
 * to fetch one — this environment can't reach an audio CDN. So the built-in
 * set is generated entirely in the browser with the Web Audio API: oscillators
 * and filtered noise, not recordings. That means it works offline, costs
 * nothing, and never has a licensing question — at the cost of sounding like
 * a synthesized buzzer and whistle rather than a sampled one, which is an
 * honest tradeoff for "works today with no setup."
 *
 * A coach who wants the real thing can add their own recording — CUSTOM_SLOTS
 * exist for exactly that, using the same local-storage pattern walk-up songs
 * already use.
 */

/**
 * Every synthesizable sound. Not every sport uses all of these — a buzzer
 * and a referee's whistle don't mean anything at a baseball game — so each
 * sport pack declares its own subset via SOUNDBOARD_BUILTIN_IDS rather than
 * this list being shown wholesale everywhere.
 */
export const BUILT_IN_SOUNDS = [
  { id: 'buzzer', label: 'Buzzer', synth: 'buzzer', emoji: '🔔' },
  { id: 'airhorn', label: 'Air Horn', synth: 'airhorn', emoji: '📯' },
  { id: 'whistle', label: 'Whistle', synth: 'whistle', emoji: '🔊' },
  { id: 'drumroll', label: 'Drum Roll', synth: 'drumroll', emoji: '🥁' },
  { id: 'cheer', label: 'Crowd Cheer', synth: 'cheer', emoji: '📣' },
  { id: 'applause', label: 'Applause', synth: 'applause', emoji: '👏' },
];

/** Used when a sport hasn't declared its own subset. */
const DEFAULT_BUILTIN_IDS = BUILT_IN_SOUNDS.map((s) => s.id);

/**
 * Built-ins for one sport, in the sport's own preferred order. Falls back to
 * everything if the sport doesn't say — better an unsorted full list than a
 * silently empty board for a sport that forgot to declare one.
 */
export function builtInsFor(sport) {
  const ids = sport?.SOUNDBOARD_BUILTIN_IDS || DEFAULT_BUILTIN_IDS;
  return ids
    .map((id) => BUILT_IN_SOUNDS.find((s) => s.id === id))
    .filter(Boolean);
}

/**
 * Empty slots for a coach's own clips. A fixed, small number — this is a
 * quick soundboard for between plays, not a media library, and unlimited
 * slots would turn the sheet into a scroll.
 */
export const CUSTOM_SLOT_COUNT = 4;

export const customSlotId = (n) => `custom${n}`;

/**
 * The custom slots as catalog-shaped entries, before a coach has renamed any.
 *
 * `suggestions` — from the sport pack's SOUNDBOARD_CUSTOM_SUGGESTIONS — name
 * what's actually worth recording for that sport (baseball: crack of the
 * bat; basketball: a real buzzer), so an empty slot reads as "here's an idea"
 * rather than a bare "Custom 1." A coach's own rename, once they've set one,
 * always wins over the suggestion.
 */
export function customSlotEntries(names = {}, suggestions = []) {
  return Array.from({ length: CUSTOM_SLOT_COUNT }, (_, i) => {
    const id = customSlotId(i + 1);
    const suggested = suggestions[i];
    return {
      id,
      label: names[id] || suggested || `Custom ${i + 1}`,
      suggested: !names[id] && !!suggested,
      synth: null,
      emoji: '🎵',
    };
  });
}

/** Every sound the board can show for one sport, built-ins first. */
export function fullCatalog(customNames = {}, sport = null) {
  return [
    ...builtInsFor(sport),
    ...customSlotEntries(customNames, sport?.SOUNDBOARD_CUSTOM_SUGGESTIONS || []),
  ];
}

export const isBuiltIn = (id) => BUILT_IN_SOUNDS.some((s) => s.id === id);
export const isCustomSlot = (id) => /^custom[1-9]\d*$/.test(id)
  && Number(id.slice(6)) <= CUSTOM_SLOT_COUNT;

/**
 * The IndexedDB key a custom clip is stored under.
 *
 * Namespaced so a stadium-sound slot id can never collide with a walk-up
 * song's key, which is a raw Firestore player id sharing the same object
 * store. Player ids are long random strings; `custom1` colliding with one is
 * effectively impossible, but the prefix makes the two keyspaces
 * unambiguous regardless of how unlikely that collision is.
 */
export const soundStorageKey = (slotId) => `__sound__${slotId}`;
