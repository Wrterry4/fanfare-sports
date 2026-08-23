/**
 * finalizeStats.js — The step that turns a finished game into season stats.
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 *
 * Season stats live at players/{id}/seasons/{teamId}_{season}, and exactly one
 * thing writes them: the finalizeGame Cloud Function. Nothing in the app ever
 * called it. So every game ended, the derived state said "final", and not one
 * season document was ever created — which is why the player card and the
 * roster showed no stats for anyone, forever. The screens were right; the
 * write path simply stopped existing halfway.
 *
 * ── Why the client cannot just write them ───────────────────────────────────
 *
 * firestore.rules puts `allow write: if false` on seasons and career, in the
 * dev rules as well as production. That is deliberate and worth keeping: a
 * client that can write its own season totals is a client that can inflate a
 * child's numbers, and stats are the thing families screenshot. The server
 * recomputes from the event log rather than believing anything sent to it.
 *
 * The consequence is that stats need Cloud Functions deployed. On Spark they
 * cannot work at all, and this reports that plainly instead of failing in a
 * way that looks like a bug in the scoring.
 */

import { call, CALLABLE_NOT_DEPLOYED } from './callable.js';

/** What happened, for a caller that wants to say so. */
export const FINALIZE = {
  DONE: 'done',
  ALREADY: 'already',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
};

/**
 * Commit one finished game's stats. Safe to call more than once.
 *
 * The server refuses a game it has already finalized, because merging a game
 * into a season twice adds it twice. That refusal is a normal outcome here,
 * not an error worth showing anyone — two devices watching the same game will
 * both try, and exactly one will win.
 *
 * @returns one of FINALIZE — never throws
 */
export async function finalizeGameStats(teamId, gameId) {
  if (!teamId || !gameId) return FINALIZE.FAILED;

  try {
    await call('finalizeGame', { teamId, gameId });
    return FINALIZE.DONE;
  } catch (e) {
    if (e?.reason === CALLABLE_NOT_DEPLOYED) return FINALIZE.UNAVAILABLE;
    // The server's own "already final" guard. Expected whenever a second
    // device gets there first.
    if (/already final/i.test(e?.message || '')) return FINALIZE.ALREADY;
    return FINALIZE.FAILED;
  }
}
