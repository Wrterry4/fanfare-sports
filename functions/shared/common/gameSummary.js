/**
 * gameSummary.js — When the mirrored game summary may be written.
 *
 * Pure, with no Firebase import, so it can be tested at a desk. That matters
 * here: the rule it encodes was violated once already and started games on its
 * own.
 */

/**
 * Only a game that is already live, and only once something has happened in
 * it.
 *
 * The mirror used to be unconditional and its payload included
 * `status: 'live'` — so opening Game Day on a SCHEDULED game flipped it to
 * live four seconds later. The Start button rendered correctly and the
 * debounced write started the game behind it.
 */
export function shouldSyncSummary(game, state) {
  if (!game || !state) return false;
  if (game.status !== 'live') return false;
  if ((state.lastEventSeq ?? -1) < 0) return false;
  return true;
}
