/**
 * teamColors.js — The colors a team picks, and the reason they're a list.
 *
 * ── Why swatches instead of a color picker ──────────────────────────────────
 *
 * A free picker is one tap away from safety yellow, and every label sitting on
 * it goes invisible in exactly the sunlight this app gets used in. It also
 * asks a parent standing at a field to make a design decision on a phone,
 * which is a bad thing to ask of anyone.
 *
 * A curated list solves both. Every entry here is a color a youth jersey
 * actually comes in, and every one ships with the text color that passes AA on
 * top of it. teamColors.test.js runs the whole list through the WCAG math and
 * fails the build if any pair drops below 4.5:1 — so this file cannot rot into
 * something unreadable without someone being told.
 *
 * `fill` is a background. `onFill` is what you put on top of it. That's the
 * same rule brand.js states for stadium gold, enforced per entry instead of by
 * comment.
 *
 * ── Primary and secondary ───────────────────────────────────────────────────
 *
 * Nearly every team is a combination — navy and gold, green and white — so a
 * team picks two. They do different jobs and are NOT interchangeable: primary
 * is the identity (the header stripe, the celebration, the tinted surface),
 * secondary is the accompaniment (the second stripe, the trim). Secondary
 * never carries text on its own, which is why it needs no separate contrast
 * guarantee beyond its own onFill.
 *
 * ── Why the surface is a tint and not the color ─────────────────────────────
 *
 * The obvious build is "paint the screen the team's color". Doing that means
 * every border, every piece of secondary text, and every white card in the app
 * was measured against a background that no longer exists — crimson behind
 * slate-grey body copy is unreadable, and it's unreadable differently for each
 * of the twenty colors below. The app would need a second design for each one.
 *
 * `surface` is instead the brand's own near-white with a few percent of the
 * team color mixed in. The screen reads as the team's without any measured
 * pair changing enough to matter, and the test file proves that for every
 * entry rather than trusting it.
 */

import { onColor, mix, contrastRatio, MIN_AA_LARGE } from './contrast.js';

/**
 * How much team color goes into the page background.
 *
 * Tuned by measurement, not taste. Measured worst cases across the whole
 * palette: 0.14 gives 5.42:1 on secondary text, 0.16 gives 5.20:1, 0.18 gives
 * 4.96:1. All pass AA, but 0.18 leaves almost no margin for a future color, so
 * 0.16 is the last comfortable step — clearly a colored screen, still a
 * readable one. Raising this is the change most likely to quietly break
 * readability, which is why the tests assert the resulting RATIOS and not just
 * this number.
 */
export const SURFACE_TINT = 0.16;

/** The brand background a tint is mixed into — chalk, from brand.js. */
const BASE_SURFACE = '#F8FAFC';

