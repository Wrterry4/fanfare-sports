/**
 * scoringModes.test.js
 * Run: node tests/scoringModes.test.js
 */

import {
  SCORING_MODES, CONTROL_GROUPS, getVisibleControls, showsPitchEntry,
  weArePitching, estimateTaps, tapReduction, MODE_TRADEOFFS,
} from '../src/sports/baseball/scoringModes.js';
import { EV } from '../src/sports/baseball/events.js';
import { reduce } from '../src/sports/baseball/engine.js';
import { computeStats } from '../src/sports/baseball/stats.js';
import { makeEvent } from '../src/sports/baseball/events.js';
import { resolveRules } from '../src/sports/baseball/rules.js';

let passed = 0, failed = 0;
const out = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; out.push(`  ok   ${name}`); }
  else { failed++; out.push(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`); }
}

out.push('\nWhich half-inning are we in the field');
check('home team fields in the top', weArePitching(true, 'home'), true);
check('home team bats in the bottom', weArePitching(false, 'home'), false);
check('away team fields in the bottom', weArePitching(false, 'away'), true);
check('away team bats in the top', weArePitching(true, 'away'), false);

out.push('\nControl visibility');
{
  const full = getVisibleControls(SCORING_MODES.FULL, false);
  check('full mode always shows pitch entry',
    !!full[CONTROL_GROUPS.PITCH], true);

  const casualBatting = getVisibleControls(SCORING_MODES.CASUAL, false);
  check('casual mode hides pitch entry while we bat',
    casualBatting[CONTROL_GROUPS.PITCH], undefined);
  check('but keeps outcome buttons',
    casualBatting[CONTROL_GROUPS.ON_BASE].includes(EV.SINGLE), true);
  check('and out buttons',
    casualBatting[CONTROL_GROUPS.OUT].includes(EV.STRIKEOUT), true);

  const casualFielding = getVisibleControls(SCORING_MODES.CASUAL, true);
  check('casual mode KEEPS pitch entry while our pitcher works',
    !!casualFielding[CONTROL_GROUPS.PITCH], true);
  check('because rest days depend on the count',
    showsPitchEntry(SCORING_MODES.CASUAL, true), true);
}

out.push('\nTap load');
{
  const full = estimateTaps(SCORING_MODES.FULL);
  const casual = estimateTaps(SCORING_MODES.CASUAL);
  check('full mode is a lot of tapping', full.total, 384);
  // Not the ~70% that dropping pitch entry outright would give: outcome taps
  // are unchanged, and we still log every pitch our own pitcher throws.
  check('casual mode lands at 232 taps', casual.total, 232);
  check('a real reduction of 40 percent', tapReduction(), 40);
  check('outcome taps are unchanged', casual.outcomes, full.outcomes);
  check('pitch taps are halved', casual.pitches, full.pitches / 2);
}

out.push('\nCasual mode costs no stats that matter');
{
  const RULES = resolveRules({ maxRunsPerInning: null });
  const lineup = (ids) => ids.map((playerId, i) => ({ playerId, order: i + 1 }));
  const config = {
    awayLineup: lineup(['a1', 'a2', 'a3']),
    homeLineup: lineup(['h1', 'h2', 'h3']),
    awayPitcher: 'a1', homePitcher: 'h1',
  };

  // Same at-bat, logged two ways: pitch-by-pitch, and outcome-only.
  let s1 = 0;
  const detailed = [
    makeEvent(EV.GAME_START, {}, { seq: s1++ }),
    makeEvent(EV.BALL, {}, { seq: s1++ }),
    makeEvent(EV.STRIKE_LOOKING, {}, { seq: s1++ }),
    makeEvent(EV.FOUL, {}, { seq: s1++ }),
    makeEvent(EV.SINGLE, { playerId: 'a1' }, { seq: s1++ }),
    makeEvent(EV.BALL, {}, { seq: s1++ }),
    makeEvent(EV.BALL, {}, { seq: s1++ }),
    makeEvent(EV.HOME_RUN, { playerId: 'a2' }, { seq: s1++ }),
  ];

  let s2 = 0;
  const casual = [
    makeEvent(EV.GAME_START, {}, { seq: s2++ }),
    makeEvent(EV.SINGLE, { playerId: 'a1' }, { seq: s2++ }),
    makeEvent(EV.HOME_RUN, { playerId: 'a2' }, { seq: s2++ }),
  ];

  const d = computeStats(detailed, RULES, config);
  const c = computeStats(casual, RULES, config);

  check('same hits', [d.batting.a1.H, c.batting.a1.H], [1, 1]);
  check('same RBI', [d.batting.a2.RBI, c.batting.a2.RBI], [2, 2]);
  check('same AVG', d.batting.a1.AVG, c.batting.a1.AVG);
  check('same SLG', d.batting.a2.SLG, c.batting.a2.SLG);
  check('same score', reduce(detailed, RULES, config).score.away,
                      reduce(casual, RULES, config).score.away);

  // The one real difference.
  const dPitches = d.pitching.h1.pitches;
  const cPitches = c.pitching.h1.pitches;
  check('detailed logging captures more pitches', dPitches > cPitches, true);
  check('casual still counts the ball put in play', cPitches, 2);

  // Engine needs no branch for any of this.
  check('the event log has the same shape either way',
    casual.every(e => typeof e.type === 'string' && 'payload' in e), true);
}

out.push('\nTradeoffs are stated, not implied');
check('both modes keep the rate stats',
  MODE_TRADEOFFS[SCORING_MODES.CASUAL].keeps.includes('AVG / OBP / SLG / OPS'), true);
check('casual mode names what it costs',
  MODE_TRADEOFFS[SCORING_MODES.CASUAL].loses.length > 0, true);
check('full mode costs nothing but effort',
  MODE_TRADEOFFS[SCORING_MODES.FULL].loses.length, 0);

console.log(out.join('\n'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
