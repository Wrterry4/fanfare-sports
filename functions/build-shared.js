/**
 * build-shared.js — Vendor the shared modules into functions/ before deploy.
 *
 * functions/index.js imports the engine from ../src/engine. That works locally
 * and fails in production: the Firebase CLI zips ONLY the functions directory,
 * so anything above it is silently absent at runtime.
 *
 * This copies the shared source into functions/shared/ so the deployed bundle
 * is self-contained. Wired to `predeploy` in firebase.json, so it can't be
 * forgotten. Same pattern as the build-shared step in Among Shadows.
 *
 * Run manually: node functions/build-shared.js
 */

import { readdirSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dest = join(here, 'shared');

const SOURCES = [
  { from: join(root, 'src/sports/baseball'), to: join(dest, 'baseball') },
  { from: join(root, 'src/sports/basketball'), to: join(dest, 'basketball') },
  { from: join(root, 'src/shared'), to: join(dest, 'common') },
];

/**
 * Single files, copied to the root of shared/.
 *
 * sportNotify.js resolves its packs as './baseball/notify.js', which only
 * works if it sits alongside the baseball folder — hence the root rather than
 * a sports/ subdirectory mirroring the source tree.
 *
 * The main registry is deliberately NOT copied: it re-exports .jsx components
 * through each pack's index, and only .js files reach the deployed bundle.
 */
const FILES = [
  { from: join(root, 'src/sports/sportNotify.js'), to: join(dest, 'sportNotify.js') },
  { from: join(root, 'src/sports/serverDispatch.js'), to: join(dest, 'serverDispatch.js') },
  // Same reason as sportNotify: a pack reaches it as '../pickPhrase.js', which
  // only resolves if it sits beside the pack folders. src/shared/ would have
  // been the obvious home, but that vendors to shared/common/ and the pack's
  // relative import would land on nothing in the deployed bundle.
  { from: join(root, 'src/sports/pickPhrase.js'), to: join(dest, 'pickPhrase.js') },
];

if (existsSync(dest)) rmSync(dest, { recursive: true });

let count = 0;
for (const { from, to } of SOURCES) {
  mkdirSync(to, { recursive: true });
  for (const file of readdirSync(from)) {
    if (!file.endsWith('.js')) continue;
    // A pack's index.js re-exports its .jsx components, which never reach the
    // bundle. Nothing server-side imports it, and shipping a module that
    // throws on import is a trap for whoever tries later.
    if (file === 'index.js') continue;
    copyFileSync(join(from, file), join(to, file));
    count++;
  }
}

for (const { from, to } of FILES) {
  copyFileSync(from, to);
  count++;
}

console.log(`[build-shared] vendored ${count} modules into functions/shared/`);
