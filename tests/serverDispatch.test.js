/**
 * serverDispatch.test.js — finalizeGame's actual per-sport pipeline.
 *
 * This runs the exact sequence functions/index.js's finalizeGame and
 * recomputeCareers perform — reduce, computeStats, slice one player out,
 * merge with what's already on their season, extract the fields to write —
 * against real engine output, for both sports. It exists because the bug it
 * guards against didn't throw: finalizeGame silently wrote zero season stats
 * for every basketball player, for every basketball game, forever. A missing
 * player in a Set is not an error a test runner notices unless something
 * asserts the count directly, which is what this does.
 */

import { serverPackFor, serverSportKeys } from '../src/sports/serverDispatch.js';

import { reduce as bbReduce } from '../src/sports/baseball/engine.js';
import { buildGameConfig as bbConfig } from '../src/sports/baseball/config.js';
import { RULE_PRESETS as bbPresets } from '../src/sports/baseball/rules.js';
import { EV as BB } from '../src/sports/baseball/events.js';

import { buildGameConfig as bkConfig } from '../src/sports/basketball/config.js';
import { DEFAULT_RULES as bkRules } from '../src/sports/basketball/rules.js';
import { EV as BK } from '../src/sports/basketball/events.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

group('serverPackFor');
{
  ok('baseball and basketball are both registered',
    serverSportKeys().includes('baseball') && serverSportKeys().includes('basketball'));
  ok('an unknown sport falls back to baseball rather than throwing',
    typeof serverPackFor('quidditch').reduce === 'function');
  ok('undefined falls back too — every game written before `sport` existed is one',
    typeof serverPackFor(undefined).reduce === 'function');
}

group('Basketball: the bug that shipped silent');
{
  const pack = serverPackFor('basketball');
  const cfg = bkConfig({ homeOrAway: 'home',
    lineup: ['p1', 'p2', 'p3', 'p4', 'p5'].map((playerId) => ({ playerId })) });
  const events = [
    { seq: 1, type: BK.GAME_START, payload: {}, at: 0 },
    { seq: 2, type: BK.MADE_2, payload: { playerId: 'p1' }, at: 1000 },
    { seq: 3, type: BK.MADE_3, payload: { playerId: 'p2' }, at: 2000 },
  ];
  const stats = pack.computeStats(events, bkRules, cfg);
  const ids = pack.realPlayerIdsFromStats(stats);

  // This is the exact assertion that would have caught it: baseball's
  // realPlayerIds reads stats.batting/.pitching/.fielding, none of which
  // exist on basketball's {players:{...}} shape, so it always found nobody.
  ok('both scoring players are found, not zero', ids.length === 2);
  ok('by the right ids', ids.sort().join() === 'p1,p2');
}

group('Basketball: slice → merge → season fields, across two games');
{
  const pack = serverPackFor('basketball');
  const cfg = bkConfig({ homeOrAway: 'home',
    lineup: ['p1', 'p2'].map((playerId) => ({ playerId })) });

  const game1 = pack.computeStats(
    [{ seq: 1, type: BK.GAME_START, payload: {}, at: 0 },
     { seq: 2, type: BK.MADE_2, payload: { playerId: 'p1' }, at: 1000 }],
    bkRules, cfg);
  const game2 = pack.computeStats(
    [{ seq: 1, type: BK.GAME_START, payload: {}, at: 0 },
     { seq: 2, type: BK.MADE_3, payload: { playerId: 'p1' }, at: 1000 },
     { seq: 3, type: BK.MADE_3, payload: { playerId: 'p1' }, at: 2000 }],
    bkRules, cfg);

  // Exactly what finalizeGame does: slice one player out, merge with
  // whatever their season already has (null the first time), repeat.
  let seasonRaw = null;
  for (const g of [game1, game2]) {
    const slice = pack.sliceStatsForPlayer(g, 'p1');
    seasonRaw = seasonRaw ? pack.mergeStats(seasonRaw, slice) : slice;
  }
  const fields = pack.seasonFieldsFor('p1', seasonRaw);

  ok('two games of scoring accumulate: 2 + 3 + 3', fields.scoring.pts === 8);
  ok('games played counts both', fields.scoring.games === 2);
  ok('the season document field is named "scoring", not "players"',
    'scoring' in fields && !('players' in fields));
}

group('Basketball: nothing here assumes baseball\'s pitching concept');
{
  const pack = serverPackFor('basketball');
  ok('restDaysFor is explicitly absent, not a baseball function pretending to work',
    pack.restDaysFor === null);
  // pitchCountFor must not read a field that doesn't exist on this engine's
  // state — the exact crash that would have followed once players were
  // actually found (see the group above).
  ok('pitchCountFor returns undefined rather than throwing',
    pack.pitchCountFor({ notPitchCounts: true }, 'p1') === undefined);
}

