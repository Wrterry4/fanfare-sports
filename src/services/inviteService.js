/**
 * inviteService.js — Client side of onboarding.
 *
 * Thin wrappers over the callables, plus the share-sheet plumbing that makes
 * "text fifteen parents" a single pass instead of fifteen trips back into the
 * app.
 */

import { httpsCallable } from './firebase';
import { functions } from './firebase';
import {
  parseInviteUrl, INVITE_ERROR_MESSAGES, ROLES, INVITE_TYPES,
} from '../shared/inviteRules.js';

const call = (name) => httpsCallable(functions, name);

// ---------------------------------------------------------------------------
// Coach side
// ---------------------------------------------------------------------------

export async function generatePlayerInvites(teamId, playerIds = null) {
  const res = await call('createPlayerInvites')({ teamId, playerIds });
  return res.data.invites;
}

export async function generateTeamInvite(teamId, role = ROLES.PARENT) {
  const res = await call('createTeamInvite')({ teamId, role });
  return res.data.url;
}

export async function generateFanInvite(teamId, playerId) {
  const res = await call('createFanInvite')({ teamId, playerId });
  return res.data.url;
}

export const revokeInvite = (inviteId) => call('revokeInvite')({ inviteId });

/** Who's joined, who's outstanding. The view that makes chasing parents tractable. */
export async function getInvitePipeline(teamId) {
  const res = await call('invitePipeline')({ teamId });
  return res.data;
}

/**
 * One message per family, pre-written. A coach copy-pasting the same sentence
 * fifteen times is where this stops getting done.
 */
export function composeInviteMessage(invite, teamName, coachName) {
  return `${invite.name} is on the ${teamName} roster. ` +
    `Tap to follow the games and get stats: ${invite.url}` +
    (coachName ? `\n\n— Coach ${coachName}` : '');
}

/**
 * Hand each message to the OS share sheet in turn. Sequential rather than
 * batched because the picker is modal — firing them in parallel would stack
 * fifteen sheets on top of each other.
 */
export async function shareInvitesSequentially(invites, teamName, coachName, Share) {
  const sent = [];
  for (const invite of invites) {
    if (invite.skipped) continue;
    try {
      const result = await Share.share({
        message: composeInviteMessage(invite, teamName, coachName),
      });
      if (result.action !== Share.dismissedAction) sent.push(invite.playerId);
    } catch {
      break; // The coach closed the sheet — stop rather than nag.
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Parent side
// ---------------------------------------------------------------------------

/**
 * Show the parent what they're joining BEFORE asking them to make an account.
 * Sign-up walls in front of unexplained value are where onboarding funnels die.
 * Works unauthenticated.
 */
export async function previewInvite(url) {
  const parsed = parseInviteUrl(url);
  if (!parsed) return { ok: false, message: INVITE_ERROR_MESSAGES.not_found };
  const res = await call('previewInvite')(parsed);
  return res.data;
}

export async function redeemInvite(url) {
  const parsed = parseInviteUrl(url);
  if (!parsed) return { ok: false, message: INVITE_ERROR_MESSAGES.not_found };
  const res = await call('redeemInvite')(parsed);
  return res.data;
}

/**
 * The line under the team name on the join screen. Says plainly what the person
 * is about to get, in their terms — not "role: parent".
 */
export function describeInvite(preview) {
  if (!preview?.ok) return '';
  const { role, type, playerFirstName, teamName, season } = preview;
  const team = season ? `${teamName} · ${season}` : teamName;

  if (type === INVITE_TYPES.PLAYER && playerFirstName) {
    return `You'll be added as ${playerFirstName}'s parent on ${team}. ` +
      `You'll get their stats, game alerts, and team messages.`;
  }
  if (type === INVITE_TYPES.FAN && playerFirstName) {
    return `You'll be able to follow ${playerFirstName} on ${team} — ` +
      `live games, alerts when they're up, and their stats.`;
  }
  if (role === ROLES.COACH)       return `You'll join ${team} as a coach.`;
  if (role === ROLES.SCOREKEEPER) return `You'll join ${team} and be able to keep the book.`;
  return `You'll join ${team}.`;
}

/**
 * Where to land after redeeming. A parent who just joined should see their kid,
 * not a generic dashboard — the first screen is the one that decides whether
 * they open the app again.
 */
export function postRedeemDestination(result) {
  if (!result?.ok) return { screen: 'JoinError', params: { message: result?.message } };
  if (result.alreadyMember) return { screen: 'GameDay', params: { teamId: result.teamId } };
  if (result.playerId) {
    return { screen: 'PlayerCard', params: { teamId: result.teamId, playerId: result.playerId,
             showNotificationSetup: true } };
  }
  return { screen: 'GameDay', params: { teamId: result.teamId } };
}
