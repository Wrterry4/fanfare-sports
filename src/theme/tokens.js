/**
 * tokens.js — Back-compat shim.
 *
 * The old flat `colors` export mapped to a single hard-coded palette. Screens
 * are migrating to useTheme(), which is theme- and sport-aware. Until that's
 * done, this maps the old names onto the Fanfare light theme so nothing breaks
 * mid-migration.
 *
 * Delete once every component reads from useTheme().
 */

import { defaultLight, text as brandText, shadow as brandShadow,
         radius as brandRadius, spacing as brandSpacing, tap as brandTap,
         fonts } from './index.js';

const t = defaultLight;

export const colors = {
  chalk: t.bg,
  card: t.surface,
  line: t.border,
  navy: t.text,
  pencil: t.textSecondary,
  clay: t.sport.accent,
  clayDim: t.sport.accentSoft,
  grass: t.success,
  out: t.danger,
  gold: t.accentFill,
  white: '#FFFFFF',
  primary: t.primary,
};

export const radius = brandRadius;
export const spacing = brandSpacing;
export const tap = brandTap;
export const text = brandText;
export const shadow = brandShadow;
export const type = fonts;
