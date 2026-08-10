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
import { currentUid } from '../services/authService.js';

/** The game doc mirror is for list views only — it must never gate the UI. */
const SUMMARY_DEBOUNCE_MS = 4000;

export function useGame(teamId, gameId, { rules, config, names }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const sequencer = useRef(null);
  const summaryTimer = useRef(null);
  const uid = currentUid();

  useEffect(() => {
    if (!teamId || !gameId) return undefined;
    let cancelled = false;

    const unsub = subscribeToGame(teamId, gameId, rules, config, names, (next) => {
      if (cancelled) return;
      if (!sequencer.current) sequencer.current = createSequencer(next.events);
      else sequencer.current.reseed(next.events);
      setSnapshot(next);
    });

    return () => { cancelled = true; unsub(); };
  }, [teamId, gameId, rules, config, names]);

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
    if (canScore && snapshot?.state) scheduleSummary(snapshot.state);
  }, [canScore, snapshot?.state?.lastEventSeq, scheduleSummary, snapshot?.state]);

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
