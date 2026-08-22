/**
 * attendance.test.js — Counting who's coming.
 *
 * The bug these pin down: the header counted staff self-answers in the
 * maybe/out buckets but excluded them from "players in", so one coach marking
 * themselves Maybe rendered "0 players in · 1 maybe" — two populations, one
 * line. Every bucket now counts children, and staff are tallied separately.
 */

import { tallyRsvps, rosterAttendance, RSVP } from '../src/shared/eventTypes.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (name) => console.log(`\n${name}`);

const roster = [
  { playerId: 'p1', firstName: 'Jack', lastName: 'Reyes', jerseyNumber: 7 },
  { playerId: 'p2', firstName: 'Mia', lastName: 'Torres', jerseyNumber: 12 },
  { playerId: 'p3', firstName: 'Sam', lastName: 'Ford', jerseyNumber: 3 },
];

group('A coach answering for themselves is not a player');
{
  const c = tallyRsvps([{ id: 'u_coach1', status: RSVP.YES }]);
  ok('no players are counted in', c.yes === 0);
  ok('the coach lands in the staff bucket', c.staff.yes === 1);
}
{
  // The exact reported symptom: this used to read "0 players in · 1 maybe".
  const c = tallyRsvps([{ id: 'u_coach1', status: RSVP.MAYBE }]);
  ok('a staff maybe does not inflate the player maybe count', c.maybe === 0);
  ok('and is counted as staff instead', c.staff.maybe === 1);
}

group('Players move the count');
{
  const c = tallyRsvps([
    { id: 'p1', status: RSVP.YES },
    { id: 'p2', status: RSVP.YES },
    { id: 'p3', status: RSVP.NO },
    { id: 'u_coach1', status: RSVP.YES },
  ]);
  ok('two players in', c.yes === 2);
  ok('one player out', c.no === 1);
  ok('nobody counted twice', c.yes + c.maybe + c.no === 3);
  ok('the coach is tracked apart', c.staff.yes === 1);
  ok('players stays an alias of yes', c.players === c.yes);
}

group('Unknown statuses are ignored rather than crashing');
{
  const c = tallyRsvps([{ id: 'p1', status: 'perhaps' }, { id: 'p2' }]);
  ok('a garbage status counts nowhere', c.yes + c.maybe + c.no === 0);
}
ok('an empty list tallies to zero', tallyRsvps([]).yes === 0);
ok('a missing list does not throw', tallyRsvps(undefined).yes === 0);

group('The list a coach reads');
{
  const { groups, staff } = rosterAttendance(roster, [
    { id: 'p1', status: RSVP.YES },
    { id: 'p3', status: RSVP.NO },
    { id: 'u_coach1', status: RSVP.YES, name: 'Coach Dana' },
  ]);
  ok('the attending player is grouped in', groups[RSVP.YES][0].playerId === 'p1');
  ok('the absent player is grouped out', groups[RSVP.NO][0].playerId === 'p3');
  // The whole reason for one combined list.
  ok('the silent player is surfaced, not dropped', groups.none.length === 1);
  ok('and is identified by name', groups.none[0].name === 'Mia Torres');
  ok('jersey numbers come through', groups[RSVP.YES][0].jerseyNumber === 7);
  ok('staff are listed separately', staff.length === 1 && staff[0].name === 'Coach Dana');
  ok('staff carry their uid, not a player id', staff[0].uid === 'coach1');
}
{
  const { groups } = rosterAttendance(roster, []);
  ok('with no answers at all, everyone is unanswered', groups.none.length === 3);
}
{
  const { groups } = rosterAttendance([], [{ id: 'p1', status: RSVP.YES }]);
  ok('an rsvp for a player no longer rostered is not invented', groups[RSVP.YES].length === 0);
}
ok('an empty roster does not throw', rosterAttendance(undefined, undefined).groups.none.length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
