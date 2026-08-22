/**
 * ActiveTeam.jsx — Which team am I looking at?
 *
 * Every screen used to call useTeams() and take teams[0], so a parent with two
 * kids on different teams could only ever see one of them. The selection now
 * lives in one place, persists across launches, and is changed from the
 * account menu.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTeams } from './useTeams.js';
import { resolveActiveTeam } from '../shared/activeTeamResolution.js';

const KEY = '@activeTeamId';
const ActiveTeamContext = createContext(null);

export function ActiveTeamProvider({ children }) {
  const { teams, loading } = useTeams();
  const [activeId, setActiveId] = useState(null);
  const [restored, setRestored] = useState(false);
  /**
   * A team we've selected but haven't seen in the list yet.
   *
   * Creating a team selects it immediately, but useTeams reads
   * users/{uid}.teamIds and the new id takes a moment to arrive. Without this,
   * the fallback below saw an activeId matching no known team, decided the
   * person had been removed from it, and bounced them straight back to their
   * old team — which looked exactly like team creation had silently failed.
   */
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((id) => { if (id) setActiveId(id); })
      .catch(() => {})
      .finally(() => setRestored(true));
  }, []);

  // Clear the pending flag once the team actually shows up.
  useEffect(() => {
    if (pendingId && teams?.some((t) => t.id === pendingId)) setPendingId(null);
  }, [teams, pendingId]);

  // Fall back to the first team when nothing is stored, or when the stored id
  // points at a team the person is no longer on.
  useEffect(() => {
    if (!restored || loading || !teams?.length) return;
    // Never override a selection still in flight — see pendingId above.
    if (pendingId) return;
    const stillThere = teams.some((t) => t.id === activeId);
    if (!activeId || !stillThere) setActiveId(teams[0].id);
  }, [restored, loading, teams, activeId, pendingId]);

  const select = (id, { isNew = false } = {}) => {
    setActiveId(id);
    // Only a brand-new team needs protecting: switching to an existing one is
    // already in the list, and holding the flag would suppress a legitimate
    // fallback if the id were bad.
    if (isNew) setPendingId(id);
    AsyncStorage.setItem(KEY, id).catch(() => {});
  };

  const team = useMemo(
    () => resolveActiveTeam(teams, activeId, restored),
    [teams, activeId, restored]
  );

  return (
    <ActiveTeamContext.Provider
      value={{ team, teams: teams ?? [], loading: loading || !restored, select }}>
      {children}
    </ActiveTeamContext.Provider>
  );
}

export function useActiveTeam() {
  const ctx = useContext(ActiveTeamContext);
  if (!ctx) throw new Error('useActiveTeam must be used inside <ActiveTeamProvider>');
  return ctx;
}
