/**
 * gameOutcome.test.js — Who won, and who gets confetti.
 *
 * The case worth testing hardest is the loss. Half of all games are losses and
 * half of those are children; a celebration firing on the wrong side of the
 * scoreboard is the single worst bug this feature could have.
 */

import {
  describeOutcome, deservesCelebration, outcomeHeadline,
} from '../src/shared/gameOutcome.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const final = (home, away) => ({ status: 'final', score: { home, away } });

group('Which side is us');
{
  const asHome = describeOutcome(final(7, 4), 'home');
  ok('home team reads its own score as us', asHome.us === 7 && asHome.them === 4);
  ok('and wins', asHome.result === 'win');

  const asAway = describeOutcome(final(7, 4), 'away');
  ok('away team reads the same game inverted', asAway.us === 4 && asAway.them === 7);
  ok('and loses', asAway.result === 'loss');

  ok('an unset side defaults to home rather than crashing',
    describeOutcome(final(7, 4), undefined).us === 7);
}

group('Results');
{
  ok('more runs is a win', describeOutcome(final(5, 2), 'home').result === 'win');
  ok('fewer runs is a loss', describeOutcome(final(2, 5), 'home').result === 'loss');
  ok('equal runs is a tie', describeOutcome(final(3, 3), 'home').result === 'tie');
  ok('margin is absolute', describeOutcome(final(2, 9), 'home').margin === 7);
  ok('a tie has no margin', describeOutcome(final(3, 3), 'home').margin === 0);
  ok('0-0 is a tie, not a loss', describeOutcome(final(0, 0), 'home').result === 'tie');
}

group('Only a finished win celebrates');
{
  ok('a finished win does', deservesCelebration(describeOutcome(final(6, 1), 'home')));

  // The three that must never throw confetti.
  ok('a loss does NOT', !deservesCelebration(describeOutcome(final(1, 6), 'home')));
  ok('a tie does NOT', !deservesCelebration(describeOutcome(final(4, 4), 'home')));
  ok('a game still in progress does NOT', !deservesCelebration(
    describeOutcome({ status: 'live', score: { home: 9, away: 0 } }, 'home')));

  ok('the away team winning the same game celebrates',
    deservesCelebration(describeOutcome(final(1, 6), 'away')));
  ok('no outcome at all does not crash', !deservesCelebration(null));
}

group('Headlines never taunt');
{
  ok('a win is announced', outcomeHeadline(describeOutcome(final(6, 1), 'home')) === 'WE WIN!');
  ok('a loss just states the fact',
    outcomeHeadline(describeOutcome(final(1, 6), 'home')) === 'FINAL');
  ok('a tie says so', outcomeHeadline(describeOutcome(final(2, 2), 'home')) === 'FINAL — TIE');
  ok('an unfinished game has no headline',
    outcomeHeadline(describeOutcome({ status: 'live', score: { home: 1, away: 0 } }, 'home')) === null);

  // Nothing in a loss or tie may read as congratulation or consolation.
  for (const [h, a] of [[1, 6], [0, 1], [2, 2], [0, 0]]) {
    const text = outcomeHeadline(describeOutcome(final(h, a), 'home')) || '';
    ok(`"${text}" carries no praise or pity at ${h}-${a}`,
      !/WIN|GREAT|NICE|SORRY|TOUGH|BETTER|LUCK/i.test(text));
  }
}

group('Junk state does not crash the end of a game');
{
  ok('no state at all', describeOutcome(undefined, 'home').result === 'tie');
  ok('no score object', describeOutcome({ status: 'final' }, 'home').us === 0);
  ok('non-numeric scores read as zero',
    describeOutcome({ status: 'final', score: { home: 'x', away: null } }, 'home').result === 'tie');
  ok('a missing status is not final', describeOutcome({ score: { home: 1, away: 0 } }).final === false);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
