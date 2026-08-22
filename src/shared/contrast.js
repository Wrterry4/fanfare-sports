/**
 * contrast.js — WCAG contrast math, so a team color can't make text unreadable.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * brand.js measures every brand pair by hand and states the rule plainly:
 * gold is a FILL, never a text color, because gold on white is 2.15:1. That
 * discipline holds exactly as long as a human picks the colors.
 *
 * Team colors are picked by a parent on a phone. The moment a team can choose
 * its own color, someone chooses safety yellow, and every label sitting on it
 * becomes invisible in the sunlight the app is used in. The palette in
 * teamColors.js is curated for that reason, but this is what proves it: the
 * test suite runs every preset through these functions and fails the build if
 * a pair drops below AA.
 *
 * Formulas are the WCAG 2.1 definitions, which is why the magic numbers look
 * arbitrary — 0.03928, 1.055, 2.4, and the 0.2126/0.7152/0.0722 luminance
 * weights are all from the spec, not tuning.
 */

/** '#RGB' or '#RRGGBB' → { r, g, b } in 0–255, or null if unparseable. */
export function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Relative luminance, 0 (black) to 1 (white). WCAG 2.1 definition. */
export function luminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Contrast ratio between two colors, 1:1 (identical) to 21:1 (black/white). */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** AA for body text. 3:1 is the large-text bar — don't use it for labels. */
export const MIN_AA = 4.5;
export const MIN_AA_LARGE = 3;

export const meetsAA = (fg, bg, min = MIN_AA) => contrastRatio(fg, bg) >= min;

/**
 * The readable text color for a given background — near-black or near-white,
 * whichever wins. Pure black on a mid-tone reads harsh, so this uses the
 * brand's navy and paper, which is what every other surface in the app uses.
 *
 * Always returns something. A background this can't parse falls back to the
 * combination that is safe on the widest range of colors.
 */
export function onColor(bg, { dark = '#0F172A', light = '#FFFFFF' } = {}) {
  if (!parseHex(bg)) return light;
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light;
}
