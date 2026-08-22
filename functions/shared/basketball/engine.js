/**
 * engine.js — Basketball state, derived by replaying the log.
 *
 * Same contract as baseball: reduce(events, rules, config) is pure, total, and
 * order-dependent only on `seq`. Nothing is stored that can be recomputed.
 *
 * ── The hard part: minutes ──────────────────────────────────────────────────
 *
 * Playing time is basketball's equivalent of the pitch count — the number a
 * parent tracks on their own and a league may mandate. It's also the one thing
 * here that can be silently WRONG, so it gets the most care.
 *
 * Two failure modes, both handled by refusing to guess:
 *
 *   Incomplete substitutions. If a scorekeeper logs three subs and misses the
 *   fourth, naive accounting produces confident, wrong minutes. So minutes are
 *   accumulated PER PERIOD, and a period only contributes if it opened with a
 *   known five (LINEUP_SET or a carry-forward from the previous period). Any
 *   period without one is counted as untracked, and the totals say so.
 *
 *   No clock. Clock stamps are optional by design, so the fallback is wall
 *   time between events. That's close in a running-clock rec game and drifts
 *   badly with a stopped clock — so minutes derived that way are flagged
 *   `estimated`, and a period with clock stamps is flagged exact. The UI can
 *   then say "about 14 minutes" rather than implying a precision it doesn't
 *   have.
 *
 * "14 minutes across 3 tracked periods" is a number you can defend to a parent.
 * "14 minutes" when one period was never logged is not.
 * ────────────────────────────────────────────────────────────────────────────
 */

import {
  EV, SHOT_VALUE, MADE_SHOTS, MISSED_SHOTS, FOULS, PLAYER_EVENTS, EVENT_WORDS,
} from './events.js';
import { DEFAULT_RULES } from './rules.js';

export function createInitialState(rules = {}, config = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  return {
    status: 'pending',
    period: 1,
    // Wall-clock ms of the last event, for the minutes fallback.
    lastEventAt: null,
    // Seconds remaining, when the scorekeeper supplies them. Null means the
    // period has no clock information at all.
    clockSeconds: null,

    score: { home: 0, away: 0 },
    periodScores: { home: [], away: [] },

    // Per-player counting stats, filled lazily.
    box: {},
    fouls: {},
    teamFouls: { home: [], away: [] },
    fouledOut: [],

    onCourt: [...(config.startingFive || [])],
    bench: [...(config.bench || [])],
    roster: [...(config.roster || [])],

    // playerId -> { seconds, estimated }
    minutes: {},
    // Per period: whether the on-court five was known throughout.
    periodTracked: {},
    // Whether any event this period carried a clock reading.
    periodHadClock: {},

    homeOrAway: config.homeOrAway || 'home',
    endReason: null,
    playByPlay: [],
    lastEventSeq: 0,
  };
}

const clone = (s) => ({
  ...s,
  score: { ...s.score },
  periodScores: { home: [...s.periodScores.home], away: [...s.periodScores.away] },
  box: Object.fromEntries(Object.entries(s.box).map(([k, v]) => [k, { ...v }])),
  fouls: { ...s.fouls },
  teamFouls: { home: [...s.teamFouls.home], away: [...s.teamFouls.away] },
  fouledOut: [...s.fouledOut],
  onCourt: [...s.onCourt],
  bench: [...s.bench],
  roster: [...s.roster],
  minutes: Object.fromEntries(Object.entries(s.minutes).map(([k, v]) => [k, { ...v }])),
  periodTracked: { ...s.periodTracked },
  periodHadClock: { ...s.periodHadClock },
  playByPlay: [...s.playByPlay],
});

const emptyLine = () => ({
  pts: 0,
  ftm: 0, fta: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0,
  oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0,
  pf: 0, tech: 0, foulsDrawn: 0,
});

const lineFor = (s, playerId) => {
  if (!s.box[playerId]) s.box[playerId] = emptyLine();
  return s.box[playerId];
};

/** Our side of the scoreboard — the opponent gets the other. */
const ourSide = (s) => s.homeOrAway;
const theirSide = (s) => (s.homeOrAway === 'home' ? 'away' : 'home');

function addScore(s, side, points) {
  s.score[side] += points;
  const idx = s.period - 1;
  while (s.periodScores[side].length <= idx) s.periodScores[side].push(0);
  s.periodScores[side][idx] += points;
}

