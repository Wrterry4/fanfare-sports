/**
 * make-icons.mjs — Render the app icon PNGs from the same geometry the app draws.
 *
 * ── Why render instead of exporting from a design tool ──────────────────────
 *
 * The mark exists twice: as SVG inside FanfareLogo.jsx, and as the PNGs iOS
 * and Android put on a home screen. Hand-exported PNGs drift from the drawn
 * version the first time anyone nudges a bar, and nobody notices because the
 * home screen icon is the one surface you never look at while developing.
 *
 * The geometry below is the same 192-space as FanfareLogo.jsx. Change one,
 * change the other, rerun this.
 *
 * ── Why no image library ────────────────────────────────────────────────────
 *
 * The icon is a gradient, one rounded tile, and four pills — all analytically
 * describable, so this samples them directly. pngjs (already present, pulled
 * in by the Firebase tooling) does the encoding. sharp or resvg would each be
 * a new dependency with native binaries, for shapes that are four inequalities.
 *
 * Anti-aliasing is 4x4 supersampling per pixel: crude, but at these sizes it
 * is indistinguishable from a proper rasterizer and it cannot go wrong.
 *
 * Run: node scripts/make-icons.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');

const C = {
  blueLight: [0x5B, 0x82, 0xF5],
  blueDeep: [0x2F, 0x4F, 0xC7],
  gold: [0xFF, 0xC1, 0x07],
  sky: [0x64, 0xC8, 0xFF],
  white: [0xFF, 0xFF, 0xFF],
};

/** Everything in the 192-unit design space, matching FanfareLogo.jsx. */
const TILE = { x: 0, y: 0, w: 192, h: 192, r: 52 };
const GLYPH = [
  { x: 38, y: 32, w: 30, h: 128, r: 15, c: C.white },
  { x: 80, y: 32, w: 74, h: 24, r: 12, c: C.gold },
  { x: 80, y: 64, w: 44, h: 24, r: 12, c: C.sky },
  { x: 80, y: 96, w: 74, h: 24, r: 12, c: C.gold },
];

/** Signed-distance test for a rounded rectangle. Negative is inside. */
function inRoundRect(px, py, { x, y, w, h, r }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r <= 0;
}

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const SS = 4;   // samples per axis

/**
 * @param size      output pixels
 * @param opts.bleed   true fills the whole square (maskable — the launcher
 *                     applies its own shape and a rounded tile inside a
 *                     circular mask leaves four bites out of the corners)
 * @param opts.inset   glyph scale about the centre, for maskable safe zones
 * @param opts.mono    draw the glyph white on transparent, ignoring color —
 *                     Android tints notification badges itself
 */
function render(size, { bleed = false, inset = 1, mono = false } = {}) {
  const png = new PNG({ width: size, height: size });
  const unit = 192 / size;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // Sample at the centre of each sub-pixel, in design units.
          const ux = (px + (sx + 0.5) / SS) * unit;
          const uy = (py + (sy + 0.5) / SS) * unit;

          // Glyph coordinates, scaled about the centre for inset renders.
          const gx = 96 + (ux - 96) / inset;
          const gy = 96 + (uy - 96) / inset;

          let hit = null;
          for (const bar of GLYPH) {
            if (inRoundRect(gx, gy, bar)) { hit = mono ? C.white : bar.c; break; }
          }

          if (hit) {
            r += hit[0]; g += hit[1]; b += hit[2]; a += 255;
          } else if (mono) {
            // Transparent everywhere the glyph isn't.
          } else if (bleed || inRoundRect(ux, uy, TILE)) {
            const t = (ux / 192 + uy / 192) / 2;
            const bg = lerp(C.blueLight, C.blueDeep, t);
            r += bg[0]; g += bg[1]; b += bg[2]; a += 255;
          }
        }
      }

      const n = SS * SS;
      const idx = (py * size + px) << 2;
      // Un-premultiply: colour is the average of the samples that had colour,
      // not of all of them, or every edge fades toward black.
      const lit = a / 255 || 1;
      png.data[idx] = Math.round(r / lit);
      png.data[idx + 1] = Math.round(g / lit);
      png.data[idx + 2] = Math.round(b / lit);
      png.data[idx + 3] = Math.round(a / n);
    }
  }

  return PNG.sync.write(png);
}

mkdirSync(outDir, { recursive: true });

const JOBS = [
  ['favicon-48.png', 48, {}],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // 0.72 keeps the glyph inside the 80% safe circle every Android launcher
  // masks to, with the gradient running edge to edge behind it.
  ['icon-maskable-512.png', 512, { bleed: true, inset: 0.72 }],
  ['badge-72.png', 72, { mono: true }],
];

for (const [name, size, opts] of JOBS) {
  const buf = render(size, opts);
  writeFileSync(join(outDir, name), buf);
  console.log(`  ${name.padEnd(24)} ${size}x${size}  ${String(buf.length).padStart(6)} bytes`);
}

console.log(`\n✓ ${JOBS.length} icons written to public/icons/`);
