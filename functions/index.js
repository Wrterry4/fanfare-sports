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
import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { createHash, randomBytes } from 'crypto';

// MUST be imported before anything that touches Firestore. See the header of
// firebase-init.js — this import is what guarantees the admin app exists by
// the time the re-exported modules at the bottom of this file evaluate.
import { db } from './firebase-init.js';

// Sport dispatch, not a baseball import. finalizeGame and recomputeCareers
// used to pull the baseball engine, stats, and rules modules in directly,
// which meant a basketball game finalized with zero season stats written for
// anybody — see serverDispatch.js for the full account.
import { serverPackFor } from './shared/serverDispatch.js';


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

/**
 * Every callable below that writes into a team gates on this.
 *
 * It was being CALLED by four of them and defined by none — invites.js has its
 * own private copy, which this file never imported, so createPlayer,
 * claimPlayer, backfillStatsAccess and finalizeGame each threw a
 * ReferenceError the moment they were invoked.
 */
async function assertStaff(teamId, uid) {
  if (!teamId) throw new HttpsError('invalid-argument', 'No team given.');
  const snap = await db.doc(`teams/${teamId}/members/${uid}`).get();
  const role = snap.data()?.role;
  if (!['owner', 'coach'].includes(role)) {
    throw new HttpsError('permission-denied', 'Coaches only.');
  }
  return role;
}

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
  const { firstName, lastName, birthYear, teamId, jerseyNumber, primaryPosition } = req.data;
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
      // Names are denormalized onto the roster entry because that is what the
      // whole team can read — /players is gated to the people authorized on
      // that child, so a roster row without a name renders as a bare id for
      // everyone but the coach.
      firstName,
      lastName: lastName ?? null,
      jerseyNumber: jerseyNumber ?? null,
      primaryPosition: primaryPosition ?? null,
      active: true,
      addedAt: FieldValue.serverTimestamp(),
    });
  });

  // Shown once, to the coach, with instructions to hand it to the parent.
  return { playerId: playerRef.id, careerCode: code };
});

/**
 * Import players from one of your own teams onto another.
 *
 * This is NOT claimPlayer. There is no career code and no guardian approval,
 * and the difference is the whole justification: claimPlayer exists so one
 * organization cannot pull a child's record onto its roster on its own
 * authority. Here the caller is already staff on BOTH teams — they can already
 * read every one of these players — so the only thing that changes is which of
 * their own rosters the child appears on. Both checks below are what make that
 * sentence true, and neither may be relaxed to one team.
 *
 * The player record is JOINED to the new team, not copied. Same playerId, so
 * career totals keep accumulating and existing parent links keep working.
 *
 * The jersey number is deliberately not carried: numbers belong to a season on
 * a team, not to the child.
 */
