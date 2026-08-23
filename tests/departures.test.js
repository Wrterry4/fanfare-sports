/**
 * departures.test.js — Who else leaves when a player leaves.
 */

import { departingMembers, linkedTo, departurePrompt, keptForSiblings }
  from '../src/shared/departures.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

const M = (uid, role, displayName, linkedPlayerIds = []) =>
  ({ uid, role, displayName, linkedPlayerIds });

console.log('\nWho goes with the player');
{
  const members = [
    M('mom', 'parent', 'Dana', ['jack']),
    M('dad', 'parent', 'Ray', ['jack']),
    M('gran', 'fan', 'Pat', ['jack']),
    M('other', 'parent', 'Sam', ['maya']),
    M('coach', 'owner', 'Wallace', ['jack']),
  ];
  const out = departingMembers(members, 'jack');
  ok('everyone linked only to that player', out.length === 3);
  ok('a parent of a different child stays', !out.some((d) => d.uid === 'other'));
  // A roster edit must never be able to remove a coach.
  ok('staff are never removed', !out.some((d) => d.uid === 'coach'));
  ok('fans linked to that child are included', out.some((d) => d.uid === 'gran'));
  ok('sorted by name', out.map((d) => d.name).join() === 'Dana,Pat,Ray');
}

console.log('\nThe sibling case');
{
  // Removing a mother because her younger son left would cut her off from her
  // daughter. This is the bug the whole module exists to prevent.
  const members = [
    M('mom', 'parent', 'Dana', ['jack', 'maya']),
    M('dad', 'parent', 'Ray', ['jack']),
  ];
  const out = departingMembers(members, 'jack');
  ok('a parent with a sibling still here stays', out.length === 1 && out[0].uid === 'dad');
  ok('and is named as kept', keptForSiblings(members, 'jack').join() === 'Dana');
  ok('nobody is kept when there are no siblings',
    keptForSiblings([M('dad', 'parent', 'Ray', ['jack'])], 'jack').length === 0);
}

console.log('\nEdges');
{
  ok('no player, nobody to remove', departingMembers([M('a', 'parent', 'A', ['x'])], null).length === 0);
  ok('no members is not a crash', departingMembers(null, 'jack').length === 0);
  ok('a member with no links is untouched',
    departingMembers([M('a', 'parent', 'A')], 'jack').length === 0);
  ok('a nameless member still reads',
    departingMembers([M('a', 'parent', null, ['jack'])], 'jack')[0].name === 'A family member');
  ok('linkedTo returns everyone, staff included',
    linkedTo([M('c', 'coach', 'C', ['jack'])], 'jack').length === 1);
}

console.log('\nThe words in the dialog');
{
  // "Remove 2 people?" is a question nobody can answer without first working
  // out who they are.
  const one = departurePrompt('Jack', [{ name: 'Dana' }]);
  ok('one person is named in the title', one.title === 'Remove Dana too?');
  ok('and reads as singular', one.message.includes('Dana is on this team only for Jack'));

  const two = departurePrompt('Jack', [{ name: 'Dana' }, { name: 'Ray' }]);
  ok('two are joined with and', two.message.includes('Dana and Ray are'));

  const three = departurePrompt('Jack', [{ name: 'Dana' }, { name: 'Pat' }, { name: 'Ray' }]);
  ok('three use a comma list', three.message.includes('Dana, Pat and Ray'));
  ok('the title generalises past one', three.title === 'Remove their family too?');
  ok('a missing first name degrades',
    departurePrompt(null, [{ name: 'Dana' }]).message.includes('this player'));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
