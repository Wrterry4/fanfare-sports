/**
 * check-tdz.mjs — Catch a binding read before it's declared, inside a component.
 *
 * The bug this exists for: a `useCallback`/`useMemo`/`useEffect` dependency
 * array is evaluated **during render**, at the point the hook is written. If it
 * names a `const` declared further down the component, that's a temporal dead
 * zone error — "Cannot access 'x' before initialization" — and the whole tree
 * unmounts.
 *
 * It compiles cleanly, imports resolve, props are declared. Nothing else in the
 * checks catches it.
 *
 * Run: node scripts/check-tdz.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.jsx') || p.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const scrub = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

const files = [...walk('src'), 'App.jsx'];
const problems = [];

for (const file of files) {
  const lines = scrub(readFileSync(file, 'utf8')).split('\n');

  // Every `const x =` / `let x =` and the line it appears on. Indentation is
  // ignored: a component's locals and the module's top level can't collide in
  // a way that matters here, and being permissive avoids false alarms.
  const declaredAt = new Map();
  const note = (name, i) => {
    // First declaration wins. A later same-named local inside a helper is a
    // different binding and must not shadow the real one — that produced a
    // false alarm on `const [code, setCode] = useState()` versus a `const code`
    // inside an error-formatting helper below it.
    if (!declaredAt.has(name)) declaredAt.set(name, i);
  };

  lines.forEach((l, i) => {
    const plain = l.match(/^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=/);
    if (plain) note(plain[1], i);

    // const [a, b] = useState(...)
    const arr = l.match(/^\s*(?:const|let)\s*\[([^\]]*)\]\s*=/);
    if (arr) for (const w of arr[1].match(/\w+/g) || []) note(w, i);

    // const { a, b } = useSomething()
    const obj = l.match(/^\s*(?:const|let)\s*\{([^}]*)\}\s*=/);
    if (obj) for (const w of obj[1].match(/\w+/g) || []) note(w, i);
  });

  // Dependency arrays: `}, [a, b]);` — evaluated where they're written.
  lines.forEach((l, i) => {
    const m = l.match(/^\s*\}\s*,\s*\[([^\]]*)\]\s*\)/);
    if (!m) return;
    for (const dep of m[1].split(',')) {
      const name = dep.trim().split(/[.?[]/)[0];
      if (!name || !/^[A-Za-z_]\w*$/.test(name)) continue;
      const at = declaredAt.get(name);
      if (at !== undefined && at > i) {
        problems.push(
          `${file}:${i + 1}  dependency "${name}" is declared later at line ${at + 1}`
        );
      }
    }
  });
}

if (problems.length) {
  console.error('TEMPORAL DEAD ZONE:\n' + [...new Set(problems)].map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`checked ${files.length} files — no dependency read before declaration`);
