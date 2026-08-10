/**
 * theme/index.js — Brand + sport, merged.
 *
 * Components read from here and never import a sport's theme directly, so a
 * screen written for baseball renders correctly under any sport pack.
 */

import { lightTheme, darkTheme, themeForGameTime, palette, radius, spacing, fonts, tap } from './brand.js';

export { palette, radius, spacing, fonts, tap, themeForGameTime };

/**
 * A sport pack contributes an accent and its own vocabulary. It CANNOT override
 * the brand surfaces, text colors, or type — that's what keeps Fanfare
 * recognizable across sports while letting each one feel like itself.
 */
export function buildTheme(base, sportTheme = {}) {
  return {
    ...base,
    sport: {
      accent: sportTheme.accent ?? base.primary,
      accentSoft: sportTheme.accentSoft ?? base.border,
      fieldStroke: sportTheme.fieldStroke ?? base.text,
      fieldFill: sportTheme.fieldFill ?? base.surface,
      occupied: sportTheme.occupied ?? sportTheme.accent ?? base.primary,
      name: sportTheme.name ?? 'sport',
    },
  };
}

export const resolveTheme = ({ sportTheme, gameDate, systemPreference } = {}) =>
  buildTheme(themeForGameTime(gameDate, systemPreference), sportTheme);

// Convenience for modules that need a theme before context is available.
export const defaultLight = buildTheme(lightTheme);
export const defaultDark = buildTheme(darkTheme);

/** Text styles are brand-level and identical across sports. */
export const text = {
  scoreboardNumber: { fontFamily: fonts.display, fontWeight: '900', fontSize: 27, fontVariant: ['tabular-nums'] },
  teamName:         { fontFamily: fonts.display, fontWeight: '700', fontSize: 13, letterSpacing: 0.9, textTransform: 'uppercase' },
  inning:           { fontFamily: fonts.display, fontWeight: '800', fontSize: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
  buttonPrimary:    { fontFamily: fonts.display, fontWeight: '800', fontSize: 15, letterSpacing: 0.7 },
  buttonSecondary:  { fontFamily: fonts.display, fontWeight: '800', fontSize: 13 },
  label:            { fontFamily: fonts.body, fontWeight: '700', fontSize: 9, letterSpacing: 1.3, textTransform: 'uppercase' },
  body:             { fontFamily: fonts.body, fontWeight: '400', fontSize: 13 },
  bodyStrong:       { fontFamily: fonts.body, fontWeight: '600', fontSize: 13 },
};

export const shadow = {
  card: {
    shadowColor: '#0F172A', shadowOpacity: 0.07, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
};
