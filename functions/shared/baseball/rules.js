/**
 * rules.js — League rule configuration.
 *
 * Two categories, and the distinction is load-bearing:
 *   CONFIG  — numbers and limits. Safe to change between games.
 *   FORKS   — booleans the state machine branches on. Enumerated up front
 *             because discovering one halfway through writing the engine
 *             means rewriting the engine.
 *
 * A snapshot of the resolved rules is frozen into every game document at
 * creation. If a league amends a rule in June, May's games must not rescore.
 */

export const DEFAULT_RULES = {
  // ---- Config -------------------------------------------------------------
  inningsPerGame: 6,
  maxRunsPerInning: null,        // null = uncapped
  maxRunsPerInningFinal: null,   // many leagues uncap the last inning
  mercyRuleDifferential: null,   // e.g. 15
  mercyRuleAfterInning: null,    // e.g. 3
  gameTimeLimitMinutes: null,
  noNewInningAfterMinutes: null,
  maxPitchesPerOuting: null,
  restDayThresholds: [],         // [{ minPitches, restDays }], descending
  minimumPlayTimeInnings: 0,

  // ---- Engine forks -------------------------------------------------------
  continuousBattingOrder: false, // bat the whole roster, not 9
  droppedThirdStrike: true,
  leadOffsAllowed: true,
  stealingAllowed: true,
  courtesyRunnerForCatcher: false,
  infieldFlyRule: true,
  walksAdvanceAllRunners: false, // t-ball: a walk pushes everyone, not just forces
  coachPitchAfterStrikes: null,  // n strikes -> coach pitches; null = off
  defensiveRotationRequired: false,
  // T-ball convention: the order flips each inning so the same kids aren't
  // always batting last.
  reverseBattingOrderEachInning: false,
};

/**
 * Bounds for the settings UI. Free-text number fields invite typos that
 * silently break scoring — 60 innings, a 3-pitch limit — so the screen uses
 * steppers constrained to these ranges.
 */
export const RULE_BOUNDS = {
  inningsPerGame:         { min: 1,  max: 9,   step: 1 },
  maxRunsPerInning:       { min: 1,  max: 20,  step: 1,  nullable: true },
  maxRunsPerInningFinal:  { min: 1,  max: 20,  step: 1,  nullable: true },
  mercyRuleDifferential:  { min: 5,  max: 20,  step: 1,  nullable: true },
  mercyRuleAfterInning:   { min: 1,  max: 8,   step: 1,  nullable: true },
  gameTimeLimitMinutes:   { min: 60, max: 180, step: 5,  nullable: true },
  noNewInningAfterMinutes:{ min: 45, max: 175, step: 5,  nullable: true },
  maxPitchesPerOuting:    { min: 30, max: 150, step: 5,  nullable: true },
  minimumPlayTimeInnings: { min: 0,  max: 9,   step: 1 },
};

/**
 * Presets. A league admin picks one, then overrides individual fields.
 * These are starting points, not gospel — every league amends something.
 */
/**
 * Presets by age division.
 *
 * Drawn from published rule sets (USSSA-style tournament rules, Five Tool,
 * 6-4-3, Baseball For All, and typical rec-league documents). Leagues amend
 * constantly, so these are starting points — every value is editable in
 * Settings, and each game freezes its own snapshot.
 *
 * Recurring patterns worth knowing:
 *   • Run cap is usually 5 per half inning, uncapped in the final inning
 *   • Mercy tightens as the game goes: 15 after 3, 10 after 4, 8 after 5
 *   • Over 35 pitches in a day means a day of rest at nearly every level
 *   • 6U–8U ~1:10, 9U–12U ~1:30–1:45, 13U–14U ~1:40–1:55
 */
/**
 * Display names for the presets, ordered youngest to oldest.
 *
 * Lives in the sport pack rather than in a screen because every sport has its
 * own age ladder — basketball's won't be "T-Ball, Coach Pitch, 10U". Any UI
 * that offers a rule preset reads this, so adding a sport doesn't mean hunting
 * for a hardcoded list.
 */