export const importPlayers = onCall(async (req) => {
  const uid = requireAuth(req);
  const { fromTeamId, toTeamId, playerIds } = req.data || {};

  if (fromTeamId === toTeamId) {
    throw new HttpsError('invalid-argument', 'Those are the same team.');
  }
  // Staff on the source AND the destination. Source membership is what makes
  // this not a data grab; destination membership is what makes it allowed.
  await assertStaff(fromTeamId, uid);
  await assertStaff(toTeamId, uid);

  const ids = [...new Set(playerIds || [])].filter(Boolean);
  if (!ids.length) throw new HttpsError('invalid-argument', 'No players given.');
  if (ids.length > 60) {
    throw new HttpsError('invalid-argument', 'Too many players in one import.');
  }

  const added = [];
  const skipped = [];

  for (const playerId of ids) {
    // The id has to come off the source roster, not out of the request body —
    // otherwise this is an arbitrary "add any player to my team" endpoint for
    // anyone who can guess an id.
    const fromRow = await db.doc(`teams/${fromTeamId}/roster/${playerId}`).get();
    if (!fromRow.exists) { skipped.push({ playerId, reason: 'not-on-source' }); continue; }

    const existing = await db.doc(`teams/${toTeamId}/roster/${playerId}`).get();
    if (existing.exists) { skipped.push({ playerId, reason: 'already-here' }); continue; }

    const player = (await db.doc(`players/${playerId}`).get()).data() || {};
    const src = fromRow.data();

    await db.doc(`teams/${toTeamId}/roster/${playerId}`).set({
      // Denormalized so every member can render a scoreboard; /players stays
      // gated to the people authorized on that child.
      firstName: player.firstName ?? src.firstName ?? null,
      lastName: player.lastName ?? src.lastName ?? null,
      // A blank the coach fills in. See the header.
      jerseyNumber: null,
      primaryPosition: src.primaryPosition ?? null,
      active: true,
      addedAt: FieldValue.serverTimestamp(),
      importedFrom: fromTeamId,
    });

    // syncPlayerAccess picks this up and recomputes both access lists, which
    // is what lets the new team's members read the player and their stats.
    await db.doc(`players/${playerId}`).update({
      rosteredTeamIds: FieldValue.arrayUnion(toTeamId),
    });

    added.push(playerId);
  }

  return { added, skipped };
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
/**
 * Recompute both access lists for one player.
 *
 * TWO lists, deliberately different in width:
 *
 *   authorizedUserIds  guardians, approved followers, and STAFF of every
 *                      rostered team. Gates the /players document itself —
 *                      birth year, guardian ids, media consent.
 *
 *   statsViewerUids    EVERY member of every rostered team, at any role.
 *                      Gates only the stat subcollections. This is what makes
 *                      the scorebook readable by the whole team without
 *                      handing a fan another family's personal details.
 *
 * Keeping them separate is the whole reason stats live in subcollections
 * rather than as fields on the player.
 */
async function accessListsFor(playerId, player) {
  const guardians = player.guardianUserIds || [];
  // Approved fans — grandparents and family — read one specific child without
  // being staff or a guardian, so they have to be listed explicitly.
  const followers = player.followerUserIds || [];
  const teams = player.rosteredTeamIds || [];

  const staff = new Set();
  const everyone = new Set();
  for (const teamId of teams) {
    const members = await db.collection(`teams/${teamId}/members`).get();
    members.forEach((m) => {
      everyone.add(m.id);
      if (['owner', 'coach'].includes(m.data().role)) staff.add(m.id);
    });
  }

  return {
    authorizedUserIds: [...new Set([...guardians, ...followers, ...staff])].sort(),
    statsViewerUids: [...new Set([...guardians, ...followers, ...everyone])].sort(),
  };
}

const sameList = (a, b) =>
  JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());

export const syncPlayerAccess = onDocumentWritten('players/{playerId}', async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;

  const next = await accessListsFor(event.params.playerId, after);

  // Both unchanged means this write was the update below; stopping here is
  // what keeps the trigger from recursing.
  if (sameList(next.authorizedUserIds, after.authorizedUserIds)
   && sameList(next.statsViewerUids, after.statsViewerUids)) return;

  await event.data.after.ref.update(next);
});

/**
 * Bump to re-run the repair once per team after changing what it writes.
 */
export const STATS_ACCESS_VERSION = 2;

/**
 * One-time repair, run automatically rather than by a button.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * Access lists ARE maintained automatically: syncPlayerAccess fires on player
 * writes, syncTeamMemberAccess on membership writes. Both work.
 *
 * Neither fires for data that already exists and isn't changing. A settled
 * roster produces no writes, so players created before those triggers existed
 * — or before the deployment that first made them load — keep a null list
 * forever. Nothing is pending, so nothing repairs it.
 *
 * The same is true of member display names, repaired here too.
 *
 * This used to be a button, which was the wrong shape: a coach has no way to
 * know whether their team needs it. The client now calls it once per team,
 * silently, and the version stamp on the team document stops it repeating.
 *
 * Safe to run repeatedly — it recomputes and writes only on a difference.
 */
