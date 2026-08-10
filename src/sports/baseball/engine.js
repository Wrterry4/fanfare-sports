/**
 * gameEngine.js — Pure scoring engine.
 *
 * reduce(events, rules, config) -> gameState
 *
 * ZERO Firebase imports. This is deliberate: the engine can be replayed
 * against recorded games as a desk test, and the identical module runs
 * client-side (optimistic live state) and inside a Cloud Function
 * (authoritative finalize). Same shared-logic pattern as build-shared.js.
 *
 * Nothing here mutates. Every handler returns a new state object, so
 * undo is `reduce(events.slice(0, -1))` and a mid-log correction is
 * `reduce(events.filter(e => !e.voided))`.
 */

import { EV, PA_ENDING, HITS, HIT_BASES, NO_RBI_EVENTS } from './events.js';
import { DEFAULT_RULES } from './rules.js';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialState(config = {}) {
  return {
    status: 'pending',          // pending | live | final
    inning: 1,
    isTop: true,
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: { 1: null, 2: null, 3: null },
    score: { home: 0, away: 0 },
    // Runs per inning, index 0 = first inning. Drives the linescore strip.
    lineScore: { home: [], away: [] },
    errors: { home: 0, away: 0 },
    runsThisInning: 0,
    lineups: {
      home: config.homeLineup || [],
      away: config.awayLineup || [],
    },
    battingIndex: { home: 0, away: 0 },
    batterId: null,
    pitchers: { home: config.homePitcher || null, away: config.awayPitcher || null },
    pitchCounts: {},            // playerId -> pitches thrown
    errorThisHalfInning: false, // drives the earned-run approximation
    endReason: null,
    playByPlay: [],             // plain-English lines for the spectator view
    lastEventSeq: null,
  };
}

const battingSide  = (s) => (s.isTop ? 'away' : 'home');
const fieldingSide = (s) => (s.isTop ? 'home' : 'away');

const clone = (s) => ({
  ...s,
  bases: { ...s.bases },
  score: { ...s.score },
  lineScore: { home: [...s.lineScore.home], away: [...s.lineScore.away] },
  errors: { ...s.errors },
  lineups: { home: [...s.lineups.home], away: [...s.lineups.away] },
  battingIndex: { ...s.battingIndex },
  pitchers: { ...s.pitchers },
  pitchCounts: { ...s.pitchCounts },
  playByPlay: [...s.playByPlay],
});

// ---------------------------------------------------------------------------
// Baserunning primitives
// ---------------------------------------------------------------------------

/** Everyone on base advances `n`. Used for hits. */
function advanceAll(bases, n) {
  const next = { 1: null, 2: null, 3: null };
  const scored = [];
  for (const b of [3, 2, 1]) {
    const runner = bases[b];
    if (!runner) continue;
    const dest = b + n;
    if (dest >= 4) scored.push(runner);
    else next[dest] = runner;
  }
  return { bases: next, scored };
}

/** Only forced runners move. Used for walks and HBP. */
function forceAdvance(bases, batterId) {
  const next = { ...bases };
  const scored = [];
  if (next[1]) {
    if (next[2]) {
      if (next[3]) scored.push(next[3]);
      next[3] = next[2];
    }
    next[2] = next[1];
  }
  next[1] = batterId;
  return { bases: next, scored };
}

// ---------------------------------------------------------------------------
// Scoring / outs
// ---------------------------------------------------------------------------

function creditRuns(state, runners, rules, { earned = true } = {}) {
  if (!runners.length) return state;
  const side = battingSide(state);
  let next = clone(state);
  let allowed = runners.length;

  // Inning run cap. The final inning is commonly uncapped.
  const isFinalInning = next.inning >= rules.inningsPerGame;
  const cap = isFinalInning
    ? (rules.maxRunsPerInningFinal ?? rules.maxRunsPerInning)
    : rules.maxRunsPerInning;

  if (cap != null) {
    allowed = Math.min(allowed, Math.max(0, cap - next.runsThisInning));
  }

  next.score[side] += allowed;
  const idx = next.inning - 1;
  while (next.lineScore[side].length <= idx) next.lineScore[side].push(0);
  next.lineScore[side][idx] += allowed;
  next.runsThisInning += allowed;
  next._runsOnPlay = allowed;
  next._runsEarned = earned && !next.errorThisHalfInning ? allowed : 0;
  // Which specific runners crossed — the stats module credits R from this.
  next._scoredPlayers = runners.slice(0, allowed);
  return next;
}

