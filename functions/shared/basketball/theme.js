/**
 * Basketball sport theme.
 *
 * Orange for the ball, navy for Fanfare. The brand's navy and surfaces stay
 * exactly as they are — a sport contributes an accent and its own vocabulary,
 * never the whole palette — so the app still reads as one product while a
 * basketball team feels like basketball.
 *
 * The orange is pulled toward burnt rather than safety-cone: it has to sit
 * beside navy without vibrating, and it has to stay legible as a small label
 * on a white card in direct sunlight in a gym doorway.
 */

export const basketballTheme = {
  name: 'basketball',
  accent: '#E2701E',        // leather, not traffic cone
  accentSoft: '#F7DFC9',
  fieldStroke: '#0F172A',
  fieldFill: '#C88B4A',     // hardwood
  occupied: '#E2701E',

  /** Sleeveless — see components/Jersey.jsx. */
  jersey: 'basketball',
};

/** Sport-specific vocabulary, so shared screens can label themselves. */
export const basketballTerms = {
  period: 'period',
  periodShort: 'PER',
  scorer: 'scorekeeper',
  scorebook: 'the book',
  participant: 'player',
  roster: 'lineup',
};