/**
 * Which rules the Settings screen offers, and what to call them.
 *
 * Lived in SettingsScreen as two hardcoded arrays, which meant every label
 * there described baseball — "Innings per game" and "Dropped third strike" on
 * a basketball team's settings. Each pack names its own.
 */
/**
 * How many players it takes to field a team, and how many to bat.
 *
 * Separate numbers on purpose. Nine take the field, but a lineup can be
 * shorter — youth leagues routinely play with eight and take an automatic out,
 * and a game with seven is still a game worth scoring. This is what the start
 * gate warns against, never what it blocks.
 */
/**
 * What this sport calls the numbered playing surface within a venue.
 *
 * "Park" was hardcoded for the venue and "Field" for the surface, which read
 * as nonsense on a basketball team playing at a rec centre. The venue label is
 * now "Location" for every sport; this is the part that genuinely differs.
 */
/** Positions offered on the roster. Was hardcoded in RosterScreen. */
export const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

export const FIELD_WORD = 'Field';
export const VENUE_PLACEHOLDER = 'Rowlett Creek';

/**
 * Whether this sport gets a field/court visual on Game Day, and the height at
 * which the shared screen switches to its compact control layout.
 *
 * Both used to be assumptions baked into GameDayScreen — a hardcoded 860px
 * breakpoint and an unconditional <Field>. Basketball's control stack is
 * taller (a player picker, a box score, fouls, and opponent scoring, versus
 * baseball's pitch/hit/out rows), so reusing baseball's breakpoint left its
 * bottom row cut off on most phones. Each sport now owns its own numbers.
 */
/**
 * Sound effects for baseball.
 *
 * Deliberately excludes buzzer and whistle — neither one means anything at a
 * baseball game, and showing them would just be clutter borrowed from
 * basketball. Air horn, drum roll, cheer, and applause all fit real
 * ballpark moments. Custom slots are suggested toward the things a
 * synthesized effect can't touch at all: the actual crack of a bat, an organ
 * riff, a specific umpire call.
 */
export const SOUNDBOARD_BUILTIN_IDS = ['airhorn', 'drumroll', 'cheer', 'applause'];
export const SOUNDBOARD_CUSTOM_SUGGESTIONS = ['Crack of the Bat', 'Organ Charge', 'Walk-off Cheer', "Ump's Call"];

export const HAS_FIELD_VISUAL = true;
export const COMPACT_HEIGHT_THRESHOLD = 860;

export const MIN_PLAYERS = { roster: 9, lineup: 9, noun: 'batters' };

export const RULE_NUMBERS = [
  ['inningsPerGame', 'Innings per game'],
  ['maxRunsPerInning', 'Run cap per inning'],
  ['mercyRuleDifferential', 'Mercy rule run difference'],
  ['mercyRuleAfterInning', 'Mercy rule after inning'],
  ['gameTimeLimitMinutes', 'Time limit (minutes)'],
  ['maxPitchesPerOuting', 'Max pitches per outing'],
];

export const RULE_TOGGLES = [
  ['continuousBattingOrder', 'Bat the whole roster'],
  ['reverseBattingOrderEachInning', 'Reverse batting order each inning'],
  ['droppedThirdStrike', 'Dropped third strike'],
  ['stealingAllowed', 'Stealing allowed'],
  ['leadOffsAllowed', 'Lead-offs allowed'],
  ['infieldFlyRule', 'Infield fly rule'],
  ['walksAdvanceAllRunners', 'Walks advance all runners'],
  ['courtesyRunnerForCatcher', 'Courtesy runner for catcher'],
];

export const PRESET_LABELS = [
  ['tball6U', 'T-Ball 6U'],
  ['tball', 'T-Ball'],
  ['coachPitch8U', 'Coach Pitch 8U'],
  ['coachPitch', 'Coach Pitch'],
  ['kidPitch9U', '9U Kid Pitch'],
  ['kidPitch10U', '10U Kid Pitch'],
  ['kidPitch11U', '11U Kid Pitch'],
  ['kidPitch12U', '12U Kid Pitch'],
  ['kidPitch13U', '13U Kid Pitch'],
  ['kidPitch14U', '14U Kid Pitch'],
  ['highSchool', 'High School'],
];

