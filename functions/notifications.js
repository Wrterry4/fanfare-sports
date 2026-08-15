/**
 * functions/notifications.js — Push.
 *
 * Everything routes through sendToUsers() so token pruning and preference
 * checks happen in exactly one place.
 *
 * Who gets what:
 *
 *   team chat        every member who hasn't muted it, minus fans (they're
 *                    excluded from chat entirely) and the sender
 *   direct message   the other participant, and nobody else
 *   game start/end   every member linked to the team
 *   hits and RBIs    only the people linked to THAT player — their parents
 *                    and their grandparents
 *
 * The last one is the reason this feature exists. A grandparent five hundred
 * miles away getting "Jack doubled, 2 RBI" is what makes them install
 * anything.
 */

import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

import { reduce } from './shared/baseball/engine.js';
import { EV, HITS } from './shared/baseball/events.js';
import { buildGameConfig } from './shared/baseball/config.js';

const db = getFirestore();

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * @param uids      recipients (already filtered by preference)
 * @param payload   { title, body, data }
 */
async function sendToUsers(uids, { title, body, data = {} }) {
  const unique = [...new Set(uids)].filter(Boolean);
  if (!unique.length) return;

  const tokenOwners = [];   // [uid, token]
  for (const uid of unique) {
    const snap = await db.doc(`users/${uid}`).get();
    const tokens = snap.data()?.pushTokens || {};
    for (const [deviceId, t] of Object.entries(tokens)) {
      if (t?.token) tokenOwners.push({ uid, deviceId, token: t.token });
    }
  }
  if (!tokenOwners.length) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens: tokenOwners.map((t) => t.token),
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    apns: { payload: { aps: { sound: 'default' } } },
    android: { priority: 'high' },
    webpush: {
      notification: { icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' },
      fcmOptions: { link: data.link || '/' },
    },
  });

  // Tokens go stale on every reinstall and browser data clear. Left alone they
  // accumulate until most of a send is failures.
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (code.includes('registration-token-not-registered')
     || code.includes('invalid-registration-token')
     || code.includes('invalid-argument')) dead.push(tokenOwners[i]);
  });
  for (const d of dead) {
    await db.doc(`users/${d.uid}`)
      .update({ [`pushTokens.${d.deviceId}`]: FieldValue.delete() })
      .catch(() => {});
  }
}

/** Members of a team who have `prefKey` switched on. */
async function membersWanting(teamId, prefKey, { excludeUid, excludeFans = false } = {}) {
  const snap = await db.collection(`teams/${teamId}/members`).get();
  return snap.docs
    .filter((d) => d.id !== excludeUid)
    .filter((d) => !(excludeFans && d.data().role === 'fan'))
    // Absent preference means on for the defaults we ship; an explicit false
    // is a deliberate mute.
    .filter((d) => d.data().notificationPrefs?.[prefKey] !== false)
    .map((d) => d.id);
}

/** Everyone linked to a specific player, with `prefKey` on. */
async function followersOfPlayer(teamId, playerId, prefKey) {
  const snap = await db.collection(`teams/${teamId}/members`)
    .where('linkedPlayerIds', 'array-contains', playerId).get();
  return snap.docs
    .filter((d) => d.data().notificationPrefs?.[prefKey] !== false)
    .map((d) => d.id);
}

const teamName = async (teamId) =>
  (await db.doc(`teams/${teamId}`).get()).data()?.name || 'Your team';

// ---------------------------------------------------------------------------
// Test send
// ---------------------------------------------------------------------------

/**
 * Pushes to the caller's own devices and reports what it found.
 *
 * Delivery has four independent moving parts — VAPID key, service worker,
 * token storage, and the fan-out here. When nothing arrives, silence doesn't
 * say which one broke. This does.
 */
export const sendTestNotification = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const snap = await db.doc(`users/${uid}`).get();
  const tokens = snap.data()?.pushTokens || {};
  const count = Object.keys(tokens).length;

  if (!count) {
    throw new HttpsError('failed-precondition',
      'No device is registered for notifications on this account. Tap "Turn on notifications" first — if you already did, it did not complete.');
  }

  await sendToUsers([uid], {
    title: 'Fanfare test',
    body: 'Notifications are working on this device.',
    data: { type: 'test', link: '/' },
  });

  // The token may still be dead; sendToUsers prunes those as it goes.
  const after = (await db.doc(`users/${uid}`).get()).data()?.pushTokens || {};
  const remaining = Object.keys(after).length;
  if (!remaining) {
    throw new HttpsError('failed-precondition',
      'The device token was rejected and has been cleared. Turn notifications on again.');
  }
  return { ok: true, devices: remaining };
});

// ---------------------------------------------------------------------------
// Team chat
// ---------------------------------------------------------------------------

export const notifyTeamMessage = onDocumentCreated(
  'teams/{teamId}/channels/{channelId}/messages/{messageId}',
  async (event) => {
    const msg = event.data?.data();
    if (!msg || msg.deleted) return;
    const { teamId, channelId } = event.params;

    const prefKey = channelId === 'announcements' ? 'announcements' : 'chatter';
    // Fans are excluded from chat by the security rules, so notifying them
    // would open something they can't read.
    const uids = await membersWanting(teamId, prefKey,
      { excludeUid: msg.senderId, excludeFans: true });

    await sendToUsers(uids, {
      title: channelId === 'announcements'
        ? `${await teamName(teamId)} · Announcement`
        : msg.senderName || 'Team chat',
      body: msg.text?.slice(0, 140) || '',
      data: { type: channelId === 'announcements' ? 'announcement' : 'chatter',
              teamId, link: `/teams/${teamId}/messages` },
    });
  }
);

