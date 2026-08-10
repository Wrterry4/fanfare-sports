/** Baseball sport pack. The single import surface for everything baseball. */

export { baseballTheme as theme, baseballTerms as terms } from './theme.js';
export { EV, makeEvent, PA_ENDING, HITS, HIT_BASES } from './events.js';
export { reduce, undo, voidEvent, applyEvent, createInitialState } from './engine.js';
export { computeStats, mergeStats } from './stats.js';
export { DEFAULT_RULES, RULE_PRESETS, resolveRules, restDaysFor } from './rules.js';
export { buildGameConfig, realPlayerIds, OPPONENT_PREFIX, isOpponentId } from './config.js';
export { SCORING_MODES, getVisibleControls, weArePitching, estimateTaps, MODE_TRADEOFFS } from './scoringModes.js';
export { exportCsv, exportCareerJson, exportGameJson } from './export.js';

export { default as Field } from './components/Field.jsx';
export { default as ActionPads } from './components/ActionPads.jsx';
export { default as RunnerSheet } from './components/RunnerSheet.jsx';
export { default as ParticipantBar } from './components/BatterBar.jsx';

export const key = 'baseball';
export const displayName = 'Baseball';
