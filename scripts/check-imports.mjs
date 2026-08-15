/**
 * check-imports.mjs — Catch identifiers used but never imported.
 *
 * This is the bug class behind the Settings crash: a scripted edit targeted a
 * multi-line import block, the file had it on one line, the replacement
 * silently matched nothing, and four imports were never added. Everything
 * still parsed — the failure only appeared when the screen rendered.
 *
 * Checks anything that looks like a component (<Foo) or a hook (useFoo(),
 * called at the top level of a component) against what the file imports or
 * defines.
 *
 * Run: node scripts/check-imports.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUILTIN_HOOKS = new Set([
  'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext',
  'useReducer', 'useLayoutEffect', 'useImperativeHandle', 'useDebugValue',
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.jsx') || p.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const scrub = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '');

const files = [...walk('src'), 'App.jsx'];
const problems = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const src = scrub(raw);

  const known = new Set();
  // Everything this file imports.
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    for (const w of m[1].match(/\w+/g) || []) known.add(w);
  }
  // Everything it declares.
  for (const m of src.matchAll(/(?:function|const|let|var|class)\s+(\w+)/g)) known.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const w of m[1].match(/\w+/g) || []) known.add(w);
  }
  for (const m of src.matchAll(/(?:const|let|var)\s*\[([^\]]*)\]/g)) {
    for (const w of m[1].match(/\w+/g) || []) known.add(w);
  }
  // Array patterns in parameter position: .map(([name, Icon, Component]) => ...)
  // Without this, anything destructured from a tuple looks unimported.
  for (const m of src.matchAll(/\(\s*\[([^\]]*)\]\s*\)\s*=>/g)) {
    for (const w of m[1].match(/\w+/g) || []) known.add(w);
  }

  // Components rendered in JSX.
  for (const m of src.matchAll(/<([A-Z]\w*)/g)) {
    if (!known.has(m[1])) problems.push(`${file}: <${m[1]}> is used but never imported`);
  }
  // Hooks called.
  for (const m of src.matchAll(/(?<![\w.])(use[A-Z]\w*)\s*\(/g)) {
    const name = m[1];
    if (BUILTIN_HOOKS.has(name) || known.has(name)) continue;
    problems.push(`${file}: ${name}() is called but never imported`);
  }
}

if (problems.length) {
  console.error('MISSING IMPORTS:\n' + [...new Set(problems)].map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`checked ${files.length} files — no missing imports`);
