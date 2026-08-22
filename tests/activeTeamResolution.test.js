/**
 * activeTeamResolution.test.js — Which team is active, and when to guess.
 *
 * The bug: AsyncStorage (the stored team preference) and Firestore (the team
 * list) are two independent async operations with no ordering guarantee. On
 * a fresh launch the team list often arrives first — the old logic resolved
 * to teams[0], an arbitrary team, the instant that happened, even though the
 * REAL preference hadn't loaded yet. Several screens read the resolved team
 * without checking a loading flag, so the wrong team's name and content
 * would render for a moment before snapping to the right one.
 */

import { resolveActiveTeam } from '../src/shared/activeTeamResolution.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const teams = [{ id: 't1', name: 'Reds' }, { id: 't2', name: 'Blues' }];

group('The bug: team list arrives before the stored preference');
{
  // restored: false is exactly this window — AsyncStorage hasn't resolved,
  // but the Firestore team list already has.
  const result = resolveActiveTeam(teams, null, false);
  ok('resolves to nothing rather than guessing teams[0]', result === null);
}

group('Once restored, the stored preference wins');
{
  const result = resolveActiveTeam(teams, 't2', true);
  ok('the actually-active team is returned', result?.id === 't2');
}

group('A stored id for a team no longer on the list falls back');
{
  const result = resolveActiveTeam(teams, 'gone', true);
  ok('falls back to the first team once restored — this is a real fallback, not a guess made too early',
    result?.id === 't1');
}

group('No stored preference at all, but restored is true');
{
  const result = resolveActiveTeam(teams, null, true);
  ok('falls back to the first team', result?.id === 't1');
}

group('Edges');
ok('an empty team list returns null even when restored', resolveActiveTeam([], 't1', true) === null);
ok('undefined teams does not throw', resolveActiveTeam(undefined, 't1', true) === null);
ok('not restored with no teams at all is still null, not a throw',
  resolveActiveTeam(undefined, undefined, false) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
