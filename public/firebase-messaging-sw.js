/**
 * firebase-messaging-sw.js — Background push for the PWA.
 *
 * MUST live at the site root. A service worker's scope is limited to its own
 * directory, so one served from /static/ could not receive messages for /.
 *
 * Uses the compat build: service worker scope has no bundler, and the modular
 * SDK's tree-shaken imports don't work here.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// These are public identifiers, not secrets — they ship in every web client.
// Access is controlled by Firestore rules, not by hiding this config.
firebase.initializeApp({
  apiKey: 'AIzaSyAKAVlHzC3qV16bPCy-g6wLgeaz2KeT0_8',
  authDomain: 'fanfare-sports.firebaseapp.com',
  projectId: 'fanfare-sports',
  messagingSenderId: '511243466883',
  appId: '1:511243466883:web:cd04fa24f86c195faec3b6',
});

const messaging = firebase.messaging();

// Without these, a deployed update sits in "waiting" until every tab closes —
// on an installed PWA that can be days. The old worker keeps control and
// background pushes go to code that may not match the app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || 'Fanfare', {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    // Same tag replaces rather than stacks: a parent who steps away shouldn't
    // return to eleven separate "Jack is up" notifications.
    tag: data.type === 'atBat' ? `atbat-${data.playerId}` : data.type,
    renotify: true,
    data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};

  let path = '/';
  if (d.type === 'atBat' || d.type === 'result' || d.type === 'gameStart' || d.type === 'finalScore') {
    path = d.gameId ? `/teams/${d.teamId}/games/${d.gameId}` : `/teams/${d.teamId}`;
  } else if (d.type === 'transfer') {
    path = `/transfers/${d.transferId}`;
  } else if (d.type === 'directMessage') {
    path = `/teams/${d.teamId}/messages/c/${d.conversationId}`;
  }

  // Focus an existing window rather than opening a duplicate.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(path); return client.focus(); }
      }
      return clients.openWindow(path);
    })
  );
});
