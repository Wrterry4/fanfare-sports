/**
 * basketball.test.js — The second sport.
 *
 * Weighted heavily toward MINUTES, because that's the number a parent will act
 * on and the one that can be confidently wrong. Everything else here either
 * fails loudly or doesn't matter much.
 */

import { reduce, minutesFor } from '../src/sports/basketball/engine.js';
import { computeStats, mergeStats, playingTimeReport } from '../src/sports/basketball/stats.js';
import { EV } from '../src/sports/basketball/events.js';
import { RULE_PRESETS, inBonus, hasFouledOut } from '../src/sports/basketball/rules.js';
import { buildGameConfig } from '../src/sports/basketball/config.js';
import { getVisibleControls, SCORING_MODES, CONTROL_GROUPS, tracksMinutes }
  from '../src/sports/basketball/scoringModes.js';
import * as present from '../src/sports/basketball/present.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const rules = RULE_PRESETS.rec10U;
const roster = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
const config = buildGameConfig({
  homeOrAway: 'home',
  lineup: roster.map((playerId) => ({ playerId })),
});

let seq = 0;
const e = (type, payload = {}, at) => ({ seq: ++seq, type, payload, at });
const reset = () => { seq = 0; };

group('Scoring');
{
  reset();
  const log = [
    e(EV.GAME_START), e(EV.MADE_2, { playerId: 'p1' }),
    e(EV.MADE_3, { playerId: 'p2' }), e(EV.MADE_1, { playerId: 'p1' }),
    e(EV.MISS_2, { playerId: 'p3' }),
  ];
  const s = reduce(log, rules, config);
  ok('two plus three plus one is six', s.score.home === 6);
  ok('points land on the right player', s.box.p1.pts === 3);
  ok('a three is worth three', s.box.p2.pts === 3);
  ok('a miss counts as an attempt', s.box.p3.fg2a === 1);
  ok('and not as a make', s.box.p3.fg2m === 0);
  ok('the opponent has not scored', s.score.away === 0);
}
{
  reset();
  const s = reduce([e(EV.GAME_START), e(EV.OPPONENT_SCORE, { points: 3 })], rules, config);
  ok('opponent points go to the other side', s.score.away === 3 && s.score.home === 0);
}

group('Fouls are eligibility, not colour');
{
  reset();
  const log = [e(EV.GAME_START)];
  for (let i = 0; i < 5; i++) log.push(e(EV.FOUL_PERSONAL, { playerId: 'p1' }));
  const s = reduce(log, rules, config);
  ok('five fouls at this level is a disqualification', s.fouledOut.includes('p1'));
  // A player who fouled out cannot keep accruing minutes.
  ok('and removes them from the floor', !s.onCourt.includes('p1'));
  ok('team fouls accumulate for the period', s.teamFouls.home[0] === 5);
  ok('hasFouledOut agrees', hasFouledOut(5, rules));
  ok('four is not five', !hasFouledOut(4, rules));
}
{
  // Some leagues switch the rule off entirely for the youngest players.
  const young = RULE_PRESETS.rec6U;
  ok('nobody fouls out at 6U', !hasFouledOut(9, young));
  ok('and there is no bonus', !inBonus(9, young));
}

