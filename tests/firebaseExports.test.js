/**
 * firebaseExports.test.js — Every Firestore helper the app imports actually
 * exists on both platform shims.
 *
 * The bug this catches: membership.js imported and used `arrayRemove` for
 * unlinking a parent, but neither firebase.web.js nor firebase.js actually
 * re-exported it from the SDK — only its counterpart, arrayUnion, was listed.
 * Linking worked; unlinking silently called `undefined(...)` and threw
 * "(0,a.arrayRemove) is not a function" at the exact moment someone tapped
 * unlink, with no earlier signal anything was wrong. A missing export like
 * this doesn't fail at import time in JavaScript — it fails at the first call
 * site, which can be arbitrarily far from where the mistake was made.
 *
 * This can't run against the real SDK here (that requires a Firebase project
 * and app instance), so it checks source text directly: every name imported
 * `from '../services/firebase'` (or the platform-specific files themselves)
 * by any file in src/ must appear in each shim's own re-export list.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full, acc); continue; }
    if (/\.jsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

/** Names this file imports from the firebase shim, however it's written. */
function importedFirebaseNames(src) {
  const names = new Set();
  // import { a, b, c } from '...firebase' or '...firebase.web'
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*\/firebase(?:\.web)?['"]/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(' as ')[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** Names one of the shim files actually re-exports. */
function exportedNames(shimPath) {
  const src = readFileSync(shimPath, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(' as ').pop().trim();
      if (name) names.add(name);
    }
  }
  for (const m of src.matchAll(/export\s+(?:const|function)\s+(\w+)/g)) {
    names.add(m[1]);
  }
  return names;
}

const webShim = join(SRC, 'services', 'firebase.web.js');
const nativeShim = join(SRC, 'services', 'firebase.js');
const webExports = exportedNames(webShim);
const nativeExports = exportedNames(nativeShim);

console.log(`\nEvery firebase import used anywhere in src/ is actually exported`);

const allFiles = walk(SRC).filter(
  (f) => f !== webShim && f !== nativeShim);

let checkedAny = false;
for (const file of allFiles) {
  const src = readFileSync(file, 'utf8');
  if (!/from\s*['"][^'"]*\/firebase(?:\.web)?['"]/.test(src)) continue;
  const used = importedFirebaseNames(src);
  if (used.size === 0) continue;
  checkedAny = true;

  for (const name of used) {
    const rel = file.replace(SRC + '/', 'src/');
    ok(`${rel}: '${name}' is exported from firebase.web.js`, webExports.has(name));
    ok(`${rel}: '${name}' is exported from firebase.js`, nativeExports.has(name));
  }
}

ok('at least one real import site was actually checked', checkedAny);

// The exact regression: arrayRemove specifically, called out by name so this
// stays meaningful even if the generic scan above is ever loosened.
ok("arrayRemove is exported from firebase.web.js", webExports.has('arrayRemove'));
ok("arrayRemove is exported from firebase.js", nativeExports.has('arrayRemove'));
ok("arrayUnion is exported from firebase.web.js", webExports.has('arrayUnion'));
ok("arrayUnion is exported from firebase.js", nativeExports.has('arrayUnion'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
