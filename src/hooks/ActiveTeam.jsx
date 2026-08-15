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

const KEY = '@activeTeamId';
const ActiveTeamContext = createContext(null);

export function ActiveTeamProvider({ children }) {
  const { teams, loading } = useTeams();
  const [activeId, setActiveId] = useState(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((id) => { if (id) setActiveId(id); })
      .catch(() => {})
      .finally(() => setRestored(true));
  }, []);

  // Fall back to the first team when nothing is stored, or when the stored id
  // points at a team the person is no longer on.
  useEffect(() => {
    if (!restored || loading || !teams?.length) return;
    const stillThere = teams.some((t) => t.id === activeId);
    if (!activeId || !stillThere) setActiveId(teams[0].id);
  }, [restored, loading, teams, activeId]);

  const select = (id) => {
    setActiveId(id);
    AsyncStorage.setItem(KEY, id).catch(() => {});
  };

  const team = useMemo(
    () => teams?.find((t) => t.id === activeId) ?? teams?.[0] ?? null,
    [teams, activeId]
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
