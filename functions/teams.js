/**
 * functions/teams.js — Team creation.
 *
 * This exists because of a bootstrapping deadlock in the rules, and the
 * deadlock is correct rather than a mistake to route around:
 *
 *   Creating a member document requires isStaff(teamId).
 *   isStaff(teamId) requires an existing member document.
 *
 * So the first member of any team cannot be written from a client. Relaxing
 * the rule to allow a self-appointed owner would let anyone insert themselves
 * as owner of ANY team by id — including one that already exists. The
 * transaction below is the only sanctioned way a team comes into being.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase-init.js';


const requireAuth = (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
};

/** Short, unambiguous, read-aloud-safe. No O/0, no I/1/L. */
const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const joinCode = () =>
  Array.from({ length: 6 }, () =>
    JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)]).join('');

/**
 * Creates the organization (if needed), the team, the owner's membership, and
 * the two default channels — atomically. A partial success would leave a team
 * nobody can administer.
 */
export const createTeam = onCall(async (req) => {
  const uid = requireAuth(req);
  const {
    name, season, division, ageGroup,
    sport = 'baseball',
    rules = {},
    orgId: existingOrgId,
    orgName,
  } = req.data;

  if (!name?.trim()) throw new HttpsError('invalid-argument', 'A team name is required.');
  if (!season?.trim()) throw new HttpsError('invalid-argument', 'A season is required.');

  // Joining an existing org requires being an admin of it.
  if (existingOrgId) {
    const org = await db.doc(`organizations/${existingOrgId}`).get();
    if (!org.exists) throw new HttpsError('not-found', 'Organization not found.');
    if (!(org.data().adminUserIds || []).includes(uid)) {
      throw new HttpsError('permission-denied', 'Not an admin of that organization.');
    }
  }

  const orgRef = existingOrgId
    ? db.doc(`organizations/${existingOrgId}`)
    : db.collection('organizations').doc();
  const teamRef = db.collection('teams').doc();

  await db.runTransaction(async (tx) => {
    if (!existingOrgId) {
      // A solo coach paying for one team still gets an org — implicitly, with
      // a single team inside. One code path instead of two.
      tx.set(orgRef, {
        name: orgName?.trim() || `${name.trim()} Organization`,
        type: 'independent',
        adminUserIds: [uid],
        billing: { plan: 'free', status: 'active', seatsUsed: 0 },
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(teamRef, {
      orgId: orgRef.id,
      name: name.trim(),
      season: season.trim(),
      division: division || null,
      ageGroup: ageGroup ?? null,
      // Stored so a second sport can land without migrating existing teams.
      sport,
      rules,
      joinCode: joinCode(),
      activeGameId: null,
      archived: false,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(db.doc(`teams/${teamRef.id}/members/${uid}`), {
      role: 'owner',
      linkedPlayerIds: [],
      notificationPrefs: {
        gameStart: true, myPlayerAtBat: false, myPlayerResult: false,
        allScoringPlays: false, finalScore: true,
        announcements: true, chatter: true, directMessages: true,
      },
      invitedBy: null,
      joinedAt: FieldValue.serverTimestamp(),
    });

    tx.set(db.doc(`users/${uid}`), {
      teamIds: FieldValue.arrayUnion(teamRef.id),
    }, { merge: true });

    // Seeded here so the Messages tab is never empty on first open.
    tx.set(db.doc(`teams/${teamRef.id}/channels/announcements`), {
      name: 'Announcements', staffOnly: true, order: 0,
    });
    tx.set(db.doc(`teams/${teamRef.id}/channels/chatter`), {
      name: 'Team Chatter', staffOnly: false, order: 1,
    });
  });

  return { teamId: teamRef.id, orgId: orgRef.id };
});

/**
 * Ownership must be transferable without data loss — coaches move on, and a
 * team stranded with an unreachable owner can't be administered.
 */
export const transferTeamOwnership = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, newOwnerUid } = req.data;

  const meRef = db.doc(`teams/${teamId}/members/${uid}`);
  const themRef = db.doc(`teams/${teamId}/members/${newOwnerUid}`);

  await db.runTransaction(async (tx) => {
    const me = await tx.get(meRef);
    const them = await tx.get(themRef);
    if (me.data()?.role !== 'owner') {
      throw new HttpsError('permission-denied', 'Only the owner can transfer ownership.');
    }
    if (!them.exists) {
      throw new HttpsError('not-found', 'That person is not on this team.');
    }
    tx.update(themRef, { role: 'owner' });
    tx.update(meRef, { role: 'coach' });
  });

  return { ok: true };
});
