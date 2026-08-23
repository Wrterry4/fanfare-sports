/**
 * rosterImport.test.js — Copying a roster from another team you coach.
 */

import {
  importSourceTeams, buildImportRows, defaultSelection, importPayloads,
  importSummary, personKey,
} from '../src/shared/rosterImport.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

const P = (playerId, firstName, lastName, jerseyNumber = null, primaryPosition = null) =>
  ({ playerId, firstName, lastName, jerseyNumber, primaryPosition });

console.log('\nWhich teams are offered');
{
  const teams = [
    { id: 'spring', name: 'Spring Reds', createdAt: '2026-02-01' },
    { id: 'fall', name: 'Fall Reds', createdAt: '2026-08-01' },
    { id: 'maya', name: "Maya's team", createdAt: '2026-05-01' },
  ];
  const roles = { spring: 'coach', fall: 'owner', maya: 'parent' };

  const out = importSourceTeams(teams, roles, 'fall');
  ok('the team being imported into is excluded', !out.some((t) => t.id === 'fall'));
  ok('teams you only parent on are excluded', !out.some((t) => t.id === 'maya'));
  ok('teams you coach are offered', out.length === 1 && out[0].id === 'spring');

  const both = importSourceTeams(teams, roles, 'maya');
  ok('newest team first', both.map((t) => t.id).join(',') === 'fall,spring');
  ok('a missing role offers nothing', importSourceTeams(teams, {}, 'fall').length === 0);
  ok('no teams is not a crash', importSourceTeams(null, null, null).length === 0);
}

console.log('\nWho is checked by default');
{
  const source = [P('p1', 'Jack', 'Miller', 12), P('p2', 'Maya', 'Ortiz', 4)];
  const rows = buildImportRows(source, []);
  ok('everyone is checked onto an empty roster', defaultSelection(rows).length === 2);
  ok('sorted by jersey number', rows.map((r) => r.firstName).join(',') === 'Maya,Jack');

  const withJack = buildImportRows(source, [P('x', 'jack', ' MILLER ', 9)]);
  const jack = withJack.find((r) => r.firstName === 'Jack');
  ok('a player already on the roster is flagged', jack.alreadyOnRoster);
  ok('and starts unchecked', !jack.selected && !defaultSelection(withJack).includes('p1'));
  ok('the rest stay checked', defaultSelection(withJack).includes('p2'));
}

console.log('\nJersey numbers');
{
  const rows = buildImportRows([P('p1', 'Jack', 'Miller', 12)], [P('x', 'Sam', 'Diaz', 12)]);
  ok('a number worn on the new team is flagged', rows[0].jerseyTaken);
  ok('but the player is still checked', rows[0].selected);
  ok('and the number is dropped, not duplicated',
    importPayloads(rows, ['p1'])[0].jerseyNumber === null);

  // Same number twice inside one import collides just as badly.
  const twins = buildImportRows([P('p1', 'Jack', 'M', 12), P('p2', 'Ann', 'B', 12)], []);
  const out = importPayloads(twins, ['p1', 'p2']);
  ok('the first of two identical numbers keeps it', out[0].jerseyNumber === 12);
  ok('the second is cleared', out[1].jerseyNumber === null);
}

console.log('\nWhat gets written');
{
  const rows = buildImportRows(
    [P('p1', 'Jack', 'Miller', 12, 'SS'), P('p2', 'Maya', 'Ortiz', 4, 'P')], []);
  const out = importPayloads(rows, ['p2']);
  ok('only checked players are written', out.length === 1 && out[0].firstName === 'Maya');
  ok('position carries over', out[0].primaryPosition === 'P');
  ok('nothing checked writes nothing', importPayloads(rows, []).length === 0);
  ok('a nameless roster row is skipped',
    importPayloads(buildImportRows([P('p3', '', '')], []), ['p3']).length === 0);
}

console.log('\nSummary line');
{
  ok('singular', importSummary({ added: 1 }) === '1 player added');
  ok('plural with cleared numbers',
    importSummary({ added: 3, numbersCleared: 1 }) === '3 players added · 1 number cleared');
  ok('failures are named', importSummary({ added: 2, failed: 1 })
    === "2 players added · 1 couldn't be added");
}

console.log('\nName matching');
{
  ok('case and spacing are ignored', personKey({ firstName: ' Jack ', lastName: 'MILLER' })
    === personKey({ firstName: 'jack', lastName: 'miller' }));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
