/**
 * polls.test.js — A question with buttons, posted into team chat.
 */

import {
  newPoll, isClosed, myChoices, toggleChoice, tally, voteLabel, winner, MAX_OPTIONS,
} from '../src/shared/polls.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

console.log('\nBuilding a poll');
{
  const p = newPoll({ question: '  Saturday scrimmage? ', options: ['Yes', 'No', ''] });
  ok('the question is trimmed', p.question === 'Saturday scrimmage?');
  ok('empty options are dropped', p.options.length === 2);
  // Positional, so fixing a typo in a label never orphans the votes for it.
  ok('option ids are positional', p.options.map((o) => o.id).join(',') === 'opt-1,opt-2');
  ok('single choice by default', p.multi === false);
  ok('a new poll is open', p.closed === false && !isClosed(p));

  ok('a question is required', throws(() => newPoll({ question: '  ', options: ['a', 'b'] })));
  ok('one option is not a poll', throws(() => newPoll({ question: 'q?', options: ['only'] })));
  ok('too many options are capped',
    newPoll({ question: 'q?', options: Array.from({ length: 20 }, (_, i) => `o${i}`) })
      .options.length === MAX_OPTIONS);
}

console.log('\nClosing');
{
  const open = { closed: false, closesAt: null };
  ok('an open poll is open', !isClosed(open));
  ok('a coach closing it closes it', isClosed({ ...open, closed: true }));
  ok('a past deadline closes it',
    isClosed({ closed: false, closesAt: '2020-01-01' }, Date.parse('2026-01-01')));
  ok('a future deadline does not',
    !isClosed({ closed: false, closesAt: '2030-01-01' }, Date.parse('2026-01-01')));
  ok('a Firestore timestamp deadline works',
    isClosed({ closesAt: { toDate: () => new Date('2020-01-01') } }, Date.parse('2026-01-01')));
  ok('no poll is not closed', !isClosed(null));
}

console.log('\nTapping options');
{
  ok('picking one selects it', toggleChoice([], 'opt-1', false).join() === 'opt-1');
  // The complaint every poll without this gets.
  ok('tapping your own answer clears it', toggleChoice(['opt-1'], 'opt-1', false).length === 0);
  ok('single choice replaces', toggleChoice(['opt-1'], 'opt-2', false).join() === 'opt-2');
  ok('multi choice adds', toggleChoice(['opt-1'], 'opt-2', true).join() === 'opt-1,opt-2');
  ok('multi choice removes', toggleChoice(['opt-1', 'opt-2'], 'opt-1', true).join() === 'opt-2');
  ok('nothing selected is not a crash', toggleChoice(null, 'opt-1', true).join() === 'opt-1');
}

console.log('\nCounting');
{
  const poll = newPoll({ question: 'Which day?', options: ['Sat', 'Sun'] });
  const votes = [
    { id: 'u1', name: 'Ann', optionIds: ['opt-1'] },
    { id: 'u2', name: 'Bo', optionIds: ['opt-1'] },
    { id: 'u3', name: 'Cy', optionIds: ['opt-2'] },
    { id: 'u4', name: 'Di', optionIds: [] },          // opened it, didn't answer
  ];
  const { rows, voters } = tally(poll, votes);
  ok('an empty vote is not a voter', voters === 3);
  ok('counts are per option', rows[0].count === 2 && rows[1].count === 1);
  ok('percentages are of voters', rows[0].pct === 67 && rows[1].pct === 33);
  ok('the leader is marked', rows[0].leading && !rows[1].leading);
  // A count of five doesn't tell a coach which five to expect on Saturday.
  ok('names come with the count', rows[0].names.join(',') === 'Ann,Bo');
  ok('the winner is the single leader', winner(poll, votes).id === 'opt-1');

  const tied = [{ id: 'u1', optionIds: ['opt-1'] }, { id: 'u2', optionIds: ['opt-2'] }];
  ok('a tie has no winner', winner(poll, tied) === null);
  ok('no votes, no winner', winner(poll, []) === null);

  ok('my own picks come back', myChoices(votes, 'u3').join() === 'opt-2');
  ok('someone who never voted has none', myChoices(votes, 'nobody').length === 0);
}

console.log('\nMulti-choice sums past 100 on purpose');
{
  const poll = newPoll({ question: 'Which nights work?', options: ['Tue', 'Wed'], multi: true });
  const votes = [
    { id: 'u1', optionIds: ['opt-1', 'opt-2'] },
    { id: 'u2', optionIds: ['opt-1', 'opt-2'] },
  ];
  const { rows, voters } = tally(poll, votes);
  // "Both people can do both nights" is the answer a coach wants; normalising
  // against total picks would say 50% each and mean nothing.
  ok('two voters, both options at 100%',
    voters === 2 && rows[0].pct === 100 && rows[1].pct === 100);
}

console.log('\nEdges');
{
  const poll = newPoll({ question: 'q?', options: ['a', 'b'] });
  ok('a vote for a deleted option is ignored, not counted',
    tally(poll, [{ id: 'u1', optionIds: ['opt-9'] }]).rows.every((r) => r.count === 0));
  ok('no votes is zero, not NaN', tally(poll, []).rows[0].pct === 0);
  ok('no votes reads in words', voteLabel(0) === 'No votes yet');
  ok('one vote is singular', voteLabel(1) === '1 vote');
  ok('more are plural', voteLabel(4) === '4 votes');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
