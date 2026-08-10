/**
 * notificationRouting.web.js — WEB.
 *
 * Nothing to do. The service worker's `notificationclick` handler navigates
 * directly (see public/firebase-messaging-sw.js), so there's no cold-start
 * notification for the app to intercept.
 *
 * This file exists to keep the native messaging module out of the web bundle
 * entirely.
 */

export async function initialNotificationData() { return null; }
export function subscribeNotificationOpened() { return () => {}; }
