/**
 * rosterStatus.test.js — Leaving a team is a state, not a deletion.
 */

import { isOnTeam, hasLeft, splitRoster, leftLabel } from '../src/shared/rosterStatus.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

console.log('\nWho counts as on the team');
{
  ok('active true is on the team', isOnTeam({ active: true }));
  // Every roster entry written before `active` existed has no field at all.
  ok('a missing flag is on the team', isOnTeam({ firstName: 'Jack' }));
  ok('active false has left', hasLeft({ active: false }) && !isOnTeam({ active: false }));
  ok('nothing is neither', !isOnTeam(null) && !hasLeft(null));
}

console.log('\nSplitting the roster');
{
  const { active, left } = splitRoster([
    { playerId: 'p1', firstName: 'Zoe', lastName: 'A', jerseyNumber: 12 },
    { playerId: 'p2', firstName: 'Jack', lastName: 'Miller', jerseyNumber: 4, active: false },
    { playerId: 'p3', firstName: 'Ann', lastName: 'B', jerseyNumber: 7 },
    { playerId: 'p4', firstName: 'Bo', lastName: 'C', jerseyNumber: 1, active: false },
  ]);
  ok('the squad is jersey order', active.map((p) => p.firstName).join(',') === 'Ann,Zoe');
  ok('former players are alphabetical', left.map((p) => p.firstName).join(',') === 'Bo,Jack');
  ok('nobody is in both', active.length === 2 && left.length === 2);
  ok('an empty roster splits cleanly',
    splitRoster(null).active.length === 0 && splitRoster(null).left.length === 0);
}

console.log('\nThe label under the name');
{
  ok('a bare state still reads', leftLabel({ active: false }) === 'Left the team');
  ok('a date is included when there is one',
    leftLabel({ active: false, leftAt: '2026-05-04' }).startsWith('Left the team · '));
  ok('an unreadable date degrades to the plain label',
    leftLabel({ active: false, leftAt: 'not a date' }) === 'Left the team');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
