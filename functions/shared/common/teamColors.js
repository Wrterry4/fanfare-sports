/**
 * teamColors.js — The color a team picks, and the reason it's a list.
 *
 * ── Why swatches instead of a color picker ──────────────────────────────────
 *
 * A free picker is one tap away from safety yellow, and every label sitting on
 * it goes invisible in exactly the sunlight this app gets used in. It also
 * asks a parent standing at a field to make a design decision on a phone,
 * which is a bad thing to ask of anyone.
 *
 * A curated list solves both. Every entry here is a color a youth jersey
 * actually comes in, and every one ships with the text color that passes AA
 * on top of it. teamColors.test.js runs the whole list through the WCAG math
 * and fails the build if any pair drops below 4.5:1 — so this file cannot rot
 * into something unreadable without someone being told.
 *
 * `fill` is a background. `onFill` is what you put on top of it. That's the
 * same rule brand.js states for stadium gold, enforced per entry instead of
 * by comment.
 *
 * ── On adding colors ────────────────────────────────────────────────────────
 *
 * Add freely, but run the tests. If a color you want fails, it is not that the
 * test is wrong — it means text on that color is genuinely hard to read, and
 * the fix is a deeper shade of the same hue, not a lower threshold.
 */

import { onColor } from './contrast.js';

export const TEAM_COLORS = [
  { id: 'navy',     label: 'Navy',      fill: '#1E3A8A', onFill: '#FFFFFF' },
  { id: 'royal',    label: 'Royal',     fill: '#1D4ED8', onFill: '#FFFFFF' },
  { id: 'sky',      label: 'Sky',       fill: '#0369A1', onFill: '#FFFFFF' },
  { id: 'teal',     label: 'Teal',      fill: '#0F766E', onFill: '#FFFFFF' },
  { id: 'forest',   label: 'Forest',    fill: '#166534', onFill: '#FFFFFF' },
  { id: 'kelly',    label: 'Kelly',     fill: '#15803D', onFill: '#FFFFFF' },
  { id: 'crimson',  label: 'Crimson',   fill: '#B91C1C', onFill: '#FFFFFF' },
  { id: 'cardinal', label: 'Cardinal',  fill: '#9F1239', onFill: '#FFFFFF' },
  { id: 'maroon',   label: 'Maroon',    fill: '#7F1D1D', onFill: '#FFFFFF' },
  { id: 'orange',   label: 'Orange',    fill: '#C2410C', onFill: '#FFFFFF' },
  { id: 'purple',   label: 'Purple',    fill: '#6D28D9', onFill: '#FFFFFF' },
  { id: 'gold',     label: 'Gold',      fill: '#F59E0B', onFill: '#0F172A' },
  { id: 'silver',   label: 'Silver',    fill: '#CBD5E1', onFill: '#0F172A' },
  { id: 'black',    label: 'Black',     fill: '#18181B', onFill: '#FFFFFF' },
];

/** What a team gets before anyone has chosen — the brand's own blue. */
export const DEFAULT_TEAM_COLOR = {
  id: null,
  label: 'Fanfare Blue',
  fill: '#2563EB',
  onFill: '#FFFFFF',
};

export const isTeamColorId = (id) => TEAM_COLORS.some((c) => c.id === id);

/**
 * Resolve whatever is on the team document into a usable pair.
 *
 * Tolerates everything a real document throws at it: a missing field on every
 * team created before this existed, an id from a future version of the list,
 * or a raw hex someone wrote by hand. The hex case still gets a safe text
 * color computed rather than trusted, because nothing validated it on the way
 * in — the whole point of onColor().
 */
export function resolveTeamColor(team) {
  const raw = team?.colorId ?? team?.color ?? null;
  if (!raw) return DEFAULT_TEAM_COLOR;

  const preset = TEAM_COLORS.find((c) => c.id === raw);
  if (preset) return preset;

  if (typeof raw === 'string' && raw.startsWith('#')) {
    return { id: null, label: 'Custom', fill: raw, onFill: onColor(raw) };
  }

  return DEFAULT_TEAM_COLOR;
}
