/**
 * functions/claims.js — Linking a person to a child.
 *
 * The principle that shapes this: **guardianship is never self-granted.**
 * Anyone can ask to be linked to a player; only a coach or an existing
 * guardian can approve it. Without that, a join code — which gets texted
 * around and forwarded — would be enough to attach yourself to someone else's
 * child and read their stats.
 *
 * Two kinds of link, and the difference matters:
 *
 *   PARENT — becomes a guardian. Can approve transfers, set the walk-up song,
 *            consent to media, and approve family members.
 *   FAN    — grandparent, aunt, family friend. Sees that child's stats and
 *            gets game alerts. Cannot approve anything, and is deliberately
 *            kept out of team chat and direct messages.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

const requireAuth = (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
};

async function memberRole(teamId, uid) {
  const snap = await db.doc(`teams/${teamId}/members/${uid}`).get();
  return snap.exists ? snap.data().role : null;
}

/**
 * Ask to be linked to a player. Creates a pending claim; grants nothing.
 */
export const requestPlayerClaim = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, playerId, kind = 'parent', note } = req.data;

  const role = await memberRole(teamId, uid);
  if (!role) throw new HttpsError('permission-denied', 'Join the team first.');
  if (!['parent', 'fan'].includes(kind)) {
    throw new HttpsError('invalid-argument', 'Unknown claim type.');
  }

  const rosterSnap = await db.doc(`teams/${teamId}/roster/${playerId}`).get();
  if (!rosterSnap.exists) throw new HttpsError('not-found', 'That player is not on this roster.');

  const dupe = await db.collection('claims')
    .where('playerId', '==', playerId)
    .where('requestedBy', '==', uid)
    .where('status', '==', 'pending')
    .limit(1).get();
  if (!dupe.empty) return { status: 'already_pending', claimId: dupe.docs[0].id };

  const userSnap = await db.doc(`users/${uid}`).get();

  const ref = await db.collection('claims').add({
    teamId, playerId, kind,
    requestedBy: uid,
    requestedByName: userSnap.data()?.displayName || 'Someone',
    note: note || null,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });

  return { status: 'pending', claimId: ref.id };
});

/**
 * A coach or an existing guardian approves. All the linked writes land in one
 * transaction — a half-applied claim would leave someone on a team with a
 * child attached but no read access, or vice versa.
 */
export const resolvePlayerClaim = onCall(async (req) => {
  const uid = requireAuth(req);
  const { claimId, approve } = req.data;

  const claimRef = db.doc(`claims/${claimId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(claimRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That request no longer exists.');
    const c = snap.data();
    if (c.status !== 'pending') throw new HttpsError('failed-precondition', 'Already resolved.');

    const playerRef = db.doc(`players/${c.playerId}`);
    const playerSnap = await tx.get(playerRef);
    const player = playerSnap.data();

    const memberSnap = await tx.get(db.doc(`teams/${c.teamId}/members/${uid}`));
    const role = memberSnap.data()?.role;
    const isStaff = ['owner', 'coach'].includes(role);
    const isGuardian = (player.guardianUserIds || []).includes(uid);

    if (!isStaff && !isGuardian) {
      throw new HttpsError('permission-denied',
        'Only a coach or a parent of this player can approve.');
    }

    if (!approve) {
      tx.update(claimRef, {
        status: 'denied', resolvedAt: FieldValue.serverTimestamp(), resolvedBy: uid,
      });
      return { status: 'denied' };
    }

    // Both kinds link the person to the player for notifications and stats.
    tx.update(db.doc(`teams/${c.teamId}/members/${c.requestedBy}`), {
      linkedPlayerIds: FieldValue.arrayUnion(c.playerId),
    });

    // Only a parent claim confers guardianship.
    if (c.kind === 'parent') {
      tx.update(playerRef, {
        guardianUserIds: FieldValue.arrayUnion(c.requestedBy),
      });
      tx.set(db.doc(`users/${c.requestedBy}`), {
        guardianOf: FieldValue.arrayUnion(c.playerId),
      }, { merge: true });
    } else {
      // A fan can read this player without being staff or a guardian, so they
      // have to be named explicitly. syncPlayerAccess preserves this.
      tx.update(playerRef, {
        followerUserIds: FieldValue.arrayUnion(c.requestedBy),
      });
    }

    tx.update(claimRef, {
      status: 'approved', resolvedAt: FieldValue.serverTimestamp(), resolvedBy: uid,
    });

    return { status: 'approved', kind: c.kind };
  });
});

/**
 * Names live on the user document, but member lists and chat need them without
 * being able to read other people's user docs. Denormalize on change.
 *
 * This is why Settings and the DM list showed roles instead of names: the
 * member doc never carried one.
 */
/**
 * A coach links a player to someone already on the team.
 *
 * The claim flow runs the other way — a parent asks, a coach approves — which
 * is right for people who join on their own. A coach sitting with a roster
 * wants to do it directly, and guardianship still can't be written from a
 * client, so it comes through here.
 */
export const assignGuardian = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, playerId, memberUid, asGuardian } = req.data;

  const role = await memberRole(teamId, uid);
  if (!['owner', 'coach'].includes(role)) {
    throw new HttpsError('permission-denied', 'Coaches only.');
  }

  const target = await db.doc(`teams/${teamId}/members/${memberUid}`).get();
  if (!target.exists) throw new HttpsError('not-found', 'That person is not on this team.');

  const batch = db.batch();

  batch.update(db.doc(`teams/${teamId}/members/${memberUid}`), {
    linkedPlayerIds: FieldValue.arrayUnion(playerId),
  });

  if (asGuardian) {
    batch.update(db.doc(`players/${playerId}`), {
      guardianUserIds: FieldValue.arrayUnion(memberUid),
    });
    batch.set(db.doc(`users/${memberUid}`), {
      guardianOf: FieldValue.arrayUnion(playerId),
    }, { merge: true });
  } else {
    // A follower reads one child without being staff or a guardian, so they
    // have to be named explicitly for syncPlayerAccess to grant it.
    batch.update(db.doc(`players/${playerId}`), {
      followerUserIds: FieldValue.arrayUnion(memberUid),
    });
  }

  await batch.commit();
  return { ok: true };
});

/**
 * A player's name is denormalized onto every roster document that references
 * them, so any team member can render a scoreboard without read access to the
 * protected /players record. This keeps those copies honest.
 */
export const propagatePlayerName = onDocumentWritten('players/{playerId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after) return;
  if (before?.firstName === after.firstName && before?.lastName === after.lastName) return;

  const playerId = event.params.playerId;
  const batch = db.batch();
  for (const teamId of after.rosteredTeamIds || []) {
    batch.set(db.doc(`teams/${teamId}/roster/${playerId}`), {
      firstName: after.firstName ?? null,
      lastName: after.lastName ?? null,
    }, { merge: true });
  }
  await batch.commit();
});

export const propagateDisplayName = onDocumentWritten('users/{uid}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after) return;
  if (before?.displayName === after.displayName) return;

  const uid = event.params.uid;
  const teamIds = after.teamIds || [];
  const batch = db.batch();
  for (const teamId of teamIds) {
    batch.set(db.doc(`teams/${teamId}/members/${uid}`), {
      displayName: after.displayName || null,
    }, { merge: true });
  }
  await batch.commit();
});