group('Minutes: refusing to guess');
{
  reset();
  // No lineup and no starting five means nothing is known about the floor.
  const bare = buildGameConfig({ homeOrAway: 'home', lineup: [] });
  const s = reduce([
    e(EV.GAME_START, {}, 1000),
    e(EV.MADE_2, { playerId: 'p1' }, 61000),
  ], rules, bare);
  const m = minutesFor(s, 'p1', rules);
  ok('an untracked game credits nobody', m.minutes === 0);
  ok('and says so rather than implying zero playing time', m.complete === false);
}
{
  reset();
  // A known five, one minute of wall time, no clock stamps.
  const s = reduce([
    e(EV.GAME_START, {}, 0),
    e(EV.MADE_2, { playerId: 'p1' }, 60000),
  ], rules, config);
  const m = minutesFor(s, 'p1', rules);
  ok('a tracked period credits the players on the floor', m.minutes === 1);
  // The honest label — wall time drifts badly with a stopped clock.
  ok('without a clock the figure is flagged estimated', m.estimated === true);
  ok('a player on the bench gets nothing', minutesFor(s, 'p7', rules).minutes === 0);
}
{
  reset();
  // Clock stamps present: exact rather than estimated.
  const s = reduce([
    e(EV.GAME_START, { clockSeconds: 420 }, 0),
    e(EV.MADE_2, { playerId: 'p1', clockSeconds: 300 }, 5000),
  ], rules, config);
  const m = minutesFor(s, 'p1', rules);
  ok('clock stamps give two minutes, not the five wall seconds', m.minutes === 2);
  ok('and the figure is exact', m.estimated === false);
}
{
  reset();
  // A substitution stops the outgoing player's clock at the sub.
  const s = reduce([
    e(EV.GAME_START, { clockSeconds: 420 }, 0),
    e(EV.SUBSTITUTION, { inId: 'p6', outId: 'p1', clockSeconds: 300 }, 1000),
    e(EV.MADE_2, { playerId: 'p6', clockSeconds: 120 }, 2000),
  ], rules, config);
  ok('the outgoing player stops accruing', minutesFor(s, 'p1', rules).minutes === 2);
  ok('the incoming player starts', minutesFor(s, 'p6', rules).minutes === 3);
  ok('the floor reflects the swap', s.onCourt.includes('p6') && !s.onCourt.includes('p1'));
}
{
  reset();
  // A gap longer than five minutes is a break, not play.
  const s = reduce([
    e(EV.GAME_START, {}, 0),
    e(EV.MADE_2, { playerId: 'p1' }, 20 * 60 * 1000),
  ], rules, config);
  ok('a twenty-minute gap between taps is not credited as playing time',
    minutesFor(s, 'p1', rules).minutes === 0);
}

group('Playing time reports refuse to mislead');
{
  reset();
  const equal = { ...rules, equalPlayingTime: true, minimumMinutesPerGame: 8 };
  const bare = buildGameConfig({ homeOrAway: 'home', lineup: [] });
  const s = reduce([e(EV.GAME_START, {}, 0), e(EV.MADE_2, { playerId: 'p1' }, 60000)], equal, bare);
  const report = playingTimeReport(s, equal, roster);
  // The whole point: no report at all beats a wrong one.
  ok('an unlogged game produces no usable report', report.usable === false);
  ok('and explains why', /not logged|not available/i.test(report.reason));
}
{
  reset();
  const equal = { ...rules, equalPlayingTime: true, minimumMinutesPerGame: 8 };
  const s = reduce([
    e(EV.GAME_START, { clockSeconds: 420 }, 0),
    e(EV.MADE_2, { playerId: 'p1', clockSeconds: 0 }, 1000),
  ], equal, config);
  const report = playingTimeReport(s, equal, roster);
  ok('a logged game produces one', report.usable === true);
  ok('flagging who is short of the minimum', report.short.length > 0);
  ok('sorted with the least-played first', report.rows[0].minutes <= report.rows.at(-1).minutes);
}
ok('no report at all when the league has no rule',
  playingTimeReport(reduce([], rules, config), RULE_PRESETS.travel12U, roster) === null);

group('Season totals recompute rates rather than averaging');
{
  reset();
  const g1 = computeStats(reduce([
    e(EV.GAME_START), e(EV.MADE_2, { playerId: 'p1' }), e(EV.MISS_2, { playerId: 'p1' }),
  ], rules, config), rules);
  reset();
  const g2 = computeStats(reduce([
    e(EV.GAME_START),
    e(EV.MADE_2, { playerId: 'p1' }), e(EV.MADE_2, { playerId: 'p1' }),
    e(EV.MISS_2, { playerId: 'p1' }), e(EV.MISS_2, { playerId: 'p1' }),
  ], rules, config), rules);

  ok('game one is 1-for-2', g1.players.p1.fg2m === 1 && g1.players.p1.fg2a === 2);
  ok('game two is 2-for-4', g2.players.p1.fg2m === 2 && g2.players.p1.fg2a === 4);

  const season = mergeStats(g1, g2);
  ok('season attempts add up', season.players.p1.fg2a === 6);
  ok('season makes add up', season.players.p1.pts === 6);
  ok('percentage comes from the totals', Math.abs(season.players.p1.fgPct - 0.5) < 1e-9);
  ok('two games counted', season.players.p1.games === 2);
}
{
  // One estimated game makes the season estimated — laundering it would be a lie.
  const a = { players: { p1: { minutes: 10, minutesEstimated: true, games: 1 } } };
  const b = { players: { p1: { minutes: 10, minutesEstimated: false, games: 1 } } };
  ok('an estimate contaminates the total, correctly',
    mergeStats(a, b).players.p1.minutesEstimated === true);
}

