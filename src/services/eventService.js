/**
 * eventService.js — Schedule entries and RSVPs.
 */

import {
  db, doc, collection, setDoc, deleteDoc, getDoc, onSnapshot, serverTimestamp,
} from './firebase';
import { currentUid } from './authService.js';
import { EVENT_TYPES, rsvpIdForPlayer, rsvpIdForSelf } from '../shared/eventTypes.js';
import { gameId, eventId as eventSlug, uniqueId } from '../shared/docIds.js';

const eventsPath = (teamId) => collection(db, 'teams', teamId, 'games');

export async function createEvent(teamId, data, rules) {
  const type = data.type || EVENT_TYPES.GAME;

  /**
   * A readable id: `2026-08-22-vs-hurricanes`, not `k3Jd8sPqR2xN1vB7`.
   *
   * A schedule entry has one natural identity — a date and who it's against —
   * so it may as well say so in the console, in a rules test and in the URL
   * this game is shared with. Doubleheaders get `-2`; anything undatable or
   * unnameable falls back to the auto-id, because a wrong-looking id is worse
   * than an opaque one. See shared/docIds.js.
   */
  const derived = type === EVENT_TYPES.GAME
    ? gameId({ date: data.date, opponent: data.opponent, homeOrAway: data.homeOrAway })
    : eventSlug({ date: data.date, type, title: data.title });

  const free = await uniqueId(derived, async (id) =>
    (await getDoc(doc(db, 'teams', teamId, 'games', id)).catch(() => null))?.exists?.() === true);

  const ref = free
    ? doc(db, 'teams', teamId, 'games', free)
    : doc(eventsPath(teamId));

  await setDoc(ref, {
    type,
    title: data.title?.trim() || null,
    opponent: type === EVENT_TYPES.GAME ? (data.opponent?.trim() || null) : null,
    homeOrAway: type === EVENT_TYPES.GAME ? (data.homeOrAway || 'home') : null,
    date: data.date || serverTimestamp(),
    // Written as `location` now; venueOf() still reads the old `park` key on
    // documents created before the rename.
    location: (data.location ?? data.park)?.trim() || null,
    field: data.field?.trim() || null,
    notes: data.notes?.trim() || null,

    // Only a game carries scoring state. A practice with a rules snapshot and a
    // line score would just be noise in every query that touches it.
    ...(type === EVENT_TYPES.GAME ? {
      status: 'scheduled',
      rulesSnapshot: rules,
      score: { home: 0, away: 0 },
      currentInning: 1,
      isTopInning: true,
      outs: 0,
      lineup: [],
      startingPitcherId: null,
      scorekeeperUid: currentUid(),
      batonRequestedBy: null,
      eventCount: 0,
    } : { status: 'scheduled' }),

    createdBy: currentUid(),
    createdAt: serverTimestamp(),
  });

  return { eventId: ref.id };
}

export function updateEvent(teamId, eventId, patch) {
  return setDoc(doc(db, 'teams', teamId, 'games', eventId), patch, { merge: true });
}

export const deleteEvent = (teamId, eventId) =>
  deleteDoc(doc(db, 'teams', teamId, 'games', eventId));

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

export function subscribeRsvps(teamId, eventId, cb) {
  return onSnapshot(
    collection(db, 'teams', teamId, 'games', eventId, 'rsvps'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

/**
 * @param playerId  the child this answer is for, or null to answer for yourself
 */
export function setRsvp({ teamId, eventId, playerId, status, name }) {
  const uid = currentUid();
  const id = playerId ? rsvpIdForPlayer(playerId) : rsvpIdForSelf(uid);
  return setDoc(doc(db, 'teams', teamId, 'games', eventId, 'rsvps', id), {
    status,
    playerId: playerId || null,
    // Recorded so a coach can see who answered for a child, and so the rules
    // can check the writer is entitled to.
    setBy: uid,
    name: name || null,
    updatedAt: serverTimestamp(),
  });
}
