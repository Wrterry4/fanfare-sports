/**
 * authService.js — Accounts and push tokens.
 *
 * v1 has no minor accounts. Every account here belongs to an adult, which is
 * what lets the DM rules be a simple "both are members of this team" check
 * rather than an age-aware policy.
 */

import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, sendPasswordResetEmail, onAuthStateChanged,
  updateProfile, auth, db,
  doc, setDoc, getDoc, updateDoc, deleteField, serverTimestamp,
} from './firebase';
import {
  requestPushPermission, fetchPushToken, revokePushToken, watchToken,
  deviceId, platformName, pushSupported, requiresInstallFirst,
} from './push';

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function signUp({ email, password, displayName }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName });

  await setDoc(doc(db, 'users', cred.user.uid), {
    displayName,
    email: email.trim().toLowerCase(),
    teamIds: [],
    guardianOf: [],
    pushTokens: {},
    createdAt: serverTimestamp(),
  }, { merge: true });

  return cred.user;
}

export async function signIn({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

/**
 * Remove this device's token before the session ends. Skipping it means the
 * next person to sign in on a shared family tablet inherits notifications
 * about someone else's child.
 */
export async function signOut() {
  const uid = auth.currentUser?.uid;
  if (uid) await unregisterDevice(uid).catch(() => {});
  await fbSignOut(auth);
}

export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());
export const observeAuth = (cb) => onAuthStateChanged(auth, cb);
export const currentUid = () => auth.currentUser?.uid ?? null;

// ---------------------------------------------------------------------------
// Push tokens
// ---------------------------------------------------------------------------

/**
 * Tokens are keyed by device, not appended to a list. A parent with a phone
 * and a tablet should get one notification per device — and reinstalling on
 * the phone should replace that entry rather than leave a dead token behind.
 */
export async function registerDevice(uid) {
  // On iOS the site must be on the home screen before push is even offered.
  // Reported rather than silently failing, so the UI can show instructions.
  if (requiresInstallFirst()) return { granted: false, needsInstall: true };
  if (!pushSupported()) return { granted: false, unsupported: true };

  const granted = await requestPushPermission();
  if (!granted) return { granted: false };

  const token = await fetchPushToken();
  if (!token) return { granted: false };
  const id = await deviceId();

  await updateDoc(doc(db, 'users', uid), {
    [`pushTokens.${id}`]: {
      token,
      platform: platformName(),
      updatedAt: serverTimestamp(),
    },
  });

  return { granted: true, token, deviceId: id };
}

export async function unregisterDevice(uid) {
  const id = await deviceId();
  await updateDoc(doc(db, 'users', uid), {
    [`pushTokens.${id}`]: deleteField(),
  });
  await revokePushToken();
}

/** FCM rotates tokens on its own schedule; a stale one fails silently. */
export function watchTokenRefresh(uid) {
  return watchToken(async (token) => {
    const id = await deviceId();
    await updateDoc(doc(db, 'users', uid), {
      [`pushTokens.${id}`]: {
        token, platform: platformName(), updatedAt: serverTimestamp(),
      },
    }).catch(() => {});
  });
}

/**
 * Permission is requested when it makes sense, not at launch.
 *
 * A cold "Allow notifications?" on first open gets denied, and on iOS the
 * denial is close to permanent — the user has to go to Settings to undo it.
 * Asking right after someone joins a team, on the screen that just told them
 * they'll be alerted when their kid is up, converts far better and is the
 * honest moment to ask.
 */
export async function requestPushAtTheRightMoment(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  const asked = snap.data()?.pushPromptedAt;
  if (asked) return { alreadyAsked: true };

  const result = await registerDevice(uid);
  await updateDoc(doc(db, 'users', uid), { pushPromptedAt: serverTimestamp() });
  return result;
}
