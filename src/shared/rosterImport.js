/**
 * rosterImport.js — Bringing last season's roster onto a new team.
 *
 * A coach who runs a spring team and a fall team usually has most of the same
 * kids. Typing fourteen names, numbers and positions in again is the single
 * longest piece of manual entry in the app, and it's entry they've already
 * done once.
 *
 * The decisions that matter here, and why:
 *
 *   Only teams you're STAFF on are offered. The roster of a team you follow as
 *   a parent is other people's children; copying it onto a team you coach is
 *   not a convenience, it's a data grab.
 *
 *   Everyone is checked by default, because "the same team, minus two" is the
 *   common case and unchecking two is less work than checking twelve. The one
 *   exception is a player already on this roster — they're listed so the coach
 *   can see they're accounted for, but importing them again would make a
 *   duplicate row, so they start unchecked.
 *
 *   A jersey number already worn on the destination team is dropped rather
 *   than imported. Two #12s break every scoreboard that identifies a player by
 *   number, and the coach is the only one who can say who changes.
 *
 * Import COPIES the player onto the new team; it does not move or merge the
 * player's identity. Putting one player record on two teams changes who can
 * read that child's record, which is a guardian's decision — that's what the
 * career-code transfer flow is for. See functions/index.js claimPlayer().
 */

const STAFF_ROLES = ['owner', 'coach'];

const clean = (s) => (s ?? '').toString().trim();

/** Names match on case and spacing, so "jack  miller" finds "Jack Miller". */
export const personKey = (p) =>
  `${clean(p?.firstName)} ${clean(p?.lastName)}`.toLowerCase().replace(/\s+/g, ' ').trim();

const millis = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime() || 0;
  if (typeof v.toMillis === 'function') return v.toMillis() || 0;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * The teams offered in the picker: every OTHER team you coach.
 *
 * @param teams        every team you're on, from useTeams()
 * @param roleByTeam   { [teamId]: role } from useMyTeamPlayers()
 * @param currentTeamId  the team being imported INTO, always excluded
 * @returns teams, newest first — last season is the one being copied
 */
export function importSourceTeams(teams, roleByTeam = {}, currentTeamId = null) {
  return (teams || [])
    .filter((t) => t?.id && t.id !== currentTeamId)
    .filter((t) => STAFF_ROLES.includes(roleByTeam[t.id]))
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt)
                 || clean(a.name).localeCompare(clean(b.name)));
}

/**
 * One row per player on the source team, annotated against the destination.
 *
 * @param sourceRoster  roster rows of the team being copied FROM
 * @param targetRoster  roster rows of the team being copied INTO
 * @returns [{ playerId, firstName, lastName, jerseyNumber, primaryPosition,
 *             alreadyOnRoster, jerseyTaken, selected }]
 */
export function buildImportRows(sourceRoster, targetRoster = []) {
  const onTarget = new Set((targetRoster || []).map(personKey).filter(Boolean));
  const takenNumbers = new Set(
    (targetRoster || [])
      .map((p) => p?.jerseyNumber)
      .filter((n) => n != null)
      .map(Number)
  );

  return (sourceRoster || [])
    .filter((p) => p?.playerId)
    .map((p) => {
      const jerseyNumber = p.jerseyNumber == null ? null : Number(p.jerseyNumber);
      const alreadyOnRoster = onTarget.has(personKey(p));
      return {
        playerId: p.playerId,
        firstName: clean(p.firstName),
        lastName: clean(p.lastName),
        jerseyNumber,
        primaryPosition: p.primaryPosition ?? null,
        alreadyOnRoster,
        jerseyTaken: jerseyNumber != null && takenNumbers.has(jerseyNumber),
        selected: !alreadyOnRoster,
      };
    })
    .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)
                 || a.firstName.localeCompare(b.firstName));
}

/** The ids checked when the list first opens. */
export const defaultSelection = (rows) =>
  (rows || []).filter((r) => r.selected).map((r) => r.playerId);

/**
 * What actually gets written, in list order.
 *
 * Numbers are resolved against the destination AND against the rest of this
 * import, so two imported players can't collide with each other either.
 */
export function importPayloads(rows, selectedIds) {
  const chosen = new Set(selectedIds || []);
  const used = new Set();

  return (rows || [])
    .filter((r) => chosen.has(r.playerId))
    .map((r) => {
      const free = r.jerseyNumber != null && !r.jerseyTaken && !used.has(r.jerseyNumber);
      if (free) used.add(r.jerseyNumber);
      return {
        firstName: r.firstName,
        lastName: r.lastName,
        jerseyNumber: free ? r.jerseyNumber : null,
        primaryPosition: r.primaryPosition ?? null,
      };
    })
    .filter((p) => p.firstName || p.lastName);
}

/** "3 players added · 1 number cleared" — plain enough to put in a toast. */
export function importSummary({ added = 0, failed = 0, numbersCleared = 0 } = {}) {
  const parts = [`${added} player${added === 1 ? '' : 's'} added`];
  if (numbersCleared) {
    parts.push(`${numbersCleared} number${numbersCleared === 1 ? '' : 's'} cleared`);
  }
  if (failed) parts.push(`${failed} couldn't be added`);
  return parts.join(' · ');
}
