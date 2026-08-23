/**
 * check-imports.mjs — Catch identifiers used but never imported.
 *
 * This is the bug class behind the Settings crash: a scripted edit targeted a
 * multi-line import block, the file had it on one line, the replacement
 * silently matched nothing, and four imports were never added. Everything
 * still parsed — the failure only appeared when the screen rendered.
 *
 * Checks three things against what a file imports or defines:
 *   components rendered in JSX  (<Foo)
 *   hooks called                (useFoo())
 *   plain function calls        (venueOf())
 *
 * The third was added after `venueOf` shipped unimported and crashed the
 * Schedule tab — same root cause as the original bug, a scripted edit whose
 * replacement silently matched nothing. Components and hooks were checked;
 * an ordinary helper was not, so the same mistake got through twice.
 *
 * Run: node scripts/check-imports.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUILTIN_HOOKS = new Set([
  'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext',
  'useReducer', 'useLayoutEffect', 'useImperativeHandle', 'useDebugValue',
]);

/** Language constructs that look like calls but aren't. */
const KEYWORDS = new Set([
  'async', 'constructor',
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function',
  'await', 'new', 'delete', 'void', 'in', 'of', 'do', 'else', 'try', 'yield',
  'import', 'export', 'super', 'this',
]);

/** Ambient globals. Not exhaustive on purpose — see the note above. */
const GLOBALS = new Set([
  'getComputedStyle', 'require', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch',
  'alert', 'confirm', 'prompt', 'structuredClone', 'queueMicrotask',
  // Browser image APIs, used by the .web.js photo uploader.
  'createImageBitmap', 'Image', 'FileReader', 'Blob',
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.jsx') || p.endsWith('.js')) acc.push(p);
  }
  return acc;
}

/**
 * Strip comments AND string literals.
 *
 * Strings matter: 'Time limit (minutes)' contains what looks exactly like a
 * call to limit(). Leaving them in produced false positives in the rule
 * label tables, and a checker that reports things that aren't real gets
 * ignored — which is worse than not having one.
 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '');

/**
 * Additionally blank out string CONTENTS for the usage scan.
 *
 * 'Time limit (minutes)' contains what looks exactly like a call to limit().
 * The quotes are kept so `from '...'` still parses — emptying them entirely
 * broke every import in the file and reported the whole codebase as missing.
 */
const stripStrings = (src) => src
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "'x'")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '"x"');

const files = [...walk('src'), 'App.jsx'];
const problems = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  // Declarations are read with strings intact; usages with them blanked.
  const src = stripComments(raw);
  const usage = stripStrings(src);

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
  /**
   * Destructured props in a PARAMETER list: function Foo({ onClose, onSave }).
   * Callback props are called by name constantly, so without this every one
   * reads as a missing import.
   *
   * Must be anchored to `)` followed by `{` or `=>`, and must reject any
   * property with a value. An earlier version matched any `({ ... }` — which
   * swallowed object literals passed as arguments, including
   * `setForm({ type: typeOf(game), ... })`. That silently marked `venueOf` as
   * declared and let the real bug through the checker.
   */
  for (const m of src.matchAll(/\(\s*\{([^}]*)\}\s*(?:,[^)]*)?\)\s*(?:=>|\{)/g)) {
    const body = m[1];
    // A value anywhere means this is a literal, not a destructuring pattern.
    if (/:\s*[^,\s}]/.test(body.replace(/=\s*[^,]+/g, ''))) continue;
    for (const w of body.match(/\w+/g) || []) known.add(w);
  }
  // Class methods and object-literal methods: render() {, componentDidCatch() {
  for (const m of src.matchAll(/^\s*(?:static\s+|async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm)) {
    known.add(m[1]);
  }
  // Plain function parameters: (cb, onUpdate) => ... and function f(handler).
  // Callback params are called by name constantly; without this every one
  // reads as a missing import.
  for (const m of src.matchAll(/(?:function\s*\w*\s*)?\(([^)]*)\)\s*(?:=>|\{)/g)) {
    for (const w of m[1].match(/\b[a-z]\w*/g) || []) known.add(w);
  }
  // Promise executor bindings: new Promise((resolve, reject) => ...)
  known.add('resolve'); known.add('reject');

  // Components rendered in JSX.
  for (const m of usage.matchAll(/<([A-Z]\w*)/g)) {
    if (!known.has(m[1])) problems.push(`${file}: <${m[1]}> is used but never imported`);
  }
  // Hooks called.
  for (const m of usage.matchAll(/(?<![\w.])(use[A-Z]\w*)\s*\(/g)) {
    const name = m[1];
    if (BUILTIN_HOOKS.has(name) || known.has(name)) continue;
    problems.push(`${file}: ${name}() is called but never imported`);
  }

  /**
   * Plain function calls.
   *
   * Restricted to camelCase identifiers that aren't preceded by a dot, aren't
   * a keyword, and aren't a global. Anything ambiguous is skipped rather than
   * reported — a checker that cries wolf gets switched off, and a missed
   * warning is cheaper than a disabled tool.
   */
  for (const m of usage.matchAll(/(?<![\w.$'"`])([a-z][A-Za-z0-9]*)\s*\(/g)) {
    const name = m[1];
    if (known.has(name) || KEYWORDS.has(name) || GLOBALS.has(name)) continue;
    problems.push(`${file}: ${name}() is called but never imported`);
  }
}

if (problems.length) {
  console.error('MISSING IMPORTS:\n' + [...new Set(problems)].map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`checked ${files.length} files — no missing imports`);
