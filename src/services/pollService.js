/**
 * pollService.js — Posting a poll, and answering one.
 *
 * A poll is a message with `kind: 'poll'`. Everything about reading messages
 * already works — the thread subscription, notifications, deletion — so the
 * only new machinery is the votes subcollection underneath it.
 */

import {
  db, doc, collection, addDoc, setDoc, updateDoc, onSnapshot, serverTimestamp,
} from './firebase';
import { newPoll } from '../shared/polls.js';

const messagesPath = (teamId, channel) =>
  collection(db, 'teams', teamId, 'channels', channel, 'messages');

const messageRef = (teamId, channel, messageId) =>
  doc(db, 'teams', teamId, 'channels', channel, 'messages', messageId);

/**
 * @param draft { question, options: [string], multi, closesAt }
 */
export async function postPoll({ teamId, channel, user, draft }) {
  // Validated here rather than at the call site, so every path that ever
  // posts a poll gets the same rules.
  const poll = newPoll(draft);

  const ref = await addDoc(messagesPath(teamId, channel), {
    kind: 'poll',
    poll,
    // `text` is what every existing reader falls back to — a notification, a
    // conversation preview, an older client that has never heard of polls.
    // Without it a poll arrives as a blank message.
    text: poll.question,
    senderId: user.uid,
    senderName: user.displayName || 'Coach',
    createdAt: serverTimestamp(),
    deleted: false,
  });
  return { messageId: ref.id };
}

/**
 * One document per voter, keyed by uid: two people answering at the same
 * moment can't overwrite each other, and changing your mind is a write to
 * your own document.
 *
 * The voter's NAME is denormalized onto the vote. A count of five doesn't tell
 * a coach which five to expect on Saturday, and reading thirty member
 * documents to find out would be absurd.
 */
export function castVote({ teamId, channel, messageId, user, optionIds }) {
  return setDoc(doc(messageRef(teamId, channel, messageId), 'votes', user.uid), {
    optionIds,
    name: user.displayName || null,
    votedAt: serverTimestamp(),
  });
}

export function subscribeVotes({ teamId, channel, messageId }, cb) {
  return onSnapshot(
    collection(messageRef(teamId, channel, messageId), 'votes'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}

/** Closing keeps the result and stops the buttons. Only the author or staff. */
export const closePoll = ({ teamId, channel, messageId }) =>
  updateDoc(messageRef(teamId, channel, messageId), { 'poll.closed': true });

export const reopenPoll = ({ teamId, channel, messageId }) =>
  updateDoc(messageRef(teamId, channel, messageId), { 'poll.closed': false });
