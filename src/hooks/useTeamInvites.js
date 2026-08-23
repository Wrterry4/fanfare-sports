/**
 * useTeamInvites.js — Pending invitations for the signed-in user.
 *
 * Deliberately not scoped to the active team: an invite is precisely a message
 * about a team you are NOT on yet, so it can't come from team-scoped data.
 */

import { useEffect, useState } from 'react';
import { subscribeTeamInvites } from '../services/teamInvites.js';
import { useAuth } from './AuthProvider.jsx';

export function useTeamInvites() {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);

  useEffect(() => {
    if (!user?.uid) { setInvites([]); return undefined; }
    return subscribeTeamInvites(user.uid, setInvites);
  }, [user?.uid]);

  return { invites, count: invites.length };
}
