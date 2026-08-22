/** Baseball sport pack. The single import surface for everything baseball. */

export { baseballTheme as theme, baseballTerms as terms } from './theme.js';
export { EV, makeEvent, PA_ENDING, HITS, HIT_BASES } from './events.js';
export { reduce, undo, voidEvent, applyEvent, createInitialState } from './engine.js';
export { computeStats, mergeStats } from './stats.js';
export { DEFAULT_RULES, RULE_PRESETS, PRESET_LABELS, RULE_BOUNDS, RULE_NUMBERS, RULE_TOGGLES, PRESET_ORDER, MIN_PLAYERS, FIELD_WORD, VENUE_PLACEHOLDER, POSITIONS,
  HAS_FIELD_VISUAL, COMPACT_HEIGHT_THRESHOLD,
  SOUNDBOARD_BUILTIN_IDS, SOUNDBOARD_CUSTOM_SUGGESTIONS,
  resolveRules, restDaysFor } from './rules.js';
export { buildGameConfig, realPlayerIds, OPPONENT_PREFIX, isOpponentId } from './config.js';
export { SCORING_MODES, getVisibleControls, weArePitching, estimateTaps, MODE_TRADEOFFS } from './scoringModes.js';

// The presenter layer — how the shared screens see this sport. Every sport
// must export all of these; enforced by tests/sportContract.test.js.
export {
  describePeriod, describeCounters, describePeriodScores,
  describeParticipants, describeSubstitution, describeUpNext,
  describeFeedEntry, describeStatLine, describeStatCard, describeTodayLine, describeMoment,
  EMPTY_FEED_TEXT, walkUpSlot,
} from './present.js';
export { exportCsv, exportCareerJson, exportGameJson } from './export.js';

export { default as Field } from './components/Field.jsx';
export { default as ActionPads } from './components/ActionPads.jsx';
export { default as RunnerSheet } from './components/RunnerSheet.jsx';
export { default as ParticipantBar } from './components/BatterBar.jsx';

export const key = 'baseball';
export const displayName = 'Baseball';
