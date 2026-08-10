/**
 * functions/index.js — Privileged operations.
 *
 * Everything here exists because it either (a) touches data no client may
 * read, (b) writes across documents that must land together, or (c) needs to
 * be trusted about what it computed.
 *
 * The engine is imported directly. Firebase Functions on Node 20+ runs ESM
 * natively, so the same modules the app ships run here unmodified — no
 * transpile step, no risk of client and server drifting apart.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { createHash, randomBytes } from 'crypto';

import { reduce } from './shared/baseball/engine.js';
import { computeStats, mergeStats } from './shared/baseball/stats.js';
import { restDaysFor } from './shared/baseball/rules.js';
import { EV } from './shared/baseball/events.js';
import { buildGameConfig, realPlayerIds } from './shared/baseball/config.js';

initializeApp();
const db = getFirestore();

const hashCode = (code) =>
  createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');

/** Unambiguous alphabet — no O/0, no I/1/L. Codes get read aloud and mistyped. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCareerCode() {
  const bytes = randomBytes(9);
  let out = '';
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) out += '-';
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

const requireAuth = (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
};

// ===========================================================================
// Player identity and transfers
// ===========================================================================

/**
 * Create a player and mint their career code.
 * The code is returned exactly once and stored only as a hash — the same
 * reason a password isn't kept in plaintext.
 */
export const createPlayer = onCall(async (req) => {
  const uid = requireAuth(req);
  const { firstName, lastName, birthYear, teamId, jerseyNumber } = req.data;
  await assertStaff(teamId, uid);

  const code = generateCareerCode();
  const playerRef = db.collection('players').doc();

  await db.runTransaction(async (tx) => {
    tx.set(playerRef, {
      firstName, lastName, birthYear,
      guardianUserIds: [],
      authorizedUserIds: [uid],
      rosteredTeamIds: [teamId],
      mediaConsent: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`careerCodes/${hashCode(code)}`), {
      playerId: playerRef.id,
      rotatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`teams/${teamId}/roster/${playerRef.id}`), {
      jerseyNumber: jerseyNumber ?? null,
      primaryPosition: null,
      active: true,
      addedAt: FieldValue.serverTimestamp(),
    });
  });

  // Shown once, to the coach, with instructions to hand it to the parent.
  return { playerId: playerRef.id, careerCode: code };
});

/**
 * A coach enters a career code to bring an existing player onto their roster.
 *
 * This does NOT link anything. It resolves the code — which no client can do —
 * and opens a pending transfer for a guardian to approve. An organization
 * pulling a child's record onto its roster on its own authority is precisely
 * the capability that shouldn't exist in this system.
 */
export const claimPlayer = onCall(async (req) => {
  const uid = requireAuth(req);
  const { code, teamId } = req.data;
  await assertStaff(teamId, uid);

  const codeSnap = await db.doc(`careerCodes/${hashCode(code)}`).get();
  if (!codeSnap.exists) {
    // Deliberately vague: a precise error turns this into an oracle for
    // probing which codes are real.
    throw new HttpsError('not-found', 'That code didn\'t match a player.');
  }

  const playerId = codeSnap.data().playerId;
  const playerSnap = await db.doc(`players/${playerId}`).get();
  const player = playerSnap.data();

  const existing = await db.collection('transfers')
    .where('playerId', '==', playerId)
    .where('toTeamId', '==', teamId)
    .where('status', '==', 'pending')
    .limit(1).get();
  if (!existing.empty) {
    return { status: 'already_pending', transferId: existing.docs[0].id };
  }

  const ref = await db.collection('transfers').add({
    playerId,
    toTeamId: teamId,
    fromTeamIds: player.rosteredTeamIds || [],
    requestedBy: uid,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  });

  await notifyGuardians(playerId, {
    title: 'Roster request',
    body: `A coach would like to add ${player.firstName} to their team.`,
    data: { type: 'transfer', transferId: ref.id },
  });

  // Only enough to confirm the right kid — never the full record.
  return {
    status: 'pending',
    transferId: ref.id,
    playerPreview: { firstName: player.firstName, lastInitial: player.lastName?.[0] },
  };
});

