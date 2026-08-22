/**
 * scheduleFilters.test.js — Upcoming/past split and calendar grouping.
 */

import { dateKey, splitUpcomingPast, groupEventsByDate } from '../src/shared/scheduleFilters.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const now = new Date('2026-08-16T12:00:00');
const ago = (days) => new Date(now.getTime() - days * 86400000);
const from = (days) => new Date(now.getTime() + days * 86400000);
const ev = (id, date, status = 'scheduled') => ({ id, date, status });

group('The basic split');
{
  const events = [ev('a', from(3)), ev('b', ago(3)), ev('c', from(1)), ev('d', ago(1))];
  const { upcoming, past } = splitUpcomingPast(events, now);
  ok('two land in each bucket', upcoming.length === 2 && past.length === 2);
  ok('upcoming is soonest first', upcoming.map((e) => e.id).join() === 'c,a');
  ok('past is most recent first', past.map((e) => e.id).join() === 'd,b');
}

group('A live game stays upcoming past its start time');
{
  const events = [ev('live', ago(1), 'live'), ev('done', ago(1), 'final')];
  const { upcoming, past } = splitUpcomingPast(events, now);
  ok('the live game is upcoming', upcoming.some((e) => e.id === 'live'));
  ok('the finished one is past', past.some((e) => e.id === 'done'));
}

group('A forgotten game is past, not upcoming');
{
  // Scheduled for yesterday, nobody tapped Start. The date has come and gone.
  const { past } = splitUpcomingPast([ev('missed', ago(1), 'scheduled')], now);
  ok('it lands in past, where a coach would notice it', past.length === 1);
}

group('Practices and misc events split the same way');
{
  const events = [
    { id: 'p1', date: from(2), status: undefined, type: 'practice' },
    { id: 'p2', date: ago(2), status: undefined, type: 'practice' },
  ];
  const { upcoming, past } = splitUpcomingPast(events, now);
  ok('future practice is upcoming', upcoming[0]?.id === 'p1');
  ok('past practice is past', past[0]?.id === 'p2');
}

group('dateKey is local, not UTC');
{
  // 9pm US-Central on the 15th should stay the 15th, not roll to UTC's 16th.
  const late = new Date(2026, 7, 15, 21, 0, 0);   // Aug 15, 9pm, local
  ok('the local calendar day is preserved', dateKey(late) === '2026-08-15');
}
ok('a Firestore-Timestamp-shaped object works', dateKey({ toDate: () => new Date(2026, 0, 5) }) === '2026-01-05');
ok('single digits are zero-padded', dateKey(new Date(2026, 0, 5)) === '2026-01-05');
ok('a missing date returns null rather than throwing', dateKey(null) === null);

group('Grouping by date, for the calendar');
{
  const events = [
    ev('a', new Date(2026, 7, 3, 9)),
    ev('b', new Date(2026, 7, 3, 18)),
    ev('c', new Date(2026, 7, 10, 9)),
  ];
  const byDate = groupEventsByDate(events);
  ok('two events share one day', byDate['2026-08-03']?.length === 2);
  ok('a different day gets its own key', byDate['2026-08-10']?.length === 1);
  ok('a day with nothing has no key at all', !('2026-08-04' in byDate));
}

group('Edges');
ok('an empty list splits into two empty lists',
  (() => { const { upcoming, past } = splitUpcomingPast([]); return upcoming.length === 0 && past.length === 0; })());
ok('undefined input does not throw', splitUpcomingPast(undefined).upcoming.length === 0);
ok('grouping an empty list returns an empty object', Object.keys(groupEventsByDate([])).length === 0);
ok('an event with no date is skipped, not crashed on', Object.keys(groupEventsByDate([{ id: 'x' }])).length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
