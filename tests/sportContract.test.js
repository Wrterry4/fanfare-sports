/**
 * sportContract.test.js — What a sport must provide.
 *
 * The pack was described as swappable, but the shared screens had been reading
 * the baseball state shape directly — isTop, bases, battingIndex, pitchers —
 * and the notification function imported the baseball engine by name. This is
 * the guard that keeps that from creeping back: every registered sport must
 * export the full presenter surface, and every sport must appear in the
 * notify map.
 *
 * Basketball will fail this test until it implements the interface, which is
 * the intended way to find out what's missing.
 */

import * as baseball from '../src/sports/baseball/present.js';
import * as baseballNotify from '../src/sports/baseball/notify.js';
import * as basketball from '../src/sports/basketball/present.js';
import * as basketballNotify from '../src/sports/basketball/notify.js';
import { notifyPackFor, notifySportKeys } from '../src/sports/sportNotify.js';
import { reduce } from '../src/sports/baseball/engine.js';
import { buildGameConfig } from '../src/sports/baseball/config.js';
import { EV } from '../src/sports/baseball/events.js';
import { RULE_PRESETS } from '../src/sports/baseball/rules.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

/**
 * Every name the shared screens reach for on a sport pack.
 *
 * This list is the contract, and it is only as good as it is complete.
 * describeAdvancePrompt was added to both packs' present.js and to neither
 * pack's index.js, so `sport.describeAdvancePrompt` was undefined, the screen's
 * optional call quietly did nothing, and the feature was invisible with no
 * error anywhere. A name that isn't listed here isn't tested — so anything the
 * screen calls goes in this array.
 */
const PRESENTER = [
  'describePeriod', 'describeCounters', 'describePeriodScores',
  'describeParticipants', 'describeSubstitution', 'describeUpNext',
  'describeFeedEntry', 'describeStatLine', 'describeMoment',
  'describeAdvancePrompt',
];
const NOTIFY = ['isNotifiable', 'describePlay', 'describeGameStart'];

// The point of a contract test: it runs against every sport, so adding one
// tells you what's missing instead of letting it half-work.
const PACKS = { baseball, basketball };
const NOTIFY_PACKS = { baseball: baseballNotify, basketball: basketballNotify };

for (const [name, pack] of Object.entries(PACKS)) {
  group(`${name} implements the presenter interface`);
  for (const fn of PRESENTER) {
    ok(`exports ${fn}`, typeof pack[fn] === 'function');
  }
}

for (const [name, pack] of Object.entries(NOTIFY_PACKS)) {
  group(`${name} implements the notify interface`);
  for (const fn of NOTIFY) {
    ok(`exports ${fn}`, typeof pack[fn] === 'function');
  }
}

group('Every sport is reachable from the notify map');
{
  ok('baseball is registered', notifySportKeys().includes('baseball'));
  ok('basketball is registered', notifySportKeys().includes('basketball'));
  // Games written before `sport` existed carry no key at all.
  ok('an unknown sport falls back rather than throwing',
    typeof notifyPackFor(undefined).describePlay === 'function');
  ok('so does a sport that was never added',
    typeof notifyPackFor('quidditch').describePlay === 'function');
}

// ---- shapes the shared components depend on -------------------------------

const rules = RULE_PRESETS.kidPitch10U;
const config = buildGameConfig({
  homeOrAway: 'home',
  lineup: [{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'p3' }],
});
const people = {
  p1: { playerId: 'p1', firstName: 'Jack', lastName: 'Reyes', jerseyNumber: 7 },
  p2: { playerId: 'p2', firstName: 'Mia', lastName: 'Torres', jerseyNumber: 12 },
  p3: { playerId: 'p3', firstName: 'Sam', lastName: 'Ford', jerseyNumber: 3 },
};
const personFor = (id) => people[id] || null;
const started = reduce([{ seq: 1, type: EV.GAME_START, payload: {} }], rules, config);

group('describePeriod');
{
  const p = baseball.describePeriod(started);
  ok('labels the period', p.label === '1st');
  // The shared Scoreboard draws an arrow only when this is set.
  ok('reports a direction for a half-inning', p.direction === 'up');
  ok('not final', p.final === false);
}

group('describeCounters');
{
  const c = baseball.describeCounters(started);
  ok('three counters', c.length === 3);
  ok('each has a key, label, filled and total',
    c.every((x) => x.key && x.label && x.filled !== undefined && x.total !== undefined));
  ok('outs are flagged as dangerous', c.find((x) => x.key === 'outs').danger === true);
}

