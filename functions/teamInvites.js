/**
 * functions/teamInvites.js — Answering an invite addressed to you.
 *
 * Creating these lives in index.js, inside importPlayers, because that's the
 * event that justifies them. This is the other half: accepting one is a
 * membership write, and no client rule permits writing your own member
 * document — that's what a join code or an invite token is for. Here the
 * invite's existence under users/{uid} IS the authorization, which is why the
 * function reads it from there and trusts nothing in the request but the id.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from './firebase-init.js';
import { TEAM_INVITE_STATUS } from './shared/common/teamInvites.js';
import { defaultNotificationPrefs, resolveRole } from './shared/common/inviteRules.js';

export const respondToTeamInvite = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const { inviteId, accept } = req.data || {};
  if (!inviteId) throw new HttpsError('invalid-argument', 'No invite given.');

  // Read from the caller's OWN subtree. An invite id from another user's menu
  // simply doesn't exist here, so there is nothing to check ownership of.
  const inviteRef = db.doc(`users/${uid}/teamInvites/${inviteId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That invite is gone.');

    const invite = snap.data();
    if (invite.status && invite.status !== TEAM_INVITE_STATUS.PENDING) {
      // Answering twice — two devices, or a stale menu — is not an error.
      return { ok: true, status: invite.status, teamId: invite.teamId };
    }

    if (!accept) {
      tx.update(inviteRef, {
        status: TEAM_INVITE_STATUS.DECLINED,
        respondedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, status: TEAM_INVITE_STATUS.DECLINED, teamId: invite.teamId };
    }

    const { teamId, playerId, role } = invite;
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
    const existing = (await tx.get(memberRef)).data() || null;

    // Never demote. Someone invited as a parent who is already an assistant
    // coach on that team stays a coach.
    const finalRole = resolveRole(existing?.role ?? null, role || 'parent');

    const update = {
      role: finalRole,
      invitedBy: invite.invitedBy || null,
      joinedAt: existing ? (existing.joinedAt ?? FieldValue.serverTimestamp())
                         : FieldValue.serverTimestamp(),
    };
    if (!existing) {
      update.notificationPrefs = defaultNotificationPrefs(finalRole);
      update.displayName = (await tx.get(db.doc(`users/${uid}`))).data()?.displayName || null;
      update.linkedPlayerIds = playerId ? [playerId] : [];
    } else if (playerId) {
      update.linkedPlayerIds = FieldValue.arrayUnion(playerId);
    }
    tx.set(memberRef, update, { merge: true });

    tx.set(db.doc(`users/${uid}`), {
      teamIds: FieldValue.arrayUnion(teamId),
    }, { merge: true });

    // Guardianship is NOT granted here, deliberately. This invite was sent
    // because the person is already a guardian of that child — an invite that
    // could confer guardianship on acceptance would be a way to hand someone a
    // child by pushing them a notification.
    tx.update(inviteRef, {
      status: TEAM_INVITE_STATUS.ACCEPTED,
      respondedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, status: TEAM_INVITE_STATUS.ACCEPTED, teamId, playerId: playerId || null };
  });
});
