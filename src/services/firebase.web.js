/**
 * firebase.web.js — WEB implementation. This is the one the PWA uses.
 *
 * ── On offline persistence ──────────────────────────────────────────────────
 *
 * The earlier note said the JS SDK's persistence was disqualifying. That was
 * true for React Native, where IndexedDB doesn't exist. On the web it does, and
 * `persistentLocalCache` gives a real on-disk queue that survives reloads.
 *
 * The caveats are honest but narrower than "it doesn't work":
 *
 *   • Safari evicts IndexedDB for sites unused for 7 days. A PWA the user has
 *     added to the home screen is exempt — which is one more reason the install
 *     prompt matters for scorekeepers specifically.
 *   • `persistentMultipleTabManager` is required or a second open tab throws
 *     and silently disables persistence in BOTH.
 *
 * For a scorekeeper who opens the app weekly during a season, this holds.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  disableNetwork, enableNetwork,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

export {
  collection, doc, query, orderBy, limit, where,
  onSnapshot, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, writeBatch, increment, arrayUnion, arrayRemove, deleteField,
} from 'firebase/firestore';
export { httpsCallable } from 'firebase/functions';
// The provider names below are Google and Facebook sign-in, and they are web
// only — see services/socialAuth.js for why the native side has no equivalent.
export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, onAuthStateChanged, updateProfile,
  GoogleAuthProvider, FacebookAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, linkWithPopup,
} from 'firebase/auth';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(config);

// initializeFirestore (not getFirestore) — the cache can only be configured at
// creation, and calling getFirestore first locks in the memory-only default.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

export function connectEmulators() {
  if (process.env.NODE_ENV === 'production') return;
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export const goOffline = () => disableNetwork(db);
export const goOnline = () => enableNetwork(db);
export const isWeb = true;
