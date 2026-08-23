/**
 * signups.js — Who's bringing the snacks.
 *
 * ── Why this is not a poll ─────────────────────────────────────────────────
 *
 * A snack rota looks like a poll and behaves nothing like one. A poll asks
 * everyone the same question and counts the answers. A rota has SLOTS, each
 * one claimed by exactly one family, and it has to still be findable in week
 * six — which a message in a chat thread is not.
 *
 * So a sign-up lives on the thing it's actually about: the game. Every slot is
 * a document under that event, claimed by whoever takes it, and the schedule
 * row can say "Snacks: unclaimed" without reading a chat log.
 *
 * ── One slot, one document ─────────────────────────────────────────────────
 *
 * Same reason as poll votes: two parents claiming the last slot at the same
 * moment must not silently overwrite each other, and "you may release only
 * your own claim" has to be a rule, not a UI convention.
 */

export const SIGNUP_PRESETS = [
  ['Snacks', 1],
  ['Drinks', 1],
  ['Team parent', 1],
  ['Field setup', 2],
  ['Scorekeeper', 1],
];

export const MAX_SLOTS = 12;

/**
 * Slot ids are `snacks-1`, `snacks-2` — derived from the label so the same
 * sign-up created twice on one event is the same slots rather than a second
 * set, and readable in the console. See shared/docIds.js for the convention.
 */
export function buildSlots({ label, count = 1 }, slugFn) {
  const name = (label || '').trim();
  if (!name) throw new Error('Name what people are signing up for.');

  const n = Math.max(1, Math.min(MAX_SLOTS, Math.floor(count) || 1));
  const base = slugFn(name);
  if (!base) throw new Error('Give it a name with some letters in it.');

  return Array.from({ length: n }, (_, i) => ({
    id: `${base}-${i + 1}`,
    label: name,
    // Only shown when there's more than one: "Snacks 1 of 1" is noise.
    position: n > 1 ? i + 1 : null,
    of: n > 1 ? n : null,
  }));
}

export const SLOT_STATE = { OPEN: 'open', MINE: 'mine', TAKEN: 'taken' };

export function slotState(slot, uid) {
  if (!slot?.claimedBy) return SLOT_STATE.OPEN;
  return slot.claimedBy === uid ? SLOT_STATE.MINE : SLOT_STATE.TAKEN;
}

/**
 * Your own claim, always. A coach can also clear anyone's — someone drops out
 * the morning of and tells the coach, not the app.
 */
export const canRelease = (slot, uid, isStaff = false) =>
  !!slot?.claimedBy && (slot.claimedBy === uid || !!isStaff);

/** "2 of 3 filled" · "All filled" · "Nobody yet". */
export function signupSummary(slots) {
  const all = slots || [];
  if (!all.length) return null;
  const filled = all.filter((s) => s.claimedBy).length;
  if (filled === 0) return `${all.length === 1 ? 'Unclaimed' : 'Nobody yet'}`;
  if (filled === all.length) return all.length === 1 ? 'Claimed' : 'All filled';
  return `${filled} of ${all.length} filled`;
}

/** Slots grouped by what they're for, in the order they were created. */
export function groupSlots(slots) {
  const groups = new Map();
  for (const s of slots || []) {
    const key = s.label || 'Sign-up';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
  return [...groups.entries()].map(([label, items]) => ({
    label,
    slots: items,
    summary: signupSummary(items),
  }));
}

/** What a schedule row says: the shortest useful thing, or nothing at all. */
export function scheduleLine(slots) {
  const groups = groupSlots(slots);
  if (!groups.length) return null;
  // Unfilled first — an open slot is the only actionable state.
  const open = groups.filter((g) => g.slots.some((s) => !s.claimedBy));
  const shown = (open.length ? open : groups).slice(0, 2);
  return shown.map((g) => `${g.label}: ${g.summary}`).join(' · ');
}
