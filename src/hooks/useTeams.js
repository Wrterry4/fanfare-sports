/**
 * useTeams.js — Which teams am I on?
 *
 * Reads users/{uid}.teamIds, then subscribes to each team document.
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
 *
 * ── Why a listener per team, not one getDoc each ────────────────────────────
 *
 * These used to be one-shot reads, which meant a change to a team document
 * never reached anyone already looking at it. A coach picking the team color
 * saw nothing until a hard refresh, and every other viewer saw nothing at all
 * — the color had genuinely saved, so it looked like the setting worked and
 * the app ignored it. Anything that lives on the team doc has the same
 * problem: renaming the team, changing rules, a new join code.
 *
 * One listener per team, torn down together. A person is on a handful of teams
 * at most, so this is a few listeners, not a fan-out worth optimizing.
 */

import { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from '../services/firebase';
import { useAuth } from './AuthProvider.jsx';

export function useTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState(null); // null = still loading
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) { setTeams([]); return undefined; }

    // Team docs arrive independently and out of order, so they're held by id
    // and re-emitted as an array ordered by teamIds — otherwise the active
    // team could appear to change places whenever one of them updated.
    let ids = [];
    const byId = new Map();
    let teamUnsubs = [];

    const emit = () => {
      setTeams(ids.map((id) => byId.get(id)).filter(Boolean));
    };

    const stopTeams = () => {
      teamUnsubs.forEach((fn) => fn());
      teamUnsubs = [];
    };

    const userUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const next = snap.data()?.teamIds || [];

      // Resubscribe only when the SET of teams changes. Without this guard any
      // unrelated write to the user document would tear down and rebuild every
      // team listener, which flickers the UI and re-bills every read.
      const same = next.length === ids.length && next.every((id, i) => id === ids[i]);
      if (same && teamUnsubs.length) return;

      ids = next;
      stopTeams();
      for (const id of [...byId.keys()]) {
        if (!ids.includes(id)) byId.delete(id);
      }

      if (!ids.length) { setTeams([]); return; }

      teamUnsubs = ids.map((id) => onSnapshot(
        doc(db, 'teams', id),
        (d) => {
          if (d.exists()) byId.set(id, { id: d.id, ...d.data() });
          else byId.delete(id);
          emit();
        },
        // One unreadable team must not blank out the others — a stale id in
        // teamIds after being removed from a team is a normal state, not an
        // error worth emptying the list for.
        () => { byId.delete(id); emit(); },
      ));
    }, (e) => { setError(e); setTeams([]); });

    return () => { userUnsub(); stopTeams(); };
  }, [user?.uid]);

  return { teams, loading: teams === null, error };
}
