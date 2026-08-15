/**
 * membership.js — Getting a second person onto a team without Cloud Functions.
 *
 * On Blaze this is redeemInvite(): a single-use link that also links a specific
 * child and grants guardianship. That has to be a function, because it writes
 * to documents the joining user doesn't own.
 *
 * On Spark, the join code is the substitute. A person opens a link carrying the
 * team id and code, and creates their OWN membership document. The rule checks
 * the submitted code against the team document, so it can't be forged by
 * writing an arbitrary value.
 *
 * What the code grants and doesn't:
 *   grants  — team membership, chat, schedule, live game viewing, and (for
 *             scorekeeper/coach roles) the ability to request the book
 *   doesn't — guardianship of any child, or access to another family's stats
 *
 * A parent still has to be linked to their child by a coach, which is a
 * deliberate difference: guardianship should never be self-granted.
 */

import {
  db, doc, collection, setDoc, getDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove, query, where,
} from './firebase';
import { call } from './callable.js';
import { currentUid } from './authService.js';

export const ROLE_LABELS = {
  owner: 'Head coach',
  coach: 'Coach',
  scorekeeper: 'Scorekeeper',
  parent: 'Parent',
  fan: 'Family',
};

const DEFAULT_PREFS = {
  gameStart: true, myPlayerAtBat: true, myPlayerResult: true,
  allScoringPlays: false, finalScore: true,
  announcements: true, chatter: true, directMessages: true,
};

/** Preview before joining, so nobody commits to an unnamed team. */
export async function previewTeam(teamId) {
  const snap = await getDoc(doc(db, 'teams', teamId));
  if (!snap.exists()) return null;
  const t = snap.data();
  return { id: snap.id, name: t.name, season: t.season, division: t.division };
}

export async function joinTeamWithCode({ teamId, code, role = 'parent' }) {
  const uid = currentUid();
  if (!uid) throw new Error('Sign in first.');

  // Carried onto the member doc so team lists and chat can show a name —
  // nobody can read another person's user document.
  const me = await getDoc(doc(db, 'users', uid)).catch(() => null);
  const displayName = me?.data()?.displayName || null;

  const teamSnap = await getDoc(doc(db, 'teams', teamId));
  if (!teamSnap.exists()) throw new Error('That team no longer exists.');

  const expected = (teamSnap.data().joinCode || '').toUpperCase();
  const given = String(code || '').trim().toUpperCase();
  // Checked here for a clear message; the rule enforces it for real.
  if (!expected || expected !== given) throw new Error('That join code is not correct.');

  await setDoc(doc(db, 'teams', teamId, 'members', uid), {
    role,
    displayName,
    joinCode: given,            // the rule compares this field
    linkedPlayerIds: [],
    notificationPrefs: DEFAULT_PREFS,
    invitedBy: null,
    joinedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'users', uid), { teamIds: arrayUnion(teamId) }, { merge: true });
  return { teamId };
}

/** Everyone on the team — powers the DM list and the baton picker. */
export function subscribeMembers(teamId, cb) {
  return onSnapshot(collection(db, 'teams', teamId, 'members'), (snap) => {
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  }, () => cb([]));
}

/** Coaches link a parent to their child. Guardianship is never self-granted. */
export function linkPlayerToMember(teamId, memberUid, playerId) {
  return updateDoc(doc(db, 'teams', teamId, 'members', memberUid), {
    linkedPlayerIds: arrayUnion(playerId),
  });
}

export function unlinkPlayerFromMember(teamId, memberUid, playerId) {
  return updateDoc(doc(db, 'teams', teamId, 'members', memberUid), {
    linkedPlayerIds: arrayRemove(playerId),
  });
}

export function setMemberRole(teamId, memberUid, role) {
  return updateDoc(doc(db, 'teams', teamId, 'members', memberUid), { role });
}

// ---------------------------------------------------------------------------
// Claiming a player
// ---------------------------------------------------------------------------

/** Ask to be linked to a child. Grants nothing until someone approves. */
export async function requestPlayerClaim({ teamId, playerId, kind = 'parent', note }) {
  return call('requestPlayerClaim', {
    teamId, playerId, kind, note,
  });
}

/** Coach-side: link someone on the team to a player. */
export async function assignGuardian({ teamId, playerId, memberUid, asGuardian }) {
  return call('assignGuardian', {
    teamId, playerId, memberUid, asGuardian,
  });
}

export async function resolvePlayerClaim(claimId, approve) {
  return call('resolvePlayerClaim', { claimId, approve });
}

/** Pending requests a coach needs to act on. */
export function subscribePendingClaims(teamId, cb) {
  const q = query(
    collection(db, 'claims'),
    where('teamId', '==', teamId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]));
}

/** My own outstanding requests, so the UI can say "waiting on a coach". */
export function subscribeMyClaims(cb) {
  const uid = currentUid();
  if (!uid) { cb([]); return () => {}; }
  const q = query(collection(db, 'claims'), where('requestedBy', '==', uid));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]));
}

export function buildJoinUrl(origin, teamId, code) {
  return `${String(origin).replace(/\/$/, '')}/join-team?team=${teamId}&code=${code}`;
}

/**
 * Deterministic id keeps one thread per pair per team, so two people opening
 * a conversation from opposite ends land in the same place.
 */
export function conversationId(teamId, a, b) {
  const [x, y] = [a, b].sort();
  return `${teamId}_${x}_${y}`;
}

export async function ensureConversation(teamId, otherUid) {
  const uid = currentUid();
  const id = conversationId(teamId, uid, otherUid);
  const ref = doc(db, 'conversations', id);
  const snap = await getDoc(ref).catch(() => null);
  if (!snap?.exists()) {
    await setDoc(ref, {
      teamId,
      participantUids: [uid, otherUid].sort(),
      lastMessage: null,
      updatedAt: serverTimestamp(),
    });
  }
  return id;
}