export const TEAM_COLORS = [
  { id: 'navy', label: 'Navy', fill: '#1E3A8A', onFill: '#FFFFFF' },
  { id: 'royal', label: 'Royal', fill: '#1D4ED8', onFill: '#FFFFFF' },
  { id: 'columbia', label: 'Columbia', fill: '#0C7BB3', onFill: '#FFFFFF' },
  { id: 'sky', label: 'Sky', fill: '#0369A1', onFill: '#FFFFFF' },
  { id: 'teal', label: 'Teal', fill: '#0F766E', onFill: '#FFFFFF' },
  { id: 'forest', label: 'Forest', fill: '#166534', onFill: '#FFFFFF' },
  { id: 'kelly', label: 'Kelly', fill: '#15803D', onFill: '#FFFFFF' },
  { id: 'olive', label: 'Olive', fill: '#4D7C0F', onFill: '#FFFFFF' },
  { id: 'crimson', label: 'Crimson', fill: '#B91C1C', onFill: '#FFFFFF' },
  { id: 'cardinal', label: 'Cardinal', fill: '#9F1239', onFill: '#FFFFFF' },
  { id: 'maroon', label: 'Maroon', fill: '#7F1D1D', onFill: '#FFFFFF' },
  { id: 'orange', label: 'Orange', fill: '#C2410C', onFill: '#FFFFFF' },
  { id: 'burnt', label: 'Burnt', fill: '#9A3412', onFill: '#FFFFFF' },
  { id: 'purple', label: 'Purple', fill: '#6D28D9', onFill: '#FFFFFF' },
  { id: 'violet', label: 'Violet', fill: '#5B21B6', onFill: '#FFFFFF' },
  { id: 'pink', label: 'Pink', fill: '#BE185D', onFill: '#FFFFFF' },
  { id: 'gold', label: 'Gold', fill: '#F59E0B', onFill: '#0F172A' },
  { id: 'vegas', label: 'Vegas Gold', fill: '#C9A227', onFill: '#0F172A' },
  { id: 'silver', label: 'Silver', fill: '#CBD5E1', onFill: '#0F172A' },
  { id: 'graphite', label: 'Graphite', fill: '#475569', onFill: '#FFFFFF' },
  { id: 'black', label: 'Black', fill: '#18181B', onFill: '#FFFFFF' },
  { id: 'white', label: 'White', fill: '#F1F5F9', onFill: '#0F172A' },
];

/** What a team gets before anyone has chosen — the brand's own blue. */
export const DEFAULT_TEAM_COLOR = {
  id: null,
  label: 'Fanfare Blue',
  fill: '#2563EB',
  onFill: '#FFFFFF',
};

export const isTeamColorId = (id) => TEAM_COLORS.some((c) => c.id === id);

/** One stored value → a usable {fill, onFill} pair, whatever shape it's in. */
function resolveOne(raw, fallback) {
  if (!raw) return fallback;

  const preset = TEAM_COLORS.find((c) => c.id === raw);
  if (preset) return preset;

  // A hand-written hex was never validated on the way in, so its text color is
  // computed rather than trusted — the whole point of onColor().
  if (typeof raw === 'string' && raw.startsWith('#')) {
    return { id: null, label: 'Custom', fill: raw, onFill: onColor(raw) };
  }

  return fallback;
}

/**
 * Resolve whatever is on the team document into everything the UI needs.
 *
 * Tolerates every shape a real document throws at it: a missing field on teams
 * created before this existed, an id from a future version of the list, a raw
 * hex, or a legacy `color` key.
 *
 * @returns { fill, onFill, label, id, secondary, surface }
 *          `secondary` is the same shape; it falls back to the primary so
 *          callers can use it unconditionally without a second null check.
 */
export function resolveTeamColor(team) {
  const primary = resolveOne(team?.colorId ?? team?.color ?? null, DEFAULT_TEAM_COLOR);
  const secondary = resolveOne(team?.secondaryColorId ?? null, primary);

  return {
    ...primary,
    secondary,
    surface: mix(BASE_SURFACE, primary.fill, SURFACE_TINT),
    numberOn: numberColor(primary, secondary),
  };
}

/**
 * The color a jersey number is printed in.
 *
 * The secondary, when you can actually read it on the primary — which is the
 * point of picking two. But a team can legitimately choose navy and royal, or
 * leave the secondary unset so it falls back to the primary itself, and then
 * the number would be invisible on the shirt. Anything under the large-text
 * bar falls back to the primary's own proven onFill.
 *
 * MIN_AA_LARGE rather than MIN_AA because a jersey number is exactly what that
 * threshold exists for: two or three digits, bold, at display size.
 */
export function numberColor(primary, secondary) {
  const candidate = secondary?.fill;
  if (candidate && contrastRatio(candidate, primary.fill) >= MIN_AA_LARGE) return candidate;
  return primary.onFill;
}

/** The page background for a team, on its own — see the header for why a tint. */
export const teamSurface = (team) => resolveTeamColor(team).surface;
