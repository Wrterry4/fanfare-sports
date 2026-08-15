/**
 * gameService.js — Firestore read/write path for live scoring.
 *
 * The engine stays pure; this is the only place that knows Firestore exists.
 *
 * Design notes worth keeping in view:
 *
 * • Events go in a SUBCOLLECTION, not an array field. An array re-sends the
 *   whole document to every listener on every change — with thirty parents
 *   watching a four-hundred-pitch game that is the entire growing log,
 *   re-downloaded per tap.
 *
 * • Sequence numbers are assigned LOCALLY, not by transaction. Firestore
 *   transactions require connectivity, and ballpark cell service is exactly
 *   where they'd fail. Since the baton guarantees a single writer, a local
 *   monotonic counter is safe and works fully offline — writes queue and
 *   flush when signal returns.
 *
 * • Corrections never delete. `voided` is set by a Cloud Function so the
 *   audit trail survives and replay stays deterministic.
 */

import {
  collection, doc, query, orderBy, onSnapshot,
  addDoc, updateDoc, serverTimestamp, writeBatch, getDocs, limit,
} from './firebase';
import { httpsCallable } from './firebase';
import { db, functions } from './firebase';
import { reduce } from '../sports/baseball/engine.js';
import { computeStats } from '../sports/baseball/stats.js';
import { shouldSyncSummary } from '../shared/gameSummary.js';

const gamePath   = (teamId, gameId) => doc(db, 'teams', teamId, 'games', gameId);
const eventsPath = (teamId, gameId) => collection(db, 'teams', teamId, 'games', gameId, 'events');

/**
 * Live game subscription.
 *
 * Two listeners: the game document (score, baton, status) and the event
 * subcollection. Derived state is recomputed locally from the events, so the
 * scoreboard fields on the game doc are a convenience for list views — never
 * the source of truth.
 *
 * onUpdate receives { game, events, state, stats, isStale }.
 */
export function subscribeToGame(teamId, gameId, rules, config, names, onUpdate) {
  let game = null;
  let events = [];
  let ready = { game: false, events: false };

  const emit = () => {
    if (!ready.game || !ready.events) return;
    const state = reduce(events, rules, config, names);
    onUpdate({
      game,
      events,
      state,
      stats: computeStats(events, rules, config),
      isStale: isStale(game),
    });
  };

  const unsubGame = onSnapshot(gamePath(teamId, gameId), (snap) => {
    game = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    ready.game = true;
    emit();
  });

  const unsubEvents = onSnapshot(
    query(eventsPath(teamId, gameId), orderBy('seq')),
    (snap) => {
      events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      ready.events = true;
      emit();
    }
  );

  return () => { unsubGame(); unsubEvents(); };
}

/**
 * A spectator is looking at a scoreboard that a human is typing into. If that
 * human's phone dies or drops signal, a frozen display that still looks live
 * is worse than an honest one.
 */
const STALE_AFTER_MS = 90_000;
export function isStale(game) {
  if (!game || game.status !== 'live') return false;
  const last = game.lastEventAt?.toMillis?.() ?? 0;
  return Date.now() - last > STALE_AFTER_MS;
}

/**
 * Local sequence counter. Seeded from what's already in the log, then owned
 * by this device for as long as it holds the baton.
 */
export function createSequencer(existingEvents = []) {
  let next = existingEvents.reduce((m, e) => Math.max(m, e.seq + 1), 0);
  return {
    take: () => next++,
    peek: () => next,
    reseed: (evts) => { next = evts.reduce((m, e) => Math.max(m, e.seq + 1), next); },
  };
}

/**
 * Append one event.
 *
 * Deliberately not awaited by the UI. Firestore's offline queue makes the
 * local write immediate; the scorekeeper should never wait on a network
 * round-trip between pitches.
 */
export function appendEvent(teamId, gameId, sequencer, uid, type, payload = {}) {
  const event = {
    seq: sequencer.take(),
    type,
    payload,
    createdBy: uid,
    createdAt: serverTimestamp(),
    voided: false,
  };
  // Fire and forget — the promise is returned for callers who want it.
  return addDoc(eventsPath(teamId, gameId), event);
}

/**
 * Mirror the derived summary onto the game doc so schedule and list views can
 * render without loading a full event log. Debounced by the caller.
 */
