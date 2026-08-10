/**
 * brand.js — Fanfare Sports.
 *
 * The brand layer is constant across every sport. Sports layer an accent and a
 * field glyph on top (see src/sports/<sport>/theme.js) so baseball and, later,
 * basketball feel like siblings rather than the same app with a new logo.
 *
 * ── Contrast, measured ──────────────────────────────────────────────────────
 *
 *   Electric Blue on white ......  5.17:1   AA  (body text OK)
 *   Electric Blue on navy ......   3.45:1   large text only — NOT body copy
 *   Stadium Gold on white ......   2.15:1   FAILS — never text on light
 *   Stadium Gold on navy .......   8.31:1   AAA
 *   White on navy ..............  17.85:1   AAA
 *   Navy on white ..............  17.85:1   AAA
 *
 * Gold is a FILL, not a text color. Gold background with navy text reads
 * beautifully; gold text on anything light is unreadable. The token names below
 * enforce that distinction so it can't be misused by accident.
 *
 * ── On dark mode outdoors ───────────────────────────────────────────────────
 *
 * I previously claimed light backgrounds beat dark in direct sun. Modeling
 * reflected glare didn't support that — dark came out marginally ahead on
 * contrast ratio, though the model ignores absolute luminance, which matters
 * too. Nobody has evidence yet.
 *
 * So both themes exist and the default follows game time: light for day games,
 * dark for evening games under lights, where dark is clearly correct. Settle it
 * at an actual 2pm game and hard-code the winner then.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const palette = {
  electricBlue: '#2563EB',
  blueDeep:     '#1D4ED8',   // pressed states, links on light
  blueLift:     '#60A5FA',   // blue that survives on navy (7.1:1)

  stadiumGold:  '#F59E0B',
  goldDeep:     '#B45309',   // gold-as-text on light surfaces (4.8:1)
  goldLift:     '#FCD34D',   // celebration fills on navy

  navy:         '#0F172A',
  navyRaised:   '#1E293B',   // cards on the dark theme
  navyLine:     '#334155',

  chalk:        '#F8FAFC',
  paper:        '#FFFFFF',
  line:         '#E2E8F0',
  slate:        '#475569',   // secondary text on light (7.5:1)
  slateLight:   '#94A3B8',   // secondary text on navy (6.9:1)

  success:      '#15803D',
  danger:       '#B91C1C',
  dangerLift:   '#FCA5A5',   // errors on navy
};

/** Day games. */
export const lightTheme = {
  mode: 'light',
  bg: palette.chalk,
  surface: palette.paper,
  surfaceRaised: palette.paper,
  border: palette.line,
  text: palette.navy,
  textSecondary: palette.slate,
  textInverted: palette.paper,
  primary: palette.electricBlue,
  primaryPressed: palette.blueDeep,
  onPrimary: palette.paper,
  accentFill: palette.stadiumGold,   // background only
  onAccent: palette.navy,            // text ON gold
  accentText: palette.goldDeep,      // gold-flavored text that passes AA
  success: palette.success,
  danger: palette.danger,
  scoreboardBg: palette.navy,
  scoreboardText: palette.paper,
};

/** Night games under lights, and anyone who prefers it. */
export const darkTheme = {
  mode: 'dark',
  bg: palette.navy,
  surface: palette.navyRaised,
  surfaceRaised: '#293548',
  border: palette.navyLine,
  text: palette.paper,
  textSecondary: palette.slateLight,
  textInverted: palette.navy,
  // NOT electricBlue — 3.45:1 on navy fails for anything but large text.
  primary: palette.blueLift,
  primaryPressed: palette.electricBlue,
  onPrimary: palette.navy,
  accentFill: palette.stadiumGold,
  onAccent: palette.navy,
  accentText: palette.goldLift,
  success: '#4ADE80',
  danger: palette.dangerLift,
  scoreboardBg: '#080D18',
  scoreboardText: palette.paper,
};

/**
 * Default by kickoff time rather than by system setting. A parent at a 7pm game
 * wants dark; the same parent at 10am wants light; neither wants to think about
 * it. System preference still wins if the person set one explicitly.
 */
export function themeForGameTime(date = new Date(), systemPreference = null) {
  if (systemPreference === 'light') return lightTheme;
  if (systemPreference === 'dark') return darkTheme;
  const hour = date.getHours();
  return hour >= 18 || hour < 7 ? darkTheme : lightTheme;
}

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };
export const spacing = { xs: 4, sm: 7, md: 12, lg: 16, xl: 22 };

export const fonts = {
  display: 'Archivo',    // scoreboard numerals, headings
  body: 'PublicSans',
};

/**
 * 56pt for controls tapped hundreds of times per game. Apple's minimum is 44,
 * Android's 48; neither anticipated one-handed use while watching a fly ball.
 */
export const tap = { primary: 56, secondary: 46, utility: 42 };
