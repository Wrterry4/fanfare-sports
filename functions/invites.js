/**
 * functions/invites.js — Onboarding.
 *
 * The funnel that decides whether this product gets used: a coach has to get
 * fifteen non-technical parents installed and linked to the correct child. If
 * this is clumsy, nothing else in the app matters.
 *
 * Three invite shapes:
 *
 *   PLAYER — one link per kid. The coach already knows which phone number
 *            belongs to which family, so sending the link IS the assertion.
 *            Redeeming links the parent to that child as a guardian, with no
 *            approval step. Single-use so a forwarded link is dead.
 *
 *   FAN    — a guardian invites family to follow their own kid. Grandparents
 *            get the on-deck alert without gaining guardian authority.
 *
 *   TEAM   — general-purpose, multi-use: assistant coach, team parent,
 *            scorekeeper. No player link.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash, randomBytes } from 'crypto';

import {
  ROLES, INVITE_TYPES, INVITE_ERRORS, INVITE_ERROR_MESSAGES,
  validateInvite, resolveRole, defaultNotificationPrefs, buildInviteUrl,
} from './shared/common/inviteRules.js';

const db = getFirestore();

const APP_URL = process.env.APP_BASE_URL || 'https://fanfaresports.app';
const DAY = 86400000;

const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
const newToken   = () => randomBytes(24).toString('base64url');

const requireAuth = (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
};

async function memberRole(teamId, uid) {
  const snap = await db.doc(`teams/${teamId}/members/${uid}`).get();
  return snap.exists ? snap.data().role : null;
}

async function assertStaff(teamId, uid) {
  const role = await memberRole(teamId, uid);
  if (![ROLES.OWNER, ROLES.COACH].includes(role)) {
    throw new HttpsError('permission-denied', 'Coaches only.');
  }
  return role;
}

// ===========================================================================
// Creating invites
// ===========================================================================

/**
 * Bulk-generate one invite per rostered player.
 *
 * The coach's real job is fifteen text messages, so this returns everything
 * needed to send them in one pass — and skips players who already have a
 * guardian, so re-running it after a few parents join doesn't spam the rest.
 */
export const createPlayerInvites = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, playerIds, expiresInDays = 30 } = req.data;
  await assertStaff(teamId, uid);

  const roster = await db.collection(`teams/${teamId}/roster`).get();
  const targets = playerIds?.length
    ? roster.docs.filter((d) => playerIds.includes(d.id))
    : roster.docs.filter((d) => d.data().active !== false);

  const expiresAt = Date.now() + expiresInDays * DAY;
  const results = [];
  const batch = db.batch();

  for (const rosterDoc of targets) {
    const playerId = rosterDoc.id;
    const playerSnap = await db.doc(`players/${playerId}`).get();
    if (!playerSnap.exists) continue;
    const player = playerSnap.data();

    // Already has a parent attached — don't generate a second link.
    if ((player.guardianUserIds || []).length > 0) {
      results.push({ playerId, name: `${player.firstName} ${player.lastName}`, skipped: 'has_guardian' });
      continue;
    }

    const token = newToken();
    const ref = db.collection('invites').doc();
    batch.set(ref, {
      teamId,
      type: INVITE_TYPES.PLAYER,
      playerId,
      role: ROLES.PARENT,
      tokenHash: hashToken(token),
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      maxUses: 1,          // forwarded links are dead on arrival
      usedCount: 0,
      usedBy: [],
      revoked: false,
    });

    results.push({
      playerId,
      name: `${player.firstName} ${player.lastName}`,
      jerseyNumber: rosterDoc.data().jerseyNumber ?? null,
      url: buildInviteUrl(APP_URL, ref.id, token),
    });
  }

  await batch.commit();
  return { invites: results };
});

/**
 * A guardian invites family to follow their own kid. Multi-use with a low cap,
 * because one link usually goes to several relatives at once.
 */
