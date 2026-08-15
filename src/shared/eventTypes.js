/**
 * eventTypes.js — Games, practices, and everything else.
 *
 * These live in the same `games` collection they always have. A new collection
 * would have meant migrating every existing document, splitting the schedule
 * query in two, and teaching Game Day to look in two places — all to store
 * what is really one thing: something on the calendar.
 *
 * A document with no `type` is a game, which is what every existing row is.
 */

export const EVENT_TYPES = {
  GAME: 'game',
  PRACTICE: 'practice',
  MISC: 'misc',
};

export const EVENT_ORDER = [
  [EVENT_TYPES.GAME, 'Game'],
  [EVENT_TYPES.PRACTICE, 'Practice'],
  [EVENT_TYPES.MISC, 'Event'],
];

export const typeOf = (e) => e?.type || EVENT_TYPES.GAME;
export const isGame = (e) => typeOf(e) === EVENT_TYPES.GAME;

/** Only games are scored, so only games have a lineup or a Game Day view. */
export const isScorable = isGame;

/** What each type shows on a schedule row. */
export function eventTitle(e, teamName) {
  switch (typeOf(e)) {
    case EVENT_TYPES.PRACTICE:
      return e.title?.trim() || 'Practice';
    case EVENT_TYPES.MISC:
      return e.title?.trim() || 'Team event';
    default:
      return `${e.homeOrAway === 'home' ? 'vs' : '@'} ${e.opponent || 'TBD'}`;
  }
}

/** Which fields the add/edit form should show. */
export function fieldsFor(type) {
  switch (type) {
    case EVENT_TYPES.PRACTICE:
      return { title: true, opponent: false, homeAway: false, park: true, field: true, notes: true };
    case EVENT_TYPES.MISC:
      return { title: true, opponent: false, homeAway: false, park: true, field: false, notes: true };
    default:
      return { title: false, opponent: true, homeAway: true, park: true, field: true, notes: true };
  }
}

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

export const RSVP = { YES: 'yes', MAYBE: 'maybe', NO: 'no' };

export const RSVP_OPTIONS = [
  [RSVP.YES, 'Attending'],
  [RSVP.MAYBE, 'Maybe'],
  [RSVP.NO, "Can't make it"],
];

export const RSVP_SHORT = {
  [RSVP.YES]: 'In',
  [RSVP.MAYBE]: 'Maybe',
  [RSVP.NO]: 'Out',
};

/**
 * RSVPs are keyed by PLAYER, not by person.
 *
 * A coach asking "how many do I have Saturday?" needs a count of kids. A parent
 * with two on the roster answers twice; a coach answers for themselves, under
 * a `u_` prefixed id so the two can't collide.
 */
export const rsvpIdForPlayer = (playerId) => playerId;
export const rsvpIdForSelf = (uid) => `u_${uid}`;
export const isSelfRsvp = (id) => String(id).startsWith('u_');

export function tallyRsvps(rsvps) {
  const counts = { yes: 0, maybe: 0, no: 0, players: 0 };
  for (const r of rsvps) {
    if (!counts[r.status] && counts[r.status] !== 0) continue;
    counts[r.status] += 1;
    if (!isSelfRsvp(r.id)) counts.players += r.status === RSVP.YES ? 1 : 0;
  }
  return counts;
}
