/**
 * scoringModes.js — How much work the scorekeeper signs up for.
 *
 * Basketball is worse than baseball for tap load. A rec game has 120-160
 * possessions and no natural pause to log during; baseball at least gives you
 * the walk back to the dugout.
 *
 * ── The split ───────────────────────────────────────────────────────────────
 *
 * CASUAL is points only: made 1, made 2, made 3, and misses. About one tap per
 * possession, which a parent can manage while watching their own kid.
 *
 * FULL adds the box score — rebounds, assists, steals, blocks, turnovers — and
 * substitutions, which is what makes minutes possible.
 *
 * FOULS APPEAR IN BOTH. Five fouls ends a child's game and team fouls decide
 * the bonus, so a foul is eligibility information, not a flavour stat. This
 * mirrors baseball keeping pitch counts in casual mode for the same reason:
 * the safety and eligibility number survives, the colour doesn't.
 *
 * ── The consequence for minutes ─────────────────────────────────────────────
 *
 * Substitutions are FULL-only, so casual mode produces no minutes at all. That
 * is the honest outcome and the engine reports it as untracked rather than
 * inventing a number. Half-logged minutes would be worse than none, because
 * equal-playing-time is exactly the figure a parent will act on.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { EV } from './events.js';

export const SCORING_MODES = {
  FULL: 'full',       // box score and substitutions
  CASUAL: 'casual',   // points and fouls only
};

export const CONTROL_GROUPS = {
  SCORE: 'score',
  BOX: 'box',
  FOUL: 'foul',
  BENCH: 'bench',
};

const SCORE_CONTROLS_FULL = [
  EV.MADE_1, EV.MADE_2, EV.MADE_3, EV.MISS_1, EV.MISS_2, EV.MISS_3,
];

// Free-throw misses are the least valuable tap in casual mode and the easiest
// to lose track of, so the short list keeps the three that decide the score.
const SCORE_CONTROLS_CASUAL = [EV.MADE_1, EV.MADE_2, EV.MADE_3, EV.MISS_2];

const BOX_CONTROLS = [
  EV.REBOUND_DEF, EV.REBOUND_OFF, EV.ASSIST, EV.STEAL, EV.BLOCK, EV.TURNOVER,
];

const FOUL_CONTROLS = [EV.FOUL_PERSONAL, EV.FOUL_DRAWN];

export function getVisibleControls(mode, rules = {}) {
  const full = mode === SCORING_MODES.FULL;
  const score = full ? SCORE_CONTROLS_FULL : SCORE_CONTROLS_CASUAL;

  return {
    [CONTROL_GROUPS.SCORE]: rules.threePointLine
      ? score
      : score.filter((e) => e !== EV.MADE_3 && e !== EV.MISS_3),
    [CONTROL_GROUPS.BOX]: full ? BOX_CONTROLS : [],
    // Always present, in both modes, on purpose.
    [CONTROL_GROUPS.FOUL]: FOUL_CONTROLS,
    [CONTROL_GROUPS.BENCH]: full,
  };
}

/**
 * Rough taps per game, used to show the tradeoff honestly in Settings rather
 * than describing casual mode as free.
 */
export function estimateTaps(mode, { possessions = 140 } = {}) {
  const full = mode === SCORING_MODES.FULL;
  const shots = Math.round(possessions * 0.9);
  const box = full ? Math.round(possessions * 0.8) : 0;
  const subs = full ? 40 : 0;
  const fouls = 30;
  return shots + box + subs + fouls;
}

export const MODE_TRADEOFFS = {
  [SCORING_MODES.FULL]: {
    label: 'Full box score',
    keeps: ['Points', 'Rebounds', 'Assists', 'Steals', 'Blocks', 'Turnovers',
            'Fouls', 'Minutes played'],
    costs: [],
    note: 'Everything, including minutes. Needs a scorekeeper who is not also '
        + 'watching their own child closely.',
  },
  [SCORING_MODES.CASUAL]: {
    label: 'Points only',
    keeps: ['Points', 'Shooting percentages', 'Fouls', 'Team fouls and bonus'],
    costs: ['Rebounds, assists, steals, blocks, turnovers', 'Minutes played'],
    note: 'About one tap per possession. Minutes are not tracked at all in '
        + 'this mode — a partial count would be worse than none.',
  },
};

/** True when substitutions are being logged, and minutes therefore mean something. */
export const tracksMinutes = (mode) => mode === SCORING_MODES.FULL;