/** Guardian approves or denies. All the linked writes land together. */
export const respondToTransfer = onCall(async (req) => {
  const uid = requireAuth(req);
  const { transferId, approve } = req.data;

  const transferRef = db.doc(`transfers/${transferId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(transferRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Request no longer exists.');
    const t = snap.data();
    if (t.status !== 'pending') throw new HttpsError('failed-precondition', 'Already resolved.');

    const playerRef = db.doc(`players/${t.playerId}`);
    const playerSnap = await tx.get(playerRef);
    const player = playerSnap.data();

    if (!(player.guardianUserIds || []).includes(uid)) {
      throw new HttpsError('permission-denied', 'Only a parent can approve this.');
    }

    if (!approve) {
      tx.update(transferRef, {
        status: 'denied', resolvedAt: FieldValue.serverTimestamp(), approvedBy: uid,
      });
      return { status: 'denied' };
    }

    tx.set(db.doc(`teams/${t.toTeamId}/roster/${t.playerId}`), {
      jerseyNumber: null,
      primaryPosition: null,
      active: true,
      addedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.update(playerRef, {
      rosteredTeamIds: FieldValue.arrayUnion(t.toTeamId),
    });

    tx.update(transferRef, {
      status: 'approved', resolvedAt: FieldValue.serverTimestamp(), approvedBy: uid,
    });

    return { status: 'approved' };
  });
});

/**
 * Keep `authorizedUserIds` current: guardians, plus staff of every team the
 * player is rostered on. This array is what makes the read rule on player
 * documents a single cheap check instead of an unbounded search.
 */
export const syncPlayerAccess = onDocumentWritten('players/{playerId}', async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;

  const guardians = after.guardianUserIds || [];
  const teams = after.rosteredTeamIds || [];

  const staff = new Set();
  for (const teamId of teams) {
    const members = await db.collection(`teams/${teamId}/members`)
      .where('role', 'in', ['owner', 'coach']).get();
    members.forEach((m) => staff.add(m.id));
  }

  const next = [...new Set([...guardians, ...staff])].sort();
  const current = [...(after.authorizedUserIds || [])].sort();
  if (JSON.stringify(next) === JSON.stringify(current)) return;

  await event.data.after.ref.update({ authorizedUserIds: next });
});

// ===========================================================================
// Scoring
// ===========================================================================

/**
 * Void an event. Corrections never delete: the log stays complete, replay
 * stays deterministic, and the audit trail survives.
 */
export const voidGameEvent = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, gameId, eventId, reason } = req.data;

  const gameRef = db.doc(`teams/${teamId}/games/${gameId}`);
  const gameSnap = await gameRef.get();
  if (!gameSnap.exists) throw new HttpsError('not-found', 'Game not found.');
  if (gameSnap.data().scorekeeperUid !== uid) {
    throw new HttpsError('permission-denied', 'Only the scorekeeper can change the book.');
  }

  const eventRef = db.doc(`teams/${teamId}/games/${gameId}/events/${eventId}`);
  await eventRef.update({
    voided: true,
    voidedBy: uid,
    voidReason: reason || 'correction',
    voidedAt: FieldValue.serverTimestamp(),
  });

  // An undo during live play is routine. Changing a completed game is not —
  // parents already saw a result, so the record says so.
  if (gameSnap.data().status === 'final') {
    await gameRef.update({ status: 'amended', amendedAt: FieldValue.serverTimestamp() });
  }
  return { ok: true };
});

/**
 * Finalize. The authoritative recompute — the same engine the client ran, but
 * the client isn't trusted about the result.
 */
export const finalizeGame = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId, gameId } = req.data;
  await assertStaff(teamId, uid);

  const gameRef = db.doc(`teams/${teamId}/games/${gameId}`);
  const gameSnap = await gameRef.get();
  const game = gameSnap.data();

  const eventsSnap = await db.collection(`teams/${teamId}/games/${gameId}/events`)
    .orderBy('seq').get();
  const events = eventsSnap.docs.map((d) => d.data()).filter((e) => !e.voided);

  const teamSnap = await db.doc(`teams/${teamId}`).get();
  const team = teamSnap.data();
  const rules = game.rulesSnapshot;

  const config = buildGameConfig(game);
  const state = reduce(events, rules, config);
  const stats = computeStats(events, rules, config);

  const seasonKey = `${teamId}_${team.season}`;
  const batch = db.batch();

  const playerIds = new Set(realPlayerIds(stats));

  for (const playerId of playerIds) {
    const gameStats = {
      batting:  { [playerId]: stats.batting[playerId]  || {} },
      pitching: { [playerId]: stats.pitching[playerId] || {} },
      fielding: { [playerId]: stats.fielding[playerId] || {} },
    };

    const seasonRef = db.doc(`players/${playerId}/seasons/${seasonKey}`);
    const seasonSnap = await seasonRef.get();
    const merged = mergeStats(seasonSnap.data()?.raw || null, gameStats);

    batch.set(seasonRef, {
      teamId, orgId: team.orgId, season: team.season, division: team.division,
      raw: merged,
      batting:  merged.batting[playerId]  || {},
      pitching: merged.pitching[playerId] || {},
      fielding: merged.fielding[playerId] || {},
      gamesPlayed: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Pitching appearances live on the ROOT player, not the team. Rest-day
    // rules are per arm, and kids routinely pitch for a rec team and a travel
    // team in the same week — this is the only place that can see both.
    const pitches = state.pitchCounts[playerId];
    if (pitches > 0) {
      const restDays = restDaysFor(pitches, rules);
      const gameDate = game.date?.toDate?.() || new Date();
      batch.set(db.doc(`players/${playerId}/pitchingAppearances/${gameId}`), {
        date: gameDate,
        teamId, gameId, pitches, restDaysRequired: restDays,
        eligibleAgain: new Date(gameDate.getTime() + restDays * 86400000),
        exceededLimit: rules.maxPitchesPerOuting != null
          && pitches > rules.maxPitchesPerOuting,
      });
    }
  }

  batch.update(gameRef, {
    status: 'final',
    score: state.score,
    finalizedAt: FieldValue.serverTimestamp(),
    finalizedBy: uid,
  });

  await batch.commit();
  await recomputeCareers([...playerIds]);

  return { ok: true, score: state.score, players: playerIds.size };
});

/** Career totals are a rollup of seasons, never incremented in place. */
async function recomputeCareers(playerIds) {
  for (const playerId of playerIds) {
    const seasons = await db.collection(`players/${playerId}/seasons`).get();
    let career = null;
    for (const s of seasons.docs) {
      career = career ? mergeStats(career, s.data().raw) : s.data().raw;
    }
    await db.doc(`players/${playerId}/career/totals`).set({
      raw: career,
      batting:  career?.batting?.[playerId]  || {},
      pitching: career?.pitching?.[playerId] || {},
      fielding: career?.fielding?.[playerId] || {},
      seasonCount: seasons.size,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

// ===========================================================================
// Notifications
// ===========================================================================

/**
 * The on-deck alert. This is the feature that gets a grandparent five hundred
 * miles away to install the app, so it's worth the trigger.
 *
 * Fan-out is per-player, not per-team: only people who linked to THIS kid and
 * opted in get woken up. Notification fatigue is the failure mode that kills
 * this feature by week two.
 */
export const notifyOnBatterUp = onDocumentCreated(
  'teams/{teamId}/games/{gameId}/events/{eventId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || data.type !== EV.BATTER_UP) return;

    const { teamId } = event.params;
    const batterId = data.payload?.playerId;
    if (!batterId) return;

    const onDeckId = data.payload?.onDeckPlayerId;

    await Promise.all([
      batterId  && pushForPlayer(teamId, batterId, 'myPlayerAtBat', (name) => ({
        title: `${name} is up`,
        body: 'At the plate now.',
      })),
      onDeckId && pushForPlayer(teamId, onDeckId, 'myPlayerAtBat', (name) => ({
        title: `${name} is on deck`,
        body: 'Up next.',
      })),
    ].filter(Boolean));
  }
);

async function pushForPlayer(teamId, playerId, prefKey, build) {
  const members = await db.collection(`teams/${teamId}/members`)
    .where('linkedPlayerIds', 'array-contains', playerId).get();

  const recipients = members.docs.filter((m) => m.data().notificationPrefs?.[prefKey]);
  if (!recipients.length) return;

  const playerSnap = await db.doc(`players/${playerId}`).get();
  const name = playerSnap.data()?.firstName || 'Your player';
  const { title, body } = build(name);

  const tokens = [];
  for (const m of recipients) {
    const userSnap = await db.doc(`users/${m.id}`).get();
    const pushTokens = userSnap.data()?.pushTokens || {};
    for (const t of Object.values(pushTokens)) if (t.token) tokens.push(t.token);
  }
  if (!tokens.length) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { type: 'atBat', teamId, playerId },
    apns: { payload: { aps: { sound: 'default', 'interruption-level': 'time-sensitive' } } },
    android: { priority: 'high' },
  });

  // Dead tokens accumulate fast across reinstalls; prune as we go.
  await pruneDeadTokens(recipients, tokens, res);
}

async function pruneDeadTokens(recipients, tokens, res) {
  const dead = new Set();
  res.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token') dead.add(tokens[i]);
  });
  if (!dead.size) return;

  for (const m of recipients) {
    const userRef = db.doc(`users/${m.id}`);
    const snap = await userRef.get();
    const pushTokens = snap.data()?.pushTokens || {};
    const updates = {};
    for (const [deviceId, t] of Object.entries(pushTokens)) {
      if (dead.has(t.token)) updates[`pushTokens.${deviceId}`] = FieldValue.delete();
    }
    if (Object.keys(updates).length) await userRef.update(updates);
  }
}

async function notifyGuardians(playerId, { title, body, data }) {
  const playerSnap = await db.doc(`players/${playerId}`).get();
  const guardians = playerSnap.data()?.guardianUserIds || [];
  const tokens = [];
  for (const g of guardians) {
    const u = await db.doc(`users/${g}`).get();
    for (const t of Object.values(u.data()?.pushTokens || {})) if (t.token) tokens.push(t.token);
  }
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens, notification: { title, body }, data: data || {},
  });
}

// ---------------------------------------------------------------------------
// Re-exported so `firebase deploy --only functions` picks everything up from
// this single entry point.
// ---------------------------------------------------------------------------
export { createTeam, transferTeamOwnership } from './teams.js';
export {
  createPlayerInvites, createFanInvite, createTeamInvite,
  revokeInvite, previewInvite, redeemInvite, invitePipeline,
} from './invites.js';