export const createFanInvite = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, playerId, maxUses = 5, expiresInDays = 90 } = req.data;

  const playerSnap = await db.doc(`players/${playerId}`).get();
  if (!playerSnap.exists) throw new HttpsError('not-found', 'Player not found.');
  if (!(playerSnap.data().guardianUserIds || []).includes(uid)) {
    throw new HttpsError('permission-denied', 'Only a parent can invite family.');
  }

  const token = newToken();
  const ref = db.collection('invites').doc();
  await ref.set({
    teamId,
    type: INVITE_TYPES.FAN,
    playerId,
    role: ROLES.FAN,
    tokenHash: hashToken(token),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Date.now() + expiresInDays * DAY,
    maxUses: Math.min(maxUses, 10),
    usedCount: 0,
    usedBy: [],
    revoked: false,
  });

  return { url: buildInviteUrl(APP_URL, ref.id, token) };
});

/** General team invite — assistant coach, team parent, scorekeeper. */
export const createTeamInvite = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, role = ROLES.PARENT, maxUses = 25, expiresInDays = 30 } = req.data;
  const myRole = await assertStaff(teamId, uid);

  // Only an owner can hand out coach access.
  if (role === ROLES.COACH && myRole !== ROLES.OWNER) {
    throw new HttpsError('permission-denied', 'Only the team owner can invite coaches.');
  }
  if (role === ROLES.OWNER) {
    throw new HttpsError('invalid-argument', 'Ownership is transferred, not invited.');
  }

  const token = newToken();
  const ref = db.collection('invites').doc();
  await ref.set({
    teamId,
    type: INVITE_TYPES.TEAM,
    playerId: null,
    role,
    tokenHash: hashToken(token),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Date.now() + expiresInDays * DAY,
    maxUses,
    usedCount: 0,
    usedBy: [],
    revoked: false,
  });

  return { url: buildInviteUrl(APP_URL, ref.id, token) };
});

