/**
 * engine.test.js — Desk tests. No Firebase, no device, no emulator.
 * Run: node tests/engine.test.js
 */

import { EV, makeEvent, resetSeq } from '../src/sports/baseball/events.js';
import { reduce, undo, voidEvent } from '../src/sports/baseball/engine.js';
import { computeStats, mergeStats } from '../src/sports/baseball/stats.js';
import { resolveRules, RULE_PRESETS, restDaysFor } from '../src/sports/baseball/rules.js';

let passed = 0, failed = 0;
const results = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; results.push(`  ok   ${name}`); }
  else { failed++; results.push(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`); }
}
function section(t) { results.push(`\n${t}`); }

// --- Fixtures --------------------------------------------------------------

const away = ['a1','a2','a3','a4','a5','a6','a7','a8','a9'];
const home = ['h1','h2','h3','h4','h5','h6','h7','h8','h9'];
const lineup = (ids) => ids.map((playerId, i) => ({ playerId, order: i + 1, position: null }));

const config = {
  awayLineup: lineup(away),
  homeLineup: lineup(home),
  awayPitcher: 'a1',
  homePitcher: 'h1',
};

let seq = 0;
const ev = (type, payload = {}) => makeEvent(type, payload, { seq: seq++ });
const newGame = () => { seq = 0; resetSeq(); return [ev(EV.GAME_START)]; };

const RULES = resolveRules({}, 'kidPitch10U');
const UNCAPPED = resolveRules({ maxRunsPerInning: null, mercyRuleDifferential: null });

// ===========================================================================
section('Count logic');
// ===========================================================================
{
  const e = [...newGame(), ev(EV.BALL), ev(EV.BALL), ev(EV.BALL), ev(EV.BALL)];
  const s = reduce(e, RULES, config);
  check('4 balls = walk, batter on first', s.bases[1], 'a1');
  check('count resets after walk', [s.balls, s.strikes], [0, 0]);
}
{
  const e = [...newGame(), ev(EV.STRIKE_LOOKING), ev(EV.STRIKE_SWINGING), ev(EV.STRIKE_SWINGING)];
  const s = reduce(e, RULES, config);
  check('3 strikes = strikeout', s.outs, 1);
  check('bases stay empty on K', s.bases[1], null);
}
{
  const e = [...newGame(),
    ev(EV.STRIKE_LOOKING), ev(EV.STRIKE_SWINGING),
    ev(EV.FOUL), ev(EV.FOUL), ev(EV.FOUL)];
  const s = reduce(e, RULES, config);
  check('2-strike fouls do not add strikes', [s.strikes, s.outs], [2, 0]);
  check('fouls still count as pitches', s.pitchCounts['h1'], 5);
}

// ===========================================================================
section('Baserunning');
// ===========================================================================
{
  // Load the bases with walks, then walk in a run.
  const walk = () => [ev(EV.BALL), ev(EV.BALL), ev(EV.BALL), ev(EV.BALL)];
  const e = [...newGame(), ...walk(), ...walk(), ...walk(), ...walk()];
  const s = reduce(e, UNCAPPED, config);
  check('bases loaded then forced run', s.score.away, 1);
  check('runner from third scored', s.bases[3], 'a2');
}
{
  const e = [...newGame(),
    ev(EV.SINGLE), ev(EV.SINGLE), ev(EV.DOUBLE)];
  const s = reduce(e, UNCAPPED, config);
  // a1 to 1st; a2 singles -> a1 to 2nd, a2 to 1st; a3 doubles -> a1 scores, a2 to 3rd
  check('double drives in the lead runner', s.score.away, 1);
  check('trail runner to third', s.bases[3], 'a2');
  check('batter stands on second', s.bases[2], 'a3');
}
{
  const e = [...newGame(), ev(EV.SINGLE), ev(EV.SINGLE), ev(EV.SINGLE), ev(EV.HOME_RUN)];
  const s = reduce(e, UNCAPPED, config);
  check('grand slam scores four', s.score.away, 4);
  check('bases cleared after slam', [s.bases[1], s.bases[2], s.bases[3]], [null, null, null]);
}

// ===========================================================================
section('Half-inning and game boundaries');
// ===========================================================================
{
  const out = () => ev(EV.GROUND_OUT);
  const e = [...newGame(), out(), out(), out()];
  const s = reduce(e, RULES, config);
  check('three outs flips to bottom half', [s.inning, s.isTop, s.outs], [1, false, 0]);
  check('batter is now the home leadoff', s.batterId, 'h1');
}
{
  // 10U caps an inning at 5 runs.
  const e = [...newGame(),
    ev(EV.HOME_RUN), ev(EV.HOME_RUN), ev(EV.HOME_RUN),
    ev(EV.HOME_RUN), ev(EV.HOME_RUN), ev(EV.HOME_RUN)];
  const s = reduce(e, RULES, config);
  check('inning run cap enforced at 5', s.score.away, 5);
  check('run cap ends the half-inning', s.isTop, false);
}
{
  // Away scores 12 in the top of 4th -> mercy after the bottom half.
  const events = newGame();
  for (let inn = 1; inn <= 3; inn++) {
    for (let i = 0; i < 3; i++) events.push(ev(EV.GROUND_OUT)); // top
    for (let i = 0; i < 3; i++) events.push(ev(EV.GROUND_OUT)); // bottom
  }
  for (let i = 0; i < 12; i++) events.push(ev(EV.HOME_RUN));
  for (let i = 0; i < 3; i++) events.push(ev(EV.GROUND_OUT)); // top of 4th ends
  const mercyRules = resolveRules({ maxRunsPerInning: null }, 'kidPitch10U');

  const midInning = reduce(events, mercyRules, config);
  check('no mercy before the trailing team bats', midInning.status, 'live');

  for (let i = 0; i < 3; i++) events.push(ev(EV.GROUND_OUT)); // bottom of 4th
  const s = reduce(events, mercyRules, config);
  check('mercy rule ends the game', s.status, 'final');
  check('mercy recorded as the end reason', s.endReason, 'mercy');
}

// ===========================================================================
section('RBI derivation');
// ===========================================================================
{
  const e = [...newGame(), ev(EV.TRIPLE), ev(EV.SINGLE)];
  const s = reduce(e, UNCAPPED, config);
  check('single with a runner on third drives one in', s._rbi, 1);
}
{
  const e = [...newGame(), ev(EV.TRIPLE), ev(EV.REACHED_ON_ERROR)];
  const s = reduce(e, UNCAPPED, config);
  check('run scores on the error', s.score.away, 1);
  check('but no RBI is credited', s._rbi, 0);
}

// ===========================================================================
section('Undo and mid-log correction');
// ===========================================================================
{
  const e = [...newGame(), ev(EV.SINGLE), ev(EV.DOUBLE), ev(EV.HOME_RUN)];
  const full = reduce(e, UNCAPPED, config);
  const back = undo(e, UNCAPPED, config);
  check('full log scores three', full.score.away, 3);
  check('undo pops the last event', back.score.away, 0);
  check('undo restores runners', [back.bases[2], back.bases[3]], ['a2', 'a1']);
}
{
  // Fourth-inning discovery: that second-inning double was actually an error.
  const e = [...newGame(), ev(EV.DOUBLE), ev(EV.SINGLE), ev(EV.GROUND_OUT)];
  const before = reduce(e, UNCAPPED, config);
  const corrected = reduce(voidEvent(e, 1), UNCAPPED, config);
  check('original log has a runner in scoring position', before.bases[3], 'a1');
  // With the double voided, a1's single is now the first event of the game.
  check('voiding replays everything forward', corrected.bases[1], 'a1');
  check('batting order shifts back one slot', corrected.batterId, 'a3');
}

// ===========================================================================
section('Substitution');
// ===========================================================================
{
  const e = [...newGame(),
    ev(EV.SINGLE),
    ev(EV.SUBSTITUTION, { outPlayerId: 'a1', inPlayerId: 'a10', side: 'away' })];
  const s = reduce(e, UNCAPPED, config);
  check('courtesy runner replaces the runner on base', s.bases[1], 'a10');
  check('lineup slot updated', s.lineups.away[0].playerId, 'a10');
}

// ===========================================================================
section('Pitch counts');
// ===========================================================================
{
  // Scorekeeper taps outcomes directly instead of pitch-by-pitch.
  const e = [...newGame(), ev(EV.WALK), ev(EV.STRIKEOUT), ev(EV.SINGLE)];
  const s = reduce(e, UNCAPPED, config);
  check('walk backfills four pitches, K three, hit one', s.pitchCounts['h1'], 8);
}
{
  check('66 pitches at 10U = 4 rest days', restDaysFor(66, RULES), 4);
  check('20 pitches at 10U = 0 rest days', restDaysFor(20, RULES), 0);
}

// ===========================================================================
section('Derived stats');
// ===========================================================================
{
  // a1 bats four times: single, walk, home run, strikeout.
  const e = [...newGame(),
    ev(EV.SINGLE,     { playerId: 'a1' }),
    ev(EV.WALK,       { playerId: 'a1' }),
    ev(EV.HOME_RUN,   { playerId: 'a1' }),
    ev(EV.STRIKEOUT,  { playerId: 'a1' }),
  ];
  const st = computeStats(e, UNCAPPED, config);
  const b = st.batting['a1'];
  check('PA counted', b.PA, 4);
  check('AB excludes the walk', b.AB, 3);
  check('hits counted', b.H, 2);
  check('total bases: 1 + 4', b.TB, 5);
  check('AVG = 2/3', b.AVG, 0.667);
  check('OBP = 3/4', b.OBP, 0.75);
  check('SLG = 5/3', b.SLG, 1.667);
  check('OPS', b.OPS, 2.417);
}
{
  const e = [...newGame(),
    ev(EV.STRIKEOUT), ev(EV.STRIKEOUT), ev(EV.SINGLE), ev(EV.HOME_RUN), ev(EV.GROUND_OUT)];
  const st = computeStats(e, UNCAPPED, config);
  const p = st.pitching['h1'];
  check('batters faced', p.BF, 5);
  check('innings pitched notation', p.IP, '1.0');
  check('strikeouts', p.K, 2);
  check('earned runs', p.ER, 2);
  check('ERA over one inning', p.ERA, 18);
}
{
  // Runs after an error in the same half-inning are unearned.
  const e = [...newGame(), ev(EV.REACHED_ON_ERROR), ev(EV.HOME_RUN)];
  const st = computeStats(e, UNCAPPED, config);
  const p = st.pitching['h1'];
  check('runs charged', p.R, 2);
  check('but unearned after the error', p.ER, 0);
}

// ===========================================================================
section('Season merge');
// ===========================================================================
{
  const g1 = [...newGame(), ev(EV.SINGLE, { playerId: 'a1' }), ev(EV.GROUND_OUT, { playerId: 'a1' })];
  const s1 = computeStats(g1, UNCAPPED, config);
  seq = 0;
  const g2 = [...newGame(), ev(EV.DOUBLE, { playerId: 'a1' }), ev(EV.STRIKEOUT, { playerId: 'a1' })];
  const s2 = computeStats(g2, UNCAPPED, config);
  const season = mergeStats(s1, s2);
  const b = season.batting['a1'];
  check('merged AB', b.AB, 4);
  check('merged hits', b.H, 2);
  check('rate stats recomputed, not averaged', b.AVG, 0.5);
  check('merged total bases', b.TB, 3);
}

// ===========================================================================
section('Play-by-play');
// ===========================================================================
{
  const e = [...newGame(), ev(EV.TRIPLE), ev(EV.SINGLE)];
  const s = reduce(e, UNCAPPED, config);
  const last = s.playByPlay[s.playByPlay.length - 1];
  check('narration generated from the log', last.text, 'a2 singles, 1 run scores.');
}


// ===========================================================================
section('Earned runs on baserunning plays');
// ===========================================================================
{
  // A run that scores on a steal, wild pitch, passed ball, or balk is EARNED.
  // None of these is an error, and marking them unearned understates ERA.
  for (const [type, label] of [
    [EV.STOLEN_BASE, 'stolen base'],
    [EV.WILD_PITCH, 'wild pitch'],
    [EV.PASSED_BALL, 'passed ball'],
    [EV.BALK, 'balk'],
  ]) {
    seq = 0;
    const e = [...newGame(), ev(EV.TRIPLE), ev(type, { runners: [3] })];
    const s = reduce(e, UNCAPPED, config);
    const st = computeStats(e, UNCAPPED, config);
    check(`run scores on a ${label}`, s.score.away, 1);
    check(`and is charged as earned (${label})`, st.pitching['h1'].ER, 1);
  }
}
{
  // The exception still holds: after an error, later runs are unearned.
  seq = 0;
  const e = [...newGame(), ev(EV.REACHED_ON_ERROR), ev(EV.STOLEN_BASE, { runners: [1] }),
             ev(EV.STOLEN_BASE, { runners: [2] }), ev(EV.STOLEN_BASE, { runners: [3] })];
  const s = reduce(e, UNCAPPED, config);
  const st = computeStats(e, UNCAPPED, config);
  check('run still scores after an error', s.score.away, 1);
  check('but is unearned', st.pitching['h1'].ER, 0);
}


// ===========================================================================
section('Line score and errors');
// ===========================================================================
{
  seq = 0;
  const e = [...newGame(),
    ev(EV.HOME_RUN), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), // T1: 1 run
    ev(EV.HOME_RUN), ev(EV.HOME_RUN), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), // B1: 2
  ];
  const s = reduce(e, UNCAPPED, config);
  check('away runs by inning', s.lineScore.away, [1]);
  check('home runs by inning', s.lineScore.home, [2]);
  check('totals agree with the line score',
    [s.score.away, s.score.home],
    [s.lineScore.away.reduce((a, b) => a + b, 0), s.lineScore.home.reduce((a, b) => a + b, 0)]);
}
{
  seq = 0;
  const e = [...newGame(), ev(EV.REACHED_ON_ERROR)];
  const s = reduce(e, UNCAPPED, config);
  check('error charged to the fielding side', s.errors.home, 1);
  check('and not to the batting side', s.errors.away, 0);
}

// ===========================================================================
section('Reverse batting order each inning (t-ball)');
// ===========================================================================
{
  seq = 0;
  const R = resolveRules({ reverseBattingOrderEachInning: true, maxRunsPerInning: null }, 'tball');
  const e = [...newGame(),
    ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT),  // top 1
    ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT),  // bottom 1
  ];
  const s = reduce(e, R, config);
  check('second inning starts at the top of the reversed order', s.batterId, 'a9');
  check('order actually reversed', s.lineups.away[0].playerId, 'a9');
  check('and is renumbered', s.lineups.away[0].order, 1);
}
{
  // Without the rule, the order continues where it left off.
  seq = 0;
  const e = [...newGame(),
    ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT),
    ev(EV.GROUND_OUT), ev(EV.GROUND_OUT), ev(EV.GROUND_OUT),
  ];
  const s = reduce(e, UNCAPPED, config);
  check('normal order is preserved', s.lineups.away[0].playerId, 'a1');
}

// --- Report ----------------------------------------------------------------
console.log(results.join('\n'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
