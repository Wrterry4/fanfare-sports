/**
 * notificationRouting.js — NATIVE.
 *
 * Isolated into its own platform-split file because a static `require` of a
 * native module is bundled by Metro whether or not a runtime Platform check
 * guards it. @react-native-firebase/messaging calls getApp() when evaluated,
 * which throws in a browser. Guarding execution is not the same as excluding
 * the module from the bundle — only a .web.js sibling does that.
 */

import {
  getMessaging, getInitialNotification, onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';

const messaging = () => getMessaging(getApp());

export async function initialNotificationData() {
  const notification = await getInitialNotification(messaging());
  return notification?.data ?? null;
}

export function subscribeNotificationOpened(handler) {
  return onNotificationOpenedApp(messaging(), (msg) => handler(msg?.data ?? null));
}
