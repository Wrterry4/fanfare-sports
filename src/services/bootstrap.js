/**
 * bootstrap.js — Team and player creation.
 *
 * On Blaze these are Cloud Functions: createTeam() and createPlayer() write
 * across several documents atomically and mint career codes with admin
 * credentials. On Spark, functions can't be deployed, so this module does the
 * same work client-side against the relaxed firestore.rules.dev.
 *
 * The flag decides which path runs. Flip EXPO_PUBLIC_SPARK_MODE to false after
 * upgrading and everything routes back through the functions with no other
 * change.
 *
 * ── What the client path gives up ───────────────────────────────────────────
 *
 *   Atomicity. A batch is close, but if a write fails midway you can end up
 *   with a team nobody owns. Recoverable in testing; not acceptable once real
 *   families depend on it.
 *
 *   Career codes. Minting one client-side would mean storing a hash the client
 *   could also read, defeating the point. In Spark mode players get a plain
 *   local id and no portable career code — so cross-team history doesn't work
 *   until you upgrade.
 *
 *   Invite redemption. redeemInvite() has to write to another user's member
 *   document, which no rule should ever permit from a client. Parent onboarding
 *   genuinely requires Blaze.
 * ────────────────────────────────────────────────────────────────────────────
 */

import {
  db, doc, collection, setDoc, getDoc, writeBatch, serverTimestamp, arrayUnion,
  httpsCallable, functions,
} from './firebase';
import { currentUid } from './authService.js';

export const SPARK_MODE = process.env.EXPO_PUBLIC_SPARK_MODE === 'true';

const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const joinCode = () =>
  Array.from({ length: 6 }, () =>
    JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)]).join('');

const DEFAULT_STAFF_PREFS = {
  gameStart: true, myPlayerAtBat: false, myPlayerResult: false,
  allScoringPlays: false, finalScore: true,
  announcements: true, chatter: true, directMessages: true,
};

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function createTeam({ name, season, division, ageGroup, sport = 'baseball', rules = {} }) {
  if (!SPARK_MODE) {
    const res = await httpsCallable(functions, 'createTeam')({
      name, season, division, ageGroup, sport, rules,
    });
    return res.data;
  }

  const uid = currentUid();
  if (!uid) throw new Error('Sign in first.');

  const teamRef = doc(collection(db, 'teams'));

  // NOT batched with the rest, deliberately.
  //
  // The dev rule for creating a member document does
  //   get(/teams/$(teamId)).data.createdBy == uid()
  // and rule get() calls see the state BEFORE the current write. Inside a
  // single batch the team document doesn't exist yet, so that lookup fails and
  // the whole batch is rejected. Same problem for the channels, which require
  // isStaff() — which requires the member document.
  //
  // Three sequential writes, each visible to the next.
  await setDoc(teamRef, {
    orgId: null,               // orgs are function-managed; skipped in Spark mode
    name: name.trim(),
    season: season.trim(),
    division: division || null,
    ageGroup: ageGroup ?? null,
    sport,
    rules,
    joinCode: joinCode(),
    activeGameId: null,
    archived: false,
    createdBy: uid,            // the rule checks this
    createdAt: serverTimestamp(),
  });

  // Name denormalized so member lists and chat can show it without reading
  // other people's user documents.
  const me = await getDoc(doc(db, 'users', uid)).catch(() => null);

  await setDoc(doc(db, 'teams', teamRef.id, 'members', uid), {
    role: 'owner',
    displayName: me?.data()?.displayName || null,
    linkedPlayerIds: [],
    notificationPrefs: DEFAULT_STAFF_PREFS,
    invitedBy: null,
    joinedAt: serverTimestamp(),
  });

  // Now that membership exists, the remaining writes pass their rule checks
  // and can go in one batch.
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), { teamIds: arrayUnion(teamRef.id) }, { merge: true });
  batch.set(doc(db, 'teams', teamRef.id, 'channels', 'announcements'),
    { name: 'Announcements', staffOnly: true, order: 0 });
  batch.set(doc(db, 'teams', teamRef.id, 'channels', 'chatter'),
    { name: 'Team Chatter', staffOnly: false, order: 1 });
  await batch.commit();

  return { teamId: teamRef.id };
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function createPlayer({ teamId, firstName, lastName, birthYear, jerseyNumber, primaryPosition }) {
  if (!SPARK_MODE) {
    const res = await httpsCallable(functions, 'createPlayer')({
      teamId, firstName, lastName, birthYear, jerseyNumber,
    });
    return res.data;
  }

  const uid = currentUid();
  const playerRef = doc(collection(db, 'players'));

  await setDoc(playerRef, {
    firstName: firstName.trim(),
    lastName: (lastName || '').trim(),
    birthYear: birthYear ?? null,
    guardianUserIds: [],
    // Required by the dev rule, and by canSeePlayer() so the creator can read
    // back what they just wrote.
    authorizedUserIds: [uid],
    rosteredTeamIds: [teamId],
    mediaConsent: false,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'teams', teamId, 'roster', playerRef.id), {
    // Denormalized so any team member can render a scoreboard. The protected
    // material — birth year, guardians, stats — stays on /players.
    firstName: firstName.trim(),
    lastName: (lastName || '').trim(),
    jerseyNumber: jerseyNumber ?? null,
    primaryPosition: primaryPosition || null,
    active: true,
    addedAt: serverTimestamp(),
  });
  // No career code in Spark mode — see the header note.
  return { playerId: playerRef.id, careerCode: null };
}

/** Bulk add, for typing in a roster in one sitting. */
export async function createPlayers(teamId, players) {
  const created = [];
  for (const p of players) {
    created.push(await createPlayer({ teamId, ...p }));
  }
  return created;
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

/**
 * @deprecated Superseded by createEvent() in eventService.js, which handles
 * practices and team events too. Kept because SetupScreen creates the first
 * game during onboarding and that path is worth leaving undisturbed.
 */
export async function createGame({ teamId, opponent, date, homeOrAway, rules, lineup = [] }) {
  const uid = currentUid();
  const gameRef = doc(collection(db, 'teams', teamId, 'games'));

  await setDoc(gameRef, {
    type: 'game',
    opponent: opponent.trim(),
    date: date || serverTimestamp(),
    homeOrAway,
    // Never 'live' on creation. A game becomes live only when someone taps
    // Start, on Schedule or on Game Day — otherwise adding next month's
    // schedule would put six games in progress at once.
    status: 'scheduled',
    // Frozen at creation: a rule amended mid-season must not rescore old games.
    rulesSnapshot: rules,
    score: { home: 0, away: 0 },
    currentInning: 1,
    isTopInning: true,
    outs: 0,
    lineup,
    startingPitcherId: null,
    scorekeeperUid: uid,
    batonRequestedBy: null,
    eventCount: 0,
    createdAt: serverTimestamp(),
  });

  return { gameId: gameRef.id };
}