group('describePeriodScores');
{
  const g = baseball.describePeriodScores(started, rules);
  ok('one column per scheduled inning', g.columns === rules.inningsPerGame);
  ok('headers match the column count', g.headers.length === g.columns);
  ok('two rows', g.rows.length === 2);
  ok('cells match the column count', g.rows.every((r) => r.cells.length === g.columns));
  ok('totals are named, not assumed', g.totalColumns.join() === 'R,E');
  ok('each row supplies a value per total column',
    g.rows.every((r) => r.totals.length === g.totalColumns.length));
  ok('the away side is acting in the top half',
    g.rows.find((r) => r.active)?.side === 'away');
}

group('describeParticipants');
{
  const parts = baseball.describeParticipants(started, rules,
    { personFor, homeOrAway: 'home', canScore: true });
  ok('reports two participants', parts.length === 2);
  ok('every one has a key and a label', parts.every((p) => p.key && p.label));
  // Home team fields in the top of the first, so the pitcher is ours.
  ok('our pitcher is marked substitutable',
    parts.find((p) => p.key === 'pitching').substitutable === true);
  ok('the batter is not', parts.find((p) => p.key === 'batting').substitutable === false);
  // Baseball's cards open stats on tap — the engine already knows who's
  // batting, nobody has to pick them first — so this stays unset. If a
  // future baseball feature ever set it, every card would silently switch to
  // arm-a-player behavior and stats would stop being reachable from Game Day.
  ok('neither card claims to be a scoring picker',
    parts.every((p) => !p.selectableForScoring));
}
{
  // Batting in the bottom half: the pitcher is theirs and not ours to change.
  const away = buildGameConfig({ homeOrAway: 'away', lineup: [{ playerId: 'p1' }] });
  const s = reduce([{ seq: 1, type: EV.GAME_START, payload: {} }], rules, away);
  const parts = baseball.describeParticipants(s, rules,
    { personFor, homeOrAway: 'away', canScore: true });
  ok("the opponent's pitcher is not substitutable",
    parts.find((p) => p.key === 'pitching').substitutable === false);
}
{
  const parts = baseball.describeParticipants(started, rules,
    { personFor, homeOrAway: 'home', canScore: false });
  ok('a viewer who cannot score can substitute nobody',
    parts.every((p) => !p.substitutable));
}

group('describeSubstitution');
{
  const spec = baseball.describeSubstitution(started, rules, 'pitching',
    { personFor, homeOrAway: 'home' });
  ok('offers our lineup', spec.options.length === 3);
  ok('names the event to record', spec.event === EV.PITCHER_CHANGE);
  ok('every option carries a person', spec.options.every((o) => o.person));
  ok('and a detail line', spec.options.every((o) => o.detail));
  ok('a slot with no substitution returns null',
    baseball.describeSubstitution(started, rules, 'batting',
      { personFor, homeOrAway: 'home' }) === null);
}

group('describeUpNext');
{
  const slots = baseball.describeUpNext(started, { personFor, battingSide: 'home' });
  ok('two slots', slots.length === 2);
  ok('labelled for the sport', slots[0].label === 'ON DECK' && slots[1].label === 'IN THE HOLE');
  ok('an empty lineup yields no slots',
    baseball.describeUpNext(started, { personFor, battingSide: 'nope' }).length === 0);
}

group('The presenter trusts canScore completely, not its own status check');
{
  // Same bug as basketball's version — see the long comment there. A game
  // whose log is missing GAME_START has state.status stuck at 'pending'
  // forever; the pitcher card must still honor whatever the caller decided.
  const stuckState = reduce(
    [{ seq: 1, type: EV.SINGLE, payload: {} }], rules, config);
  ok('reproduces the bug: status never left pending even though the at-bat counted',
    stuckState.status === 'pending');

  const parts = baseball.describeParticipants(stuckState, rules,
    { personFor, homeOrAway: 'home', canScore: true });
  ok('the pitcher card is substitutable anyway',
    parts.find((p) => p.key === 'pitching').substitutable === true);
}