/**
 * Mirror the derived summary onto the game document so list views can render
 * without loading an event log.
 *
 * Deliberately does NOT write `status`. Every status transition is an explicit
 * act — Start on Game Day or Schedule, End Game, or finalize — and a
 * background mirror has no business making one.
 */
export function syncGameSummary(teamId, gameId, state) {
  return updateDoc(gamePath(teamId, gameId), {
    score: state.score,
    currentInning: state.inning,
    isTopInning: state.isTop,
    outs: state.outs,
    // Mirrored so the Schedule tab can render a finished game's inning-by-
    // inning report without loading its whole event log.
    lineScore: state.lineScore,
    errors: state.errors,
    lastEventAt: serverTimestamp(),
    eventCount: (state.lastEventSeq ?? -1) + 1,
  });
}

/**
 * Undo. The last event is voided rather than deleted — the log stays complete,
 * and `reduce()` already ignores voided events.
 */
export async function undoLastEvent(teamId, gameId) {
  const snap = await getDocs(
    query(eventsPath(teamId, gameId), orderBy('seq', 'desc'), limit(5))
  );
  const target = snap.docs.find((d) => d.data().voided !== true);
  if (!target) return null;
  const call = httpsCallable(functions, 'voidGameEvent');
  return call({ teamId, gameId, eventId: target.id, reason: 'undo' });
}

/** Mid-log correction. Marks the game amended so viewers see why it changed. */
export function correctEvent(teamId, gameId, eventId, reason) {
  const call = httpsCallable(functions, 'voidGameEvent');
  return call({ teamId, gameId, eventId, reason: reason || 'correction' });
}

// ---------------------------------------------------------------------------
// The baton
// ---------------------------------------------------------------------------

/** Raise a hand for the book. Requesting is not taking. */
export function requestBaton(teamId, gameId, uid) {
  return updateDoc(gamePath(teamId, gameId), { batonRequestedBy: uid });
}

/** Current holder approves. Rules permit only these two fields together. */
export function approveBaton(teamId, gameId, requesterUid) {
  return updateDoc(gamePath(teamId, gameId), {
    scorekeeperUid: requesterUid,
    batonRequestedBy: null,
  });
}

export function denyBaton(teamId, gameId) {
  return updateDoc(gamePath(teamId, gameId), { batonRequestedBy: null });
}

/**
 * Owner-only reclaim. Needed because the alternative — a dead phone holding
 * the book with no way to take it back — leaves the game unscoreable.
 */
export function seizeBaton(teamId, gameId, uid) {
  return updateDoc(gamePath(teamId, gameId), {
    scorekeeperUid: uid,
    batonRequestedBy: null,
    batonSeizedAt: serverTimestamp(),
  });
}

export const holdsBaton = (game, uid) => !!game && game.scorekeeperUid === uid;

// ---------------------------------------------------------------------------
// Lineup lock — the audio cache-warming hook
// ---------------------------------------------------------------------------

/**
 * Finalizing the lineup is where walk-up clips get pre-downloaded. The audio
 * feature isn't built yet, but the moment has to exist in the flow now —
 * retrofitting a finalize step into a screen that never had one is awkward,
 * and this is where the cache warm belongs.
 */
export async function lockLineup(teamId, gameId, lineup) {
  await updateDoc(gamePath(teamId, gameId), {
    lineup,
    lineupLockedAt: serverTimestamp(),
  });
  // v1: no-op. Wire prefetchWalkUpClips(lineup) here when audio ships.
}

/** Create a game with the team's current rules frozen into it. */
export async function createGame(teamId, { opponent, date, homeOrAway, rules, createdBy }) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'teams', teamId, 'games'));
  batch.set(ref, {
    opponent,
    date,
    homeOrAway,
    status: 'scheduled',
    // Frozen at creation. If the league amends a rule in June, games played
    // in May must not silently rescore.
    rulesSnapshot: rules,
    score: { home: 0, away: 0 },
    currentInning: 1,
    isTopInning: true,
    outs: 0,
    lineup: [],
    scorekeeperUid: createdBy,
    batonRequestedBy: null,
    eventCount: 0,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

// Re-exported so callers keep importing game concerns from one place.
export { shouldSyncSummary };
