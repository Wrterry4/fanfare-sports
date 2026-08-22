/**
 * index.js — The basketball pack.
 *
 * Exports exactly the surface baseball does, which is what lets the shared
 * screens use either without a conditional. tests/sportContract.test.js checks
 * every name here against the interface.
 *
 * What this sport proved about the refactor:
 *
 *   The presenter shapes held. Periods with no halves return direction: null,
 *   the score grid returns one total column instead of R and E, and
 *   describeParticipants returns five people instead of two — all absorbed by
 *   the existing shapes rather than needing new ones.
 *
 *   The generalized SubstitutionSheet earned itself back immediately.
 *   Basketball substitutes constantly, and it needed no new UI at all.
 *
 *   One thing did NOT generalize: ParticipantBar. Baseball's shows the batting
 *   order, which has no basketball equivalent, so this pack supplies a bench
 *   strip through describeUpNext instead and exports no bar.
 */

export { basketballTheme as theme, basketballTerms as terms } from './theme.js';
export { EV, SHOT_VALUE, MADE_SHOTS, MISSED_SHOTS, SHOT_PAIRS, FOULS, EVENT_WORDS } from './events.js';
export { reduce, undo, voidEvent, applyEvent, createInitialState, minutesFor } from './engine.js';
export { computeStats, mergeStats, playingTimeReport } from './stats.js';
export {
  DEFAULT_RULES, RULE_PRESETS, PRESET_LABELS, RULE_BOUNDS, RULE_NUMBERS, RULE_TOGGLES,
  MIN_PLAYERS, FIELD_WORD, VENUE_PLACEHOLDER, POSITIONS,
  HAS_FIELD_VISUAL, COMPACT_HEIGHT_THRESHOLD,
  SOUNDBOARD_BUILTIN_IDS, SOUNDBOARD_CUSTOM_SUGGESTIONS,
  resolveRules, hasFouledOut, inBonus,
} from './rules.js';
export { buildGameConfig, realPlayerIds, OPPONENT_PREFIX, isOpponentId } from './config.js';
export {
  SCORING_MODES, CONTROL_GROUPS, getVisibleControls, estimateTaps,
  MODE_TRADEOFFS, tracksMinutes,
} from './scoringModes.js';

// The presenter layer — how the shared screens see this sport.
export {
  describePeriod, describeCounters, describePeriodScores,
  describeParticipants, describeSubstitution, describeUpNext,
  describeFeedEntry, describeStatLine, describeStatCard, describeTodayLine, describeMoment,
  EMPTY_FEED_TEXT, walkUpSlot,
} from './present.js';

// Named to match baseball's slots so GameDayScreen can destructure either.
export { default as Field } from './components/Court.jsx';
export { default as ActionPads } from './components/ActionPads.jsx';
export { default as RunnerSheet } from './components/CorrectionSheet.jsx';

export const key = 'basketball';
export const displayName = 'Basketball';
