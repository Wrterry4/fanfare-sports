/**
 * stamp-build.mjs — Writes what got built, before it gets built.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * Tonight's session had the same conversation repeat itself several times:
 * a fix ships, the person tests it, nothing looks different, and the reason
 * turns out to be that the deploy never actually happened, or an old bundle
 * was still cached. The bundle hash in an error screen was the only signal
 * available, and it's not something anyone can read by just looking at the
 * running app.
 *
 * This writes a small, always-fresh source file — src/generated/buildInfo.js
 * — every time a real web build runs, containing the exact moment it was
 * built and, when available, the exact commit it was built from. Settings
 * displays it. "Is this actually the new version" becomes a glance instead
 * of a debugging session.
 *
 * Runs as a prestep in `npm run build:web`, BEFORE `expo export` — the stamp
 * has to exist as a real source file before Metro bundles it, not be
 * injected into the output afterward the way finalize-web.mjs works with
 * dist/, since by then the JS is already bundled.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function appVersion() {
  try {
    const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    return app?.expo?.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function commitHash() {
  try {
    // Short hash is enough to identify a build; the long one is one git
    // command away for anyone who actually needs it.
    return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    // Not every environment this runs in has git available, or is even a
    // git checkout — a missing hash shouldn't fail the build over it.
    return null;
  }
}

const buildInfo = {
  version: appVersion(),
  builtAt: new Date().toISOString(),
  commit: commitHash(),
};

const outDir = join(root, 'src', 'generated');
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'buildInfo.js'), `/**
 * buildInfo.js — GENERATED. Do not edit by hand.
 *
 * Rewritten by scripts/stamp-build.mjs on every \`npm run build:web\`. The
 * committed version of this file is a placeholder so the app — and the test
 * suite — never breaks in a checkout where the build script hasn't run yet;
 * it just shows as an unbuilt/dev state until it has.
 */

export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
`);

console.log(`✓ stamped build: v${buildInfo.version}${buildInfo.commit ? ` (${buildInfo.commit})` : ''} @ ${buildInfo.builtAt}`);
