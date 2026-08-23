/**
 * scoringModes.js — How much work the scorekeeper signs up for.
 *
 * The single biggest adoption risk in this app is that someone has to tap
 * three to four hundred times per game while also trying to watch their own
 * kid play. That person burns out around week four and the book goes back to
 * paper.
 *
 * Casual mode logs plate-appearance outcomes and skips pitch-by-pitch. You
 * lose pitch count and strike percentage; you keep every rate stat that
 * matters — AVG, OBP, SLG, OPS, RBI, runs.
 *
 * One asymmetry drives the design: pitch counts are only needed for YOUR OWN
 * pitcher, and rest-day rules make them non-negotiable. So casual mode drops
 * pitch entry while your team is batting, and keeps it while your team is in
 * the field. That's roughly half the game at full detail and half at a
 * fraction of it.
 *
 * The engine needs no changes for any of this. Casual mode is a decision about
 * which buttons are on screen; the event log keeps the same shape, and
 * computeStats() does not care whether the pitches leading to a strikeout were
 * logged one at a time.
 */

import { EV } from './events.js';

export const SCORING_MODES = {
  FULL: 'full',       // every pitch
  CASUAL: 'casual',   // outcomes, plus pitches only when we're pitching
};

export const CONTROL_GROUPS = {
  PITCH: 'pitch',
  ON_BASE: 'onBase',
  OUT: 'out',
  BASERUNNING: 'baserunning',
};

const PITCH_CONTROLS = [EV.BALL, EV.STRIKE_SWINGING, EV.FOUL];

const ON_BASE_CONTROLS = [
  EV.SINGLE, EV.DOUBLE, EV.TRIPLE, EV.HOME_RUN, EV.WALK,
];

const OUT_CONTROLS = [
  EV.GROUND_OUT, EV.FLY_OUT, EV.STRIKEOUT, EV.FIELDERS_CHOICE, EV.REACHED_ON_ERROR,
];

/**
 * In full mode a strikeout is produced by the third strike, so a K button is
 * redundant — and worse, tapping it after two logged strikes silently
 * backfills a third pitch that was never thrown. Outcome-only mode has no
 * pitch buttons, so there K is the only way to record one.
 */
const OUT_CONTROLS_FULL = OUT_CONTROLS.filter((e) => e !== EV.STRIKEOUT);

const BASERUNNING_CONTROLS = [
  EV.STOLEN_BASE, EV.CAUGHT_STEALING, EV.PICKED_OFF,
  EV.WILD_PITCH, EV.PASSED_BALL, EV.BALK,
];

/**
 * @param mode          SCORING_MODES value
 * @param weArePitching true when our team is in the field
 */
export function getVisibleControls(mode, weArePitching) {
  // Casual mode now hides the pitch row in BOTH halves of the inning.
  //
  // Previously it kept pitch buttons while our own pitcher worked, so toggling
  // the mode appeared to do nothing for half the game — it looked like the
  // button had stopped responding. Pitch counts still matter, so casual mode
  // swaps the three-button pitch row for a single tally control instead.
  const showsPitches = mode === SCORING_MODES.FULL;
  const groups = {
    [CONTROL_GROUPS.ON_BASE]: ON_BASE_CONTROLS,
    [CONTROL_GROUPS.OUT]: showsPitches ? OUT_CONTROLS_FULL : OUT_CONTROLS,
    [CONTROL_GROUPS.BASERUNNING]: BASERUNNING_CONTROLS,
  };

  if (showsPitches) groups[CONTROL_GROUPS.PITCH] = PITCH_CONTROLS;

  return groups;
}

export const showsPitchEntry = (mode) => mode === SCORING_MODES.FULL;

/**
 * In casual mode, a single tally button keeps the pitch count honest while our
 * pitcher works — rest-day limits depend on it and nothing else can
 * reconstruct it after the fact.
 */
export const showsPitchTally = (mode, weArePitching) =>
  mode === SCORING_MODES.CASUAL && weArePitching;

/**
 * True when our team is in the field, given the half-inning and which dugout
 * we're in. Home bats in the bottom.
 */
export function weArePitching(isTop, homeOrAway) {
  return homeOrAway === 'home' ? isTop : !isTop;
}

/**
 * What the scorekeeper gives up. Shown once, on the mode picker, so the choice
 * is informed rather than a guess about what "casual" means.
 */
export const MODE_TRADEOFFS = {
  [SCORING_MODES.FULL]: {
    label: 'Every pitch',
    detail: 'Full pitch counts, strike percentage, and complete at-bat history.',
    keeps: ['AVG / OBP / SLG / OPS', 'RBI and runs', 'Pitch counts', 'Strike %', 'Pitch-by-pitch log'],
    loses: [],
  },
  [SCORING_MODES.CASUAL]: {
    label: 'Outcomes',
    detail: 'Log what happened at each at-bat. Pitch entry stays on while your pitcher works.',
    keeps: ['AVG / OBP / SLG / OPS', 'RBI and runs', 'Pitch counts for your pitcher'],
    loses: ['Strike % for opposing pitchers', 'Pitch-by-pitch replay'],
  },
};

/**
 * Rough tap counts per nine-inning game, used to make the tradeoff concrete on
 * the picker screen rather than abstract.
 */
export function estimateTaps(mode, { plateAppearances = 80, pitchesPerPA = 3.8 } = {}) {
  const outcomeTaps = plateAppearances;
  const allPitchTaps = Math.round(plateAppearances * pitchesPerPA);

  if (mode === SCORING_MODES.FULL) {
    return { total: outcomeTaps + allPitchTaps, pitches: allPitchTaps, outcomes: outcomeTaps };
  }
  // Half the plate appearances are ours; we only log pitches for the other half.
  const pitches = Math.round(allPitchTaps / 2);
  return { total: outcomeTaps + pitches, pitches, outcomes: outcomeTaps };
}

export function tapReduction(opts) {
  const full = estimateTaps(SCORING_MODES.FULL, opts).total;
  const casual = estimateTaps(SCORING_MODES.CASUAL, opts).total;
  return Math.round(((full - casual) / full) * 100);
}
