/**
 * inviteRules.js — Invite validation, as a pure function.
 *
 * Shared by the client (to render a useful error before a round-trip) and by
 * the redeem function (which is the one that actually decides). Same module
 * both places, so the message a parent sees can't disagree with the reason
 * they were turned away.
 */

/**
 * Three roles a person can be invited as, plus owner.
 *
 * SCOREKEEPER was removed. Who keeps the book changes game to game — a parent
 * takes it when the coach is coaching third base — and that's already modelled
 * properly as `scorekeeperUid` on the game document, handed around with the
 * baton. Freezing it as a membership role meant a season-long label for a
 * job that lasts two hours, and a coach having to re-invite someone to change
 * it.
 *
 * Anyone at coach or parent level can score; the baton decides who is doing it
 * right now.
 */
export const ROLES = {
  OWNER: 'owner',
  COACH: 'coach',
  PARENT: 'parent',
  FAN: 'fan',
};

/**
 * Members created before the role was removed still carry it. Mapped to parent
 * rather than dropped: a scorekeeper could score and use team chat, which is
 * exactly what a parent can do, so nobody silently loses access.
 */
export const LEGACY_ROLES = { scorekeeper: ROLES.PARENT };

export const normalizeRole = (role) => LEGACY_ROLES[role] || role;

/**
 * A grandparent is not a guardian. She needs the on-deck alert and her
 * grandson's line, and she must not be able to approve a roster transfer or
 * consent to media on someone else's behalf. That's what `fan` is for.
 */
export const ROLE_CAPABILITIES = {
  [ROLES.OWNER]:       { score: true,  manageRoster: true,  approveTransfers: false, teamChat: true,  seeAllPlayers: true  },
  [ROLES.COACH]:       { score: true,  manageRoster: true,  approveTransfers: false, teamChat: true,  seeAllPlayers: true  },
  // Parents can score. Whoever holds the baton is the scorekeeper today.
  [ROLES.PARENT]:      { score: true,  manageRoster: false, approveTransfers: true,  teamChat: true,  seeAllPlayers: false },
  [ROLES.FAN]:         { score: false, manageRoster: false, approveTransfers: false, teamChat: false, seeAllPlayers: false },
};

export const INVITE_TYPES = {
  PLAYER: 'player',  // links the redeemer to one specific kid as a guardian
  FAN: 'fan',        // a guardian inviting family to follow their own kid
  TEAM: 'team',      // general: assistant coach, team parent
};

export const INVITE_ERRORS = {
  NOT_FOUND: 'not_found',
  BAD_TOKEN: 'bad_token',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  EXHAUSTED: 'exhausted',
  ALREADY_MEMBER: 'already_member',
};

/** Copy the parent actually sees. Errors explain what to do, not what broke. */
export const INVITE_ERROR_MESSAGES = {
  [INVITE_ERRORS.NOT_FOUND]: 'This invite link isn\'t valid. Ask your coach to send a new one.',
  [INVITE_ERRORS.BAD_TOKEN]: 'This invite link isn\'t valid. Ask your coach to send a new one.',
  [INVITE_ERRORS.EXPIRED]: 'This invite has expired. Ask your coach to send a new one.',
  [INVITE_ERRORS.REVOKED]: 'This invite was cancelled. Ask your coach to send a new one.',
  [INVITE_ERRORS.EXHAUSTED]: 'This invite has already been used. Ask your coach to send a new one.',
  [INVITE_ERRORS.ALREADY_MEMBER]: 'You\'re already on this team.',
};

/**
 * @param invite     the stored invite document (or null)
 * @param tokenHash  hash of the secret from the link
 * @param now        ms timestamp
 * @param existingMemberRole  role the redeemer already holds on this team, if any
 * @returns { ok: true } | { ok: false, error }
 */
export function validateInvite(invite, tokenHash, now = Date.now(), existingMemberRole = null) {
  if (!invite) return { ok: false, error: INVITE_ERRORS.NOT_FOUND };

  // Compared before anything else that could distinguish a real invite id
  // from a fake one by timing or by error message.
  if (invite.tokenHash !== tokenHash) return { ok: false, error: INVITE_ERRORS.BAD_TOKEN };

  if (invite.revoked) return { ok: false, error: INVITE_ERRORS.REVOKED };

  const expires = typeof invite.expiresAt === 'number'
    ? invite.expiresAt
    : invite.expiresAt?.toMillis?.() ?? null;
  if (expires != null && now > expires) return { ok: false, error: INVITE_ERRORS.EXPIRED };

  const max = invite.maxUses ?? 1;
  if ((invite.usedCount ?? 0) >= max) return { ok: false, error: INVITE_ERRORS.EXHAUSTED };

  // Re-tapping a link you already used shouldn't look like a failure, but it
  // also shouldn't burn a second use.
  if (existingMemberRole && existingMemberRole === invite.role) {
    return { ok: false, error: INVITE_ERRORS.ALREADY_MEMBER };
  }

  return { ok: true };
}

/**
 * Role precedence when someone redeems an invite for a team they're already on.
 * A coach who also has a kid on the team stays a coach — the higher capability
 * wins, and the player link is added regardless of role.
 */
const PRECEDENCE = [ROLES.FAN, ROLES.PARENT, ROLES.COACH, ROLES.OWNER];

export function resolveRole(existingRole, invitedRole) {
  if (!existingRole) return invitedRole;
  const a = PRECEDENCE.indexOf(existingRole);
  const b = PRECEDENCE.indexOf(invitedRole);
  return b > a ? invitedRole : existingRole;
}

/** Conservative by default. Notification fatigue kills this feature by week two. */
export function defaultNotificationPrefs(role) {
  const base = {
    gameStart: false,
    myPlayerAtBat: false,
    myPlayerResult: false,
    allScoringPlays: false,
    finalScore: true,
    announcements: true,
    chatter: false,
    directMessages: true,
  };
  if (role === ROLES.PARENT || role === ROLES.FAN) {
    return { ...base, gameStart: true, myPlayerAtBat: true, myPlayerResult: true,
             chatter: role === ROLES.PARENT, directMessages: role === ROLES.PARENT };
  }
  if (role === ROLES.OWNER || role === ROLES.COACH) {
    return { ...base, gameStart: true, chatter: true };
  }
  return base;
}

/**
 * Deep link shape: the secret rides in the URL fragment so it never reaches a
 * server access log, a referrer header, or an analytics pageview.
 */
export function buildInviteUrl(baseUrl, inviteId, token) {
  return `${baseUrl.replace(/\/$/, '')}/join/${inviteId}#${token}`;
}

export function parseInviteUrl(url) {
  const m = String(url).match(/\/join\/([A-Za-z0-9_-]+)#(.+)$/);
  return m ? { inviteId: m[1], token: m[2] } : null;
}
