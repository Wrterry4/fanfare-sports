/**
 * departures.js — Who else leaves when a player leaves.
 *
 * A kid who moved away and a kid who's out for the season look identical to
 * the app and completely different to their family: one should stop getting
 * Saturday's game alerts, the other is coming back in three weeks and would
 * lose the season's photos and stats for nothing. The app can't tell which,
 * so it asks — and this decides who the question is even ABOUT.
 *
 * Three rules, and the middle one is the one that matters:
 *
 *   Only people linked to the departing player. Everyone else on the team is
 *   unaffected by definition.
 *
 *   NOT a parent with another child still on the roster. Siblings on one team
 *   is ordinary, and removing a mother because her younger son left would cut
 *   her off from her daughter — the exact bug this function exists to prevent.
 *
 *   Never staff. An assistant coach whose own kid leaves is still the
 *   assistant coach, and a roster edit must not be able to remove a coach.
 */

const STAFF_ROLES = ['owner', 'coach'];

/**
 * @param members   [{ uid, role, displayName, linkedPlayerIds }] — the team
 * @param playerId  the player who just left
 * @returns [{ uid, name, role }] — safe to remove, in name order
 */
export function departingMembers(members, playerId) {
  if (!playerId) return [];

  return (members || [])
    .filter((m) => m?.uid)
    .filter((m) => !STAFF_ROLES.includes(m.role))
    .filter((m) => (m.linkedPlayerIds || []).includes(playerId))
    // The sibling case: anything else linked here keeps them on the team.
    .filter((m) => (m.linkedPlayerIds || []).filter((id) => id !== playerId).length === 0)
    .map((m) => ({
      uid: m.uid,
      name: m.displayName || 'A family member',
      role: m.role || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Everyone linked to this player, whether or not they'd be removed. */
export const linkedTo = (members, playerId) =>
  (members || []).filter((m) => (m?.linkedPlayerIds || []).includes(playerId));

/**
 * The sentence in the dialog.
 *
 * Names, not a count: "Remove 2 people?" is a question nobody can answer
 * without first working out who they are.
 */
export function departurePrompt(playerFirstName, departing) {
  const who = departing.map((d) => d.name);
  const list = who.length === 1 ? who[0]
    : who.length === 2 ? `${who[0]} and ${who[1]}`
    : `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`;

  return {
    title: who.length === 1 ? `Remove ${who[0]} too?` : 'Remove their family too?',
    message: `${list} ${who.length === 1 ? 'is' : 'are'} on this team only for `
      + `${playerFirstName || 'this player'}. Removing them stops the game alerts `
      + `and team chat. Keeping them leaves the season they played visible.`,
  };
}

/**
 * A parent kept because a sibling is still here — worth saying out loud, since
 * a coach who expected the family to go would otherwise assume it failed.
 */
export function keptForSiblings(members, playerId) {
  return (members || [])
    .filter((m) => !STAFF_ROLES.includes(m?.role))
    .filter((m) => (m?.linkedPlayerIds || []).includes(playerId))
    .filter((m) => (m.linkedPlayerIds || []).filter((id) => id !== playerId).length > 0)
    .map((m) => m.displayName || 'A family member');
}
