/**
 * advances.test.js — Runners go where the rulebook allows and nowhere else.
 *
 * This is the scoring engine, so the tests lean on the cases that decide a
 * game: a runner who held, a runner who cannot hold, and the boundary between
 * them — which is also what decides whether the app interrupts the scorekeeper.
 */

import {
  runnerOptions, defaultAdvances, isAmbiguous, normalizeAdvances, SCORED,
} from '../src/sports/baseball/advances.js';
import { reduce } from '../src/sports/baseball/engine.js';
import { EV } from '../src/sports/baseball/events.js';
import { RULE_PRESETS } from '../src/sports/baseball/rules.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const on = (spec) => ({ 1: spec[1] || null, 2: spec[2] || null, 3: spec[3] || null });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

group('Who is forced, and who could have held');
{
  // The case that started this: a single, runner on third, and he holds.
  ok('single with a runner on third is ambiguous', isAmbiguous(on({ 3: 'c' }), 1));
  ok('single with a runner on second is ambiguous', isAmbiguous(on({ 2: 'b' }), 1));

  // A runner on first has nowhere to stand once the batter takes first.
  ok('single with only a runner on first is NOT ambiguous',
    !isAmbiguous(on({ 1: 'a' }), 1));
  ok('double with only a runner on first is NOT ambiguous',
    !isAmbiguous(on({ 1: 'a' }), 2));
  ok('double with a runner on third IS ambiguous', isAmbiguous(on({ 3: 'c' }), 2));

  // On a triple everyone is behind the batter, so everyone scores.
  ok('a triple is never ambiguous', !isAmbiguous(on({ 1: 'a', 2: 'b', 3: 'c' }), 3));
  ok('a home run is never ambiguous', !isAmbiguous(on({ 1: 'a', 3: 'c' }), 4));
  ok('empty bases are never ambiguous', !isAmbiguous(on({}), 1));
  ok('bases loaded on a single IS ambiguous — the runners on 2nd and 3rd chose',
    isAmbiguous(on({ 1: 'a', 2: 'b', 3: 'c' }), 1));
}

group('A free runner can hold; a forced runner cannot');
{
  const [third] = runnerOptions(on({ 3: 'c' }), 1);
  ok('a runner on third may hold on a single', third.choices.includes(3));
  ok('and may score', third.choices.includes(SCORED));
  ok('and is not marked forced', third.forced === false);
  ok('defaulting to fourth base, as the old engine did', third.fallback === SCORED);

  const [first] = runnerOptions(on({ 1: 'a' }), 1);
  ok('a runner on first cannot hold on a single', !first.choices.includes(1));
  ok('and is marked forced', first.forced === true);
  ok('their floor is second', first.choices[0] === 2);
  ok('they may still take an extra base', first.choices.includes(3));
}

group('Runners never pass each other');
{
  // Runner on third holds; the runner on second is stuck behind him.
  const opts = runnerOptions(on({ 2: 'b', 3: 'c' }), 1);
  const third = opts.find((o) => o.from === 3);
  const second = opts.find((o) => o.from === 2);
  ok('the lead runner is offered first', opts[0].from === 3);
  ok('with third defaulting home, second may score too',
    third.fallback === SCORED && second.choices.includes(SCORED));

  const held = normalizeAdvances(on({ 2: 'b', 3: 'c' }), 1, { 3: 3, 2: SCORED });
  ok('if third holds, second cannot score past him', held[2] < 3);
  ok('second is pinned to second base', held[2] === 2);
  ok('and third stayed put', held[3] === 3);
}

group('Defaults reproduce the old behaviour exactly');
{
  ok('single moves everyone up one',
    same(defaultAdvances(on({ 1: 'a', 2: 'b' }), 1), { 2: 3, 1: 2 }));
  ok('double moves everyone up two',
    same(defaultAdvances(on({ 1: 'a', 2: 'b' }), 2), { 2: SCORED, 1: 3 }));
  ok('triple scores everyone',
    same(defaultAdvances(on({ 1: 'a', 3: 'c' }), 3), { 3: SCORED, 1: SCORED }));
  ok('a home run scores everyone',
    same(defaultAdvances(on({ 1: 'a', 2: 'b', 3: 'c' }), 4),
      { 3: SCORED, 2: SCORED, 1: SCORED }));
  ok('empty bases produce an empty map', same(defaultAdvances(on({}), 1), {}));
}

