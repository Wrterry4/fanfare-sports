/**
 * useMyTeamPlayers.js — Which of my children is on which team.
 *
 * Once someone is tracking two kids, "Ridgeview Reds" and "Northgate Fury"
 * don't say which is which at a glance — but "Jack" and "Maya" do. This maps
 * teamId to the players you're linked to there, so the team switcher can lead
 * with the name that actually identifies it.
 *
 * Also returns your ROLE on each team, which comes free — it's a field on the
 * same member document this already subscribes to. The switcher uses it to
 * label teams where you have no child: "Also coaching" is wrong for someone
 * who only keeps the book.
 */

import { useEffect, useState } from 'react';
import { db, doc, collection, onSnapshot, getDoc } from '../services/firebase';
import { useAuth } from './AuthProvider.jsx';

export function useMyTeamPlayers(teams) {
  const { user } = useAuth();
  const [byTeam, setByTeam] = useState({});
  const [roleByTeam, setRoleByTeam] = useState({});

  const key = (teams || []).map((t) => t.id).join(',');

  useEffect(() => {
    if (!user?.uid || !teams?.length) { setByTeam({}); setRoleByTeam({}); return undefined; }
    let cancelled = false;

    const unsubs = teams.map((t) =>
      onSnapshot(doc(db, 'teams', t.id, 'members', user.uid), async (snap) => {
        const member = snap.data() || {};
        if (!cancelled) setRoleByTeam((m) => ({ ...m, [t.id]: member.role || null }));
        const ids = member.linkedPlayerIds || [];
        if (!ids.length) {
          if (!cancelled) setByTeam((m) => ({ ...m, [t.id]: [] }));
          return;
        }
        // Names come from the roster document, which every member can read —
        // /players is gated to the people authorized on that child.
        const rows = await Promise.all(ids.map(async (pid) => {
          const r = await getDoc(doc(db, 'teams', t.id, 'roster', pid)).catch(() => null);
          if (!r?.exists?.()) return null;
          return { playerId: pid, ...r.data() };
        }));
        if (!cancelled) {
          setByTeam((m) => ({ ...m, [t.id]: rows.filter(Boolean) }));
        }
      }, () => {})
    );

    return () => { cancelled = true; unsubs.forEach((u) => u()); };
  }, [user?.uid, key]);

  return { byTeam, roleByTeam };
}
