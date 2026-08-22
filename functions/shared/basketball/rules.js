/**
 * rules.js — League settings.
 *
 * Youth basketball varies more than youth baseball: period length, number of
 * periods, foul limits, whether there's a shot clock, and — the one parents
 * actually care about — whether equal playing time is mandated.
 */

export const DEFAULT_RULES = {
  periods: 4,
  periodMinutes: 8,
  overtimeMinutes: 3,

  // Five in most youth leagues, six in some high-school associations.
  foulsToFoulOut: 5,
  // Team fouls in a period before the other side shoots free throws.
  teamFoulsForBonus: 7,

  threePointLine: true,
  shotClockSeconds: 0,          // 0 = none, which is normal below high school

  /**
   * Equal playing time.
   *
   * Many rec leagues mandate it, and it's the single thing youth basketball
   * parents track on their own. When set, the app can flag a player who's
   * short — but only for periods where substitutions were actually logged.
   * A warning derived from incomplete data would be worse than none.
   */
  equalPlayingTime: false,
  minimumMinutesPerGame: 0,

  mercyRuleDifferential: 0,     // 0 = no mercy rule
  runningClockDifferential: 0,  // clock stops being stopped at this margin
  playersOnCourt: 5,
};

/**
 * Display names, youngest first. Read by the new-team form, which asks the
 * sport pack rather than holding its own list.
 */
export const PRESET_LABELS = [
  ['rec6U', '6U Rec'],
  ['rec8U', '8U Rec'],
  ['rec10U', '10U Rec'],
  ['rec12U', '12U Rec'],
  ['travel12U', '12U Travel'],
  ['middleSchool', 'Middle School'],
  ['highSchool', 'High School'],
];

export const RULE_PRESETS = {
  // The youngest levels often play four short periods with no three-point
  // line, no free throws, and mandated equal time.
  rec6U: {
    ...DEFAULT_RULES,
    periods: 4,
    periodMinutes: 6,
    threePointLine: false,
    foulsToFoulOut: 0,          // nobody fouls out this young
    teamFoulsForBonus: 0,
    equalPlayingTime: true,
  },
  rec8U: {
    ...DEFAULT_RULES,
    periods: 4,
    periodMinutes: 6,
    threePointLine: false,
    foulsToFoulOut: 5,
    teamFoulsForBonus: 0,
    equalPlayingTime: true,
  },
  rec10U: {
    ...DEFAULT_RULES,
    periods: 4,
    periodMinutes: 7,
    equalPlayingTime: true,
  },
  rec12U: {
    ...DEFAULT_RULES,
    periods: 4,
    periodMinutes: 8,
    equalPlayingTime: true,
  },
  travel12U: {
    ...DEFAULT_RULES,
    periods: 4,
    periodMinutes: 8,
  },
  middleSchool: {
    ...DEFAULT_RULES,
    periods: 4,
    periodMinutes: 8,
    teamFoulsForBonus: 7,
  },
  highSchool: {
    ...DEFAULT_RULES,
    periods: 4,
    periodMinutes: 8,
    overtimeMinutes: 4,
    foulsToFoulOut: 5,
    teamFoulsForBonus: 7,
    shotClockSeconds: 35,
  },
};

/**
 * Five on the floor. A roster of exactly five means no substitutions and no
 * cover for a foul-out, so the roster minimum is higher than the lineup one.
 */
/**
 * What this sport calls the numbered playing surface within a venue.
 *
 * "Park" was hardcoded for the venue and "Field" for the surface, which read
 * as nonsense on a basketball team playing at a rec centre. The venue label is
 * now "Location" for every sport; this is the part that genuinely differs.
 */
/** Positions offered on the roster. */
export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export const FIELD_WORD = 'Court';
export const VENUE_PLACEHOLDER = 'Hoover Rec Center';

/**
 * No field visual.
 *
 * The court graphic didn't do anything — it took no taps, and the fouls it
 * displayed duplicated the team-fouls counter already in the header. Removing
 * it isn't a placeholder for a future shot chart (that's a real, separate
 * feature if it's ever wanted); it's a plain "this sport doesn't need one."
 * Court.jsx is left in the codebase for that possible future rather than
 * deleted.
 *
 * COMPACT_HEIGHT_THRESHOLD is set well above baseball's. Basketball's control
 * stack — player picker, box score, fouls, opponent scoring — is taller even
 * in casual mode, so it needs the compact layout on more phones, not fewer.
 */
/**
 * Sound effects for basketball.
 *
 * Every synthesized built-in fits here — a buzzer marks the end of a period,
 * a whistle is a foul, an air horn is a celebration. Custom slots are
 * suggested toward the sounds that matter most for THIS sport specifically:
 * a real buzzer (the synthesized one is a fair stand-in, but the real thing
 * from a gym is unmistakable) and a dunk/rim effect that has no synthesized
 * equivalent at all.
 */
export const SOUNDBOARD_BUILTIN_IDS = ['buzzer', 'whistle', 'airhorn', 'drumroll', 'cheer', 'applause'];
export const SOUNDBOARD_CUSTOM_SUGGESTIONS = ['Real Buzzer', 'Dunk FX', 'Crowd Chant', 'Swish'];

export const HAS_FIELD_VISUAL = false;
export const COMPACT_HEIGHT_THRESHOLD = 960;

export const MIN_PLAYERS = { roster: 5, lineup: 5, noun: 'players' };

/** Which rules Settings offers, in basketball's own words. */
export const RULE_NUMBERS = [
  ['periods', 'Periods per game'],
  ['periodMinutes', 'Minutes per period'],
  ['foulsToFoulOut', 'Fouls to foul out'],
  ['teamFoulsForBonus', 'Team fouls for bonus'],
  ['minimumMinutesPerGame', 'Minimum minutes per player'],
  ['shotClockSeconds', 'Shot clock (seconds)'],
];

export const RULE_TOGGLES = [
  ['threePointLine', 'Three-point line'],
  ['equalPlayingTime', 'Equal playing time required'],
];

/** Editable numbers, with bounds, for the Settings steppers. */
export const RULE_BOUNDS = {
  periods: { min: 2, max: 4, step: 1 },
  periodMinutes: { min: 4, max: 12, step: 1 },
  overtimeMinutes: { min: 1, max: 5, step: 1 },
  foulsToFoulOut: { min: 0, max: 6, step: 1 },
  teamFoulsForBonus: { min: 0, max: 10, step: 1 },
  minimumMinutesPerGame: { min: 0, max: 32, step: 1 },
  shotClockSeconds: { min: 0, max: 35, step: 5 },
  mercyRuleDifferential: { min: 0, max: 50, step: 5 },
};

export function resolveRules(preset, overrides = {}) {
  const base = preset && RULE_PRESETS[preset] ? RULE_PRESETS[preset] : DEFAULT_RULES;
  return { ...base, ...overrides };
}

/** Whether a player is disqualified on fouls. Zero means the rule is off. */
export function hasFouledOut(fouls, rules) {
  const limit = rules?.foulsToFoulOut || 0;
  return limit > 0 && fouls >= limit;
}

/** Whether the other team is shooting on every foul this period. */
export function inBonus(teamFouls, rules) {
  const limit = rules?.teamFoulsForBonus || 0;
  return limit > 0 && teamFouls >= limit;
}
