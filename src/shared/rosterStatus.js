/**
 * rosterStatus.js — On the team, or no longer on it.
 *
 * Taking a player off the roster used to delete the roster entry. That's the
 * wrong shape for what actually happens: kids leave mid-season, and the games
 * they played are still part of the record. A deleted entry takes the name
 * with it, so every box score they appear in falls back to a raw document id —
 * the roster entry is the only place their name is readable by the whole team.
 *
 * So leaving is a STATE, not a deletion. `active: false` keeps the name and
 * the history, and takes them out of every list that means "who's on this team
 * now": lineups, attendance, the picker on Game Day.
 *
 * The player record itself is untouched either way. It never belonged to the
 * team — that's what makes career stats work.
 */

/** Absent `active` means yes: every roster entry written before this existed. */
export const isOnTeam = (row) => !!row && row.active !== false;

export const hasLeft = (row) => !!row && row.active === false;

/** Jersey order for the current squad; alphabetical for those who've left. */
export function splitRoster(rows) {
  const all = (rows || []).filter(Boolean);
  return {
    active: all.filter(isOnTeam)
      .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)),
    // Numbers get reassigned the moment someone leaves, so ordering former
    // players by one would shuffle them around whoever inherits it.
    left: all.filter(hasLeft)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
  };
}

/** What the roster row says under the name once someone is gone. */
export const leftLabel = (row) => {
  const when = row?.leftAt?.toDate?.() ?? (row?.leftAt ? new Date(row.leftAt) : null);
  if (!when || isNaN(when)) return 'Left the team';
  return `Left the team · ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};
