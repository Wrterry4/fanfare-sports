/**
 * config.js — Turning a game document into engine input.
 *
 * Mirrors baseball's config: the engine never reads Firestore, so everything
 * it needs arrives here.
 */

export const OPPONENT_PREFIX = 'opp_';

export const isOpponentId = (id) => String(id || '').startsWith(OPPONENT_PREFIX);

export function buildGameConfig(game = {}) {
  const roster = (game.lineup || []).map((s) => s.playerId).filter(Boolean);
  const size = game.playersOnCourt || 5;

  // Starters are the first five unless the lineup marks them, which keeps a
  // game usable when a coach hasn't set a starting five.
  const marked = (game.lineup || []).filter((s) => s.starter).map((s) => s.playerId);
  const startingFive = (marked.length ? marked : roster).slice(0, size);

  return {
    roster,
    startingFive,
    bench: roster.filter((id) => !startingFive.includes(id)),
    homeOrAway: game.homeOrAway || 'home',
    names: game.names || {},
  };
}

/** Ids that belong to real children, for anything that writes player stats. */
export const realPlayerIds = (ids = []) => ids.filter((id) => id && !isOpponentId(id));
