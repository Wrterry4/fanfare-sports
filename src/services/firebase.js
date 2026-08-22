/**
 * firebase.js — NATIVE implementation.
 *
 * Metro resolves `./firebase` to `firebase.web.js` for web builds and to this
 * file for iOS/Android. Every other module imports from './firebase' WITHOUT
 * an extension, which is what lets the platform swap happen.
 *
 * This file is not used by the PWA. It exists so the same source ships native
 * later without touching the service layer.
 */

import { getApp } from '@react-native-firebase/app';
import { Platform } from 'react-native';

export {
  collection, doc, query, orderBy, limit, where,
  onSnapshot, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, writeBatch, increment, arrayUnion, arrayRemove, deleteField,
} from '@react-native-firebase/firestore';
export { httpsCallable } from '@react-native-firebase/functions';
export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, onAuthStateChanged, updateProfile,
} from '@react-native-firebase/auth';

import { getFirestore, connectFirestoreEmulator } from '@react-native-firebase/firestore';
import { getAuth, connectAuthEmulator } from '@react-native-firebase/auth';
import { getFunctions, connectFunctionsEmulator } from '@react-native-firebase/functions';
import { getStorage } from '@react-native-firebase/storage';

export const app = getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

db.settings({ persistence: true, cacheSizeBytes: 100 * 1024 * 1024 });

const HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export function connectEmulators() {
  if (!__DEV__) return;
  connectFirestoreEmulator(db, HOST, 8080);
  connectAuthEmulator(auth, `http://${HOST}:9099`);
  connectFunctionsEmulator(functions, HOST, 5001);
}

export const goOffline = () => db.disableNetwork();
export const goOnline = () => db.enableNetwork();
export const isWeb = false;
