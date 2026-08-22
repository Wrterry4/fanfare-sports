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

  /**
   * The playing surface itself.
   *
   * Both are deliberately muted. The diamond now sits on a page tinted with
   * the team's color, and a saturated grass green beside a maroon or purple
   * surface fights it — these are chosen to read as grass and dirt while
   * staying quiet enough to sit on any of the twenty team tints. They also
   * have to survive direct sun, which is where bright greens turn to glare.
   */
  grass: '#5C9C63',
  grassRim: '#4A8551',     // the arc's own edge, so it doesn't need a stroke
  dirt: '#C79A6B',
  dirtRim: '#B0855A',
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
