/**
 * photoShared.js — The parts of photos that are just Firestore.
 *
 * Reading the album, deleting a photo and posting the chat message that points
 * at one need no camera roll and no image encoding, so they work identically
 * on both platforms and live here rather than being written twice.
 */

import {
  db, doc, collection, addDoc, setDoc, deleteDoc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp,
} from './firebase';

export const photosPath = (teamId) => collection(db, 'teams', teamId, 'photos');

/**
 * Every photo the team has posted, newest first.
 *
 * The album and the chat read the same collection — a photo is one document,
 * and the message in the thread only points at it. Deleting from either place
 * removes it from both, because they were never two things.
 */
export function subscribePhotos(teamId, cb) {
  if (!teamId) { cb([]); return () => {}; }
  return onSnapshot(
    query(photosPath(teamId), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}

/**
 * The chat message that carries a photo.
 *
 * `text` is set so every existing reader — a push notification, a conversation
 * preview — has something to say. A message that renders as an empty bubble in
 * an older client is worse than one that says "Photo".
 */
export function postPhotoMessage({ teamId, channel, user, photo }) {
  return addDoc(
    collection(db, 'teams', teamId, 'channels', channel, 'messages'),
    {
      kind: 'photo',
      photoId: photo.id,
      photoUrl: photo.url,
      width: photo.width ?? null,
      height: photo.height ?? null,
      text: '📷 Photo',
      senderId: user.uid,
      senderName: user.displayName || 'Someone',
      createdAt: serverTimestamp(),
      deleted: false,
    },
  );
}

/**
 * The document goes; the file in Storage is left.
 *
 * Deleting the object needs the same client that uploaded it and a rule that
 * allows it, and a failed file delete must not leave a photo visible in the
 * album after someone asked for it to be gone. The document is what every view
 * reads, so removing it is what "deleted" means here. Orphaned files are a
 * storage bill, not a privacy problem — and a scheduled cleanup can sweep them
 * once there's a reason to.
 */
export function deletePhoto({ teamId, photoId }) {
  return deleteDoc(doc(db, 'teams', teamId, 'photos', photoId));
}

/** Used by the web uploader once the file is up and the URL is known. */
export function writePhotoDoc({ teamId, photoId, data }) {
  return setDoc(doc(db, 'teams', teamId, 'photos', photoId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export const markPhotoMessage = ({ teamId, photoId, messageId, channel }) =>
  updateDoc(doc(db, 'teams', teamId, 'photos', photoId), { messageId, channel });
