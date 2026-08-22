/**
 * functionsLoad.test.js — The deployment must load.
 *
 * Regression guard for the ESM hoisting bug: index.js called initializeApp()
 * in its own body while re-exporting modules that called getFirestore() at
 * their top level. Imports are hoisted, so those modules evaluated first and
 * the entire deployment failed to load — every callable returned `internal`
 * and no trigger ever fired.
 *
 * A unit test can't catch that; only actually importing the entrypoint can.
 * Skips itself when functions/node_modules isn't installed, so `npm test`
 * still runs clean on a fresh clone.
 */

import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const functionsDir = join(here, '..', 'functions');

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

console.log('\nThe functions entrypoint loads');

if (!existsSync(join(functionsDir, 'node_modules'))) {
  console.log('  skip  functions/node_modules absent — run: npm install --prefix functions');
  console.log('\n0 passed, 0 failed');
  process.exit(0);
}
if (!existsSync(join(functionsDir, 'shared'))) {
  console.log('  skip  functions/shared absent — run: node functions/build-shared.js');
  console.log('\n0 passed, 0 failed');
  process.exit(0);
}

process.env.GOOGLE_CLOUD_PROJECT ||= 'fanfare-sports';

// Every callable and trigger the app actually invokes. If the module graph
// throws on load, this import rejects and all of them are dead at once.
const EXPECTED = [
  'assignGuardian', 'requestPlayerClaim', 'resolvePlayerClaim',
  'sendTestNotification', 'notifyScoringPlay', 'notifyGameStatus',
  'notifyTeamMessage', 'notifyDirectMessage',
  'createTeam', 'createPlayer', 'finalizeGame', 'redeemInvite',
];

try {
  const mod = await import(pathToFileURL(join(functionsDir, 'index.js')).href);
  ok('index.js evaluates without throwing', true);
  for (const name of EXPECTED) {
    ok(`exports ${name}`, typeof mod[name] !== 'undefined');
  }
} catch (e) {
  ok(`index.js evaluates without throwing — ${e.message}`, false);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
