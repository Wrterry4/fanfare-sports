/**
 * Baseball sport theme.
 *
 * Infield clay against the Fanfare navy and blue. The accent is what makes
 * baseball feel like baseball — a future basketball pack would bring hardwood
 * amber, soccer a pitch green — while surfaces, type, and the scoreboard stay
 * brand-constant.
 */

export const baseballTheme = {
  name: 'baseball',
  accent: '#B5451B',       // infield clay
  accentSoft: '#E8D3C9',
  fieldStroke: '#0F172A',
  fieldFill: '#FFFFFF',
  occupied: '#B5451B',     // a base with a runner on it
};

/** Sport-specific vocabulary, so shared screens can label themselves. */
export const baseballTerms = {
  period: 'inning',
  periodShort: 'INN',
  scorer: 'scorekeeper',
  scorebook: 'the book',
  participant: 'batter',
  roster: 'lineup',
};
