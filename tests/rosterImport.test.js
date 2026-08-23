/**
 * rosterImport.test.js — Importing a roster from another team you coach.
 *
 * The two rules that matter most here: the player's IDENTITY comes over (same
 * playerId, so career and parent links survive), and their jersey number does
 * not (it belongs to a season on a team, not to the child).
 */

import {
  importSourceTeams, buildImportRows, defaultSelection, importSelection, importSummary,
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
  ok('a team you only parent on is never a source', !out.some((t) => t.id === 'maya'));
  ok('teams you coach are offered', out.length === 1 && out[0].id === 'spring');

  const both = importSourceTeams(teams, roles, 'maya');
  ok('newest team first', both.map((t) => t.id).join(',') === 'fall,spring');
  ok('a missing role offers nothing', importSourceTeams(teams, {}, 'fall').length === 0);
  ok('a fan role offers nothing',
    importSourceTeams(teams, { spring: 'fan' }, 'fall').length === 0);
  ok('no teams is not a crash', importSourceTeams(null, null, null).length === 0);
}

console.log('\nWho is checked by default');
{
  const source = [P('p1', 'Jack', 'Miller', 12), P('p2', 'Maya', 'Ortiz', 4)];
  const rows = buildImportRows(source, []);
  ok('everyone is checked onto an empty roster', defaultSelection(rows).length === 2);
  ok('listed in last season\'s number order', rows.map((r) => r.firstName).join(',') === 'Maya,Jack');

  // Same identity, not a name match: this is the id, so it is exact.
  const withJack = buildImportRows(source, [P('p1', 'Jack', 'Miller', 9)]);
  const jack = withJack.find((r) => r.playerId === 'p1');
  ok('a player already on this roster is flagged', jack.alreadyOnRoster);
  ok('and starts unchecked', !jack.selected && !defaultSelection(withJack).includes('p1'));
  ok('the rest stay checked', defaultSelection(withJack).includes('p2'));

  const namesake = buildImportRows(source, [P('someone-else', 'Jack', 'Miller', 3)]);
  ok('a different child with the same name is still importable',
    !namesake.find((r) => r.playerId === 'p1').alreadyOnRoster);
}

console.log('\nIdentity comes over; the number does not');
{
  const rows = buildImportRows([P('p1', 'Jack', 'Miller', 12, 'SS')], []);
  const out = importSelection(rows, ['p1']);
  ok('the same playerId is imported', out[0].playerId === 'p1');
  ok('no jersey number is sent', !('jerseyNumber' in out[0]));
  ok('the old number is shown for recognition only', rows[0].formerJersey === 12);
  ok('position carries over as a starting point', out[0].primaryPosition === 'SS');
  ok('the name travels for the roster entry',
    out[0].firstName === 'Jack' && out[0].lastName === 'Miller');
}

console.log('\nWhat gets sent');
{
  const rows = buildImportRows(
    [P('p1', 'Jack', 'Miller', 12, 'SS'), P('p2', 'Maya', 'Ortiz', 4, 'P')], []);
  const out = importSelection(rows, ['p2']);
  ok('only checked players are sent', out.length === 1 && out[0].playerId === 'p2');
  ok('nothing checked sends nothing', importSelection(rows, []).length === 0);

  // Re-sending them would only blank the number they were just given here.
  const already = buildImportRows([P('p1', 'Jack', 'Miller', 12)], [P('p1', 'Jack', 'Miller', 7)]);
  ok('a player already here is never sent, even if checked',
    importSelection(already, ['p1']).length === 0);
}

console.log('\nSummary line');
{
  ok('singular', importSummary({ added: 1 }) === '1 player added');
  ok('plural', importSummary({ added: 3 }) === '3 players added');
  ok('failures are named',
    importSummary({ added: 2, failed: 1 }) === "2 players added · 1 couldn't be added");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
