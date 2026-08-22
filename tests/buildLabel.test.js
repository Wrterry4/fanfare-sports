/**
 * buildLabel.test.js — What Settings shows for the app version.
 */

import { formatBuildLabel } from '../src/shared/buildLabel.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const now = new Date('2026-08-20T12:00:00Z');

group('The committed placeholder — nobody has built yet');
{
  const label = formatBuildLabel({ version: '0.0.0', builtAt: null, commit: null }, now);
  ok('shows the version', label.includes('0.0.0'));
  ok('says unbuilt rather than a fake date', label.includes('unbuilt'));
}

group('A real build, same year');
{
  const label = formatBuildLabel(
    { version: '0.1.0', builtAt: '2026-08-20T18:42:00.000Z', commit: '342c116' }, now);
  ok('includes the version', label.includes('0.1.0'));
  ok('includes the commit', label.includes('342c116'));
  ok('does not repeat the current year — redundant when it is this year',
    !label.includes('2026'));
}

group('A real build from a previous year shows the year');
{
  const label = formatBuildLabel(
    { version: '0.1.0', builtAt: '2025-01-05T18:42:00.000Z', commit: 'abc1234' }, now);
  ok('the year is shown so an old build cannot be mistaken for a fresh one',
    label.includes('2025'));
}

group('A build with no commit available');
{
  // git might not be present in every environment this ever runs in.
  const label = formatBuildLabel({ version: '0.1.0', builtAt: '2026-08-20T18:42:00.000Z', commit: null }, now);
  ok('still shows a real build time', label.includes('built'));
  ok('does not show a stray separator with nothing after it', !label.trim().endsWith('·'));
}

group('Edges');
ok('a garbage timestamp falls back to unbuilt rather than "Invalid Date"',
  !formatBuildLabel({ version: '0.1.0', builtAt: 'not a date' }, now).includes('Invalid'));
ok('a completely missing buildInfo does not throw', formatBuildLabel(null, now).includes('0.0.0'));
ok('undefined does not throw', formatBuildLabel(undefined, now).includes('unbuilt'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
