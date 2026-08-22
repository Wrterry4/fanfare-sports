/**
 * stats.js — Box scores and season totals.
 *
 * Same contract as baseball's: computeStats(state) produces one game, and
 * mergeStats(a, b) accumulates seasons. The important rule is repeated here
 * because it's the one that's easy to get wrong — RATE STATS ARE RECOMPUTED
 * FROM TOTALS, NEVER AVERAGED. Averaging two games' shooting percentages gives
 * a number that belongs to neither game.
 */

import { reduce, minutesFor } from './engine.js';
import { isOpponentId } from './config.js';

const pct = (made, att) => (att > 0 ? made / att : 0);

/** Derived fields, computed from counting stats every time. */
function derive(line) {
  const fgm = line.fg2m + line.fg3m;
  const fga = line.fg2a + line.fg3a;
  return {
    ...line,
    fgm,
    fga,
    fgPct: pct(fgm, fga),
    fg3Pct: pct(line.fg3m, line.fg3a),
    ftPct: pct(line.ftm, line.fta),
    // True shooting accounts for threes and free throws being worth more per
    // attempt; field-goal percentage alone flatters a player who never shoots
    // outside.
    tsPct: (fga + 0.44 * line.fta) > 0
      ? line.pts / (2 * (fga + 0.44 * line.fta))
      : 0,
  };
}

/**
 * @param events the raw log — NOT reduced state.
 *
 * The signature matters more than it looks. gameService calls this as
 * computeStats(events, rules, config) because that's what baseball takes, and
 * this used to accept (state, rules). It therefore received the events ARRAY
 * where it expected state, `state.box` was undefined, and the whole snapshot
 * callback threw before it could ever set state — so Game Day sat on a
 * spinner forever with no error shown.
 *
 * Both sports now take the same three arguments. A pack whose stats function
 * disagrees with the caller is invisible until someone opens a game.
 */
export function computeStats(events = [], rules = {}, config = {}) {
  const state = Array.isArray(events)
    ? reduce(events, rules, config)
    : events;   // tolerate a pre-reduced state, which the tests pass
  const players = {};

  for (const [playerId, line] of Object.entries(state.box || {})) {
    if (isOpponentId(playerId)) continue;
    const mins = minutesFor(state, playerId, rules);
    players[playerId] = {
      ...derive(line),
      games: 1,
      // Minutes carry their own provenance so a season total can say how much
      // of it is trustworthy rather than presenting an estimate as fact.
      minutes: mins.minutes,
      minutesSeconds: mins.seconds,
      minutesEstimated: mins.estimated,
      minutesTrackedPeriods: mins.trackedPeriods,
      minutesComplete: mins.complete,
    };
  }

  return {
    players,
    score: { ...state.score },
    periodScores: {
      home: [...state.periodScores.home],
      away: [...state.periodScores.away],
    },
    teamFouls: {
      home: [...state.teamFouls.home],
      away: [...state.teamFouls.away],
    },
  };
}

const COUNTING = [
  'pts', 'ftm', 'fta', 'fg2m', 'fg2a', 'fg3m', 'fg3a',
  'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'to',
  'pf', 'tech', 'foulsDrawn', 'games', 'minutes', 'minutesSeconds',
  'minutesTrackedPeriods',
];

export function mergeStats(a, b) {
  const out = { players: {} };
  const ids = new Set([
    ...Object.keys(a?.players || {}),
    ...Object.keys(b?.players || {}),
  ]);

  for (const id of ids) {
    const x = a?.players?.[id] || {};
    const y = b?.players?.[id] || {};
    const merged = {};
    for (const key of COUNTING) merged[key] = (x[key] || 0) + (y[key] || 0);

    // One estimated game makes the season total an estimate. Saying otherwise
    // would launder an approximation into a fact.
    merged.minutesEstimated = !!x.minutesEstimated || !!y.minutesEstimated;
    merged.minutesComplete = (x.minutesComplete !== false) && (y.minutesComplete !== false);

    // Recomputed from the merged totals, not averaged.
    out.players[id] = derive(merged);
  }

  return out;
}

/**
 * Playing-time fairness, for leagues that mandate it.
 *
 * Returns null rather than a warning when the data can't support one — an
 * equal-time flag derived from a half-logged game would send a coach into a
 * conversation with a parent holding numbers that aren't real.
 */
export function playingTimeReport(state, rules = {}, roster = []) {
  if (!rules.equalPlayingTime && !rules.minimumMinutesPerGame) return null;

  const rows = roster
    .filter((id) => !isOpponentId(id))
    .map((id) => ({ playerId: id, ...minutesFor(state, id, rules) }));

  const anyTracked = rows.some((r) => r.trackedPeriods > 0);
  if (!anyTracked) {
    return {
      usable: false,
      reason: 'Substitutions were not logged, so minutes are not available '
            + 'for this game.',
      rows,
    };
  }

  const minimum = rules.minimumMinutesPerGame || 0;
  const complete = rows.every((r) => r.complete);

  return {
    usable: true,
    // Stated plainly so the UI never has to imply precision it lacks.
    complete,
    estimated: rows.some((r) => r.estimated),
    short: minimum > 0 ? rows.filter((r) => r.minutes < minimum) : [],
    rows: rows.sort((a, b) => a.minutes - b.minutes),
  };
}