group('Baseball: unchanged by the dispatch existing');
{
  const pack = serverPackFor('baseball');
  const rules = bbPresets.kidPitch10U;
  const cfg = bbConfig({ homeOrAway: 'away',
    lineup: ['p1', 'p2', 'p3'].map((playerId) => ({ playerId })) });
  const events = [
    { seq: 1, type: BB.GAME_START, payload: {} },
    { seq: 2, type: BB.SINGLE, payload: {} },
    { seq: 3, type: BB.HOME_RUN, payload: {} },
  ];
  const state = pack.reduce(events, rules, cfg);
  const stats = pack.computeStats(events, rules, cfg);
  const ids = pack.realPlayerIdsFromStats(stats);

  // Only p1 and p2 actually came to the plate — p3 never batted, so real
  // batters here means "everyone who appears in a stat line," not "everyone
  // in the lineup."
  ok('finds the batters who actually came to the plate', ids.length === 2);

  const slice = pack.sliceStatsForPlayer(stats, ids[0]);
  ok('a slice keeps the three-map shape mergeStats expects',
    'batting' in slice && 'pitching' in slice && 'fielding' in slice);

  const merged = pack.mergeStats(null, slice);
  const fields = pack.seasonFieldsFor(ids[0], merged);
  ok('season fields are the flat batting/pitching/fielding baseball has always written',
    'batting' in fields && 'pitching' in fields && 'fielding' in fields
    && !('scoring' in fields));

  const pitcherId = state.pitchers[state.isTop ? 'home' : 'away'];
  ok('pitchCountFor still reads real pitch counts for baseball',
    pack.pitchCountFor(state, pitcherId) > 0);
  ok('restDaysFor is a real function for baseball', typeof pack.restDaysFor === 'function');
}

group('Career grouping: two sports never merge through one sport\'s math');
{
  // This is the shape recomputeCareers now groups by `sport` to avoid —
  // simulated directly since recomputeCareers itself needs firebase-admin.
  const bb = serverPackFor('baseball');
  const bk = serverPackFor('basketball');

  // homeOrAway: 'away' so kid1's lineup bats in the TOP of the first —
  // immediately after GAME_START, rather than needing a half-inning to turn
  // over first.
  const bbCfg = bbConfig({ homeOrAway: 'away', lineup: [{ playerId: 'kid1' }] });
  const bbStats = bb.computeStats(
    [{ seq: 1, type: BB.GAME_START, payload: {} }, { seq: 2, type: BB.SINGLE, payload: {} }],
    bbPresets.kidPitch10U, bbCfg);

  const bkCfg = bkConfig({ homeOrAway: 'home', lineup: [{ playerId: 'kid1' }] });
  const bkStats = bk.computeStats(
    [{ seq: 1, type: BK.GAME_START, payload: {}, at: 0 },
     { seq: 2, type: BK.MADE_2, payload: { playerId: 'kid1' }, at: 1000 }],
    bkRules, bkCfg);

  const bbSeason = bb.seasonFieldsFor('kid1', bb.sliceStatsForPlayer(bbStats, 'kid1'));
  const bkSeason = bk.seasonFieldsFor('kid1', bk.sliceStatsForPlayer(bkStats, 'kid1'));

  ok('a two-sport kid\'s baseball line has real at-bats',
    bbSeason.batting.AB > 0);
  ok('and a completely separate basketball line',
    bkSeason.scoring.pts === 2);
  ok('one never leaks fields into the other',
    !('scoring' in bbSeason) && !('batting' in bkSeason));
}

group('The presenters read the new per-sport career shape');
{
  const bbPresent = await import('../src/sports/baseball/present.js');
  const bkPresent = await import('../src/sports/basketball/present.js');

  // Exactly the shape recomputeCareers now writes to players/{id}/career/totals.
  const career = {
    baseball: {
      batting: { AB: 30, H: 10, HR: 2, RBI: 8, R: 9, AVG: 0.333, OPS: 0.9 },
      pitching: { outs: 12, K: 5, BB: 2, IP: '4.0', ERA: 2.0, WHIP: 1.1 },
      seasonCount: 2,
    },
    basketball: {
      scoring: { games: 6, pts: 42, reb: 10, ast: 5, fgPct: 0.45, minutes: 60 },
      seasonCount: 1,
    },
  };

  const bbCard = bbPresent.describeStatCard({ season: {}, career });
  const bbCareer = bbCard.find((s) => s.key === 'career');
  ok('baseball reads its own career.baseball section', !!bbCareer);
  ok('with the right season count', bbCareer.label.includes('2 seasons'));

  const bkCard = bkPresent.describeStatCard({ season: {}, career });
  const bkCareer = bkCard.find((s) => s.key === 'career');
  ok('basketball reads career.basketball, not career.baseball', !!bkCareer);
  ok('with basketball\'s own game count', bkCareer.label.includes('6 game'));

  // A player who has only ever played one sport must not show a phantom
  // career section for the other.
  const onlyBaseball = { baseball: career.baseball };
  const bkCardEmpty = bkPresent.describeStatCard({ season: {}, career: onlyBaseball });
  ok('no basketball career section when the player has never played it',
    !bkCardEmpty.find((s) => s.key === 'career'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
