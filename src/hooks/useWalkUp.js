/**
 * useWalkUp.js — Fire the walk-up song when a new batter comes up.
 *
 * Watches the engine's batter, not a Firestore listener. The scorekeeper's tap
 * updates local state instantly; waiting for a server round trip would put the
 * song a second or two behind the kid stepping in.
 *
 * Only the device holding the book plays anything — it's the one connected to
 * the speaker, and thirty phones playing the same song from the bleachers
 * would be chaos.
 */

import { useEffect, useRef } from 'react';
import { playClip, stopClip } from '../services/audioStore';

export function useWalkUp({ batterId, enabled, audioConfig }) {
  const lastBatter = useRef(null);

  useEffect(() => {
    if (!enabled) { stopClip(); return; }
    if (!batterId || batterId === lastBatter.current) return;

    lastBatter.current = batterId;
    const cfg = audioConfig?.[batterId];
    if (!cfg) return;

    playClip(batterId, {
      startSeconds: cfg.startSeconds ?? 0,
      durationSeconds: cfg.durationSeconds ?? 15,
      volume: cfg.volume ?? 1,
    }).catch(() => {});
  }, [batterId, enabled, audioConfig]);

  // Leaving the screen mid-song should not leave it playing.
  useEffect(() => () => stopClip(), []);

  return { stop: stopClip };
}
