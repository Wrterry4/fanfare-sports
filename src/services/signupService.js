/**
 * signupService.js — Sign-up slots on a schedule entry.
 *
 * Slots live under the event they belong to, so a coach asking "who has snacks
 * on Saturday" reads one place, and a game that gets deleted takes its rota
 * with it rather than leaving an orphan.
 */

import {
  db, doc, collection, setDoc, deleteDoc, updateDoc, onSnapshot, serverTimestamp,
} from './firebase';
import { buildSlots } from '../shared/signups.js';
import { slug } from '../shared/docIds.js';

const slotsPath = (teamId, eventId) =>
  collection(db, 'teams', teamId, 'games', eventId, 'slots');

const slotRef = (teamId, eventId, slotId) =>
  doc(db, 'teams', teamId, 'games', eventId, 'slots', slotId);

/**
 * Create a sign-up: one document per slot.
 *
 * Ids are derived from the label, so a coach adding "Snacks" twice ends up
 * with one Snacks slot rather than two — the second write lands on the same
 * document. `merge` keeps whoever already claimed it.
 */
export async function createSignup({ teamId, eventId, label, count = 1 }) {
  const slots = buildSlots({ label, count }, slug);
  for (const slot of slots) {
    await setDoc(slotRef(teamId, eventId, slot.id), {
      label: slot.label,
      position: slot.position,
      of: slot.of,
      createdAt: serverTimestamp(),
    }, { merge: true });
  }
  return { slots: slots.map((s) => s.id) };
}

/**
 * Claiming writes the name alongside the uid.
 *
 * Same reason as a poll vote: the point of the list is reading who is bringing
 * what, and a column of user ids is not that.
 */
export const claimSlot = ({ teamId, eventId, slotId, user }) =>
  updateDoc(slotRef(teamId, eventId, slotId), {
    claimedBy: user.uid,
    claimedName: user.displayName || null,
    claimedAt: serverTimestamp(),
  });

/** Released rather than deleted — the slot still exists, it's just open again. */
export const releaseSlot = ({ teamId, eventId, slotId }) =>
  updateDoc(slotRef(teamId, eventId, slotId), {
    claimedBy: null, claimedName: null, claimedAt: null,
  });

export const removeSlot = ({ teamId, eventId, slotId }) =>
  deleteDoc(slotRef(teamId, eventId, slotId));

export function subscribeSlots({ teamId, eventId }, cb) {
  if (!teamId || !eventId) { cb([]); return () => {}; }
  return onSnapshot(slotsPath(teamId, eventId),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]));
}
