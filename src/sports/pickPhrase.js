/**
 * pickPhrase.js — Choose one line from a pool, the same way on every device.
 *
 * ── Why not Math.random() ───────────────────────────────────────────────────
 *
 * The whole point of a moment banner is that everyone watching sees it at
 * once — a parent in the stands, a grandparent at home, and the scorekeeper
 * all get the same "GRAND SLAM!" off the same live event. Each of those is a
 * separate device running its own copy of this code, so a random pick would
 * give them different phrases for the same swing, and two people comparing
 * phones would reasonably conclude the app was broken.
 *
 * Seeding off something every device already agrees on — the event's `seq` —
 * makes the choice identical everywhere with no broadcast, no extra field on
 * the event, and no server involvement at all.
 *
 * ── What this is not ────────────────────────────────────────────────────────
 *
 * This is a hash, not a round robin. `seq` counts every event in the game,
 * not just the notable ones, so consecutive home runs land on effectively
 * arbitrary entries rather than walking the pool 1 → 2 → 3 in order. That is
 * the intended trade: real rotation would require threading a per-event-type
 * count through the presenter, and arbitrary-but-stable already delivers the
 * variety this exists for.
 */

/**
 * @param pool  array of anything — phrases, or {named, plain} pairs
 * @param seed  any number-ish value; an event's seq in practice
 * @returns one entry, or null for an empty/absent pool
 */
export function pickPhrase(pool, seed) {
  if (!Array.isArray(pool) || pool.length === 0) return null;

  // A missing or junk seed must still return something rather than throwing —
  // a banner is the last place a crash is worth it. Index 0 is a fine answer.
  const n = Number(seed);
  const safe = Number.isFinite(n) ? Math.abs(Math.trunc(n)) : 0;

  return pool[safe % pool.length];
}
