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
import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Sport dispatch, not a baseball import. This function used to pull in the
// baseball engine and hard-code "singled"/"doubled"/RBI wording, which made a
// Cloud Function a baseball function — a second sport would have meant a
// switch here growing a branch forever.
import { notifyPackFor } from './shared/sportNotify.js';
import { db } from './firebase-init.js';


// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * @param uids      recipients (already filtered by preference)
 * @param payload   { title, body, data }
 */
export async function sendToUsers(uids, { title, body, data = {} }) {
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

  /**
   * ── Why web gets a DATA-ONLY message ────────────────────────────────────
   *
   * This used to send a top-level `notification` block to every platform. On
   * web that block is displayed AUTOMATICALLY by the browser — and it also
   * wakes onBackgroundMessage in the service worker, which called
   * showNotification itself. Two banners for one event, every time.
   *
   * Data-only leaves the service worker as the single thing that displays,
   * and carries title and body in `data` so it still has something to show.
   * Native keeps the notification block, which is what iOS and Android need
   * to display while the app is backgrounded.
   *
   * The `channel` field is what lets the client tell a background push from a
   * foreground in-app message: the SW shows an OS banner, the foreground
   * handler shows a toast instead. Nobody wants a system notification for a
   * game they're actively watching.
   */
  const stringData = Object.fromEntries(
    Object.entries({ ...data, title, body, channel: 'push' })
      .map(([k, v]) => [k, String(v)])
  );

  const res = await getMessaging().sendEachForMulticast({
    tokens: tokenOwners.map((t) => t.token),
    data: stringData,
    apns: {
      payload: { aps: { sound: 'default', alert: { title, body } } },
    },
    android: {
      priority: 'high',
      notification: { title, body },
    },
    webpush: {
      // Deliberately no `notification` key — see above.
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

/**
 * One read, both facts. notifyScoringPlay and notifyGameStatus need the
 * team's sport as well as its name — using team.sport rather than
 * game.sport is what makes the sport-accurate wording apply to every game
 * already in progress, not just ones created after this shipped, since
 * team.sport has been set at creation time all along and game.sport never
 * was.
 */
const teamMeta = async (teamId) => {
  const data = (await db.doc(`teams/${teamId}`).get()).data();
  return { name: data?.name || 'Your team', sport: data?.sport || 'baseball' };
};

const teamName = async (teamId) => (await teamMeta(teamId)).name;

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

/** What a message looks like in a notification banner. */
function previewOf(msg) {
  const text = (msg.text || '').slice(0, 140);
  if (msg.kind === 'poll') return `📊 Poll · ${msg.poll?.question || text}`;
  if (msg.kind === 'photo') return '📷 Sent a photo';
  return text;
}

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

    /**
     * Team chat and a direct message used to look identical — both just
     * showed the sender's name as the title, with no way to tell from the
     * notification itself whether "Jessica" meant a private message or one
     * posted to the whole team. Worse for a person on more than one team:
     * nothing said WHICH team's Jessica.
     *
     * Team name leads because "where" is the thing a glance needs first;
     * the sender goes in the body, which is the shape group-chat
     * notifications everyone already recognizes.
     */
    const teamLabel = await teamName(teamId);
    await sendToUsers(uids, {
      title: channelId === 'announcements'
        ? `${teamLabel} · Announcement`
        : `${teamLabel} · Team Chat`,
      // A poll and a photo carry `text` so nothing renders blank, but the
      // banner should say which one arrived — "Coach: Who can make Saturday?"
      // reads as a question somebody expects a typed answer to.
      body: `${msg.senderName || 'Someone'}: ${previewOf(msg)}`,
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

    // The sender leads here — a DM is personal, so who it's from matters
    // more than where it's from. The team name still rides along in case the
    // same two people are connected on more than one team.
    const teamLabel = await teamName(convo.teamId);
    await sendToUsers(wanting, {
      title: `${msg.senderName || 'New message'} · ${teamLabel}`,
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
    const { name, sport: sportKey } = await teamMeta(teamId);
    const vs = `${after.homeOrAway === 'home' ? 'vs' : '@'} ${after.opponent}`;

    if (after.status === 'live') {
      const uids = await membersWanting(teamId, 'gameStart');
      // Resolved from the TEAM, not after.sport — no game document has ever
      // had a `sport` field, so reading it here always fell back to
      // baseball's "First pitch" regardless of what the team actually plays.
      const { body } = notifyPackFor(sportKey).describeGameStart();
      await sendToUsers(uids, {
        title: `${name} ${vs}`,
        body,
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

export const notifyScoringPlay = onDocumentCreated(
  'teams/{teamId}/games/{gameId}/events/{eventId}',
  async (event) => {
    const created = event.data?.data();
    if (!created) return;

    const { teamId, gameId } = event.params;

    const gameSnap = await db.doc(`teams/${teamId}/games/${gameId}`).get();
    const game = gameSnap.data();
    if (!game) return;

    /**
     * The team's sport, not the game document's.
     *
     * game.sport is never written anywhere in the client — it doesn't exist
     * on a single game document that's ever been created. notifyPackFor was
     * therefore always defaulting to baseball, for every team, regardless of
     * what they actually play — the exact "still baseball themed" symptom.
     * team.sport has been set correctly since team creation; using it here is
     * both the fix and the reason it applies to games already in progress.
     */
    const { sport: sportKey, name: teamLabel } = await teamMeta(teamId);
    const pack = notifyPackFor(sportKey);
    // Cheap check first — this trigger fires on every pitch, and replaying the
    // log for a called ball would be wasteful.
    if (!pack.isNotifiable(created.type)) return;

    const evSnap = await db.collection(`teams/${teamId}/games/${gameId}/events`)
      .orderBy('seq').get();
    // Bound to this event: a later one may already have been written.
    const events = evSnap.docs.map((d) => d.data())
      .filter((e) => !e.voided && e.seq <= created.seq);

    const play = pack.describePlay(created, events, game);
    if (!play) return;

    const playerSnap = await db.doc(`players/${play.playerId}`).get();
    const first = playerSnap.data()?.firstName || 'Your player';

    const matchup = `${teamLabel} `
      + `${game.homeOrAway === 'home' ? 'vs' : '@'} ${game.opponent}`;

    const uids = await followersOfPlayer(teamId, play.playerId, play.preferenceKey);
    await sendToUsers(uids, {
      title: play.title(first, { matchup }),
      body: play.body(first, { matchup }),
      data: {
        type: play.kind, teamId, gameId, playerId: play.playerId,
        link: `/teams/${teamId}/games/${gameId}`,
      },
    });
  }
);
