/**
 * socialAuth.web.js — WEB. Google and Facebook sign-in.
 *
 * ── Popup, with redirect as the fallback that actually matters ─────────────
 *
 * signInWithPopup is the better experience — the app never unloads, so nothing
 * in memory is lost — but it is blocked in exactly the place this app is most
 * used: an installed iOS PWA, where window.open either does nothing or opens
 * a detached Safari window that can't message back. Rather than guess from the
 * user agent, this tries the popup and falls back to a redirect on the errors
 * that mean "popups don't work here".
 *
 * A redirect unloads the page, so the result is picked up on the next load by
 * completeRedirectSignIn(), which AuthProvider calls once at startup.
 *
 * ── The account document ──────────────────────────────────────────────────
 *
 * Email sign-up writes users/{uid} itself. A social sign-in has no such step —
 * the first sign-in IS the sign-up — so both paths funnel through
 * ensureUserDoc(), which merges rather than overwrites: signing in with Google
 * on an account that already exists must not blank out its teamIds.
 */

import {
  auth, db, doc, setDoc, getDoc, serverTimestamp,
  GoogleAuthProvider, FacebookAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
} from './firebase';

/**
 * Rendered in this order. Google first: it's the account most families
 * already have on the phone, and the one-tap chooser is the shortest path
 * from "a coach texted me a link" to being in the app.
 */
export const SOCIAL_PROVIDERS = [
  { id: 'google.com', label: 'Continue with Google' },
  { id: 'facebook.com', label: 'Continue with Facebook' },
];

export const socialSignInSupported = () => true;

function providerFor(id) {
  if (id === 'google.com') {
    const p = new GoogleAuthProvider();
    // Always ask which account. Without this, a shared family laptop silently
    // reuses whoever signed in last — and on this app that means one parent
    // looking at another family's child.
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }
  if (id === 'facebook.com') {
    const p = new FacebookAuthProvider();
    p.addScope('email');
    return p;
  }
  throw new Error('Unknown sign-in provider.');
}

/** The errors that mean "this browser will not give you a popup". */
const NEEDS_REDIRECT = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/cancelled-popup-request',
  'auth/web-storage-unsupported',
];

export async function signInWithProvider(id) {
  const provider = providerFor(id);
  try {
    const cred = await signInWithPopup(auth, provider);
    await ensureUserDoc(cred.user);
    return cred.user;
  } catch (e) {
    const code = e?.code || '';
    // Closing the window yourself is not an error worth reporting back.
    if (code === 'auth/popup-closed-by-user') return null;
    if (NEEDS_REDIRECT.includes(code)) {
      await signInWithRedirect(auth, provider);
      return null;               // the page is on its way out
    }
    throw e;
  }
}

/**
 * Called once at startup. Returns the user when this load is the far side of
 * a redirect, and null on every ordinary load.
 */
export async function completeRedirectSignIn() {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    await ensureUserDoc(result.user);
    return result.user;
  } catch {
    // A failed redirect must not stop the app from starting; the person lands
    // on the sign-in screen and can try again.
    return null;
  }
}

/**
 * Create the account document on first social sign-in, and leave it alone
 * afterwards.
 *
 * Merged, never overwritten: the fields below are the ones a provider knows
 * about, and every other field on the document — teamIds, guardianOf,
 * pushTokens — belongs to the app and must survive.
 */
export async function ensureUserDoc(user) {
  if (!user?.uid) return;
  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref).catch(() => null);

  if (existing?.exists?.()) {
    // Only fill gaps. A person who set their display name in the app should
    // not have it replaced by their Facebook name on next sign-in.
    const data = existing.data() || {};
    const patch = {};
    if (!data.displayName && user.displayName) patch.displayName = user.displayName;
    if (!data.email && user.email) patch.email = user.email.toLowerCase();
    if (Object.keys(patch).length) await setDoc(ref, patch, { merge: true });
    return;
  }

  await setDoc(ref, {
    displayName: user.displayName || null,
    email: user.email ? user.email.toLowerCase() : null,
    teamIds: [],
    guardianOf: [],
    pushTokens: {},
    createdAt: serverTimestamp(),
  }, { merge: true });
}
