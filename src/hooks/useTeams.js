/**
 * useTeams.js — Which teams am I on?
 *
 * Reads users/{uid}.teamIds, then fetches each team document individually.
 *
 * A collection query (`where('createdBy','==',uid)`) does NOT work here, and
 * the reason is worth remembering: Firestore rejects a query outright unless
 * it can prove EVERY possible result is readable. It does not filter results
 * through the rules. Since teams are readable only to members, no query across
 * /teams can ever be proven safe — it fails with "Missing or insufficient
 * permissions" even when the user would be allowed to read every document the
 * query returns.
 *
 * Individual document reads are checked one at a time, so they're fine. That's
 * what the teamIds array on the user document is for.
 */

import { useEffect, useState } from 'react';
import { db, doc, onSnapshot, getDoc } from '../services/firebase';
import { useAuth } from './AuthProvider.jsx';

export function useTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState(null); // null = still loading
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) { setTeams([]); return undefined; }

    return onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      const ids = snap.data()?.teamIds || [];
      if (!ids.length) { setTeams([]); return; }

      try {
        const docs = await Promise.all(
          ids.map((id) => getDoc(doc(db, 'teams', id)).catch(() => null))
        );
        setTeams(
          docs.filter((d) => d?.exists?.() ?? d?.exists)
              .map((d) => ({ id: d.id, ...d.data() }))
        );
      } catch (e) {
        setError(e);
        setTeams([]);
      }
    }, (e) => { setError(e); setTeams([]); });
  }, [user?.uid]);

  return { teams, loading: teams === null, error };
}