export const revokeInvite = onCall(async (req) => {
  const uid = requireAuth(req);
  const { inviteId } = req.data;
  const ref = db.doc(`invites/${inviteId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invite not found.');

  const inv = snap.data();
  const isCreator = inv.createdBy === uid;
  const role = await memberRole(inv.teamId, uid);
  if (!isCreator && ![ROLES.OWNER, ROLES.COACH].includes(role)) {
    throw new HttpsError('permission-denied', 'Not yours to cancel.');
  }

  await ref.update({ revoked: true, revokedAt: FieldValue.serverTimestamp(), revokedBy: uid });
  return { ok: true };
});

// ===========================================================================
// Redeeming
// ===========================================================================

/**
 * Unauthenticated preview, so the parent sees what they're joining before
 * being asked to create an account. Asking someone to sign up before telling
 * them what for is where onboarding funnels die.
 *
 * Returns a first name only. Whoever holds this link was texted it directly
 * by the coach, and a first name is the minimum needed to confirm it's the
 * right child.
 */
export const previewInvite = onCall(async (req) => {
  const { inviteId, token } = req.data;
  const snap = await db.doc(`invites/${inviteId}`).get();
  const invite = snap.exists ? snap.data() : null;

  const v = validateInvite(invite, hashToken(token || ''), Date.now());
  if (!v.ok) return { ok: false, error: v.error, message: INVITE_ERROR_MESSAGES[v.error] };

  const teamSnap = await db.doc(`teams/${invite.teamId}`).get();
  const team = teamSnap.data();

  let playerFirstName = null;
  if (invite.playerId) {
    const p = await db.doc(`players/${invite.playerId}`).get();
    playerFirstName = p.data()?.firstName || null;
  }

  return {
    ok: true,
    teamName: team?.name || null,
    season: team?.season || null,
    role: invite.role,
    type: invite.type,
    playerFirstName,
  };
});

/**
 * Redeem. Everything lands in one transaction: membership, the player link,
 * guardianship, and the invite's own use counter. A partial success here would
 * leave a parent on a team with no kid attached, or a burned link with no
 * membership — both are worse than a clean failure.
 */
export const redeemInvite = onCall(async (req) => {
  const uid = requireAuth(req);
  const { inviteId, token } = req.data;

  const inviteRef = db.doc(`invites/${inviteId}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    const invite = snap.exists ? snap.data() : null;

    const existingRole = invite
      ? (await tx.get(db.doc(`teams/${invite.teamId}/members/${uid}`))).data()?.role ?? null
      : null;

    const v = validateInvite(invite, hashToken(token || ''), Date.now(), existingRole);
    if (!v.ok) {
      // Already a member at the invited role is a no-op, not an error the
      // parent should have to think about.
      if (v.error === INVITE_ERRORS.ALREADY_MEMBER) {
        return { ok: true, teamId: invite.teamId, alreadyMember: true };
      }
      return { ok: false, error: v.error, message: INVITE_ERROR_MESSAGES[v.error] };
    }

    const { teamId, playerId, role, type } = invite;
    const finalRole = resolveRole(existingRole, role);

    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
    const memberUpdate = {
      role: finalRole,
      invitedBy: invite.createdBy,
      joinedAt: FieldValue.serverTimestamp(),
    };
    if (!existingRole) {
      memberUpdate.notificationPrefs = defaultNotificationPrefs(finalRole);
      memberUpdate.linkedPlayerIds = playerId ? [playerId] : [];
    } else if (playerId) {
      memberUpdate.linkedPlayerIds = FieldValue.arrayUnion(playerId);
    }
    tx.set(memberRef, memberUpdate, { merge: true });

    tx.set(db.doc(`users/${uid}`), {
      teamIds: FieldValue.arrayUnion(teamId),
    }, { merge: true });

    // Only a PLAYER invite confers guardianship. A fan invite links the person
    // to the kid for notifications and stat visibility, and stops there.
    if (playerId && type === INVITE_TYPES.PLAYER) {
      tx.update(db.doc(`players/${playerId}`), {
        guardianUserIds: FieldValue.arrayUnion(uid),
      });
      tx.set(db.doc(`users/${uid}`), {
        guardianOf: FieldValue.arrayUnion(playerId),
      }, { merge: true });
    }

    tx.update(inviteRef, {
      usedCount: FieldValue.increment(1),
      usedBy: FieldValue.arrayUnion(uid),
      lastUsedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, teamId, playerId: playerId || null, role: finalRole, type };
  });

  return result;
});

/**
 * Coach-facing status board. Shows which families are still outstanding, which
 * is the only view that makes chasing down fifteen parents tractable.
 */
export const invitePipeline = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId } = req.data;
  await assertStaff(teamId, uid);

  const [roster, invites] = await Promise.all([
    db.collection(`teams/${teamId}/roster`).get(),
    db.collection('invites')
      .where('teamId', '==', teamId)
      .where('type', '==', INVITE_TYPES.PLAYER).get(),
  ]);

  const byPlayer = new Map();
  for (const d of invites.docs) {
    const inv = d.data();
    byPlayer.set(inv.playerId, { id: d.id, ...inv });
  }

  const rows = [];
  for (const r of roster.docs) {
    const p = await db.doc(`players/${r.id}`).get();
    if (!p.exists) continue;
    const player = p.data();
    const inv = byPlayer.get(r.id);
    const hasGuardian = (player.guardianUserIds || []).length > 0;

    rows.push({
      playerId: r.id,
      name: `${player.firstName} ${player.lastName}`,
      jerseyNumber: r.data().jerseyNumber ?? null,
      status: hasGuardian ? 'joined'
            : !inv ? 'not_invited'
            : inv.revoked ? 'cancelled'
            : Date.now() > inv.expiresAt ? 'expired'
            : 'pending',
      inviteId: inv?.id || null,
      invitedAt: inv?.createdAt || null,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return {
    players: rows,
    summary: {
      joined: rows.filter((r) => r.status === 'joined').length,
      pending: rows.filter((r) => r.status === 'pending').length,
      needsAttention: rows.filter((r) =>
        ['not_invited', 'expired', 'cancelled'].includes(r.status)).length,
    },
  };
});