export const backfillStatsAccess = onCall(async (req) => {
  const uid = requireAuth(req);
  const { teamId } = req.data;
  await assertStaff(teamId, uid);

  const roster = await db.collection(`teams/${teamId}/roster`).get();
  let updated = 0, skipped = 0;

  /**
   * Repair member display names while we're here.
   *
   * propagateDisplayName copies users/{uid}.displayName onto each member
   * document, but it only fires when the name CHANGES — and it was one of the
   * functions that never loaded before the initialization fix, so every member
   * created until then has a null name. The UI falls back to the role, which
   * is why a parent called Jessica appears in Direct Messages as "Parent".
   *
   * Nothing would ever repopulate those on its own: the name is already
   * correct on the user document, so no write is pending.
   */
  const members = await db.collection(`teams/${teamId}/members`).get();
  let names = 0;
  for (const m of members.docs) {
    const userSnap = await db.doc(`users/${m.id}`).get();
    const real = userSnap.data()?.displayName || null;
    if (!real || m.data().displayName === real) continue;
    await m.ref.set({ displayName: real }, { merge: true });
    names++;
  }

  for (const entry of roster.docs) {
    const ref = db.doc(`players/${entry.id}`);
    const snap = await ref.get();
    if (!snap.exists) { skipped++; continue; }
    const player = snap.data();

    const next = await accessListsFor(entry.id, player);
    if (sameList(next.authorizedUserIds, player.authorizedUserIds)
     && sameList(next.statsViewerUids, player.statsViewerUids)) { skipped++; continue; }

    await ref.update(next);
    updated++;
  }

  /**
   * Stamped so the client knows this team is done and never asks again.
   *
   * The version, rather than a boolean: if a future change alters what the
   * access lists contain, bumping STATS_ACCESS_VERSION re-runs it once per
   * team automatically instead of needing another button.
   */
  await db.doc(`teams/${teamId}`).set(
    { statsAccessVersion: STATS_ACCESS_VERSION }, { merge: true });

  return { ok: true, updated, skipped, players: roster.size, names,
           version: STATS_ACCESS_VERSION };
});

/**
 * Membership changes have to reach the players too.
 *
 * statsViewerUids is a snapshot of a team's roster of PEOPLE, so a grandparent
 * who joins on Friday would otherwise see nothing until someone happened to
 * edit each child. This recomputes every player on the team when a member is
 * added, removed, or has their role changed.
 *
 * Role changes matter as well as joins: promoting a parent to coach widens
 * authorizedUserIds, not just the stats list.
 */