export const RULE_PRESETS = {
  tball: {
    ...DEFAULT_RULES,
    reverseBattingOrderEachInning: true,
    inningsPerGame: 4,
    maxRunsPerInning: 5,
    continuousBattingOrder: true,
    droppedThirdStrike: false,
    leadOffsAllowed: false,
    stealingAllowed: false,
    infieldFlyRule: false,
    walksAdvanceAllRunners: true,
    mercyRuleDifferential: 15,
    mercyRuleAfterInning: 3,
  },

  coachPitch: {
    ...DEFAULT_RULES,
    inningsPerGame: 5,
    maxRunsPerInning: 5,
    continuousBattingOrder: true,
    droppedThirdStrike: false,
    leadOffsAllowed: false,
    stealingAllowed: false,
    infieldFlyRule: false,
    mercyRuleDifferential: 15,
    mercyRuleAfterInning: 3,
  },

  kidPitch10U: {
    ...DEFAULT_RULES,
    inningsPerGame: 6,
    maxRunsPerInning: 5,
    maxRunsPerInningFinal: null,
    continuousBattingOrder: true,
    droppedThirdStrike: false,
    leadOffsAllowed: false,
    stealingAllowed: true,
    maxPitchesPerOuting: 75,
    restDayThresholds: [
      { minPitches: 66, restDays: 4 },
      { minPitches: 51, restDays: 3 },
      { minPitches: 36, restDays: 2 },
      { minPitches: 21, restDays: 1 },
      { minPitches: 1, restDays: 0 },
    ],
    mercyRuleDifferential: 12,
    mercyRuleAfterInning: 4,
  },

  kidPitch12U: {
    ...DEFAULT_RULES,
    inningsPerGame: 6,
    maxRunsPerInning: 5,
    continuousBattingOrder: true,
    maxPitchesPerOuting: 85,
    restDayThresholds: [
      { minPitches: 66, restDays: 4 },
      { minPitches: 51, restDays: 3 },
      { minPitches: 36, restDays: 2 },
      { minPitches: 21, restDays: 1 },
      { minPitches: 1, restDays: 0 },
    ],
    mercyRuleDifferential: 12,
    mercyRuleAfterInning: 4,
  },


  tball6U: {
    ...DEFAULT_RULES,
    inningsPerGame: 4,
    maxRunsPerInning: 5,
    gameTimeLimitMinutes: 60,
    continuousBattingOrder: true,
    reverseBattingOrderEachInning: true,
    droppedThirdStrike: false,
    leadOffsAllowed: false,
    stealingAllowed: false,
    infieldFlyRule: false,
    walksAdvanceAllRunners: true,
    mercyRuleDifferential: 11,
    mercyRuleAfterInning: 3,
  },

  coachPitch8U: {
    ...DEFAULT_RULES,
    inningsPerGame: 6,
    maxRunsPerInning: 5,
    maxRunsPerInningFinal: null,
    gameTimeLimitMinutes: 70,
    continuousBattingOrder: true,
    droppedThirdStrike: false,
    leadOffsAllowed: false,
    stealingAllowed: false,
    infieldFlyRule: false,
    mercyRuleDifferential: 15,
    mercyRuleAfterInning: 3,
  },

  kidPitch9U: {
    ...DEFAULT_RULES,
    inningsPerGame: 6,
    maxRunsPerInning: 5,
    gameTimeLimitMinutes: 90,
    continuousBattingOrder: true,
    droppedThirdStrike: false,
    leadOffsAllowed: false,
    stealingAllowed: true,
    courtesyRunnerForCatcher: true,
    maxPitchesPerOuting: 75,
    restDayThresholds: [
      { minPitches: 66, restDays: 4 },
      { minPitches: 51, restDays: 3 },
      { minPitches: 36, restDays: 2 },
      { minPitches: 21, restDays: 1 },
      { minPitches: 1,  restDays: 0 },
    ],
    mercyRuleDifferential: 15,
    mercyRuleAfterInning: 2,
  },

  kidPitch11U: {
    ...DEFAULT_RULES,
    inningsPerGame: 6,
    maxRunsPerInning: 5,
    gameTimeLimitMinutes: 105,
    continuousBattingOrder: true,
    leadOffsAllowed: true,
    stealingAllowed: true,
    courtesyRunnerForCatcher: true,
    maxPitchesPerOuting: 75,
    restDayThresholds: [
      { minPitches: 66, restDays: 4 },
      { minPitches: 51, restDays: 3 },
      { minPitches: 36, restDays: 2 },
      { minPitches: 21, restDays: 1 },
      { minPitches: 1,  restDays: 0 },
    ],
    mercyRuleDifferential: 15,
    mercyRuleAfterInning: 3,
  },

  kidPitch13U: {
    ...DEFAULT_RULES,
    inningsPerGame: 7,
    maxRunsPerInning: null,
    gameTimeLimitMinutes: 110,
    continuousBattingOrder: false,
    leadOffsAllowed: true,
    stealingAllowed: true,
    courtesyRunnerForCatcher: true,
    maxPitchesPerOuting: 85,
    restDayThresholds: [
      { minPitches: 76, restDays: 4 },
      { minPitches: 61, restDays: 3 },
      { minPitches: 46, restDays: 2 },
      { minPitches: 31, restDays: 1 },
      { minPitches: 1,  restDays: 0 },
    ],
    mercyRuleDifferential: 15,
    mercyRuleAfterInning: 3,
  },

  kidPitch14U: {
    ...DEFAULT_RULES,
    inningsPerGame: 7,
    maxRunsPerInning: null,
    gameTimeLimitMinutes: 115,
    continuousBattingOrder: false,
    leadOffsAllowed: true,
    stealingAllowed: true,
    maxPitchesPerOuting: 95,
    restDayThresholds: [
      { minPitches: 76, restDays: 4 },
      { minPitches: 61, restDays: 3 },
      { minPitches: 46, restDays: 2 },
      { minPitches: 31, restDays: 1 },
      { minPitches: 1,  restDays: 0 },
    ],
    mercyRuleDifferential: 15,
    mercyRuleAfterInning: 3,
  },

  highSchool: {
    ...DEFAULT_RULES,
    inningsPerGame: 7,
    maxRunsPerInning: null,
    continuousBattingOrder: false,
    maxPitchesPerOuting: 105,
    restDayThresholds: [
      { minPitches: 76, restDays: 3 },
      { minPitches: 51, restDays: 2 },
      { minPitches: 31, restDays: 1 },
      { minPitches: 1, restDays: 0 },
    ],
    mercyRuleDifferential: 10,
    mercyRuleAfterInning: 5,
  },
};

/** Ordered for the settings picker: youngest to oldest. */
export const PRESET_ORDER = [
  ['tball', 'T-Ball (4-5U)'],
  ['tball6U', 'T-Ball 6U'],
  ['coachPitch', 'Coach Pitch'],
  ['coachPitch8U', 'Coach Pitch 8U'],
  ['kidPitch9U', '9U'],
  ['kidPitch10U', '10U'],
  ['kidPitch11U', '11U'],
  ['kidPitch12U', '12U'],
  ['kidPitch13U', '13U'],
  ['kidPitch14U', '14U'],
  ['highSchool', 'High School'],
];

export function resolveRules(overrides = {}, preset = null) {
  const base = preset && RULE_PRESETS[preset] ? RULE_PRESETS[preset] : DEFAULT_RULES;
  return { ...base, ...overrides };
}

/** Rest days owed for a given pitch count under these rules. */
export function restDaysFor(pitches, rules) {
  const tiers = rules.restDayThresholds || [];
  for (const tier of tiers) {
    if (pitches >= tier.minPitches) return tier.restDays;
  }
  return 0;
}
