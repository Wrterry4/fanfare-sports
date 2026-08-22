/**
 * gameOutcome.js — Did we win, and by how much.
 *
 * Split out from the celebration component so the question "should confetti
 * fire" is answerable without mounting anything, and so both sports get the
 * same answer. Every sport in this app scores as {home, away}, which is the
 * only assumption here.
 *
 * ── Why a loss is a first-class result ──────────────────────────────────────
 *
 * The obvious build is "when the game ends, throw confetti." Half of all games
 * are losses, and half of those are 8-year-olds. Firing a celebration at a kid
 * who just lost is worse than showing nothing at all, so the outcome is
 * computed first and the celebration asks it what it's allowed to do.
 *
 * A tie is its own answer too — some youth leagues don't play extras.
 */

/**
 * @param state       reduced game state; needs .status and .score
 * @param homeOrAway  which side WE are, from the game doc
 * @returns { final, result: 'win'|'loss'|'tie', us, them, margin } — `final`
 *          is false for a game still in progress, and everything else is
 *          still filled in so a caller can preview a score without branching
 */
export function describeOutcome(state, homeOrAway) {
  const home = Number(state?.score?.home) || 0;
  const away = Number(state?.score?.away) || 0;
  const weAreHome = homeOrAway !== 'away';   // unset defaults to home

  const us = weAreHome ? home : away;
  const them = weAreHome ? away : home;

  return {
    final: state?.status === 'final',
    result: us > them ? 'win' : us < them ? 'loss' : 'tie',
    us,
    them,
    margin: Math.abs(us - them),
  };
}

/** Only a finished win gets the full treatment. */
export const deservesCelebration = (outcome) => !!outcome?.final && outcome.result === 'win';

/**
 * The headline. Kept here rather than in the component so the wording is
 * testable and so nothing in the loss case can accidentally read as a taunt.
 */
export function outcomeHeadline(outcome) {
  if (!outcome?.final) return null;
  if (outcome.result === 'win') return 'WE WIN!';
  if (outcome.result === 'tie') return 'FINAL — TIE';
  return 'FINAL';
}
