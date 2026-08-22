/**
 * finalize-web.mjs — Post-export step for the PWA.
 *
 * `expo export` produces a bare index.html with no manifest link and none of
 * the Apple meta tags. Without those, iOS treats a home-screen shortcut as a
 * Safari bookmark — you get the address bar and toolbar, which is exactly the
 * "it doesn't feel like an app" problem.
 *
 * Also copies public/ into dist/, which the export doesn't do.
 *
 * Run automatically as part of `npm run build:web`.
 */

import { readFileSync, writeFileSync, cpSync, existsSync } from 'fs';
import { join } from 'path';

const dist = 'dist';
if (!existsSync(dist)) {
  console.error('dist/ not found — run expo export first.');
  process.exit(1);
}

// 1. Static assets the export ignores: manifest, icons, service worker.
cpSync('public', dist, { recursive: true });

// 2. Head tags.
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');

const HEAD = `
    <title>Fanfare Sports</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0F172A">
    <meta name="description" content="Live scoring, stats, and team communication for youth sports.">

    <!-- iOS standalone. Without apple-mobile-web-app-capable, a home-screen
         icon opens in Safari chrome instead of as an app. -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <!-- NOT black-translucent. That makes iOS paint the page UNDER the status
         bar and apply its own blur over the top of the app, which looked like
         a rendering bug. "black" reserves the strip and starts the app below
         it. -->
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="apple-mobile-web-app-title" content="Fanfare">
    <link rel="apple-touch-icon" href="/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png">
    <meta name="mobile-web-app-capable" content="yes">

    <!-- viewport-fit=cover lets the app paint under the notch; user-scalable=no
         stops the double-tap zoom that makes a scoring pad unusable. -->
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">

    <style>
      /* 100% resolves against a viewport iOS reports before its chrome settles,
         which left the app short and showed the page background below the tab
         bar. 100dvh tracks the real visible area; the 100% line is the
         fallback for browsers without dvh. */
      html, body, #root { height: 100%; }
      @supports (height: 100dvh) {
        html, body, #root { height: 100dvh; }
      }
      /* DO NOT add min-height: -webkit-fill-available here.
         It was here as "belt and braces" and it was the bug. On an installed
         iOS PWA, -webkit-fill-available resolves TALLER than the visible
         viewport, and because min-height beats height whenever it's larger,
         #root grew past the bottom of the screen. The tab bar sits at the
         bottom of #root, so it was pushed off-screen — labels clipped by the
         screen edge, with the extra height showing as a dead strip above the
         bar. 100dvh already tracks the real visible area. */

      /* env() can't be read from a React Native style object, so it's exposed
         as a custom property that JS can read back through
         getComputedStyle. See src/hooks/useBottomInset.web.js — this is what
         lets the tab bar sit exactly on the home indicator rather than
         guessing a fixed 20px. */
      :root {
        --safe-top: env(safe-area-inset-top, 0px);
        --safe-bottom: env(safe-area-inset-bottom, 0px);
      }
      html, body, #root { overscroll-behavior: none; }
      body {
        margin: 0;
        background: #F8FAFC;
        -webkit-tap-highlight-color: transparent;
        /* Never scroll the page itself — screens manage their own scrolling.
           Page-level scroll is what produced the rubber-band gap. */
        position: fixed;
        width: 100%;
        overflow: hidden;
      }
      * { -webkit-touch-callout: none; }
      input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; }
    </style>

    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .catch(function (e) { console.warn('SW registration failed', e); });
        });
      }
    </script>
`;

// Expo ships its own viewport tag; ours must replace it, not sit beside it.
html = html.replace(/<meta\s+name="viewport"[^>]*>/gi, '');
html = html.replace(/<title>.*?<\/title>/i, '');
html = html.replace('</head>', `${HEAD}  </head>`);

writeFileSync(indexPath, html);

console.log('✓ public/ copied into dist/');
console.log('✓ manifest, iOS standalone tags, and service worker registration injected');
