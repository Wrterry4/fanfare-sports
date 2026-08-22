/**
 * foregroundPush.web.js — In-app messages, as distinct from push.
 *
 * There was no onMessage handler at all. Every message became an OS banner,
 * including ones arriving while the person was staring at the screen the
 * notification was about — a parent watching Game Day got a system alert
 * telling them what they were already looking at.
 *
 * FCM splits these for us: onBackgroundMessage fires in the service worker
 * when the app isn't focused, onMessage fires here when it is. Now that the
 * server sends data-only to web, the two paths can render differently — the
 * worker shows an OS banner, this shows an in-app toast.
 */

import { onMessage } from 'firebase/messaging';
import { getMessaging, isSupported } from 'firebase/messaging';
import { app } from './firebase.web.js';

/**
 * @param handler receives { title, body, data } for FOREGROUND messages only
 * @returns unsubscribe
 */
export function subscribeForegroundPush(handler) {
  let unsub = () => {};
  let cancelled = false;

  isSupported().then((supported) => {
    if (!supported || cancelled) return;
    const messaging = getMessaging(app);
    unsub = onMessage(messaging, (payload) => {
      const data = payload.data || {};
      handler({
        title: data.title || payload.notification?.title || 'Fanfare',
        body: data.body || payload.notification?.body || '',
        // Marked so anything downstream can tell where it came from. The
        // server sets channel:'push'; this is the same event seen in-app.
        data: { ...data, channel: 'inApp' },
      });
    });
  }).catch(() => {});

  return () => { cancelled = true; unsub(); };
}
