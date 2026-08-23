/**
 * teamInvites.js — Invitations addressed to a person, not to a link.
 *
 * The token invites in inviteRules.js answer "someone holds this URL, who are
 * they?". This is the other shape: the app already KNOWS who should be asked.
 * When a coach imports a returning player, that child's parents are existing
 * accounts with existing guardian links — texting them a fresh link to a kid
 * they're already attached to is asking them to re-prove something the
 * database already knows.
 *
 * So the invite is a document in the invitee's own subtree, they get a push,
 * and accepting is one tap. No token, nothing to forward, nothing to leak: an
 * invite that only exists under users/{uid} can only ever be redeemed by that
 * user, which is a stronger guarantee than a single-use link.
 *
 * Written and answered by Cloud Function only. Accepting writes a membership
 * document, and no client rule may do that on its own behalf.
 */

export const TEAM_INVITE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};

/**
 * Deterministic id: one invite per person per player per team, forever.
 *
 * A coach who imports, removes and re-imports the same player would otherwise
 * pile up three identical invites in a parent's menu. Re-inviting overwrites
 * the same document instead.
 */
export const teamInviteId = (teamId, playerId) => `${teamId}__${playerId || 'team'}`;

/** Pending only, newest first — the menu is a to-do list, not a history. */
export function pendingTeamInvites(invites) {
  return (invites || [])
    .filter((i) => i && (i.status ?? TEAM_INVITE_STATUS.PENDING) === TEAM_INVITE_STATUS.PENDING)
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}

const millis = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime() || 0;
  if (typeof v.toMillis === 'function') return v.toMillis() || 0;
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * The words, in one place.
 *
 * The push notification and the row in the menu say the same thing, because a
 * parent who taps the banner and then reads something different has to work
 * out whether they're looking at two events or one.
 */
export function inviteWording({ teamName, playerFirstName, season } = {}) {
  const team = teamName || 'a team';
  const who = playerFirstName ? `${playerFirstName} is` : "Your player is";
  return {
    title: 'Team invite',
    body: `${who} on ${team}${season ? ` for ${season}` : ''}. Tap to join.`,
    // The menu row has the team name beside it already, so it doesn't repeat it.
    rowTitle: team,
    rowSub: playerFirstName
      ? `${playerFirstName} was added to this team${season ? ` · ${season}` : ''}`
      : (season || 'You\'ve been invited to join'),
  };
}
