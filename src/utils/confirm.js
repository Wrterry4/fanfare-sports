/**
 * confirm.js — Dialogs that actually work on the web.
 *
 * react-native-web implements Alert.alert as a bare window.alert: it shows the
 * title and DROPS the buttons array entirely, so every onPress callback is
 * silently never called.
 *
 * That's why Delete Player, Delete Game, Undo, and Sign Out all looked like
 * dead buttons — the code was fine, the confirmation just never resolved.
 */

import { Alert, Platform } from 'react-native';

/**
 * @returns Promise<boolean> — true if the person confirmed.
 */
export function confirm({ title, message, confirmLabel = 'OK', destructive = false }) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(
      typeof window !== 'undefined' ? window.confirm(text) : false
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Plain notice. Alert.alert is fine for this on both platforms. */
export function notify(title, message) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
