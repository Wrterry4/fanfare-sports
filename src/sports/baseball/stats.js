/**
 * stats.js — Derived statistics.
 *
 * Nothing is stored incrementally. Stats are a projection of the event log,
 * which means a mid-log correction automatically produces correct totals with
 * no reconciliation step.
 *
 * Live view: run this client-side over the events already in memory.
 * Finalize:  run the identical module in a Cloud Function and write the
 *            result to /players/{id}/seasons/{key} and /career/totals.
 */

import { EV, PA_ENDING, HITS, HIT_BASES } from './events.js';
import { createInitialState, applyEvent } from './engine.js';
import { DEFAULT_RULES } from './rules.js';

const emptyBatting = () => ({
  PA: 0, AB: 0, H: 0, singles: 0, doubles: 0, triples: 0, HR: 0,
  R: 0, RBI: 0, BB: 0, K: 0, HBP: 0, SF: 0, SH: 0, SB: 0, CS: 0, TB: 0,
  ROE: 0, FC: 0, GIDP: 0,
});

const emptyPitching = () => ({
  BF: 0, outs: 0, H: 0, R: 0, ER: 0, BB: 0, K: 0, HBP: 0, HR: 0,
  pitches: 0, strikes: 0, balls: 0,
});

const emptyFielding = () => ({ PO: 0, A: 0, E: 0 });

const bump = (bucket, key, factory) => {
  if (!bucket[key]) bucket[key] = factory();
  return bucket[key];
};

const div = (num, den) => (den > 0 ? num / den : 0);
const r3 = (n) => Math.round(n * 1000) / 1000;
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Walk the log, applying each event and reading the derived flags the engine
 * hangs off the resulting state.
 */
export function computeStats(events, rules = DEFAULT_RULES, config = {}) {
  const batting = {};
  const pitching = {};
  const fielding = {};

  let state = createInitialState(config);
  const ordered = [...events].filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);

  for (const event of ordered) {
    const before = state;
    const pitcherBefore = before.isTop ? before.pitchers.home : before.pitchers.away;
    state = applyEvent(before, event, rules);

    const type = event.type;
    const payload = event.payload || {};

    // ---- Pitch-level accounting -----------------------------------------
    if (pitcherBefore) {
      const p = bump(pitching, pitcherBefore, emptyPitching);
      if (type === EV.BALL) { p.pitches++; p.balls++; }
      else if (type === EV.STRIKE_SWINGING || type === EV.STRIKE_LOOKING || type === EV.FOUL) {
        p.pitches++; p.strikes++;
      }
      else if (PA_ENDING.has(type)) {
        // Backfilled pitches when the scorekeeper taps an outcome directly.
        if (type === EV.WALK) { const n = Math.max(0, 4 - before.balls); p.pitches += n; p.balls += n; }
        else if (type === EV.STRIKEOUT) { const n = Math.max(0, 3 - before.strikes); p.pitches += n; p.strikes += n; }
        else { p.pitches++; p.strikes++; }
      }
    }

    // ---- Batting ---------------------------------------------------------
    if (PA_ENDING.has(type)) {
      const batterId = state._batterId || payload.playerId;
      if (batterId) {
        const b = bump(batting, batterId, emptyBatting);
        b.PA++;
        b.RBI += state._rbi || 0;

        if (HITS.has(type)) {
          b.H++;
          b.TB += HIT_BASES[type];
          if (type === EV.SINGLE) b.singles++;
          else if (type === EV.DOUBLE) b.doubles++;
          else if (type === EV.TRIPLE) b.triples++;
          else if (type === EV.HOME_RUN) b.HR++;
        } else if (type === EV.WALK) b.BB++;
        else if (type === EV.HBP) b.HBP++;
        else if (type === EV.STRIKEOUT) b.K++;
        else if (type === EV.SAC_FLY) b.SF++;
        else if (type === EV.SAC_BUNT) b.SH++;
        else if (type === EV.REACHED_ON_ERROR) b.ROE++;
        else if (type === EV.FIELDERS_CHOICE) b.FC++;
        else if (type === EV.DOUBLE_PLAY) b.GIDP++;
      }

      // ---- Pitcher charged for the plate appearance ----------------------
      if (pitcherBefore) {
        const p = bump(pitching, pitcherBefore, emptyPitching);
        p.BF++;
        if (HITS.has(type)) p.H++;
        if (type === EV.HOME_RUN) p.HR++;
        if (type === EV.WALK) p.BB++;
        if (type === EV.HBP) p.HBP++;
        if (type === EV.STRIKEOUT) p.K++;
        p.outs += state._outsOnPlay || 0;
      }
    }

    // Outs recorded on the bases still count toward the pitcher's innings.
    if (type === EV.CAUGHT_STEALING || type === EV.PICKED_OFF) {
      if (pitcherBefore) {
        const p = bump(pitching, pitcherBefore, emptyPitching);
        p.outs += state._outsOnPlay || 0;
      }
    }

    // ---- Runs scored -----------------------------------------------------
    const scorers = state._scoredPlayers || [];
    for (const pid of scorers) {
      bump(batting, pid, emptyBatting).R++;
    }
    if (pitcherBefore && scorers.length) {
      const p = bump(pitching, pitcherBefore, emptyPitching);
      p.R += scorers.length;
      p.ER += state._runsEarned || 0;
    }

    // ---- Baserunning -----------------------------------------------------
    if (type === EV.STOLEN_BASE) {
      const runners = payload.runnerIds || [];
      for (const pid of runners) bump(batting, pid, emptyBatting).SB++;
      if (!runners.length && payload.runnerId) bump(batting, payload.runnerId, emptyBatting).SB++;
    }
    if (type === EV.CAUGHT_STEALING && payload.runnerId) {
      bump(batting, payload.runnerId, emptyBatting).CS++;
    }

    // ---- Fielding --------------------------------------------------------
    if (payload.putoutBy) bump(fielding, payload.putoutBy, emptyFielding).PO++;
    if (Array.isArray(payload.assistBy)) {
      for (const pid of payload.assistBy) bump(fielding, pid, emptyFielding).A++;
    }
    if (payload.errorBy) bump(fielding, payload.errorBy, emptyFielding).E++;
  }

  return {
    batting: finalizeBatting(batting),
    pitching: finalizePitching(pitching),
    fielding: finalizeFielding(fielding),
  };
}

