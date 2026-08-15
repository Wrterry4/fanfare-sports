/**
 * check-props.mjs — Catch props used but never declared.
 *
 * This is the bug class that caused the blank blue screen: ActionPads read
 * `rules` without declaring it, so at render time it was an undefined global
 * and the whole tree unmounted.
 *
 * Splits on every component boundary — `function`, `export function`, and
 * `const X = (` — because an earlier version only split on `function` and
 * therefore bled one component's body into the next, producing false alarms.
 *
 * Run: node scripts/check-props.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SUSPECTS = [
  'rules', 'state', 'game', 'games', 'team', 'teams', 'roster', 'names',
  'config', 'mode', 'byId', 'side', 'user', 'order', 'out', 'locked',
  'audioConfig', 'batter', 'personFor', 'header', 'items', 'result',
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.jsx')) acc.push(p);
  }
  return acc;
}

/** Strip comments and string literals so prose can't trigger a match. */
function scrub(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/'[^'\n]*'/g, '""')
    .replace(/"[^"\n]*"/g, '""')
    .replace(/`[^`]*`/g, '""');
}

const BOUNDARY = /\n(?:export\s+)?(?:default\s+)?(?:function\s+\w+|const\s+\w+\s*=)/g;

const files = [...walk('src'), 'App.jsx'];
const problems = [];

for (const file of files) {
  const clean = scrub(readFileSync(file, 'utf8'));
  const decl = /(?:export\s+)?function\s+(\w+)\s*\(\s*\{([^}]*)\}/g;
  let m;
  while ((m = decl.exec(clean))) {
    const [, name, props] = m;
    const declared = new Set(props.match(/\w+/g) || []);

    BOUNDARY.lastIndex = m.index + m[0].length;
    const next = BOUNDARY.exec(clean);
    const body = clean.slice(m.index + m[0].length, next ? next.index : clean.length);

    // Object destructuring: const { a, b } = ...
    for (const d of body.match(/(?:const|let|var)\s*\{[^}]*\}/g) || []) {
      for (const w of d.match(/\w+/g) || []) declared.add(w);
    }
    // Array destructuring: const [order, setOrder] = useState(...)
    // Missing this reported every useState value as an undeclared prop.
    for (const d of body.match(/(?:const|let|var)\s*\[[^\]]*\]/g) || []) {
      for (const w of d.match(/\w+/g) || []) declared.add(w);
    }
    for (const d of body.match(/(?:const|let|var|function)\s+(\w+)/g) || []) {
      declared.add(d.split(/\s+/)[1]);
    }

    for (const s of SUSPECTS) {
      if (declared.has(s)) continue;
      if (new RegExp(`(?<![\\w.])${s}\\s*[.?[(]`).test(body)) {
        problems.push(`${file}: ${name}() uses "${s}" but never declares it`);
      }
    }
  }
}

if (problems.length) {
  console.error('UNDECLARED PROPS:\n' + [...new Set(problems)].map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`checked ${files.length} components — no undeclared props`);
