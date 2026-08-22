/**
 * teamGrouping.js — Organizing the team switcher by child.
 *
 * Once someone follows two kids, a flat list of team names is the wrong shape.
 * "Ridgeview Reds" and "Northgate Fury" don't say which child is which, but
 * "Jack" and "Maya" do — and a parent thinks in children, not clubs.
 *
 * Three rules fall out of that:
 *
 *   A team appears under EVERY child you're linked to there. Siblings on the
 *   same team is common, and picking one to hide would be arbitrary.
 *
 *   Teams where you have no linked child go in their own group at the end —
 *   you're the coach, not a parent. Labelled by role, so a scorekeeper isn't
 *   told they're coaching.
 *
 *   With one child and nothing else, grouping is noise. The caller can check
 *   `grouped.length === 1` and render a plain list instead.
 */

export const UNLINKED_KEY = '__unlinked__';

/**
 * @param teams   [{ id, name, season, division, ... }]
 * @param byTeam  { [teamId]: [{ playerId, firstName, ... }] } from useMyTeamPlayers
 * @param role    your role on each team, { [teamId]: 'owner' | 'coach' | ... }
 * @returns [{ key, label, sublabel, playerId, teams: [] }]
 */
export function groupTeamsByPlayer(teams, byTeam = {}, role = {}) {
  const groups = new Map();
  const unlinked = [];

  for (const team of teams || []) {
    const kids = byTeam[team.id] || [];

    if (!kids.length) { unlinked.push(team); continue; }

    for (const kid of kids) {
      const key = kid.playerId;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          playerId: kid.playerId,
          label: kid.firstName || 'Your player',
          sublabel: null,
          teams: [],
        });
      }
      groups.get(key).teams.push(team);
    }
  }

  // Alphabetical by child, so the order doesn't shuffle when a team is added.
  const out = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));

  if (unlinked.length) {
    // Named for what you actually do there. Someone keeping the book for a
    // team with no child of their own isn't "coaching" it.
    const staffish = unlinked.every((t) =>
      ['owner', 'coach'].includes(role[t.id]));
    out.push({
      key: UNLINKED_KEY,
      playerId: null,
      label: staffish ? 'Also coaching' : 'Other teams',
      sublabel: 'No player of yours linked here',
      teams: unlinked,
    });
  }

  return out;
}

/**
 * True when grouping adds nothing — one child, or one group of any kind.
 * A single heading above a single team is just a line of text in the way.
 */
export const groupingIsUseful = (grouped) =>
  grouped.length > 1 || (grouped[0]?.teams?.length || 0) > 1;
