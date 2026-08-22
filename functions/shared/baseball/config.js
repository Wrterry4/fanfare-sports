/**
 * gameConfig.js — Turning a game document into engine config.
 *
 * Youth scorekeeping tracks YOUR roster. The other dugout is anonymous slots:
 * nobody enters the opposing team's nine names, and their stats aren't yours to
 * keep. The engine still needs a batting order on both sides to advance the
 * game, so the opponent gets placeholder IDs that are filtered out before
 * anything is written.
 *
 * This lives in shared/ because THREE places need it — the client (live state),
 * the finalize function (authoritative recompute), and the tests. It previously
 * existed only inside functions/index.js with the test keeping its own copy,
 * which is exactly the drift the shared layer is supposed to prevent.
 */

export const OPPONENT_PREFIX = 'opp_';

export const isOpponentId = (id) => String(id).startsWith(OPPONENT_PREFIX);

export function buildGameConfig(game) {
  const mine = (game.lineup || []).map((s, i) => ({
    playerId: s.playerId,
    order: s.battingOrder ?? i + 1,
    position: s.position || null,
  }));

  const size = Math.max(9, mine.length);
  const opponent = Array.from({ length: size }, (_, i) => ({
    playerId: `${OPPONENT_PREFIX}${i + 1}`,
    order: i + 1,
    position: null,
  }));

  const isHome = game.homeOrAway === 'home';
  return {
    homeLineup:  isHome ? mine : opponent,
    awayLineup:  isHome ? opponent : mine,
    homePitcher: isHome ? (game.startingPitcherId || null) : `${OPPONENT_PREFIX}p`,
    awayPitcher: isHome ? `${OPPONENT_PREFIX}p` : (game.startingPitcherId || null),
  };
}

/** Drop placeholder rows before writing stats anywhere. */
export function realPlayerIds(stats) {
  return [...new Set([
    ...Object.keys(stats.batting || {}),
    ...Object.keys(stats.pitching || {}),
    ...Object.keys(stats.fielding || {}),
  ])].filter((id) => !isOpponentId(id));
}

/** Which side is ours this half-inning. */
export const weAreBatting = (isTop, homeOrAway) =>
  homeOrAway === 'home' ? !isTop : isTop;
