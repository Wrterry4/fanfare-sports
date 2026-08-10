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
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Fanfare">
    <link rel="apple-touch-icon" href="/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png">
    <meta name="mobile-web-app-capable" content="yes">

    <!-- viewport-fit=cover lets the app paint under the notch; user-scalable=no
         stops the double-tap zoom that makes a scoring pad unusable. -->
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">

    <style>
      /* Kill the iOS rubber-band scroll — the scoring screen is fixed, and
         bouncing reveals a white gap under the button pad. */
      html, body, #root { height: 100%; overscroll-behavior: none; }
      body { margin: 0; background: #0F172A; -webkit-tap-highlight-color: transparent; }
      * { -webkit-touch-callout: none; }
      input, textarea { -webkit-user-select: text; user-select: text; }
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
