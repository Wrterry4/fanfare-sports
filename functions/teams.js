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
import { isTeamColorId } from './shared/common/teamColors.js';


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
    colorId = null,
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
      // Validated against the shared list rather than trusted: this is a
      // client-supplied value that ends up painting the UI, and an unknown id
      // resolves to the brand default anyway. Null means nobody picked.
      colorId: isTeamColorId(colorId) ? colorId : null,
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

// ===========================================================================
// Joining with a code
// ===========================================================================

/**
 * Look at a team before joining it, signed out.
 *
 * Unauthenticated on purpose: the join screen creates the account inline, and
 * asking someone to sign up before telling them what they're signing up for is
 * where invite funnels lose people. Same reasoning as previewInvite().
 *
 * Returns the name, season and division — and NOT the join code, which is the
 * whole reason this can't be a client read of the team document.
 */
export const previewTeamPublic = onCall(async (req) => {
  const { teamId } = req.data || {};
  if (!teamId) throw new HttpsError('invalid-argument', 'No team given.');

  const snap = await db.doc(`teams/${teamId}`).get();
  if (!snap.exists) return null;

  const t = snap.data();
  return {
    id: snap.id,
    name: t.name || null,
    season: t.season || null,
    division: t.division || null,
  };
});

/**
 * Join a team by typing the code the coach shared.
 *
 * ── Why this can't stay on the client ─────────────────────────────────────
 *
 * The client version read the team document to compare the code. Under the
 * development rules that works, because any signed-in user may read any team.
 * In production that read is closed, and opening it would be worse than the
 * problem it solves: the join code is a FIELD on the team document, so letting
 * anyone read the document hands them the code for every team in the project.
 *
 * Checking it here is the only shape where the code stays secret AND the
 * person is allowed in — the comparison happens somewhere the client can't
 * see, and the membership write happens with credentials no client has.
 *
 * Owner is never grantable this way. A team has one owner, established at
 * creation and moved only by transferTeamOwnership().
 */
export const joinWithCode = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, code, role = 'parent' } = req.data || {};

  if (!teamId) throw new HttpsError('invalid-argument', 'No team given.');
  if (!['parent', 'fan', 'coach'].includes(role)) {
    throw new HttpsError('invalid-argument', 'That is not a role you can join as.');
  }

  const teamSnap = await db.doc(`teams/${teamId}`).get();
  if (!teamSnap.exists) throw new HttpsError('not-found', 'That team no longer exists.');

  const expected = String(teamSnap.data().joinCode || '').trim().toUpperCase();
  const given = String(code || '').trim().toUpperCase();
  if (!expected || expected !== given) {
    // Deliberately the same message whether the code is wrong or the team has
    // none: a precise error turns this into an oracle for probing codes.
    throw new HttpsError('permission-denied', "That join code isn't correct.");
  }

  const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
  const existing = await memberRef.get();
  if (existing.exists) {
    // Already on the team is a no-op, not an error worth showing anybody.
    return { teamId, alreadyMember: true, role: existing.data().role };
  }

  const me = (await db.doc(`users/${uid}`).get()).data() || {};

  await db.runTransaction(async (tx) => {
    tx.set(memberRef, {
      role,
      // Denormalized so member lists and chat can show a name without reading
      // another person's user document.
      displayName: me.displayName || null,
      linkedPlayerIds: [],
      notificationPrefs: defaultPrefsFor(role),
      invitedBy: null,
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`users/${uid}`), {
      teamIds: FieldValue.arrayUnion(teamId),
    }, { merge: true });
  });

  return { teamId, alreadyMember: false, role };
});

/**
 * A fan follows one child and stays out of team traffic; anyone else gets the
 * ordinary set. Mirrors defaultNotificationPrefs() in shared/inviteRules.js —
 * kept local so this file has no reason to import the invite module.
 */
function defaultPrefsFor(role) {
  const base = {
    gameStart: true, myPlayerAtBat: true, myPlayerResult: true,
    allScoringPlays: false, finalScore: true,
    announcements: true, chatter: true, directMessages: true,
  };
  if (role !== 'fan') return base;
  return { ...base, chatter: false, announcements: false, directMessages: false };
}