group('describeMoment — celebration banners');
{
  ok('a home run is a moment',
    baseball.describeMoment({ type: EV.HOME_RUN, payload: {} }, started, { personFor })?.tone === 'big');
  ok("a personalized home run includes the player's name",
    baseball.describeMoment(
      { type: EV.HOME_RUN, payload: { playerId: 'p1' } }, started,
      { personFor: () => ({ firstName: 'Jack' }) }
    ).text.includes('JACK'));
  ok('a strikeout is a moment', !!baseball.describeMoment({ type: EV.STRIKEOUT, payload: {} }, started, { personFor }));
  ok('an ordinary single is not', baseball.describeMoment({ type: EV.SINGLE, payload: {} }, started, { personFor }) === null);
  ok('a made-up event type is not', baseball.describeMoment({ type: 'NONSENSE', payload: {} }, started, { personFor }) === null);
}

group('Notifications describe the same play as before');
{
  // Away side, so OUR lineup bats in the top of the first and the batter is a
  // real player rather than an opponent placeholder.
  const game = { homeOrAway: 'away', opponent: 'Hawks', rulesSnapshot: rules,
                 lineup: [{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'p3' }] };
  const log = [{ seq: 1, type: EV.GAME_START, payload: {} }];
  ok('a called ball is not notifiable', !baseballNotify.isNotifiable(EV.BALL));
  ok('a single is', baseballNotify.isNotifiable(EV.SINGLE));
  ok('so is coming to the plate', baseballNotify.isNotifiable(EV.BATTER_UP));

  // Bottom of the first: our home lineup is batting.
  const hit = { seq: 2, type: EV.SINGLE, payload: {} };
  const play = baseballNotify.describePlay(hit, [...log, hit], game);
  ok('a hit produces a descriptor', !!play);
  if (play) {
    ok('naming a real player', play.playerId === 'p1');
    ok('gated on the result preference', play.preferenceKey === 'myPlayerResult');
    ok('with the old wording', play.body('Jack') === 'Jack singled');
    ok('and the matchup as the title',
      play.title('Jack', { matchup: 'Reds vs Hawks' }) === 'Reds vs Hawks');
  }
}
{
  // Home side batting in the top means the OPPONENT is at the plate.
  const game = { homeOrAway: 'home', opponent: 'Hawks', rulesSnapshot: rules, lineup: [] };
  const log = [{ seq: 1, type: EV.GAME_START, payload: {} }];
  const hit = { seq: 2, type: EV.SINGLE, payload: {} };
  const play = baseballNotify.describePlay(hit, [...log, hit], game);
  ok('nothing is sent for an opponent batter', play === null);
}

group('Engine and stats accept what the caller actually passes');
{
  /**
   * gameService calls reduce(events, rules, config, names) and
   * computeStats(events, rules, config). A pack whose signature disagrees
   * doesn't fail at import — it throws inside a Firestore snapshot callback,
   * so the screen sits on a spinner forever with nothing logged.
   *
   * Basketball's computeStats took (state, rules) and shipped that way. This
   * calls both functions the way the real caller does.
   */
  const packs = {
    baseball: {
      engine: await import('../src/sports/baseball/engine.js'),
      stats: await import('../src/sports/baseball/stats.js'),
      config: await import('../src/sports/baseball/config.js'),
      rules: (await import('../src/sports/baseball/rules.js')).DEFAULT_RULES,
      start: (await import('../src/sports/baseball/events.js')).EV.GAME_START,
    },
    basketball: {
      engine: await import('../src/sports/basketball/engine.js'),
      stats: await import('../src/sports/basketball/stats.js'),
      config: await import('../src/sports/basketball/config.js'),
      rules: (await import('../src/sports/basketball/rules.js')).DEFAULT_RULES,
      start: (await import('../src/sports/basketball/events.js')).EV.GAME_START,
    },
  };

  for (const [name, p] of Object.entries(packs)) {
    const cfg = p.config.buildGameConfig({
      homeOrAway: 'home',
      lineup: ['q1', 'q2', 'q3', 'q4', 'q5'].map((playerId) => ({ playerId })),
    });
    const log = [{ seq: 1, type: p.start, payload: {}, at: 0 }];

    let state = null, stats = null, err = null;
    try {
      // Exactly the call gameService makes.
      state = p.engine.reduce(log, p.rules, cfg, {});
      stats = p.stats.computeStats(log, p.rules, cfg);
    } catch (e) { err = e; }

    ok(`${name}: reduce(events, rules, config, names) works`, !!state && !err);
    ok(`${name}: computeStats(events, rules, config) works`, !!stats && !err);
    if (err) console.log(`       ${err.message}`);
    // An empty log must not throw either — that's every game before its first tap.
    let empty = null;
    try { empty = p.stats.computeStats([], p.rules, cfg); } catch (e) { empty = null; }
    ok(`${name}: an empty log produces stats rather than throwing`, empty !== null);
  }
}

