/**
 * push.js — NATIVE push. See push.web.js for the browser implementation.
 */

import { getApp } from '@react-native-firebase/app';
import {
  getMessaging, requestPermission, getToken, onTokenRefresh, deleteToken,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { getUniqueId } from 'react-native-device-info';
import { Platform } from 'react-native';

const messaging = getMessaging(getApp());

export const pushSupported = () => true;

/** Native has no install step — the OS prompt is the whole flow. */
export const requiresInstallFirst = () => false;

export async function requestPushPermission() {
  const status = await requestPermission(messaging);
  return status === AuthorizationStatus.AUTHORIZED ||
         status === AuthorizationStatus.PROVISIONAL;
}

export const fetchPushToken = () => getToken(messaging);
export const revokePushToken = () => deleteToken(messaging);
export const watchToken = (cb) => onTokenRefresh(messaging, cb);
export const deviceId = () => getUniqueId();
export const platformName = () => Platform.OS;