/**
 * Credit everyone currently on the floor with the time since the last event.
 *
 * Called before any state change, so a substitution charges the outgoing
 * player for the time up to the sub and not past it.
 */
function accrueMinutes(s, event) {
  const period = s.period;
  if (s.status !== 'live') return;
  // A period whose lineup was never established can't produce trustworthy
  // minutes for anyone, so nothing accumulates.
  if (!s.periodTracked[period]) return;

  let elapsed = null;
  let exact = false;

  // Preferred: the difference between two clock readings.
  if (typeof event?.payload?.clockSeconds === 'number' && s.clockSeconds !== null) {
    const delta = s.clockSeconds - event.payload.clockSeconds;
    // A clock that ran backwards means a correction or a new period; ignore.
    if (delta >= 0 && delta < 600) { elapsed = delta; exact = true; }
  }

  // Fallback: wall time. Fine with a running clock, drifts with a stopped one.
  if (elapsed === null
      && typeof s.lastEventAt === 'number'
      && typeof event?.at === 'number') {
    const delta = (event.at - s.lastEventAt) / 1000;
    // Anything over five minutes between taps is a break, not play.
    if (delta > 0 && delta < 300) elapsed = delta;
  }

  if (!elapsed) return;

  for (const playerId of s.onCourt) {
    if (!s.minutes[playerId]) s.minutes[playerId] = { seconds: 0, estimated: false };
    s.minutes[playerId].seconds += elapsed;
    if (!exact) s.minutes[playerId].estimated = true;
  }
}

function narrate(s, event, text) {
  s.playByPlay.push({
    period: s.period,
    kind: event.type,
    text,
    seq: event.seq,
  });
}

const nameOf = (s, playerId) =>
  s.names?.[playerId] || `#${playerId}`;