group('Scoring modes');
{
  const full = getVisibleControls(SCORING_MODES.FULL, rules);
  const casual = getVisibleControls(SCORING_MODES.CASUAL, rules);
  ok('full mode shows the box score buttons', full[CONTROL_GROUPS.BOX].length > 0);
  ok('casual mode does not', casual[CONTROL_GROUPS.BOX].length === 0);
  // The asymmetry that mirrors baseball's pitch counts.
  ok('fouls are present in casual mode', casual[CONTROL_GROUPS.FOUL].length > 0);
  ok('and in full mode', full[CONTROL_GROUPS.FOUL].length > 0);
  ok('casual mode still scores points', casual[CONTROL_GROUPS.SCORE].length > 0);
  ok('only full mode tracks minutes', tracksMinutes(SCORING_MODES.FULL)
    && !tracksMinutes(SCORING_MODES.CASUAL));
}
{
  const noThrees = getVisibleControls(SCORING_MODES.FULL, RULE_PRESETS.rec8U);
  ok('a league with no three-point line hides the three button',
    !noThrees[CONTROL_GROUPS.SCORE].includes(EV.MADE_3));
}

group('Presenter shapes match the shared components');
{
  reset();
  const s = reduce([e(EV.GAME_START)], rules, config);
  const personFor = (id) => ({ playerId: id, firstName: id, lastName: 'X', jerseyNumber: 1 });

  const p = present.describePeriod(s, rules);
  ok('period is labelled 1st', p.label === '1st');
  // Basketball periods have no halves, so the shared Scoreboard draws no arrow.
  ok('no half-inning arrow', p.direction === null);

  const grid = present.describePeriodScores(s, rules);
  ok('four columns for four periods', grid.columns === 4);
  ok('one total column, not R and E', grid.totalColumns.join() === 'T');
  ok('each row supplies one total', grid.rows.every((r) => r.totals.length === 1));

  const parts = present.describeParticipants(s, rules, { personFor, canScore: true });
  ok('five on the floor, not two', parts.length === 5);
  ok('all are substitutable', parts.every((x) => x.substitutable));
  // The card is the player picker for basketball — tap arms them for the
  // next scoring action instead of opening stats. GameDayScreen reads this
  // flag rather than checking which sport it's rendering.
  ok('every card is selectable for scoring when the viewer can score',
    parts.every((x) => x.selectableForScoring === true));

  const readOnly = present.describeParticipants(s, rules, { personFor, canScore: false });
  ok("a read-only viewer's cards are not pickers — they fall back to stats",
    readOnly.every((x) => x.selectableForScoring === false));

  const sub = present.describeSubstitution(s, rules, 'court0', { personFor });
  ok('substitution offers the bench', sub.options.length === 2);
  ok('and names the event', sub.event === EV.SUBSTITUTION);
  ok('carrying the outgoing player', sub.extraPayload.outId === 'p1');
}
{
  reset();
  const overtime = reduce([e(EV.GAME_START), e(EV.PERIOD_END), e(EV.PERIOD_END),
                           e(EV.PERIOD_END), e(EV.PERIOD_END)], rules, config);
  ok('a fifth period is overtime',
    present.describePeriod(overtime, rules).label === 'OT');
}