function recordOuts(state, n) {
  const next = clone(state);
  next.outs += n;
  return next;
}

function resetCount(state) {
  const next = clone(state);
  next.balls = 0;
  next.strikes = 0;
  return next;
}

/** Advance the batting order and set the next batter. */
function nextBatter(state) {
  const next = clone(state);
  const side = battingSide(next);
  const lineup = next.lineups[side];
  if (!lineup.length) return next;
  next.battingIndex[side] = (next.battingIndex[side] + 1) % lineup.length;
  next.batterId = lineup[next.battingIndex[side]].playerId;
  return next;
}

function currentBatter(state) {
  if (state.batterId) return state.batterId;
  const side = battingSide(state);
  const lineup = state.lineups[side];
  return lineup.length ? lineup[state.battingIndex[side]].playerId : null;
}

// ---------------------------------------------------------------------------
// Half-inning and game boundaries
// ---------------------------------------------------------------------------

function shouldEndHalfInning(state, rules) {
  if (state.outs >= 3) return 'outs';
  const isFinalInning = state.inning >= rules.inningsPerGame;
  const cap = isFinalInning
    ? (rules.maxRunsPerInningFinal ?? rules.maxRunsPerInning)
    : rules.maxRunsPerInning;
  if (cap != null && state.runsThisInning >= cap) return 'runCap';
  return null;
}

function endHalfInning(state, rules, reason) {
  let next = clone(state);
  next.playByPlay.push({
    inning: next.inning,
    isTop: next.isTop,
    text: reason === 'runCap'
      ? `Run limit reached — side retired.`
      : `Side retired.`,
    kind: 'inningEnd',
  });

  next.bases = { 1: null, 2: null, 3: null };
  next.outs = 0;
  next.balls = 0;
  next.strikes = 0;
  next.runsThisInning = 0;
  next.errorThisHalfInning = false;

  const gameOver = checkGameEnd(next, rules);
  if (gameOver) {
    next.status = 'final';
    next.endReason = gameOver;
    return next;
  }

  if (next.isTop) {
    next.isTop = false;
  } else {
    next.isTop = true;
    next.inning += 1;
  }

  // T-ball convention: whoever batted last in one inning bats first in the
  // next, so the same kids aren't always at the end of the order. Reverse the
  // side that's coming up and start it at the top.
  if (rules.reverseBattingOrderEachInning) {
    const side = next.isTop ? 'away' : 'home';
    next.lineups[side] = [...next.lineups[side]].reverse()
      .map((slot, i) => ({ ...slot, order: i + 1 }));
    next.battingIndex[side] = 0;
  }
  // Clear first: currentBatter() prefers an existing batterId, which would
  // otherwise carry the previous half-inning's hitter across to the new side.
  next.batterId = null;
  next.batterId = currentBatter(next);
  return next;
}

/**
 * Called once a half-inning is complete. Returns an end reason or null.
 */
