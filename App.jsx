/**
 * App.jsx — Root.
 *
 * Three responsibilities: initialize Firebase, gate on auth, and hand the
 * navigation container a linking config that knows about invite fragments.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator.jsx';
import ErrorBoundary from './src/components/ErrorBoundary.jsx';
import { AuthProvider, useAuth } from './src/hooks/AuthProvider.jsx';
import { ActiveTeamProvider } from './src/hooks/ActiveTeam.jsx';
import { InAppNoticeProvider } from './src/components/InAppNotice.jsx';
import PostInstallNotifyPrompt from './src/components/PostInstallNotifyPrompt.jsx';
import NoticeHost from './src/components/NoticeHost.jsx';
import { navigationRef } from './src/navigation/navigationRef.js';
import { linkingConfig } from './src/navigation/linking.js';
import { connectEmulators } from './src/services/firebase';
import { colors } from './src/theme/tokens.js';

/**
 * useAuth() only works below <AuthProvider>, so the prompt needs its own tiny
 * wrapper rather than being mounted directly in App() alongside the provider
 * that supplies it.
 */
function PostInstallNotifyGate() {
  const { user } = useAuth();
  return <PostInstallNotifyPrompt uid={user?.uid} />;
}

export default function App() {
  useEffect(() => { connectEmulators(); }, []);

  return (
    <SafeAreaProvider>
      {/* Light content on the navy scoreboard strip. */}
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <ErrorBoundary>
      <NavigationContainer ref={navigationRef} linking={linkingConfig}>
        {/* One auth listener for the whole app. Two would double-redeem
            pending invites and burn the single-use link. */}
        <AuthProvider>
          <ActiveTeamProvider>
            {/* Wraps the navigator so a foreground notice floats above every
                screen. Background pushes are handled by the service worker;
                this is only for messages arriving while the app is open. */}
            <InAppNoticeProvider>
              <RootNavigator />
            </InAppNoticeProvider>
            <PostInstallNotifyGate />
            {/* Floats above every screen so notify() can reach it from
                anywhere, including async handlers. */}
            <NoticeHost />
          </ActiveTeamProvider>
        </AuthProvider>
      </NavigationContainer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
