/**
 * push.web.js — Web push.
 *
 * ── The one real constraint of shipping as a PWA ────────────────────────────
 *
 * On iOS, Web Push works ONLY after the user adds the site to their home
 * screen, and only on iOS 16.4+. Safari in a normal tab cannot receive push at
 * all. Android and desktop Chrome have no such requirement.
 *
 * Since the on-deck alert is the feature that makes a grandparent install
 * anything, iPhone users must be walked through Share → Add to Home Screen
 * before the permission prompt will even appear. `requiresInstallFirst()`
 * exists so the UI can detect that case and show instructions instead of a
 * button that would silently do nothing.
 *
 * Adding to the home screen also exempts the site from Safari's 7-day
 * IndexedDB eviction — so the same step that enables push is the one that makes
 * offline scoring durable. Worth prompting hard for scorekeepers.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { app } from './firebase.web.js';

const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;

let _messaging = null;
async function messaging() {
  if (_messaging) return _messaging;
  if (!(await isSupported())) return null;
  _messaging = getMessaging(app);
  return _messaging;
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

export const pushSupported = () =>
  'Notification' in window && 'serviceWorker' in navigator;

/** True when the browser can only deliver push to an installed PWA. */
export const requiresInstallFirst = () => isIOS() && !isInstalled();

export async function requestPushPermission() {
  if (!pushSupported() || requiresInstallFirst()) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function fetchPushToken() {
  const m = await messaging();
  if (!m) return null;
  const registration = await navigator.serviceWorker.ready;
  return getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

export async function revokePushToken() {
  const m = await messaging();
  if (m) await deleteToken(m).catch(() => {});
}

/**
 * The web SDK has no onTokenRefresh. Tokens rotate silently, so the app
 * re-fetches on each launch and overwrites the entry for this device — which
 * achieves the same thing without a listener.
 */
export const watchToken = () => () => {};

/** No hardware ID on the web. A stable per-browser UUID does the same job. */
export function deviceId() {
  const KEY = 'deviceId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(KEY, id);
  }
  return Promise.resolve(id);
}

export const platformName = () => 'web';
