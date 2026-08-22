/**
 * events.js — What can happen in a basketball game.
 *
 * Same discipline as baseball: an append-only log of small facts, never
 * derived totals. Nothing here says "12 points" — points come from replaying
 * makes. That's what lets a mis-tap be voided and the whole game recomputed.
 *
 * The vocabulary is deliberately smaller than baseball's. Basketball has no
 * count to track and no base state, so most events are a player doing a thing
 * once. The complexity lives elsewhere: who is on the floor, and for how long.
 */

export const EV = {
  // ---- lifecycle ---------------------------------------------------------
  GAME_START: 'GAME_START',
  PERIOD_END: 'PERIOD_END',
  GAME_END: 'GAME_END',

  // ---- scoring -----------------------------------------------------------
  // Made shots carry their own value so the engine never has to guess whether
  // a shot was behind the arc.
  MADE_1: 'MADE_1',
  MADE_2: 'MADE_2',
  MADE_3: 'MADE_3',
  MISS_1: 'MISS_1',
  MISS_2: 'MISS_2',
  MISS_3: 'MISS_3',

  // ---- box score ---------------------------------------------------------
  REBOUND_OFF: 'REBOUND_OFF',
  REBOUND_DEF: 'REBOUND_DEF',
  ASSIST: 'ASSIST',
  STEAL: 'STEAL',
  BLOCK: 'BLOCK',
  TURNOVER: 'TURNOVER',

  // ---- fouls -------------------------------------------------------------
  // Tracked in BOTH scoring modes. Five fouls ends a child's game and the
  // bonus changes how the last two minutes are played, so this is eligibility
  // information rather than a flavour stat — the same argument that keeps
  // pitch counts out of baseball's casual mode.
  FOUL_PERSONAL: 'FOUL_PERSONAL',
  FOUL_TECHNICAL: 'FOUL_TECHNICAL',
  FOUL_DRAWN: 'FOUL_DRAWN',

  // ---- who is on the floor -----------------------------------------------
  SUBSTITUTION: 'SUBSTITUTION',
  // Opens a period with a known five. Without one, minutes for that period
  // can't be trusted and are reported as untracked rather than guessed.
  LINEUP_SET: 'LINEUP_SET',

  // ---- opponent ----------------------------------------------------------
  // The other team's scoring, kept coarse. Nobody is charting an opponent's
  // assists at 10U, but the score has to be right.
  OPPONENT_SCORE: 'OPPONENT_SCORE',
};

/** Every made shot, and what it's worth. */
export const SHOT_VALUE = {
  [EV.MADE_1]: 1,
  [EV.MADE_2]: 2,
  [EV.MADE_3]: 3,
};

export const MADE_SHOTS = [EV.MADE_1, EV.MADE_2, EV.MADE_3];
export const MISSED_SHOTS = [EV.MISS_1, EV.MISS_2, EV.MISS_3];

/** Attempt pairs, so a percentage can be computed without special cases. */
export const SHOT_PAIRS = [
  { made: EV.MADE_1, missed: EV.MISS_1, value: 1, key: 'ft' },
  { made: EV.MADE_2, missed: EV.MISS_2, value: 2, key: 'fg2' },
  { made: EV.MADE_3, missed: EV.MISS_3, value: 3, key: 'fg3' },
];

export const FOULS = [EV.FOUL_PERSONAL, EV.FOUL_TECHNICAL];

/** Events that name a player. Used to validate a log and to build box scores. */
export const PLAYER_EVENTS = [
  ...MADE_SHOTS, ...MISSED_SHOTS, ...FOULS,
  EV.REBOUND_OFF, EV.REBOUND_DEF, EV.ASSIST, EV.STEAL, EV.BLOCK,
  EV.TURNOVER, EV.FOUL_DRAWN,
];

export const LIFECYCLE = [EV.GAME_START, EV.PERIOD_END, EV.GAME_END];

/** Plain English for the play feed. */
export const EVENT_WORDS = {
  [EV.MADE_1]: 'made a free throw',
  [EV.MADE_2]: 'scored',
  [EV.MADE_3]: 'hit a three',
  [EV.MISS_1]: 'missed a free throw',
  [EV.MISS_2]: 'missed',
  [EV.MISS_3]: 'missed a three',
  [EV.REBOUND_OFF]: 'grabbed an offensive rebound',
  [EV.REBOUND_DEF]: 'grabbed a rebound',
  [EV.ASSIST]: 'assisted',
  [EV.STEAL]: 'stole the ball',
  [EV.BLOCK]: 'blocked a shot',
  [EV.TURNOVER]: 'turned it over',
  [EV.FOUL_PERSONAL]: 'was called for a foul',
  [EV.FOUL_TECHNICAL]: 'was called for a technical',
  [EV.FOUL_DRAWN]: 'drew a foul',
};