// ---------------------------------------------------------------------------
// Direct messages
// ---------------------------------------------------------------------------

export const notifyDirectMessage = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const msg = event.data?.data();
    if (!msg || msg.deleted) return;
    const { conversationId } = event.params;

    const convo = (await db.doc(`conversations/${conversationId}`).get()).data();
    if (!convo) return;

    // Only the other participant. Never the wider team.
    const others = (convo.participantUids || []).filter((u) => u !== msg.senderId);
    const wanting = [];
    for (const uid of others) {
      const m = await db.doc(`teams/${convo.teamId}/members/${uid}`).get();
      if (m.data()?.notificationPrefs?.directMessages !== false) wanting.push(uid);
    }

    await sendToUsers(wanting, {
      title: msg.senderName || 'New message',
      body: msg.text?.slice(0, 140) || '',
      data: { type: 'directMessage', teamId: convo.teamId, conversationId,
              link: `/teams/${convo.teamId}/messages` },
    });
  }
);

// ---------------------------------------------------------------------------
// Game start and end
// ---------------------------------------------------------------------------

export const notifyGameStatus = onDocumentWritten(
  'teams/{teamId}/games/{gameId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after || before?.status === after.status) return;

    // Practices and team events share this collection but are never started or
    // ended, so there's nothing to announce.
    if ((after.type || 'game') !== 'game') return;

    const { teamId, gameId } = event.params;
    const name = await teamName(teamId);
    const vs = `${after.homeOrAway === 'home' ? 'vs' : '@'} ${after.opponent}`;

    if (after.status === 'live') {
      const uids = await membersWanting(teamId, 'gameStart');
      await sendToUsers(uids, {
        title: `${name} ${vs}`,
        body: 'First pitch — follow along live.',
        data: { type: 'gameStart', teamId, gameId, link: `/teams/${teamId}/games/${gameId}` },
      });
      return;
    }

    if (after.status === 'final') {
      const ours = after.homeOrAway === 'home' ? after.score?.home : after.score?.away;
      const theirs = after.homeOrAway === 'home' ? after.score?.away : after.score?.home;
      const verdict = ours > theirs ? 'Win' : ours < theirs ? 'Loss' : 'Tie';
      const uids = await membersWanting(teamId, 'finalScore');
      await sendToUsers(uids, {
        title: `${name} ${vs} — Final`,
        body: `${verdict} ${ours ?? 0}–${theirs ?? 0}`,
        data: { type: 'finalScore', teamId, gameId, link: `/teams/${teamId}/games/${gameId}` },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Hits, RBIs, and coming to the plate
// ---------------------------------------------------------------------------

const HIT_WORD = {
  [EV.SINGLE]: 'singled',
  [EV.DOUBLE]: 'doubled',
  [EV.TRIPLE]: 'tripled',
  [EV.HOME_RUN]: 'homered',
};

const NOTIFIABLE = new Set([
  ...HITS, EV.WALK, EV.SAC_FLY, EV.BATTER_UP,
]);

export const notifyScoringPlay = onDocumentCreated(
  'teams/{teamId}/games/{gameId}/events/{eventId}',
  async (event) => {
    const created = event.data?.data();
    if (!created || !NOTIFIABLE.has(created.type)) return;

    const { teamId, gameId } = event.params;

    /**
     * The event document records the type but not who batted — the scorekeeper
     * taps "Single" and the engine derives the batter from game state. So the
     * log is replayed here with the same engine the app uses, which gives both
     * the batter and the exact RBI count.
     *
     * Only hits and walks get this far, so it runs about eighty times a game
     * rather than on every pitch.
     */
    const gameSnap = await db.doc(`teams/${teamId}/games/${gameId}`).get();
    const game = gameSnap.data();
    if (!game) return;

    const evSnap = await db.collection(`teams/${teamId}/games/${gameId}/events`)
      .orderBy('seq').get();
    // Bound to this event: a later one may already have been written.
    const events = evSnap.docs.map((d) => d.data())
      .filter((e) => !e.voided && e.seq <= created.seq);

    const state = reduce(events, game.rulesSnapshot || {}, buildGameConfig(game));
    const playerId = state._batterId;
    if (!playerId || String(playerId).startsWith('opp_')) return;

    const playerSnap = await db.doc(`players/${playerId}`).get();
    const first = playerSnap.data()?.firstName || 'Your player';

    if (created.type === EV.BATTER_UP) {
      const uids = await followersOfPlayer(teamId, playerId, 'myPlayerAtBat');
      await sendToUsers(uids, {
        title: `${first} is up`,
        body: 'At the plate now.',
        data: { type: 'atBat', teamId, gameId, playerId,
                link: `/teams/${teamId}/games/${gameId}` },
      });
      return;
    }

    const rbi = state._rbi || 0;
    const word = HIT_WORD[created.type]
      || (created.type === EV.WALK ? 'walked' : 'hit a sacrifice fly');

    let body = `${first} ${word}`;
    if (rbi > 0) body += ` — ${rbi} RBI`;

    const uids = await followersOfPlayer(teamId, playerId, 'myPlayerResult');
    await sendToUsers(uids, {
      title: `${await teamName(teamId)} ${game.homeOrAway === 'home' ? 'vs' : '@'} ${game.opponent}`,
      body,
      data: { type: 'result', teamId, gameId, playerId,
              link: `/teams/${teamId}/games/${gameId}` },
    });
  }
);
