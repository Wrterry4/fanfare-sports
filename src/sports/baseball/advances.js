/**
 * advances.js — Where each runner actually ended up.
 *
 * ── The problem this exists for ─────────────────────────────────────────────
 *
 * The engine moved every runner exactly as far as the batter: a single pushed
 * everyone up one, a double up two. That is right often enough to feel right
 * and wrong often enough to be a bug. A runner on third holds on a soft single
 * to the infield. A runner on second stops at third rather than test an arm.
 * Neither could be recorded, so the score itself came out wrong.
 *
 * ── Forced vs free, which is the whole idea ─────────────────────────────────
 *
 * On a hit that puts the batter on base `n`, every runner standing on base
 * `n` or behind it has nowhere to stay — the batter is taking their base. They
 * are FORCED to at least n+1. A runner ahead of the batter's base is FREE: they
 * may hold, or advance, or score.
 *
 * That distinction is what decides whether the app interrupts the scorekeeper.
 * If every runner is forced there is nothing to ask about, and asking would be
 * a tax on the most common plays in the game. If even one runner could have
 * held, the default is a guess and the app should say so.
 *
 * ── Rules encoded here ──────────────────────────────────────────────────────
 *
 *  - a runner never moves backward
 *  - a runner never passes the runner ahead of them
 *  - two runners never share a base, though any number may score
 *  - a forced runner cannot stop on a base the batter is taking
 *
 * Bases are 1, 2, 3. Destination 4 means scored. Everything here is pure and
 * takes the bases map as data, so the sheet and the engine cannot disagree
 * about what is legal.
 */

/** Destination meaning "crossed the plate". */
export const SCORED = 4;

/** Lead runner first — a runner's ceiling depends on where the one ahead went. */
const DESCENDING = [3, 2, 1];

/**
 * The floor for a runner on `base` when the batter takes base `n`.
 * Forced runners cannot stay; free runners can.
 */
function floorFor(base, n) {
  return base <= n ? n + 1 : base;
}

/**
 * Every legal destination for each occupied base, lead runner first.
 *
 * @param bases  { 1: id|null, 2: id|null, 3: id|null }
 * @param n      the base the batter reaches (1..4; 4 is a home run)
 * @returns [{ from, runner, forced, choices: number[], fallback }]
 *          `choices` is always non-empty and always contains `fallback`.
 */
export function runnerOptions(bases, n) {
  const out = [];
  // Nobody has been placed yet, so the lead runner may go all the way home.
  let ceiling = SCORED;

  for (const from of DESCENDING) {
    const runner = bases?.[from];
    if (!runner) continue;

    const min = floorFor(from, n);
    const choices = [];
    for (let dest = min; dest <= SCORED; dest++) {
      if (dest > ceiling) break;
      choices.push(dest);
    }

    // A runner with nowhere legal to go is not a real state — it means the
    // runner ahead was placed somewhere impossible. Scoring them is the only
    // answer that never loses a runner off the board.
    if (choices.length === 0) choices.push(SCORED);

    // What the old engine would have done, clamped into what's legal.
    const naive = from + n;
    const fallback = choices.includes(naive)
      ? naive
      : choices[choices.length - 1];

    out.push({ from, runner, forced: from <= n, choices, fallback });

    // Anyone behind must finish below this runner — unless this one scored,
    // in which case the base is free again and they may score too.
    ceiling = fallback >= SCORED ? SCORED : fallback - 1;
  }

  return out;
}

/**
 * What the app records when nobody adjusts anything.
 * @returns { [fromBase]: destination }
 */
export function defaultAdvances(bases, n) {
  const map = {};
  for (const o of runnerOptions(bases, n)) map[o.from] = o.fallback;
  return map;
}

/**
 * Does any runner have a real decision to make?
 *
 * True only when someone could have HELD — that is, a runner standing ahead of
 * the base the batter is taking. A forced runner's exact destination is still
 * adjustable, but nothing about it is surprising, and interrupting for it would
 * put a sheet in front of the scorekeeper on nearly every hit in the game.
 *
 * A home run is never ambiguous: everyone scores.
 */
export function isAmbiguous(bases, n) {
  if (n >= SCORED) return false;
  return DESCENDING.some((b) => bases?.[b] && b > n);
}

/**
 * Force a requested set of advances into something legal.
 *
 * The sheet should never produce an illegal set, but this is the engine's own
 * guard: an event can arrive from an older build, a hand-edited document, or a
 * future version of the sheet, and the reducer must not be the thing that
 * decides a game by trusting it.
 */
export function normalizeAdvances(bases, n, requested) {
  const map = {};
  let ceiling = SCORED;

  for (const from of DESCENDING) {
    const runner = bases?.[from];
    if (!runner) continue;

    const min = floorFor(from, n);
    const asked = Number(requested?.[from]);
    const naive = from + n;

    let dest = Number.isFinite(asked) ? asked : naive;
    if (dest < min) dest = min;            // never backward, never unforced
    if (dest > SCORED) dest = SCORED;
    if (dest > ceiling) dest = ceiling;    // never past the runner ahead
    if (dest < min) dest = SCORED;         // no room left: they came home

    map[from] = dest;
    ceiling = dest >= SCORED ? SCORED : dest - 1;
  }

  return map;
}