group('normalizeAdvances refuses illegal input');
{
  const b = on({ 1: 'a', 2: 'b', 3: 'c' });

  ok('a runner cannot move backward',
    normalizeAdvances(b, 1, { 3: 1 })[3] >= 3);
  ok('a forced runner cannot hold',
    normalizeAdvances(b, 1, { 1: 1 })[1] >= 2);
  ok('a destination past home is clamped',
    normalizeAdvances(b, 1, { 3: 9 })[3] === SCORED);
  ok('a missing entry falls back to the naive advance',
    normalizeAdvances(on({ 2: 'b' }), 1, {})[2] === 3);
  ok('junk is treated as missing',
    normalizeAdvances(on({ 2: 'b' }), 1, { 2: 'yes' })[2] === 3);
  ok('no requested map at all still produces defaults',
    same(normalizeAdvances(on({ 2: 'b' }), 1, undefined), { 2: 3 }));

  // Two runners asked to the same base — the trailing one must give way.
  const collide = normalizeAdvances(on({ 2: 'b', 3: 'c' }), 1, { 3: 3, 2: 3 });
  ok('two runners never share a base', collide[2] !== collide[3]);

  // Everyone can score at once, which is the one case where "sharing" is fine.
  const allHome = normalizeAdvances(b, 1, { 3: SCORED, 2: SCORED, 1: SCORED });
  ok('but any number may score together',
    allHome[3] === SCORED && allHome[2] === SCORED && allHome[1] === SCORED);
}

group('Nothing here crashes on a broken document');
{
  ok('no bases object', same(defaultAdvances(undefined, 1), {}));
  ok('no bases object, ambiguity', isAmbiguous(undefined, 1) === false);
  ok('normalize with no bases', same(normalizeAdvances(undefined, 1, { 2: 3 }), {}));
  ok('options with no bases', runnerOptions(undefined, 1).length === 0);
  ok('every option list is non-empty',
    runnerOptions(on({ 1: 'a', 2: 'b', 3: 'c' }), 1).every((o) => o.choices.length > 0));
  ok('every fallback is one of its own choices',
    runnerOptions(on({ 1: 'a', 2: 'b', 3: 'c' }), 2)
      .every((o) => o.choices.includes(o.fallback)));
}

group('Through the real engine');
{
  const lineup = ['p1', 'p2', 'p3', 'p4'].map((playerId, i) => ({ playerId, order: i + 1 }));
  const cfg = { homeLineup: lineup, awayLineup: lineup, homePitcher: 'x', awayPitcher: 'y' };
  const rules = { ...RULE_PRESETS.majors, maxRunsPerInning: null, maxRunsPerInningFinal: null };
  let seq = 0;
  const ev = (type, payload = {}) => ({ seq: ++seq, type, payload });

  /** Get a runner to third with nobody else on, then hit a single. */
  const toThird = [ev(EV.GAME_START), ev(EV.TRIPLE, { playerId: 'p1' })];

  const auto = reduce([...toThird, ev(EV.SINGLE, { playerId: 'p2' })], rules, cfg);
  ok('by default the runner on third scores on a single', auto.score.away === 1);
  ok('and the batter is on first', auto.bases[1] === 'p2');

  const held = reduce(
    [...toThird, ev(EV.SINGLE, { playerId: 'p2', advances: { 3: 3 } })], rules, cfg);
  ok('holding him at third scores nobody', held.score.away === 0);
  ok('he is still standing on third', held.bases[3] === 'p1');
  ok('and the batter still reached first', held.bases[1] === 'p2');

  // The RBI must follow the runs that actually scored, or the box score lies.
  ok('no run means no RBI', held._rbi === 0);
  ok('the automatic version credits one', auto._rbi === 1);

  // A forced runner cannot be held, even if the event says so.
  const forced = reduce(
    [ev(EV.GAME_START), ev(EV.SINGLE, { playerId: 'p1' }),
      ev(EV.SINGLE, { playerId: 'p2', advances: { 1: 1 } })], rules, cfg);
  ok('a runner on first is pushed off it by the batter', forced.bases[1] === 'p2');
  ok('and ends up on second', forced.bases[2] === 'p1');

  // An event with no advances key at all — every game recorded before this
  // shipped — must replay identically.
  const legacy = reduce(
    [...toThird, ev(EV.SINGLE, { playerId: 'p2' })], rules, cfg);
  ok('old events replay exactly as before', legacy.score.away === auto.score.away
    && legacy.bases[1] === auto.bases[1]);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
