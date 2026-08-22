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
      return { title: true, opponent: false, homeAway: false, location: true, field: true, notes: true };
    case EVENT_TYPES.MISC:
      return { title: true, opponent: false, homeAway: false, location: true, field: false, notes: true };
    default:
      return { title: false, opponent: true, homeAway: true, location: true, field: true, notes: true };
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

/**
 * Counts of PLAYERS, consistently.
 *
 * The old version mixed two populations: `players` excluded staff self-answers
 * but `yes`/`maybe`/`no` counted them, so a coach marking themselves Maybe
 * rendered "0 players in · 1 maybe" — two different denominators in one line.
 *
 * Every bucket here counts children only. Staff answers are tallied separately
 * under `staff`, because "am I bringing the equipment" and "do I have nine
 * kids" are different questions.
 */
export function tallyRsvps(rsvps) {
  const counts = {
    yes: 0, maybe: 0, no: 0,
    staff: { yes: 0, maybe: 0, no: 0 },
  };
  for (const r of rsvps || []) {
    const bucket = isSelfRsvp(r.id) ? counts.staff : counts;
    if (bucket[r.status] === undefined) continue;
    bucket[r.status] += 1;
  }
  // Kept as an alias: `players` was the only field the schedule read.
  counts.players = counts.yes;
  return counts;
}

/**
 * Every child on the roster with their answer, including the ones who haven't
 * given one.
 *
 * The silent group is the actionable one — a coach chasing attendance needs to
 * know who to text, and a list of only the people who already replied can't
 * tell them that.
 */
export function rosterAttendance(roster, rsvps) {
  const byId = Object.fromEntries((rsvps || []).map((r) => [r.id, r]));
  const groups = { [RSVP.YES]: [], [RSVP.MAYBE]: [], [RSVP.NO]: [], none: [] };

  for (const p of roster || []) {
    const answer = byId[p.playerId];
    const status = answer?.status;
    const entry = {
      playerId: p.playerId,
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Player',
      jerseyNumber: p.jerseyNumber ?? null,
      status: status || null,
    };
    (groups[status] || groups.none).push(entry);
  }

  // Staff answering for themselves aren't on the roster, so they'd otherwise
  // vanish from a list a coach is reading to see who's coming.
  const staff = (rsvps || [])
    .filter((r) => isSelfRsvp(r.id))
    .map((r) => ({
      playerId: null, uid: String(r.id).slice(2),
      name: r.name || 'Team staff', jerseyNumber: null, status: r.status,
    }));

  return { groups, staff };
}

/**
 * Where the game is.
 *
 * The field was called `park`, which only makes sense for baseball — a
 * basketball game is at a school or a rec centre. New writes use `location`;
 * this reads both so every game scheduled before the rename keeps its venue
 * instead of silently going blank.
 *
 * The old field is deliberately not migrated. A backfill would touch every
 * game document in every team to change a label, and reading two keys costs
 * nothing.
 */
export const venueOf = (game) => game?.location ?? game?.park ?? null;