export const syncTeamMemberAccess = onDocumentWritten(
  'teams/{teamId}/members/{memberUid}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const joined = !before && after;
    const left = before && !after;
    const roleChanged = before && after && before.role !== after.role;
    if (!joined && !left && !roleChanged) return;

    const { teamId } = event.params;
    const roster = await db.collection(`teams/${teamId}/roster`).get();

    for (const entry of roster.docs) {
      const ref = db.doc(`players/${entry.id}`);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const player = snap.data();

      const next = await accessListsFor(entry.id, player);
      if (sameList(next.authorizedUserIds, player.authorizedUserIds)
       && sameList(next.statsViewerUids, player.statsViewerUids)) continue;

      await ref.update(next).catch(() => {});
    }
  }
);

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

  /**
   * Finalizing is NOT idempotent, so it must not run twice.
   *
   * Each run merges this game's slice into every player's season document.
   * Running it again adds the same game a second time — a kid's season hit
   * total climbing after a game nobody replayed, which reads exactly like
   * stats leaking between games because that is what it is.
   *
   * Refusing outright rather than trying to detect and subtract: a correct
   * re-finalize has to un-merge the previous contribution first, and a
   * half-right version of that would corrupt the season quietly instead of
   * loudly. An amended game needs that un-merge before it can be re-run.
   */
  if (game?.status === 'final') {
    throw new HttpsError(
      'failed-precondition',
      'This game is already final. Undo a play to amend it before finalizing again.',
    );
  }

  const eventsSnap = await db.collection(`teams/${teamId}/games/${gameId}/events`)
    .orderBy('seq').get();
  const events = eventsSnap.docs.map((d) => d.data()).filter((e) => !e.voided);

  const teamSnap = await db.doc(`teams/${teamId}`).get();
  const team = teamSnap.data();
  const rules = game.rulesSnapshot;

  /**
   * The team's sport, resolved server-side. team.sport is reliable for every
   * team regardless of when it was created — createTeam has always defaulted
   * it to 'baseball' — which is what makes this fix apply retroactively to
   * games already in progress, not just ones created after today's deploy.
   */
  const pack = serverPackFor(team.sport);

  const config = pack.buildGameConfig(game);
  const state = pack.reduce(events, rules, config);
  const stats = pack.computeStats(events, rules, config);

  const seasonKey = `${teamId}_${team.season}`;
  const batch = db.batch();

  const playerIds = new Set(pack.realPlayerIdsFromStats(stats));

  for (const playerId of playerIds) {
    // What actually gets merged and written is sport-specific — baseball
    // keeps batting/pitching/fielding as parallel maps, basketball keeps one
    // players map. Both concerns stay inside the dispatch, not this loop.
    const gameSlice = pack.sliceStatsForPlayer(stats, playerId);

    const seasonRef = db.doc(`players/${playerId}/seasons/${seasonKey}`);
    const seasonSnap = await seasonRef.get();
    const merged = pack.mergeStats(seasonSnap.data()?.raw || null, gameSlice);
    const mergedFields = pack.seasonFieldsFor(playerId, merged);

    batch.set(seasonRef, {
      teamId, orgId: team.orgId, season: team.season, division: team.division,
      // Recorded so recomputeCareers can group a player's seasons by sport
      // rather than merging a basketball season into a baseball career.
      sport: team.sport || 'baseball',
      raw: merged,
      ...mergedFields,
      gamesPlayed: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Pitching appearances live on the ROOT player, not the team. Rest-day
    // rules are per arm, and kids routinely pitch for a rec team and a travel
    // team in the same week — this is the only place that can see both.
    //
    // pitchCountFor returns undefined for a sport with no pitching concept,
    // so this whole block is skipped for basketball rather than reading a
    // field (state.pitchCounts) that doesn't exist on its engine state.
    const pitches = pack.pitchCountFor(state, playerId);
    if (pitches > 0 && pack.restDaysFor) {
      const restDays = pack.restDaysFor(pitches, rules);
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

/**
 * Career totals are a rollup of seasons, never incremented in place.
 *
 * Grouped by SPORT, not just by player, and that grouping matters. A season
 * document now carries the sport it was played under (see finalizeGame). A
 * two-sport athlete's baseball seasons and basketball seasons get merged
 * separately — mixing them through one sport's mergeStats would either
 * silently drop the foreign shape's fields or corrupt both.
 *
 * The document path stays players/{id}/career/totals, unchanged for the
 * client, but its shape is now { [sportKey]: { raw, ...fields, seasonCount },
 * updatedAt } instead of flat top-level fields. A player whose only sport is
 * baseball — everyone, before today — gets exactly one key populated.
 */
async function recomputeCareers(playerIds) {
  for (const playerId of playerIds) {
    const seasons = await db.collection(`players/${playerId}/seasons`).get();

    const bySport = {};
    for (const s of seasons.docs) {
      const data = s.data();
      const sportKey = data.sport || 'baseball';
      (bySport[sportKey] ||= []).push(data);
    }

    const career = {};
    for (const [sportKey, docs] of Object.entries(bySport)) {
      const pack = serverPackFor(sportKey);
      let raw = null;
      for (const d of docs) raw = raw ? pack.mergeStats(raw, d.raw) : d.raw;

      career[sportKey] = {
        raw,
        ...pack.seasonFieldsFor(playerId, raw),
        seasonCount: docs.length,
      };
    }

    await db.doc(`players/${playerId}/career/totals`).set({
      ...career,
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
  requestPlayerClaim, resolvePlayerClaim, assignGuardian,
  propagateDisplayName, propagatePlayerName,
} from './claims.js';
export {
  notifyTeamMessage, notifyDirectMessage, notifyGameStatus, notifyScoringPlay,
  sendTestNotification,
} from './notifications.js';
export {
  createPlayerInvites, createFanInvite, createTeamInvite,
  revokeInvite, previewInvite, redeemInvite, invitePipeline,
} from './invites.js';
