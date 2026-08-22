/**
 * check-hooks.mjs — Hooks must not follow an early return.
 *
 * The bug this exists for reached production: GameDayScreen returned a
 * spinner while `state` was still null, and a useMemo sat below that return.
 * On the first render the hook never ran; on the second it did. React counts
 * hooks per render and threw #310 — "Rendered more hooks than during the
 * previous render" — which surfaces as a blank error screen, not a warning.
 *
 * Nothing else in the toolchain catches it. The test suite doesn't render
 * components, and esbuild only parses. This is a source scan, deliberately
 * crude: it flags any hook call that appears after a top-level early return
 * inside a component, which is exactly the shape of the failure.
 *
 * A false positive means moving a hook up, which is where it belonged anyway.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../src', import.meta.url));

const HOOK = /\b(use[A-Z]\w*)\s*\(/;
const COMPONENT = /^(export default )?function [A-Z]/;
// Two-space indent means top level of the component body.
const EARLY_RETURN = /^ {2}(if \(.*\) return |return null;)/;

const offenders = [];

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { scan(full); continue; }
    if (!/\.jsx?$/.test(entry)) continue;

    const lines = readFileSync(full, 'utf8').split('\n');
    let inComponent = false;
    let returnAt = null;

    lines.forEach((line, i) => {
      if (COMPONENT.test(line)) { inComponent = true; returnAt = null; return; }
      if (!inComponent) return;

      const code = line.trim();
      if (code.startsWith('//') || code.startsWith('*')) return;

      if (EARLY_RETURN.test(line)) { returnAt = i + 1; return; }

      if (returnAt && HOOK.test(line)) {
        offenders.push({
          file: relative(ROOT, full),
          hook: i + 1,
          ret: returnAt,
          text: code.slice(0, 60),
        });
        returnAt = null;   // one report per return is enough
      }
    });
  }
}

scan(ROOT);

if (offenders.length) {
  console.error('HOOKS AFTER AN EARLY RETURN:');
  for (const o of offenders) {
    console.error(`  src/${o.file}:${o.hook} — runs only when line ${o.ret} does not return`);
    console.error(`    ${o.text}`);
  }
  console.error('\nMove these above the early return. React counts hooks per render.');
  process.exit(1);
}

console.log('checked components — no hooks after an early return');