group('The presenter trusts canScore completely, not its own status check');
{
  /**
   * The actual bug: describeParticipants used to require state.status ===
   * 'live' internally, in ADDITION to whatever canScore the caller passed
   * in. For a game whose event log is missing its GAME_START event — one
   * started before that was fixed to actually get recorded — state.status
   * is stuck at 'pending' forever, since nothing server-side backfills it.
   * Scoring itself still works fine in that state (nothing in the engine
   * gates a made shot or a foul on status), which is exactly why this was so
   * easy to miss: the game looked completely normal except for this one
   * thing. No caller-side fix could ever have repaired it, because this
   * function silently overrode canScore with its own stricter check no
   * matter what the caller decided.
   */
  reset();
  const cfg = buildGameConfig({ homeOrAway: 'home',
    lineup: ['p1', 'p2', 'p3', 'p4', 'p5'].map((playerId) => ({ playerId })) });
  const personFor = (id) => ({ playerId: id, firstName: 'Jack' });

  // No GAME_START in this log at all — status never leaves 'pending'.
  const stuckState = reduce(
    [e(EV.MADE_2, { playerId: 'p1' })], rules, cfg);
  ok('reproduces the exact bug: status is stuck even though scoring worked',
    stuckState.status === 'pending' && stuckState.score.home === 2);

  const parts = present.describeParticipants(stuckState, rules, { personFor, canScore: true });
  ok('cards are selectable anyway — the caller already decided scoring is possible',
    parts.every((p) => p.selectableForScoring === true));
  ok('substitution follows the same rule', parts.every((p) => p.substitutable === true));

  // A read-only viewer must still be correctly excluded regardless.
  const viewerParts = present.describeParticipants(stuckState, rules, { personFor, canScore: false });
  ok('a viewer is still correctly non-selectable on the same stuck game',
    viewerParts.every((p) => !p.selectableForScoring));
}

group('describeMoment — celebration banners');
{
  reset();
  const cfg5 = buildGameConfig({ homeOrAway: 'home',
    lineup: ['p1', 'p2', 'p3', 'p4', 'p5'].map((playerId) => ({ playerId })) });
  const personFor = (id) => ({ playerId: id, firstName: 'Jack' });

  const madeThree = { type: EV.MADE_3, payload: { playerId: 'p1' } };
  ok('a made three is a moment',
    present.describeMoment(madeThree, {}, { personFor })?.text.includes('JACK'));

  const block = { type: EV.BLOCK, payload: {} };
  ok('a block is a moment', !!present.describeMoment(block, {}, { personFor }));

  const madeTwo = { type: EV.MADE_2, payload: { playerId: 'p1' } };
  ok('an ordinary two is not', present.describeMoment(madeTwo, {}, { personFor }) === null);

  // The real foul-out sequence: five personal fouls on one player, checked
  // against the engine's own resulting state rather than a hand-built one —
  // this is the case that needs state AFTER the event, not just the event.
  const log = [e(EV.GAME_START)];
  for (let i = 0; i < 5; i++) log.push(e(EV.FOUL_PERSONAL, { playerId: 'p1' }));
  const stateAfter = reduce(log, rules, cfg5);
  const fifthFoul = log[log.length - 1];
  ok('the player is actually fouled out in this state', stateAfter.fouledOut.includes('p1'));
  ok('the fifth foul is the moment', present.describeMoment(fifthFoul, stateAfter, { personFor })?.tone === 'bad');

  // The first foul on the same player must stay silent — it isn't the one
  // that disqualified them.
  const firstFoul = log[1];
  const earlyState = reduce([log[0], log[1]], rules, cfg5);
  ok('an early foul on the same player is not a moment',
    present.describeMoment(firstFoul, earlyState, { personFor }) === null);
}

group('Undo and void behave like baseball');
{
  reset();
  const log = [e(EV.GAME_START), e(EV.MADE_2, { playerId: 'p1' }), e(EV.MADE_3, { playerId: 'p1' })];
  ok('five points before', reduce(log, rules, config).box.p1.pts === 5);
  const { undo, voidEvent } = await import('../src/sports/basketball/engine.js');
  ok('undo drops the last event', reduce(undo(log), rules, config).box.p1.pts === 2);
  ok('voiding replays without it', reduce(voidEvent(log, 2), rules, config).box.p1.pts === 3);
  ok('the log itself is unchanged', log.length === 3);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