export function applyEvent(state, event, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  const s = clone(state);
  const playerId = event.payload?.playerId;

  accrueMinutes(s, event);

  if (typeof event?.payload?.clockSeconds === 'number') {
    s.clockSeconds = event.payload.clockSeconds;
    s.periodHadClock[s.period] = true;
  }
  // typeof, not truthiness: a timestamp of 0 is a real timestamp, and treating
  // it as absent left the opening tip with no clock to measure from — which
  // silently zeroed everyone's minutes for the first period.
  if (typeof event?.at === 'number') s.lastEventAt = event.at;
  s.lastEventSeq = Math.max(s.lastEventSeq, event.seq || 0);

  switch (event.type) {
    case EV.GAME_START: {
      s.status = 'live';
      s.period = 1;
      // A game that starts with a known five is tracked from the opening tip.
      s.periodTracked[1] = s.onCourt.length > 0;
      narrate(s, event, 'Game on.');
      return s;
    }

    case EV.LINEUP_SET: {
      const five = event.payload?.playerIds || [];
      s.onCourt = [...five];
      s.bench = s.roster.filter((id) => !five.includes(id));
      // This is what makes the period's minutes trustworthy.
      s.periodTracked[s.period] = five.length > 0;
      narrate(s, event, 'Lineup set.');
      return s;
    }

    case EV.SUBSTITUTION: {
      const { inId, outId } = event.payload || {};
      if (inId && outId) {
        s.onCourt = s.onCourt.map((id) => (id === outId ? inId : id));
        s.bench = s.bench.map((id) => (id === inId ? outId : id));
        if (!s.bench.includes(outId)) s.bench.push(outId);
        narrate(s, event, `${nameOf(s, inId)} in for ${nameOf(s, outId)}.`);
      }
      return s;
    }

    case EV.PERIOD_END: {
      const last = s.period;
      s.period = last + 1;
      s.clockSeconds = null;
      // The five carries into the next period unless it's changed, so the
      // next period stays tracked if this one was.
      s.periodTracked[s.period] = !!s.periodTracked[last] && s.onCourt.length > 0;
      narrate(s, event, `End of period ${last}.`);
      return s;
    }

    case EV.GAME_END: {
      s.status = 'final';
      s.endReason = event.payload?.reason || 'regulation';
      narrate(s, event, 'Final.');
      return s;
    }

    case EV.OPPONENT_SCORE: {
      const pts = event.payload?.points || 2;
      addScore(s, theirSide(s), pts);
      narrate(s, event, `Opponent scores ${pts}.`);
      return s;
    }

    default: break;
  }

  // ---- everything below names one of our players --------------------------
  if (!playerId || !PLAYER_EVENTS.includes(event.type)) return s;
  const line = lineFor(s, playerId);

  if (MADE_SHOTS.includes(event.type)) {
    const value = SHOT_VALUE[event.type];
    line.pts += value;
    if (value === 1) { line.ftm += 1; line.fta += 1; }
    if (value === 2) { line.fg2m += 1; line.fg2a += 1; }
    if (value === 3) { line.fg3m += 1; line.fg3a += 1; }
    addScore(s, ourSide(s), value);
    narrate(s, event, `${nameOf(s, playerId)} ${EVENT_WORDS[event.type]}.`);
    return s;
  }

  if (MISSED_SHOTS.includes(event.type)) {
    if (event.type === EV.MISS_1) line.fta += 1;
    if (event.type === EV.MISS_2) line.fg2a += 1;
    if (event.type === EV.MISS_3) line.fg3a += 1;
    narrate(s, event, `${nameOf(s, playerId)} ${EVENT_WORDS[event.type]}.`);
    return s;
  }

  if (FOULS.includes(event.type)) {
    if (event.type === EV.FOUL_TECHNICAL) line.tech += 1;
    else line.pf += 1;

    s.fouls[playerId] = (s.fouls[playerId] || 0) + 1;

    const idx = s.period - 1;
    const side = ourSide(s);
    while (s.teamFouls[side].length <= idx) s.teamFouls[side].push(0);
    s.teamFouls[side][idx] += 1;

    // Fouling out removes the player from the floor, which also stops their
    // clock — the reason fouls are tracked in casual mode too.
    const limit = r.foulsToFoulOut || 0;
    if (limit > 0 && s.fouls[playerId] >= limit && !s.fouledOut.includes(playerId)) {
      s.fouledOut.push(playerId);
      s.onCourt = s.onCourt.filter((id) => id !== playerId);
      narrate(s, event, `${nameOf(s, playerId)} fouled out.`);
      return s;
    }
    narrate(s, event, `${nameOf(s, playerId)} ${EVENT_WORDS[event.type]}.`);
    return s;
  }

  switch (event.type) {
    case EV.REBOUND_OFF: line.oreb += 1; line.reb += 1; break;
    case EV.REBOUND_DEF: line.dreb += 1; line.reb += 1; break;
    case EV.ASSIST: line.ast += 1; break;
    case EV.STEAL: line.stl += 1; break;
    case EV.BLOCK: line.blk += 1; break;
    case EV.TURNOVER: line.to += 1; break;
    case EV.FOUL_DRAWN: line.foulsDrawn += 1; break;
    default: break;
  }
  narrate(s, event, `${nameOf(s, playerId)} ${EVENT_WORDS[event.type] || 'did something'}.`);
  return s;
}

/** Replay a log. Voided events are skipped, exactly as in baseball. */
export function reduce(events = [], rules = {}, config = {}) {
  const ordered = [...events]
    .filter((e) => e && !e.voided)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));

  let state = createInitialState(rules, config);
  state.names = config.names || {};
  for (const event of ordered) state = applyEvent(state, event, rules);
  return state;
}

/** Drop the last event. Same signature as baseball's. */
export function undo(events = []) {
  const live = [...events].filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  if (!live.length) return events;
  const lastSeq = live[live.length - 1].seq;
  return events.filter((e) => e.seq !== lastSeq);
}

/** Mark one event void and replay everything after it. */
export function voidEvent(events = [], seq) {
  return events.map((e) => (e.seq === seq ? { ...e, voided: true } : e));
}

/**
 * Minutes in a form the UI can state honestly.
 *
 * Returns whole minutes, whether the figure is an estimate, and how many
 * periods actually contributed — because "14 minutes across 3 of 4 periods"
 * is the truthful version when a period went unlogged.
 */
export function minutesFor(state, playerId, rules = {}) {
  const entry = state.minutes[playerId];
  const periods = rules.periods || DEFAULT_RULES.periods;
  const tracked = Object.values(state.periodTracked).filter(Boolean).length;

  return {
    minutes: entry ? Math.round(entry.seconds / 60) : 0,
    seconds: entry ? Math.round(entry.seconds) : 0,
    estimated: entry ? entry.estimated : true,
    trackedPeriods: tracked,
    totalPeriods: periods,
    complete: tracked >= Math.min(periods, state.period),
  };
}
