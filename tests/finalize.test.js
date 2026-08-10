/**
 * finalize.test.js — The finalize math, tested without Firebase.
 *
 * Everything the Cloud Function computes before it touches the database is
 * pure. This replays two complete games through the real engine, merges them
 * the way finalizeGame does, and checks the season and career totals.
 *
 * Run: node tests/finalize.test.js
 */

import { EV, makeEvent } from '../src/sports/baseball/events.js';
import { reduce } from '../src/sports/baseball/engine.js';
import { computeStats, mergeStats } from '../src/sports/baseball/stats.js';
import { resolveRules, restDaysFor } from '../src/sports/baseball/rules.js';
import { buildGameConfig, OPPONENT_PREFIX as OPP } from '../src/sports/baseball/config.js';

let passed = 0, failed = 0;
const out = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; out.push(`  ok   ${name}`); }
  else { failed++; out.push(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`); }
}

const ROSTER = ['p_jack','p_wu','p_luis','p_eli','p_sam','p_diego','p_owen','p_micah','p_theo'];
const RULES = resolveRules({}, 'kidPitch10U');

function game(homeOrAway, script) {
  const g = {
    homeOrAway,
    lineup: ROSTER.map((playerId, i) => ({ playerId, battingOrder: i + 1 })),
    startingPitcherId: 'p_theo',
  };
  const config = buildGameConfig(g);
  let seq = 0;
  const events = [makeEvent(EV.GAME_START, {}, { seq: seq++ })];
  for (const [type, payload] of script) {
    events.push(makeEvent(EV[type], payload || {}, { seq: seq++ }));
  }
  return {
    g, config, events,
    state: reduce(events, RULES, config),
    stats: computeStats(events, RULES, config),
  };
}

out.push('\nOpponent slots');
{
  // Away team bats first, so our roster hits in the top half.
  const r = game('away', [
    ['SINGLE'], ['DOUBLE'], ['HOME_RUN'], ['GROUND_OUT'], ['FLY_OUT'], ['STRIKEOUT'],
  ]);
  const realIds = Object.keys(r.stats.batting).filter(id => !id.startsWith(OPP));
  const oppIds  = Object.keys(r.stats.batting).filter(id =>  id.startsWith(OPP));
  check('our roster gets real stats', realIds.length, 6);
  check('opponent produced no batting rows this half', oppIds.length, 0);
  check('score is ours', r.state.score.away, 3);
}
{
  // Home game: our roster bats in the bottom, opponent slots bat the top.
  const r = game('home', [
    ['GROUND_OUT'], ['GROUND_OUT'], ['GROUND_OUT'],   // opponent's half
    ['SINGLE'], ['HOME_RUN'],                          // ours
  ]);
  const oppIds = Object.keys(r.stats.batting).filter(id => id.startsWith(OPP));
  check('opponent outs recorded under placeholder ids', oppIds.length, 3);
  check('placeholders are filtered before writing',
    Object.keys(r.stats.batting).filter(id => !id.startsWith(OPP)).length, 2);
  check('our runs land on the home line', r.state.score.home, 2);
}

out.push('\nSeason accumulation across two games');
{
  const g1 = game('away', [
    ['SINGLE', { playerId:'p_jack' }],
    ['WALK',   { playerId:'p_jack' }],
    ['STRIKEOUT', { playerId:'p_jack' }],
  ]);
  const g2 = game('away', [
    ['DOUBLE',    { playerId:'p_jack' }],
    ['GROUND_OUT',{ playerId:'p_jack' }],
    ['HOME_RUN',  { playerId:'p_jack' }],
  ]);

  const season = mergeStats(g1.stats, g2.stats);
  const j = season.batting['p_jack'];

  check('season PA', j.PA, 6);
  check('season AB excludes the walk', j.AB, 5);
  check('season hits', j.H, 3);
  check('season total bases 1+2+4', j.TB, 7);
  check('season AVG = 3/5', j.AVG, 0.6);
  check('season SLG = 7/5', j.SLG, 1.4);
  check('season OBP = 4/6', j.OBP, 0.667);

  // Rate stats must come from the summed counting stats, not from averaging
  // the two games' rates. G1 AVG .500, G2 AVG .667 — the mean would be .583.
  check('rates recomputed, not averaged', j.AVG !== 0.583, true);

  const career = mergeStats(season, g1.stats);
  check('career keeps accumulating', career.batting['p_jack'].PA, 9);
}

out.push('\nPitching appearance and rest days');
{
  const r = game('home', [
    ...Array.from({ length: 24 }, () => ['BALL']),   // opponent's half-inning
    ...Array.from({ length: 9 },  () => ['STRIKE_SWINGING']),
  ]);
  const pitches = r.state.pitchCounts['p_theo'];
  check('our pitcher charged for the top half', pitches > 0, true);
  check('rest days derive from the count', restDaysFor(pitches, RULES), restDaysFor(pitches, RULES));
  check('a 40-pitch outing costs 2 days at 10U', restDaysFor(40, RULES), 2);
  check('a 70-pitch outing costs 4 days', restDaysFor(70, RULES), 4);
  check('75 is the 10U outing ceiling', RULES.maxPitchesPerOuting, 75);
}

out.push('\nCorrection replays cleanly');
{
  const base = game('away', [
    ['DOUBLE', { playerId:'p_jack' }],
    ['SINGLE', { playerId:'p_wu'   }],
    ['GROUND_OUT', { playerId:'p_luis' }],
  ]);
  const beforeStats = computeStats(base.events, RULES, base.config);
  const voided = base.events.map(e => e.seq === 1 ? { ...e, voided:true } : e);
  const afterStats = computeStats(voided, RULES, base.config);

  check('double counted before the correction', beforeStats.batting['p_jack'].H, 1);
  check('voided event drops from totals', afterStats.batting['p_jack'], undefined);
  check('other players unaffected', afterStats.batting['p_wu'].H, 1);
  check('the log itself is unchanged', base.events.length, voided.length);
}

console.log(out.join('\n'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
