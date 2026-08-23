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
 *
 * ── The label is not the identity ──────────────────────────────────────────
 *
 * Groups are keyed by playerId, always — that id is what career stats
 * accumulate against and what a guardian link points at. The NAME is only how
 * a group is labelled, and two groups can legitimately share one: siblings
 * called J. on different teams, or two unrelated Jacks.
 *
 * So labels are disambiguated after the fact. Two Jacks become "Jack M." and
 * "Jack R.". Two groups with the same full name are something else entirely —
 * two player records for what is probably one child, which is a data problem
 * rather than a display one — so they're flagged rather than silently merged.
 * Merging them here would hide exactly the thing worth seeing.
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
          lastName: kid.lastName || '',
          sublabel: null,
          teams: [],
        });
      }
      groups.get(key).teams.push(team);
    }
  }

  // Alphabetical by child, so the order doesn't shuffle when a team is added.
  const out = disambiguate([...groups.values()]
    .sort((a, b) => a.label.localeCompare(b.label)));

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
 * Make every label tell two children apart, and say so when it can't.
 *
 * Runs on the sorted list so the result is stable: adding a second Jack
 * renames the first one too, which is correct — "Jack" stopped being enough
 * the moment there were two.
 */
function disambiguate(groups) {
  const byFirst = new Map();
  for (const g of groups) {
    if (!byFirst.has(g.label)) byFirst.set(g.label, []);
    byFirst.get(g.label).push(g);
  }

  for (const [first, sharing] of byFirst) {
    if (sharing.length < 2) continue;

    for (const g of sharing) {
      const initial = (g.lastName || '').trim().charAt(0).toUpperCase();
      if (initial) g.label = `${first} ${initial}.`;
    }

    // Same first AND last name: two player records, one child. Almost always
    // a player entered twice, or a roster copied instead of imported before
    // identity was preserved.
    const byFull = new Map();
    for (const g of sharing) {
      const full = `${first} ${(g.lastName || '').trim()}`.toLowerCase();
      if (!byFull.has(full)) byFull.set(full, []);
      byFull.get(full).push(g);
    }
    for (const dupes of byFull.values()) {
      if (dupes.length < 2) continue;
      for (const g of dupes) {
        g.duplicateName = true;
        g.sublabel = 'Two records for this name — see the note below';
      }
    }
  }

  return groups;
}

/** Groups that share a full name with another: one child, two player records. */
export const duplicateGroups = (grouped) =>
  (grouped || []).filter((g) => g.duplicateName);

/**
 * True when grouping adds nothing — one child, or one group of any kind.
 * A single heading above a single team is just a line of text in the way.
 */
export const groupingIsUseful = (grouped) =>
  grouped.length > 1 || (grouped[0]?.teams?.length || 0) > 1;
