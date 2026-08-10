/**
 * build-prototype.js
 *
 * Inlines the real engine modules into a single self-contained HTML file so
 * the prototype can be opened straight from disk (file://) with no server and
 * no divergence from the engine that ships. Strip imports/exports, concatenate
 * in dependency order, inject.
 *
 * Run: node build-prototype.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

const MODULES = [
  'src/sports/baseball/rules.js',
  'src/sports/baseball/events.js',
  'src/sports/baseball/engine.js',
  'src/sports/baseball/stats.js',
];

function strip(source) {
  return source
    // Drop ES module import statements — everything shares one scope once inlined.
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    // Drop the `export` keyword but keep the declaration.
    .replace(/^export\s+(const|function|let|class)\s/gm, '$1 ')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
}

const engine = MODULES
  .map((rel) => {
    const src = readFileSync(join(here, rel), 'utf8');
    return `\n/* ===== ${rel} ===== */\n${strip(src)}`;
  })
  .join('\n');

const template = readFileSync(join(here, 'prototype/template.html'), 'utf8');
const out = template.replace('/*__ENGINE__*/', engine);

writeFileSync(join(here, 'prototype/index.html'), out);
console.log(`Built prototype/index.html (${(out.length / 1024).toFixed(1)} KB)`);
