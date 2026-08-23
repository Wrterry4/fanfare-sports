/**
 * linking.js — Deep links and notification routing.
 *
 * Two problems here that are easy to get wrong and painful to discover later.
 *
 * 1. React Navigation's path parser DISCARDS the URL fragment. Our invite
 *    secret lives in the fragment specifically so it stays out of server logs
 *    and referrer headers — which means the standard `linking.config` route
 *    map cannot see it. The raw URL has to be intercepted first.
 *
 * 2. A parent tapping an invite link almost never has an account yet. The
 *    invite has to survive a detour through sign-up — including the app being
 *    killed mid-flow, which happens whenever someone leaves to check their
 *    email for a verification code. So it's persisted, not held in memory.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { parseInviteUrl } from '../shared/inviteRules.js';
// Platform-split: the web build gets a no-op module, so the native messaging
// SDK never enters the web bundle. A runtime Platform check would NOT be
// enough — Metro bundles static requires regardless of whether they execute.
import { initialNotificationData, subscribeNotificationOpened }
  from './notificationRouting';

const PENDING_KEY = '@pendingInvite';

// ---------------------------------------------------------------------------
// Pending invite
// ---------------------------------------------------------------------------

export async function stashPendingInvite(parsed) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({
    ...parsed,
    stashedAt: Date.now(),
  }));
}

/**
 * Read and clear. Stale entries are dropped — a link opened three weeks ago
 * and abandoned shouldn't fire the next time the app launches.
 */
export async function takePendingInvite(maxAgeMs = 7 * 86400000) {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(PENDING_KEY);
  try {
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.stashedAt ?? 0) > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const peekPendingInvite = async () => {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw ? JSON.parse(raw) : null;
};

// ---------------------------------------------------------------------------
// URL handling
// ---------------------------------------------------------------------------

/**
 * Returns the path React Navigation should route to, after pulling anything
 * fragment-shaped out of the URL first.
 */
async function interceptUrl(url) {
  if (!url) return null;

  const invite = parseInviteUrl(url);
  if (invite) {
    await stashPendingInvite(invite);
    // The token is deliberately NOT in the route params — it would end up in
    // navigation state, which gets serialized into crash reports and dev tools.
    return `/join/${invite.inviteId}`;
  }
  return url;
}

export const PREFIXES = [
  'fanfare://',
  'https://fanfaresports.app',
  'https://www.ridgeview.app',
];

export const linkingConfig = {
  prefixes: PREFIXES,

  async getInitialURL() {
    // A notification tap takes priority over a cold-start URL — if both are
    // present, the notification is the more recent intent.
    const data = await initialNotificationData();
    if (data) {
      const path = notificationToPath(data);
      if (path) return path;
    }
    return interceptUrl(await Linking.getInitialURL());
  },

  subscribe(listener) {
    const onUrl = async ({ url }) => {
      const next = await interceptUrl(url);
      if (next) listener(next);
    };
    const urlSub = Linking.addEventListener('url', onUrl);

    const unsubNotification = subscribeNotificationOpened((data) => {
      const path = notificationToPath(data);
      if (path) listener(path);
    });

    return () => {
      urlSub.remove();
      unsubNotification();
    };
  },

  config: {
    screens: {
      Join: 'join/:inviteId',
      JoinTeam: 'join-team',
      GameDay: 'teams/:teamId/games/:gameId',
      PlayerCard: 'teams/:teamId/players/:playerId',
      Transfer: 'transfers/:transferId',
      Messages: {
        path: 'teams/:teamId/messages',
        screens: { Conversation: 'c/:conversationId' },
      },
      NotFound: '*',
    },
  },
};

// ---------------------------------------------------------------------------
// Notifications → routes
// ---------------------------------------------------------------------------

/**
 * A tapped notification should land on the thing it was about. Dropping
 * someone on a generic home screen after "Jack is on deck" wastes the one
 * moment they were most engaged.
 */
export function notificationToPath(data = {}) {
  const { type, teamId, gameId, playerId, transferId, conversationId } = data;
  switch (type) {
    case 'atBat':
    case 'result':
      return gameId ? `/teams/${teamId}/games/${gameId}`
                    : `/teams/${teamId}/players/${playerId}`;
    case 'transfer':
      return `/transfers/${transferId}`;
    case 'directMessage':
      return `/teams/${teamId}/messages/c/${conversationId}`;
    case 'announcement':
    case 'chatter':
      return `/teams/${teamId}/messages`;
    case 'gameStart':
    case 'finalScore':
      return `/teams/${teamId}/games/${gameId}`;
    // An invite is answered in the account menu, and the menu isn't a route —
    // it's a sheet over whatever tab you're on. Returning null lets the app
    // open where it was; the badge on the hamburger is what carries it from
    // there. Routing to the team itself would be worse: you aren't a member
    // of it yet, which is the whole reason you were asked.
    case 'teamInvite':
      return null;
    default:
      return null;
  }
}

/**
 * Called once auth resolves. If a pending invite is waiting, redeem it and
 * hand back where to go — this is what closes the loop for a parent who
 * tapped a link, created an account, and came back.
 */
export async function resolvePendingInvite(redeemFn, buildDestination) {
  const pending = await takePendingInvite();
  if (!pending) return null;
  const result = await redeemFn(`x/join/${pending.inviteId}#${pending.token}`);
  return buildDestination(result);
}
