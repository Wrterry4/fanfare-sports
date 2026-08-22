/**
 * events.js — The vocabulary of the append-only log.
 *
 * Every event is a plain object:
 *   { seq, type, payload, createdBy, createdAt, voided }
 *
 * The engine never mutates totals. State is always reduce(events, rules).
 * That's what makes undo trivial and mid-log corrections possible.
 */

export const EV = {
  // Lifecycle
  GAME_START: 'GAME_START',
  INNING_START: 'INNING_START',
  INNING_END: 'INNING_END',
  GAME_END: 'GAME_END',

  // Batter
  BATTER_UP: 'BATTER_UP',

  // Pitches
  BALL: 'BALL',
  // Counts toward the pitcher's total and nothing else. Outcome-only mode
  // needs a way to keep pitch counts honest (rest-day limits depend on them)
  // without implying anything about the count — the tally button used to fire
  // BALL, which walked batters that never walked.
  PITCH_TALLY: 'PITCH_TALLY',
  STRIKE_SWINGING: 'STRIKE_SWINGING',
  STRIKE_LOOKING: 'STRIKE_LOOKING',
  FOUL: 'FOUL',

  // Outcomes
  SINGLE: 'SINGLE',
  DOUBLE: 'DOUBLE',
  TRIPLE: 'TRIPLE',
  HOME_RUN: 'HOME_RUN',
  WALK: 'WALK',
  HBP: 'HBP',
  STRIKEOUT: 'STRIKEOUT',
  GROUND_OUT: 'GROUND_OUT',
  FLY_OUT: 'FLY_OUT',
  LINE_OUT: 'LINE_OUT',
  SAC_FLY: 'SAC_FLY',
  SAC_BUNT: 'SAC_BUNT',
  FIELDERS_CHOICE: 'FIELDERS_CHOICE',
  REACHED_ON_ERROR: 'REACHED_ON_ERROR',
  DOUBLE_PLAY: 'DOUBLE_PLAY',
  TRIPLE_PLAY: 'TRIPLE_PLAY',

  // Baserunning
  STOLEN_BASE: 'STOLEN_BASE',
  CAUGHT_STEALING: 'CAUGHT_STEALING',
  PICKED_OFF: 'PICKED_OFF',
  WILD_PITCH: 'WILD_PITCH',
  PASSED_BALL: 'PASSED_BALL',
  BALK: 'BALK',
  RUNNER_ADVANCE: 'RUNNER_ADVANCE',

  // Defense / roster
  ERROR: 'ERROR',
  SUBSTITUTION: 'SUBSTITUTION',
  POSITION_CHANGE: 'POSITION_CHANGE',
  PITCHER_CHANGE: 'PITCHER_CHANGE',

  // Meta
  MANUAL_SCORE_ADJUST: 'MANUAL_SCORE_ADJUST',
};

/** Events that end a plate appearance. */
export const PA_ENDING = new Set([
  EV.SINGLE, EV.DOUBLE, EV.TRIPLE, EV.HOME_RUN, EV.WALK, EV.HBP,
  EV.STRIKEOUT, EV.GROUND_OUT, EV.FLY_OUT, EV.LINE_OUT,
  EV.SAC_FLY, EV.SAC_BUNT, EV.FIELDERS_CHOICE, EV.REACHED_ON_ERROR,
  EV.DOUBLE_PLAY, EV.TRIPLE_PLAY,
]);

export const HITS = new Set([EV.SINGLE, EV.DOUBLE, EV.TRIPLE, EV.HOME_RUN]);

/** Base the batter reaches on a hit. */
export const HIT_BASES = {
  [EV.SINGLE]: 1,
  [EV.DOUBLE]: 2,
  [EV.TRIPLE]: 3,
  [EV.HOME_RUN]: 4,
};

/** Total bases, for SLG. */
export const TOTAL_BASES = HIT_BASES;

/**
 * No RBI is credited when the run scores on an error, or on a
 * ground-into-double-play. Everything else that drives a runner in counts.
 */
export const NO_RBI_EVENTS = new Set([
  EV.REACHED_ON_ERROR, EV.DOUBLE_PLAY, EV.TRIPLE_PLAY,
  EV.ERROR, EV.WILD_PITCH, EV.PASSED_BALL, EV.BALK,
  EV.STOLEN_BASE, EV.PICKED_OFF, EV.CAUGHT_STEALING,
]);

let seqCounter = 0;

/**
 * Build an event. In production `seq` comes from the game doc's eventCount
 * and `createdAt` is a server timestamp — this helper is for tests and for
 * optimistic local appends before the write lands.
 */
export function makeEvent(type, payload = {}, meta = {}) {
  return {
    seq: meta.seq !== undefined ? meta.seq : seqCounter++,
    type,
    payload,
    createdBy: meta.createdBy || null,
    createdAt: meta.createdAt || null,
    voided: false,
  };
}

export function resetSeq() {
  seqCounter = 0;
}
