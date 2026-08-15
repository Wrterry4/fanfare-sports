/**
 * useMyRole.js — What am I on the active team?
 *
 * Drives which tabs render. A fan (grandparent, family friend) follows one
 * child: they get Game Day and Schedule and nothing else. Roster would hand
 * them a directory of other people's children, and chat is deliberately
 * adults-on-the-team only.
 */

import { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from '../services/firebase';
import { useAuth } from './AuthProvider.jsx';
import { useActiveTeam } from './ActiveTeam.jsx';

export function useMyRole() {
  const { user } = useAuth();
  const { team } = useActiveTeam();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!team?.id || !user?.uid) { setMember(null); setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(doc(db, 'teams', team.id, 'members', user.uid),
      (snap) => { setMember(snap.exists() ? snap.data() : null); setLoading(false); },
      () => { setMember(null); setLoading(false); });
  }, [team?.id, user?.uid]);

  const role = member?.role ?? null;
  return {
    member,
    role,
    loading,
    isStaff: role === 'owner' || role === 'coach',
    isOwner: role === 'owner',
    isFan: role === 'fan',
    canScore: ['owner', 'coach', 'scorekeeper', 'parent'].includes(role),
    linkedPlayerIds: member?.linkedPlayerIds ?? [],
  };
}
