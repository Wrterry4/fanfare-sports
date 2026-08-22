/**
 * useGame.js — Live game state.
 *
 * Wraps subscribeToGame and owns the two things the screen needs that the
 * service layer deliberately doesn't: memoized stats and a debounced summary
 * write.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  subscribeToGame, appendEvent, createSequencer, syncGameSummary,
  undoLastEvent, holdsBaton,
} from '../services/gameService.js';
import { shouldSyncSummary } from '../shared/gameSummary.js';
import { snapshotIdentity } from '../shared/gameIdentity.js';
import { currentUid } from '../services/authService.js';

/** The game doc mirror is for list views only — it must never gate the UI. */
const SUMMARY_DEBOUNCE_MS = 4000;

export function useGame(teamId, gameId, { rules, config, names, sport }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const sequencer = useRef(null);
  const summaryTimer = useRef(null);
  // Tracks which game the current `snapshot` actually belongs to, so a real
  // game switch can be told apart from `rules`/`config`/`names` merely
  // getting new object references on an unrelated re-render.
  const identityRef = useRef(null);
  const uid = currentUid();

  useEffect(() => {
    if (!teamId || !gameId) return undefined;

    /**
     * Clear stale state the instant we're looking at a different game —
     * OR a different sport for the same game.
     *
     * This used to keep rendering the PREVIOUS snapshot until the new
     * subscription's first callback arrived. That's fine when nothing about
     * the shape changed — a few frames of the old score is harmless — but a
     * shape mismatch crashes outright: baseball's ActionPads reads
     * state.pitchers with no fallback, basketball's presenter read
     * state.onCourt the same way, and so on throughout both packs.
     *
     * The first version of this fix keyed the reset on teamId+gameId alone,
     * which covers switching games. It missed a real second path to the same
     * bug: `sport` can change while teamId and gameId stay exactly the same.
     * sportForTeam falls back to baseball whenever team.sport isn't known
     * yet — which is true for one render on almost every load, before the
     * team document has actually arrived — so the very first subscription
     * often starts as baseball's reduce() and then swaps to basketball's a
     * moment later once the real team doc loads. teamId:gameId doesn't
     * change during that swap, so the old check never cleared the snapshot,
     * and the stale baseball-shaped state kept rendering through basketball
     * components for that gap. `sport.key` is now part of the identity, so
     * that swap clears the snapshot exactly like a real game switch does.
     */
    const identity = snapshotIdentity(teamId, gameId, sport);
    if (identityRef.current !== identity) {
      setSnapshot(null);
      sequencer.current = null;
    }
    identityRef.current = identity;

    let cancelled = false;

    // The sport pack travels with the subscription. Without it every game was
    // replayed through the baseball engine regardless of the team's sport.
    const unsub = subscribeToGame(teamId, gameId, rules, config, names, (next) => {
      if (cancelled) return;
      if (!sequencer.current) sequencer.current = createSequencer(next.events);
      else sequencer.current.reseed(next.events);
      setSnapshot(next);
    }, sport);

    return () => { cancelled = true; unsub(); };
  }, [teamId, gameId, rules, config, names, sport]);

  /**
   * Debounced. Every event triggering a game-doc write would double the write
   * volume of a 400-pitch game for data nothing on this screen reads.
   */
  const scheduleSummary = useCallback((state) => {
    clearTimeout(summaryTimer.current);
    summaryTimer.current = setTimeout(() => {
      syncGameSummary(teamId, gameId, state).catch(() => {});
    }, SUMMARY_DEBOUNCE_MS);
  }, [teamId, gameId]);

  useEffect(() => () => clearTimeout(summaryTimer.current), []);

  const record = useCallback((type, payload) => {
    if (!sequencer.current) return;
    // Not awaited: the offline queue makes the local write immediate, and a
    // scorekeeper should never wait on the network between pitches.
    appendEvent(teamId, gameId, sequencer.current, uid, type, payload)
      .catch((e) => setError(e));
  }, [teamId, gameId, uid]);

  const canScore = useMemo(
    () => holdsBaton(snapshot?.game, uid),
    [snapshot?.game, uid]
  );

  /**
   * ONLY the baton holder writes the summary.
   *
   * Without this guard every spectator's device fires a game-doc update on
   * each event. The rules correctly reject those writes — but that means
   * thirty phones generating a steady stream of permission-denied errors, a
   * noisy console, and pointless retries. The listener is read-only for
   * everyone who isn't scoring.
   */
  useEffect(() => {
    // Second guard, independent of the first: a scheduled game is never
    // mirrored, so opening it can't move it.
    if (canScore && shouldSyncSummary(snapshot?.game, snapshot?.state)) {
      scheduleSummary(snapshot.state);
    }
  }, [canScore, snapshot?.game, snapshot?.state?.lastEventSeq, scheduleSummary, snapshot?.state]);

  return {
    game: snapshot?.game ?? null,
    state: snapshot?.state ?? null,
    stats: snapshot?.stats ?? null,
    events: snapshot?.events ?? [],
    isStale: snapshot?.isStale ?? false,
    canScore,
    error,
    record,
    undo: useCallback(() => undoLastEvent(teamId, gameId).catch(setError), [teamId, gameId]),
  };
}