function checkGameEnd(state, rules) {
  const { home, away } = state.score;
  const diff = Math.abs(home - away);

  // Mercy rule — evaluated at the end of any half-inning past the threshold.
  if (
    rules.mercyRuleDifferential != null &&
    rules.mercyRuleAfterInning != null &&
    state.inning >= rules.mercyRuleAfterInning &&
    diff >= rules.mercyRuleDifferential
  ) {
    // Only end mid-inning-pair if the trailing team has had its at-bat,
    // i.e. after the bottom half, or after the top if home is already ahead.
    if (!state.isTop || home > away) return 'mercy';
  }

  const regulationComplete = state.inning >= rules.inningsPerGame;

  if (regulationComplete) {
    // Home leads after the top of the final inning — no bottom needed.
    if (state.isTop && home > away) return 'regulation';
    // Bottom of the final inning is done and someone leads.
    if (!state.isTop && home !== away) return 'regulation';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pitch accounting
// ---------------------------------------------------------------------------

function addPitches(state, n) {
  const next = clone(state);
  const pitcher = next.pitchers[fieldingSide(next)];
  if (!pitcher || n <= 0) return next;
  next.pitchCounts[pitcher] = (next.pitchCounts[pitcher] || 0) + n;
  return next;
}

// ---------------------------------------------------------------------------
// Play-by-play narration
// ---------------------------------------------------------------------------

const OUTCOME_TEXT = {
  [EV.SINGLE]: 'singles',
  [EV.DOUBLE]: 'doubles',
  [EV.TRIPLE]: 'triples',
  [EV.HOME_RUN]: 'homers',
  [EV.WALK]: 'walks',
  [EV.HBP]: 'is hit by the pitch',
  [EV.STRIKEOUT]: 'strikes out',
  [EV.GROUND_OUT]: 'grounds out',
  [EV.FLY_OUT]: 'flies out',
  [EV.LINE_OUT]: 'lines out',
  [EV.SAC_FLY]: 'hits a sacrifice fly',
  [EV.SAC_BUNT]: 'lays down a sacrifice bunt',
  [EV.FIELDERS_CHOICE]: 'reaches on a fielder\'s choice',
  [EV.REACHED_ON_ERROR]: 'reaches on an error',
  [EV.DOUBLE_PLAY]: 'grounds into a double play',
  [EV.TRIPLE_PLAY]: 'into a triple play',
};

function narrate(state, text, kind = 'play') {
  const next = clone(state);
  next.playByPlay.push({ inning: next.inning, isTop: next.isTop, text, kind });
  return next;
}

function nameOf(state, playerId, names) {
  return (names && names[playerId]) || playerId || 'Batter';
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function handlePitch(state, event, rules) {
  let next = addPitches(state, 1);

  if (event.type === EV.BALL) {
    next.balls += 1;
    if (next.balls >= 4) {
      return applyOutcome(next, { ...event, type: EV.WALK, _auto: true }, rules);
    }
    return next;
  }

  if (event.type === EV.FOUL) {
    // A foul with two strikes is a pitch, not a strike.
    if (next.strikes < 2) next.strikes += 1;
    return next;
  }

  // STRIKE_SWINGING | STRIKE_LOOKING
  next.strikes += 1;
  if (next.strikes >= 3) {
    return applyOutcome(next, { ...event, type: EV.STRIKEOUT, _auto: true }, rules);
  }
  return next;
}

function applyOutcome(state, event, rules, names) {
  const type = event.type;
  const payload = event.payload || {};
  const batter = payload.playerId || currentBatter(state);
  let next = clone(state);
  const outsBefore = next.outs;

  // If a scorekeeper taps the outcome directly rather than pitch-by-pitch,
  // backfill the pitches that must have been thrown.
  if (!event._auto) {
    if (type === EV.WALK) next = addPitches(next, Math.max(0, 4 - next.balls));
    else if (type === EV.STRIKEOUT) next = addPitches(next, Math.max(0, 3 - next.strikes));
    else if (PA_ENDING.has(type)) next = addPitches(next, 1); // ball put in play
  }

  let scored = [];

  if (HITS.has(type)) {
    const n = HIT_BASES[type];
    const adv = advanceAll(next.bases, n);
    next.bases = adv.bases;
    scored = adv.scored;
    if (n >= 4) scored.push(batter);
    else next.bases[n] = batter;

  } else if (type === EV.WALK || type === EV.HBP) {
    if (rules.walksAdvanceAllRunners) {
      const adv = advanceAll(next.bases, 1);
      next.bases = adv.bases;
      scored = adv.scored;
      next.bases[1] = batter;
    } else {
      const adv = forceAdvance(next.bases, batter);
      next.bases = adv.bases;
      scored = adv.scored;
    }

  } else if (type === EV.REACHED_ON_ERROR) {
    next.errorThisHalfInning = true;
    next.errors[fieldingSide(next)] += 1;
    const adv = advanceAll(next.bases, 1);
    next.bases = adv.bases;
    scored = adv.scored;
    next.bases[1] = batter;

  } else if (type === EV.FIELDERS_CHOICE) {
    // Lead runner erased by default; batter safe at first.
    const outBase = payload.outAtBase ?? (next.bases[3] ? 3 : next.bases[2] ? 2 : 1);
    next.bases[outBase] = null;
    next = recordOuts(next, 1);
    next.bases[1] = batter;

  } else if (type === EV.SAC_FLY) {
    next = recordOuts(next, 1);
    if (next.bases[3]) { scored = [next.bases[3]]; next.bases[3] = null; }

  } else if (type === EV.SAC_BUNT) {
    next = recordOuts(next, 1);
    const adv = advanceAll(next.bases, 1);
    next.bases = adv.bases;
    scored = adv.scored;

  } else if (type === EV.DOUBLE_PLAY) {
    next = recordOuts(next, 2);
    if (next.bases[1]) next.bases[1] = null;

  } else if (type === EV.TRIPLE_PLAY) {
    next = recordOuts(next, 3);
    next.bases = { 1: null, 2: null, 3: null };

  } else if (
    type === EV.STRIKEOUT || type === EV.GROUND_OUT ||
    type === EV.FLY_OUT   || type === EV.LINE_OUT
  ) {
    next = recordOuts(next, 1);
  }

  // Explicit runner advances from the RBI/advance modal override defaults.
  if (Array.isArray(payload.extraScored)) {
    for (const pid of payload.extraScored) {
      for (const b of [1, 2, 3]) if (next.bases[b] === pid) next.bases[b] = null;
      scored.push(pid);
    }
  }

  next._outsOnPlay = next.outs - outsBefore;

  const earned = !NO_RBI_EVENTS.has(type);
  next = creditRuns(next, scored, rules, { earned });
  const runsCounted = next._runsOnPlay || 0;

  // RBI is derived, not prompted. Runs scored on the play, minus the
  // situations where the rulebook withholds credit.
  next._rbi = NO_RBI_EVENTS.has(type) ? 0 : runsCounted;
  next._paEnded = PA_ENDING.has(type);
  next._outcomeType = type;
  next._batterId = batter;

  const verb = OUTCOME_TEXT[type] || type.toLowerCase().replace(/_/g, ' ');
  let text = `${nameOf(next, batter, names)} ${verb}`;
  if (runsCounted > 0) text += runsCounted === 1 ? ', 1 run scores' : `, ${runsCounted} runs score`;
  next = narrate(next, text + '.');

  next = resetCount(next);
  if (PA_ENDING.has(type)) next = nextBatter(next);

  const endReason = shouldEndHalfInning(next, rules);
  if (endReason) next = endHalfInning(next, rules, endReason);

  return next;
}

function handleBaserunning(state, event, rules, names) {
  const type = event.type;
  const payload = event.payload || {};
  let next = clone(state);
  const outsBefore = next.outs;

  if (type === EV.STOLEN_BASE || type === EV.WILD_PITCH ||
      type === EV.PASSED_BALL || type === EV.BALK) {

    const targets = payload.runners
      ? payload.runners
      : Object.entries(next.bases).filter(([, v]) => v).map(([b]) => Number(b));

    if (type === EV.WILD_PITCH || type === EV.PASSED_BALL) next = addPitches(next, 1);

    const scored = [];
    const moved = { ...next.bases };
    for (const b of [3, 2, 1]) {
      if (!targets.includes(b) || !moved[b]) continue;
      const runner = moved[b];
      moved[b] = null;
      if (b + 1 >= 4) scored.push(runner);
      else moved[b + 1] = runner;
    }
    next.bases = moved;
    // Runs scoring on a steal, wild pitch, passed ball, or balk are all EARNED
    // under the scoring rules — none of them is an error. The earlier version
    // marked everything but a balk unearned, which understated ERA, and also
    // carried a dead ternary that assigned a value to itself.
    next = creditRuns(next, scored, rules, { earned: true });
    next._sbCredit = type === EV.STOLEN_BASE ? targets.length : 0;
    next = narrate(next, type === EV.STOLEN_BASE ? 'Stolen base.' : 'Runner advances.');

  } else if (type === EV.CAUGHT_STEALING || type === EV.PICKED_OFF) {
    const b = payload.fromBase ?? 1;
    next.bases[b] = null;
    next = recordOuts(next, 1);
    next = narrate(next, type === EV.CAUGHT_STEALING ? 'Caught stealing.' : 'Picked off.');

  } else if (type === EV.RUNNER_ADVANCE) {
    const { fromBase, toBase } = payload;
    const runner = next.bases[fromBase];
    if (runner) {
      next.bases[fromBase] = null;
      if (toBase >= 4) next = creditRuns(next, [runner], rules, { earned: true });
      else next.bases[toBase] = runner;
    }
  } else if (type === EV.ERROR) {
    next.errorThisHalfInning = true;
    next.errors[fieldingSide(next)] += 1;
    next = narrate(next, 'Error on the play.');
  }

  next._outsOnPlay = next.outs - outsBefore;

  const endReason = shouldEndHalfInning(next, rules);
  if (endReason) next = endHalfInning(next, rules, endReason);
  return next;
}

// ---------------------------------------------------------------------------
// Main reducer
// ---------------------------------------------------------------------------

/** Per-event derived flags. Cleared each event so clone() can't leak them forward. */
const TRANSIENT = [
  '_runsOnPlay', '_runsEarned', '_scoredPlayers', '_rbi', '_paEnded',
  '_outcomeType', '_batterId', '_outsOnPlay', '_sbCredit', '_walkUpFor',
];

function clearTransient(state) {
  const next = { ...state };
  for (const k of TRANSIENT) delete next[k];
  return next;
}

export function applyEvent(state, event, rules, names) {
  if (event.voided) return state;
  state = clearTransient(state);
  const type = event.type;
  let next;

  switch (type) {
    case EV.GAME_START:
      next = clone(state);
      next.status = 'live';
      next.batterId = currentBatter(next);
      next = narrate(next, 'Play ball.', 'lifecycle');
      break;

    case EV.BATTER_UP: {
      next = clone(state);
      // Explicit playerId supports pinch hitters and skipped slots.
      if (event.payload?.playerId) {
        next.batterId = event.payload.playerId;
        const side = battingSide(next);
        const idx = next.lineups[side].findIndex(
          (s) => s.playerId === event.payload.playerId
        );
        if (idx >= 0) next.battingIndex[side] = idx;
      } else {
        next.batterId = currentBatter(next);
      }
      // This is the walk-up audio hook: emitted explicitly so substitutions
      // and skipped batters can't leave the trigger ambiguous.
      next._walkUpFor = next.batterId;
      break;
    }

    case EV.BALL:
    case EV.STRIKE_SWINGING:
    case EV.STRIKE_LOOKING:
    case EV.FOUL:
      next = handlePitch(state, event, rules);
      break;

    case EV.PITCHER_CHANGE: {
      next = clone(state);
      next.pitchers[fieldingSide(next)] = event.payload.playerId;
      break;
    }

    case EV.SUBSTITUTION: {
      next = clone(state);
      const { outPlayerId, inPlayerId, side } = event.payload;
      const s = side || battingSide(next);
      next.lineups[s] = next.lineups[s].map((slot) =>
        slot.playerId === outPlayerId ? { ...slot, playerId: inPlayerId } : slot
      );
      for (const b of [1, 2, 3]) {
        if (next.bases[b] === outPlayerId) next.bases[b] = inPlayerId;
      }
      if (next.batterId === outPlayerId) next.batterId = inPlayerId;
      break;
    }

    case EV.POSITION_CHANGE: {
      next = clone(state);
      const { playerId, position, side } = event.payload;
      const s = side || fieldingSide(next);
      next.lineups[s] = next.lineups[s].map((slot) =>
        slot.playerId === playerId ? { ...slot, position } : slot
      );
      break;
    }

    case EV.MANUAL_SCORE_ADJUST: {
      next = clone(state);
      const { home, away } = event.payload;
      if (home != null) next.score.home = home;
      if (away != null) next.score.away = away;
      break;
    }

    case EV.GAME_END:
      next = clone(state);
      next.status = 'final';
      next.endReason = event.payload?.reason || 'manual';
      break;

    case EV.STOLEN_BASE:
    case EV.CAUGHT_STEALING:
    case EV.PICKED_OFF:
    case EV.WILD_PITCH:
    case EV.PASSED_BALL:
    case EV.BALK:
    case EV.RUNNER_ADVANCE:
    case EV.ERROR:
      next = handleBaserunning(state, event, rules, names);
      break;

    default:
      if (PA_ENDING.has(type)) {
        next = applyOutcome(state, event, rules, names);
      } else {
        next = state;
      }
  }

  next = { ...next, lastEventSeq: event.seq };
  return next;
}

/**
 * The whole engine, in one line of intent:
 *   state is never stored, only derived.
 */
export function reduce(events, rules = DEFAULT_RULES, config = {}, names = null) {
  let state = createInitialState(config);
  const ordered = [...events]
    .filter((e) => !e.voided)
    .sort((a, b) => a.seq - b.seq);
  for (const event of ordered) {
    state = applyEvent(state, event, rules, names);
  }
  return state;
}

/** Undo: drop the last non-voided event and replay. */
export function undo(events, rules, config, names) {
  const live = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  return reduce(live.slice(0, -1), rules, config, names);
}

/** Correction: void one event mid-log, replay everything forward. */
export function voidEvent(events, seq) {
  return events.map((e) => (e.seq === seq ? { ...e, voided: true } : e));
}
