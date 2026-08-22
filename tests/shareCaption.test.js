/**
 * shareCaption.test.js — What gets forwarded to grandparents.
 *
 * This text leaves the app and lands in group chats, so the loss case matters
 * more than the win case: it has to state the result without editorializing,
 * and the score has to stay honest.
 */

import { shareCaption, shareFileName } from '../src/shared/shareCaption.js';
import { describeOutcome } from '../src/shared/gameOutcome.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const final = (home, away) => ({ status: 'final', score: { home, away } });

group('The caption states the result');
{
  const win = shareCaption(describeOutcome(final(8, 3), 'home'), 'Wildcats', 'Hawks');
  ok('a win says so', win.headline === 'FINAL — WIN');
  ok('names both teams and both scores', win.line === 'Wildcats 8, Hawks 3');

  const loss = shareCaption(describeOutcome(final(3, 8), 'home'), 'Wildcats', 'Hawks');
  ok('a loss is plain FINAL', loss.headline === 'FINAL');
  ok('and reports the real score', loss.line === 'Wildcats 3, Hawks 8');

  ok('a tie says tie',
    shareCaption(describeOutcome(final(4, 4), 'home'), 'Wildcats', 'Hawks').headline === 'FINAL — TIE');
}

group('The score is never flattered');
{
  // Reversing us/them on a loss would make the card read as a win. It has to
  // match the scoreboard the parent just watched.
  const loss = shareCaption(describeOutcome(final(1, 9), 'home'), 'Wildcats', 'Hawks');
  ok('our score comes first even when losing', loss.line.startsWith('Wildcats 1'));
  ok('their score is not shrunk', loss.line.includes('Hawks 9'));

  const away = shareCaption(describeOutcome(final(1, 9), 'away'), 'Wildcats', 'Hawks');
  ok('the away team sees the same game from its own side', away.line === 'Wildcats 9, Hawks 1');
}

group('Nothing editorializes');
{
  for (const [h, a] of [[0, 12], [1, 2], [5, 5], [0, 0]]) {
    const { full } = shareCaption(describeOutcome(final(h, a), 'home'), 'Wildcats', 'Hawks');
    ok(`${h}-${a} carries no commentary`,
      !/tough|unlucky|next time|great|amazing|sorry|proud|almost/i.test(full));
  }
}

group('Missing pieces still produce something sendable');
{
  const noOpp = shareCaption(describeOutcome(final(5, 2), 'home'), 'Wildcats', null);
  ok('a missing opponent gets a neutral stand-in', noOpp.line === 'Wildcats 5, the opponent 2');
  const noTeam = shareCaption(describeOutcome(final(5, 2), 'home'), '', 'Hawks');
  ok('a missing team name does not render blank', noTeam.line.startsWith('Our team 5'));
  ok('no outcome at all still returns text', !!shareCaption(null, 'Wildcats', 'Hawks').full);
  ok('full joins headline and line', shareCaption(describeOutcome(final(1, 0), 'home'), 'A', 'B').full
    === 'FINAL — WIN\nA 1, B 0');
}

group('Filenames are safe everywhere');
{
  const d = new Date('2026-08-22T12:00:00Z');
  ok('slugs the team and dates the file',
    shareFileName('Ridgeview Reds', d) === 'ridgeview-reds-2026-08-22.png');
  ok('strips punctuation that breaks filesystems',
    !/[^a-z0-9\-.]/.test(shareFileName("O'Brien's 12U — A/B", d)));
  ok('no leading or trailing dashes before the date',
    !shareFileName('!!!Wildcats!!!', d).startsWith('-'));
  ok('an empty name still produces a file', shareFileName('', d) === 'game-2026-08-22.png');
  ok('a name of pure punctuation falls back', shareFileName('///', d).startsWith('game-'));
  ok('a long name is truncated', shareFileName('x'.repeat(200), d).length < 60);
  ok('an invalid date does not throw', !!shareFileName('Wildcats', new Date('nope')));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
