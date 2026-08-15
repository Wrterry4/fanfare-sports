/**
 * AuthProvider.jsx — One auth listener for the whole app.
 *
 * useAuth() was previously a plain hook, and two components called it:
 * RootNavigator and JoinScreen. That meant two independent auth listeners,
 * two FCM token watchers, and — because the "already handled" guard was a ref
 * local to each hook instance — TWO attempts to redeem the same pending invite.
 *
 * The second redemption would burn the invite's single use and could leave a
 * parent looking at an "already used" error on the account they just created.
 *
 * A provider makes the listener a singleton. useAuth() now reads context.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { observeAuth, watchTokenRefresh, registerDevice } from '../services/authService.js';
import { resolvePendingInvite } from '../navigation/linking.js';
import { redeemInvite, postRedeemDestination } from '../services/inviteService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still resolving
  const [pendingDestination, setPendingDestination] = useState(null);
  const tokenWatcher = useRef(null);
  const inviteHandled = useRef(false);

  useEffect(() => {
    const unsub = observeAuth(async (u) => {
      setUser(u ?? null);

      tokenWatcher.current?.();
      tokenWatcher.current = null;

      if (!u) { inviteHandled.current = false; return; }

      tokenWatcher.current = watchTokenRefresh(u.uid);

      // Re-register silently when permission is already granted. FCM rotates
      // tokens, and a reinstall issues a new one — without this, notifications
      // quietly stop and nobody knows why.
      const alreadyGranted =
        typeof Notification !== 'undefined' && Notification.permission === 'granted';
      if (alreadyGranted) registerDevice(u.uid).catch(() => {});

      if (!inviteHandled.current) {
        inviteHandled.current = true;
        try {
          const dest = await resolvePendingInvite(redeemInvite, postRedeemDestination);
          if (dest) setPendingDestination(dest);
        } catch {
          // A failed redeem must not block sign-in. The link stays consumed
          // either way; the parent can be re-invited.
        }
      }
    });

    return () => { unsub(); tokenWatcher.current?.(); };
  }, []);

  const value = {
    user,
    loading: user === undefined,
    signedIn: !!user,
    pendingDestination,
    clearPendingDestination: () => setPendingDestination(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