function finalizeBatting(raw) {
  const out = {};
  for (const [pid, b] of Object.entries(raw)) {
    const AB = b.PA - (b.BB + b.HBP + b.SF + b.SH);
    const obpDen = AB + b.BB + b.HBP + b.SF;
    const AVG = div(b.H, AB);
    const OBP = div(b.H + b.BB + b.HBP, obpDen);
    const SLG = div(b.TB, AB);
    out[pid] = {
      ...b,
      AB,
      AVG: r3(AVG),
      OBP: r3(OBP),
      SLG: r3(SLG),
      OPS: r3(OBP + SLG),
    };
  }
  return out;
}

function finalizePitching(raw) {
  const out = {};
  for (const [pid, p] of Object.entries(raw)) {
    const IP = p.outs / 3;
    out[pid] = {
      ...p,
      IP: formatIP(p.outs),
      IPDecimal: r3(IP),
      ERA: IP > 0 ? r2((p.ER * 9) / IP) : 0,
      WHIP: IP > 0 ? r2((p.BB + p.H) / IP) : 0,
      KPerBB: p.BB > 0 ? r2(p.K / p.BB) : p.K,
      strikePct: p.pitches > 0 ? r3(p.strikes / p.pitches) : 0,
    };
  }
  return out;
}

/** Baseball notation: 5.2 means five and two-thirds, not five point two. */
function formatIP(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function finalizeFielding(raw) {
  const out = {};
  for (const [pid, f] of Object.entries(raw)) {
    const chances = f.PO + f.A + f.E;
    out[pid] = { ...f, TC: chances, FPCT: chances > 0 ? r3((f.PO + f.A) / chances) : 0 };
  }
  return out;
}

/**
 * Merge game stats into a running season or career total.
 * Rate stats are always recomputed from counting stats — never averaged.
 */
export function mergeStats(target, incoming) {
  const merged = { batting: {}, pitching: {}, fielding: {} };

  for (const group of ['batting', 'pitching', 'fielding']) {
    const ids = new Set([
      ...Object.keys(target?.[group] || {}),
      ...Object.keys(incoming?.[group] || {}),
    ]);
    for (const pid of ids) {
      const a = target?.[group]?.[pid] || {};
      const b = incoming?.[group]?.[pid] || {};
      const sum = {};
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        if (typeof a[k] === 'number' && Number.isInteger(a[k]) || typeof b[k] === 'number' && Number.isInteger(b[k])) {
          if (COUNTING_STATS.has(k)) sum[k] = (a[k] || 0) + (b[k] || 0);
        }
      }
      merged[group][pid] = sum;
    }
  }

  return {
    batting: finalizeBatting(merged.batting),
    pitching: finalizePitching(merged.pitching),
    fielding: finalizeFielding(merged.fielding),
  };
}

const COUNTING_STATS = new Set([
  'PA', 'H', 'singles', 'doubles', 'triples', 'HR', 'R', 'RBI', 'BB', 'K',
  'HBP', 'SF', 'SH', 'SB', 'CS', 'TB', 'ROE', 'FC', 'GIDP',
  'BF', 'outs', 'ER', 'pitches', 'strikes', 'balls',
  'PO', 'A', 'E',
]);
