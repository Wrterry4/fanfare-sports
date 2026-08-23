/**
 * docIds.test.js — Document ids you can read.
 */

import { slug, dateKey, joinId, gameId, eventId, prefixedId, uniqueId }
  from '../src/shared/docIds.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

console.log('\nSlugs');
{
  ok('spaces become hyphens', slug('Northgate Fury') === 'northgate-fury');
  ok('accents are folded, not dropped', slug('Peñasco') === 'penasco');
  ok('punctuation collapses', slug("St. Mary's  (9U)!") === 'st-mary-s-9u');
  ok('no leading or trailing hyphen', slug('  --Reds--  ') === 'reds');
  ok('nothing in, nothing out', slug(null) === '' && slug('') === '');
  ok('long names are truncated cleanly',
    slug('a'.repeat(60)).length === 40 && !slug('x '.repeat(40)).endsWith('-'));
}

console.log("\nIds Firestore won't reject");
{
  // Slashes split paths; a bare dot is a path segment; __x__ is reserved.
  ok('no slashes survive', !slug('spring/fall').includes('/'));
  ok('a bare dot cannot be the whole id', slug('.') === '' && slug('..') === '');
  ok('reserved underscores are stripped', slug('__proto__') === 'proto');
}

console.log('\nDates');
{
  ok('a date reads as the day a coach would call it',
    dateKey(new Date(2026, 7, 22)) === '2026-08-22');
  ok('single digits are padded', dateKey(new Date(2026, 0, 5)) === '2026-01-05');
  ok('a Firestore timestamp works too',
    dateKey({ toDate: () => new Date(2026, 7, 22) }) === '2026-08-22');
  ok('an unparseable date falls back to today rather than "NaN-NaN"',
    /^\d{4}-\d{2}-\d{2}$/.test(dateKey('not a date')));
}

console.log('\nGames and events');
{
  ok('a home game names the opponent',
    gameId({ date: new Date(2026, 7, 22), opponent: 'Hurricanes' })
      === '2026-08-22-vs-hurricanes');
  ok('an away game says so',
    gameId({ date: new Date(2026, 7, 22), opponent: 'Hurricanes', homeOrAway: 'away' })
      === '2026-08-22-at-hurricanes');
  ok('an unnamed opponent still makes a usable id',
    gameId({ date: new Date(2026, 7, 22), opponent: '' }) === '2026-08-22-vs-tbd');
  ok('an event uses its title',
    eventId({ date: new Date(2026, 8, 1), title: 'Team photos' })
      === '2026-09-01-team-photos');
  ok('an untitled event falls back to its type',
    eventId({ date: new Date(2026, 8, 1), type: 'practice' }) === '2026-09-01-practice');
  ok('nothing to derive from returns null, it does not invent one',
    joinId('', null) === null);
}

console.log('\nPrefixed random ids');
{
  ok('the prefix says what it is', prefixedId('poll', () => 0.5).startsWith('poll-'));
  ok('six hex characters follow', /^poll-[0-9a-f]{6}$/.test(prefixedId('poll', () => 0.5)));
  ok('two calls differ', prefixedId('poll') !== prefixedId('poll'));
  ok('a messy prefix is slugged', prefixedId('Snack Signup', () => 0.1)
    .startsWith('snack-signup-'));
}

console.log('\nDoubleheaders');
{
  const existing = new Set(['2026-08-22-vs-hurricanes']);
  const taken = async (id) => existing.has(id);
  const run = async () => {
    ok('a free id is used as-is',
      await uniqueId('2026-08-23-vs-hurricanes', taken) === '2026-08-23-vs-hurricanes');
    ok('the second game of a doubleheader gets -2',
      await uniqueId('2026-08-22-vs-hurricanes', taken) === '2026-08-22-vs-hurricanes-2');

    existing.add('2026-08-22-vs-hurricanes-2');
    ok('and the third gets -3',
      await uniqueId('2026-08-22-vs-hurricanes', taken) === '2026-08-22-vs-hurricanes-3');
    ok('no base is no id', await uniqueId(null, taken) === null);

    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed ? 1 : 0);
  };
  run();
}
