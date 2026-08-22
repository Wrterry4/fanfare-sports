/**
 * pushEligibility.test.js — When the post-install notification prompt shows.
 */

import { isEligibleForPostInstallPrompt } from '../src/shared/pushEligibility.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

group('The one case that should show it');
ok('installed, supported, never asked',
  isEligibleForPostInstallPrompt({ installed: true, supported: true, permission: 'default' }));

group('Already decided — showing again would be nagging');
{
  ok('already granted', !isEligibleForPostInstallPrompt(
    { installed: true, supported: true, permission: 'granted' }));
  ok('already denied — a re-ask does nothing on iOS anyway', !isEligibleForPostInstallPrompt(
    { installed: true, supported: true, permission: 'denied' }));
}

group('Not actually possible yet');
{
  ok('not installed — this is the whole point, alerts cannot work yet',
    !isEligibleForPostInstallPrompt({ installed: false, supported: true, permission: 'default' }));
  ok('browser does not support push at all',
    !isEligibleForPostInstallPrompt({ installed: true, supported: false, permission: 'default' }));
}

group('Edges');
ok('everything missing is not eligible', !isEligibleForPostInstallPrompt({}));
ok('a garbage permission string is not eligible',
  !isEligibleForPostInstallPrompt({ installed: true, supported: true, permission: 'unsupported' }));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
