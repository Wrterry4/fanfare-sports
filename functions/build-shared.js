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
  { from: join(root, 'src/shared'), to: join(dest, 'common') },
];

if (existsSync(dest)) rmSync(dest, { recursive: true });

let count = 0;
for (const { from, to } of SOURCES) {
  mkdirSync(to, { recursive: true });
  for (const file of readdirSync(from)) {
    if (!file.endsWith('.js')) continue;
    copyFileSync(join(from, file), join(to, file));
    count++;
  }
}

console.log(`[build-shared] vendored ${count} modules into functions/shared/`);
