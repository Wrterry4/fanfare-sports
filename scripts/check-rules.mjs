/**
 * check-rules.mjs — Every function a rules file calls is actually defined.
 *
 * The bug this catches, which shipped undetected: the RSVP rule called
 * `member(teamId)` and neither rules file defined it. A Firestore ruleset that
 * references an undefined function does not compile, so `firebase deploy
 * --only firestore:rules` rejected the whole file — meaning the rules running
 * in production were whatever last deployed successfully, and nobody could
 * tell from the source which that was.
 *
 * Rules aren't JavaScript and don't fail at the call site; they fail at deploy
 * or not at all. A syntax check you can run in a second is worth having in
 * front of a deploy that takes a minute to reject you.
 *
 * This is deliberately NOT a rules emulator test — `npm run test:rules` does
 * that and needs a running emulator. This only answers "would this compile",
 * which is the question that costs a deploy cycle to ask any other way.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILES = ['firestore.rules', 'firestore.rules.dev', 'storage.rules'];

/** Built into the rules language, so never declared in the file. */
const BUILTINS = new Set([
  'get', 'exists', 'existsAfter', 'getAfter', 'debug',
  'hasAny', 'hasAll', 'hasOnly', 'diff', 'affectedKeys', 'keys', 'values',
  'size', 'matches', 'split', 'join', 'lower', 'upper', 'trim', 'replace',
  'toSet', 'toUtf8', 'string', 'int', 'float', 'bool', 'timestamp', 'duration',
  'path', 'latlng', 'math', 'abs', 'ceil', 'floor', 'round', 'isEqual',
  'date', 'time', 'value', 'year', 'month', 'day', 'hours', 'minutes',
  'seconds', 'nanos', 'dayOfWeek', 'dayOfYear', 'toMillis', 'unique',
  'firestore', 'request', 'resource', 'in', 'is',
]);

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

/** Comments can contain anything that looks like code; strip them first. */
const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ');

console.log('\nEvery function a rules file calls is defined in it');

for (const file of FILES) {
  let src;
  try { src = strip(readFileSync(join(ROOT, file), 'utf8')); }
  catch { ok(`${file}: readable`, false); continue; }

  const defined = new Set(
    [...src.matchAll(/function\s+([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1])
  );

  // A call is a name followed by "(" that isn't the declaration itself and
  // isn't a method on something (those are builtins or field accesses).
  const called = new Set();
  for (const m of src.matchAll(/(^|[^.\w])([A-Za-z_]\w*)\s*\(/g)) {
    const name = m[2];
    if (BUILTINS.has(name)) continue;
    if (['if', 'return', 'allow', 'match', 'service', 'function'].includes(name)) continue;
    called.add(name);
  }

  const missing = [...called].filter((n) => !defined.has(n));
  ok(`${file}: ${defined.size} defined, ${called.size} called${
    missing.length ? ` — MISSING: ${missing.join(', ')}` : ''}`, missing.length === 0);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
