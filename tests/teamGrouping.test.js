/**
 * teamGrouping.test.js — The team switcher, grouped by child.
 */

import { groupTeamsByPlayer, groupingIsUseful, UNLINKED_KEY }
  from '../src/shared/teamGrouping.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

const T = (id, name) => ({ id, name, season: 'Fall 2026' });
const seminoles = T('t1', '5U Seminoles');
const fury = T('t2', 'Northgate Fury');
const rec = T('t3', 'Rec League Reds');

console.log('\nOne parent, two kids, two teams');
{
  const g = groupTeamsByPlayer([seminoles, fury], {
    t1: [{ playerId: 'p1', firstName: 'Jack' }],
    t2: [{ playerId: 'p2', firstName: 'Maya' }],
  });
  ok('two groups', g.length === 2);
  ok('sorted alphabetically by child', g[0].label === 'Jack' && g[1].label === 'Maya');
  ok("Jack's group holds his team", g[0].teams[0].id === 't1');
  ok("Maya's group holds hers", g[1].teams[0].id === 't2');
}

console.log('\nSiblings on the same team');
{
  const g = groupTeamsByPlayer([seminoles], {
    t1: [{ playerId: 'p1', firstName: 'Jack' }, { playerId: 'p2', firstName: 'Maya' }],
  });
  // Picking one sibling to hide would be arbitrary.
  ok('the team appears under both children', g.length === 2
    && g[0].teams[0].id === 't1' && g[1].teams[0].id === 't1');
}

console.log('\nOne child on two teams');
{
  const g = groupTeamsByPlayer([seminoles, rec], {
    t1: [{ playerId: 'p1', firstName: 'Jack' }],
    t3: [{ playerId: 'p1', firstName: 'Jack' }],
  });
  ok('one group', g.length === 1);
  ok('holding both teams', g[0].teams.length === 2);
  ok('grouping still earns its place', groupingIsUseful(g));
}

console.log('\nCoaching a team with no child of your own');
{
  const g = groupTeamsByPlayer([seminoles, fury],
    { t1: [{ playerId: 'p1', firstName: 'Jack' }] },
    { t2: 'coach' });
  ok('the unlinked team is separated', g.length === 2);
  ok('and comes last', g[1].key === UNLINKED_KEY);
  ok('labelled for a coach', g[1].label === 'Also coaching');
}

console.log('\nA scorekeeper is not told they are coaching');
{
  const g = groupTeamsByPlayer([fury], {}, { t2: 'scorekeeper' });
  ok('neutral label instead', g[0].label === 'Other teams');
}

console.log('\nWhen grouping would be noise');
{
  const one = groupTeamsByPlayer([seminoles], { t1: [{ playerId: 'p1', firstName: 'Jack' }] });
  ok('one child, one team needs no headings', !groupingIsUseful(one));
  const none = groupTeamsByPlayer([seminoles], {});
  ok('a lone unlinked team needs none either', !groupingIsUseful(none));
}

console.log('\nEdges');
ok('no teams yields no groups', groupTeamsByPlayer([], {}).length === 0);
ok('undefined input does not throw', groupTeamsByPlayer(undefined, undefined).length === 0);
{
  const g = groupTeamsByPlayer([seminoles], { t1: [{ playerId: 'p1' }] });
  ok('a child with no first name still groups', g[0].label === 'Your player');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