group('A stale, wrong-sport snapshot degrades instead of crashing');
{
  /**
   * The bug that actually shipped -- twice. useGame keeps the previous
   * game's snapshot in state until a new subscription's first callback
   * arrives. Switching from a basketball game to a baseball one (or back)
   * means the NEW sport's presenter can briefly run against the OLD sport's
   * state. useGame.js clears the snapshot the instant the game identity
   * changes, which is the real fix -- but the first patch for this only
   * hardened describePeriodScores, the one function that happened to crash
   * first. describeParticipants crashed the exact same way two rounds later
   * (state.onCourt.slice on a baseball-shaped state, which has no onCourt at
   * all), because nothing forced every OTHER presenter function to be
   * checked too.
   *
   * So this doesn't call one function -- it calls every exported `describe*`
   * function each pack has, against the OTHER sport's state, and requires
   * every one to survive. Adding a new presenter function that reads a
   * sport-specific field without defaulting it will fail here
   * automatically, rather than waiting to be discovered live.
   */
  const basketballShaped = {
    status: 'live', period: 2, inning: 1, isTop: true, homeOrAway: 'home',
    score: { away: 10, home: 8 }, periodScores: { away: [10], home: [8] },
    onCourt: ['p1', 'p2'], bench: ['p3'], box: {}, fouls: {}, fouledOut: [],
    teamFouls: { home: [1], away: [0] },
  };
  const baseballShaped = {
    status: 'live', inning: 3, isTop: false, period: 1,
    score: { away: 2, home: 1 }, errors: { away: 0, home: 1 },
    lineScore: { away: [2], home: [1] },
    lineups: { home: [{ playerId: 'h1' }], away: [{ playerId: 'a1' }] },
    battingIndex: { home: 0, away: 0 },
    pitchers: { home: 'h1', away: 'a1' }, pitchCounts: {},
  };
  const personFor = (id) => (id ? { playerId: id, firstName: 'X', lastName: 'Y', jerseyNumber: 1 } : null);
  const args = { personFor, homeOrAway: 'home', canScore: true, battingSide: 'home' };

  const callEvery = (pack, state, label) => {
    const names = Object.keys(pack).filter((k) => k.startsWith('describe'));
    ok(`${label}: at least the known presenter functions are covered`, names.length >= 5);
    for (const name of names) {
      let threw = null;
      try {
        const fn = pack[name];
        // describeSubstitution genuinely takes a 4th argument (slotKey,
        // before the trailing options object); every other describe*
        // function takes (state, rules, extras) or (state, extras). Calling
        // it with the wrong shape throws on destructuring the missing
        // argument -- a test-harness mismatch, not the bug this test exists
        // to catch, so it gets its actual signature rather than the generic
        // one below.
        if (name === 'describeSubstitution') {
          fn(state, {}, 'pitching', args) ?? fn(state, {}, 'court0', args);
        } else {
          fn(state, {}, args) ?? fn(state, args);
        }
      } catch (e) { threw = e.message; }
      ok(`${label}: ${name} does not crash`, threw === null);
    }
  };

  callEvery(baseball, basketballShaped, "baseball's presenter, given basketball's state");
  callEvery(basketball, baseballShaped, "basketball's presenter, given baseball's state");
}

group('No shared code reaches into one sport');
{
  /**
   * The bug this catches, which shipped and crashed a basketball team:
   * useGameDay imported buildGameConfig and RULE_PRESETS straight from the
   * baseball pack, so a basketball game got baseball state and the first read
   * of state.periodScores.away threw. Four other files had the same leak.
   *
   * A source scan is crude but it catches the entire class, and the presenter
   * interface is worthless if callers can bypass it.
   */
  const { readdirSync, readFileSync, statSync } = await import('fs');
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');

  const root = fileURLToPath(new URL('../src', import.meta.url));
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // A pack may import itself; anything else may not.
        if (full.includes('/sports/baseball') || full.includes('/sports/basketball')) continue;
        walk(full);
        continue;
      }
      if (!/\.jsx?$/.test(entry)) continue;
      const src = readFileSync(full, 'utf8');
      for (const sport of ['baseball', 'basketball']) {
        if (src.includes(`sports/${sport}/`)) {
          offenders.push(`${full.replace(root, 'src')} imports ${sport} directly`);
        }
      }
    }
  };
  walk(root);

  ok('shared code goes through the registry, not a sport pack',
    offenders.length === 0);
  for (const o of offenders) console.log(`       ${o}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
