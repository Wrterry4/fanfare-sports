/**
 * serverDispatch.js — Which sport computes and writes this game's stats?
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * functions/index.js's finalizeGame and recomputeCareers imported baseball's
 * engine, stats, and rules modules directly — the same class of bug
 * sportNotify.js exists to prevent, just never applied here. The effect was
 * silent, not a crash:
 *
 *   - Baseball's realPlayerIds reads stats.batting / .pitching / .fielding.
 *     Basketball's computeStats returns { players: {...} } — none of those
 *     keys exist, so the player loop in finalizeGame found nobody, and every
 *     basketball game finalized with ZERO season stats written for anybody.
 *   - The pitching-appearance block reads state.pitchCounts[playerId].
 *     Basketball's engine state has no pitchCounts at all.
 *   - recomputeCareers called baseball's mergeStats on basketball's raw
 *     stats. It didn't throw (everything in there is optional-chained) — it
 *     just silently produced an empty, wrong career document.
 *
 * Mirrors sportNotify.js: a small map of pure functions, importing only .js
 * files so it survives being vendored into the deployed bundle (a pack's
 * index.js re-exports .jsx components, which never reach the server).
 * ────────────────────────────────────────────────────────────────────────────
 */

import * as baseballEngine from './baseball/engine.js';
import * as baseballStats from './baseball/stats.js';
import * as baseballConfig from './baseball/config.js';
import * as baseballRules from './baseball/rules.js';

import * as basketballEngine from './basketball/engine.js';
import * as basketballStats from './basketball/stats.js';
import * as basketballConfig from './basketball/config.js';

const PACKS = {
  baseball: {
    reduce: baseballEngine.reduce,
    computeStats: baseballStats.computeStats,
    mergeStats: baseballStats.mergeStats,
    buildGameConfig: baseballConfig.buildGameConfig,
    restDaysFor: baseballRules.restDaysFor,
    pitchCountFor: (state, playerId) => state.pitchCounts?.[playerId],
    realPlayerIdsFromStats: baseballConfig.realPlayerIds,
    /**
     * A computeStats-shaped object scoped to one player — same shape as the
     * full multi-player one, just with a single key. This is what lets
     * mergeStats (which expects a full computeStats shape) combine an
     * existing season with one more game's contribution, without
     * finalizeGame ever branching on which sport it's holding.
     */
    sliceStatsForPlayer: (stats, playerId) => ({
      batting: { [playerId]: stats.batting?.[playerId] || {} },
      pitching: { [playerId]: stats.pitching?.[playerId] || {} },
      fielding: { [playerId]: stats.fielding?.[playerId] || {} },
    }),
    /**
     * What a season document's per-player fields look like for this sport.
     * `merged` is this sport's own mergeStats output — shaped however that
     * sport likes internally; this is the bridge to Firestore, and the only
     * place that shape has to be agreed on.
     */
    seasonFieldsFor: (playerId, merged) => ({
      batting: merged.batting?.[playerId] || {},
      pitching: merged.pitching?.[playerId] || {},
      fielding: merged.fielding?.[playerId] || {},
    }),
  },
  basketball: {
    reduce: basketballEngine.reduce,
    computeStats: basketballStats.computeStats,
    mergeStats: basketballStats.mergeStats,
    buildGameConfig: basketballConfig.buildGameConfig,
    restDaysFor: null,               // no pitching concept
    pitchCountFor: () => undefined,
    realPlayerIdsFromStats: (stats) => Object.keys(stats.players || {}),
    sliceStatsForPlayer: (stats, playerId) => ({
      players: { [playerId]: stats.players?.[playerId] || {} },
    }),
    seasonFieldsFor: (playerId, merged) => ({
      scoring: merged.players?.[playerId] || {},
    }),
  },
};

/**
 * Defaults to baseball: every game, season, and team created before `sport`
 * existed is one.
 */
export function serverPackFor(sportKey) {
  return PACKS[sportKey] || PACKS.baseball;
}

export const serverSportKeys = () => Object.keys(PACKS);
