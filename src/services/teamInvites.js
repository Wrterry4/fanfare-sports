/**
 * teamInvites.js — Invitations waiting for you.
 *
 * Live, not fetched once: an invite arrives while the app is open (a coach
 * importing a roster right now is the normal case), and a menu that only knew
 * about invites present at launch would show nothing at the moment the push
 * notification says to look.
 */

import {
  db, doc, collection, onSnapshot, httpsCallable, functions,
} from './firebase';
import { pendingTeamInvites } from '../shared/teamInvites.js';

/**
 * @param uid  the signed-in user
 * @param cb   receives PENDING invites, newest first
 * @returns unsubscribe
 */
export function subscribeTeamInvites(uid, cb) {
  if (!uid) { cb([]); return () => {}; }
  return onSnapshot(
    collection(db, 'users', uid, 'teamInvites'),
    (snap) => cb(pendingTeamInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    // A read failure here must not break the menu it lives in.
    () => cb([]),
  );
}

/**
 * Accept or decline. The function does the membership write — no client rule
 * lets you add yourself to a team, which is the entire point of an invite.
 */
export async function respondToTeamInvite(inviteId, accept) {
  const res = await httpsCallable(functions, 'respondToTeamInvite')({ inviteId, accept });
  return res.data;
}
