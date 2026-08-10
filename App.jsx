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
import { AuthProvider } from './src/hooks/AuthProvider.jsx';
import { navigationRef } from './src/navigation/navigationRef.js';
import { linkingConfig } from './src/navigation/linking.js';
import { connectEmulators } from './src/services/firebase';
import { colors } from './src/theme/tokens.js';

export default function App() {
  useEffect(() => { connectEmulators(); }, []);

  return (
    <SafeAreaProvider>
      {/* Light content on the navy scoreboard strip. */}
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <NavigationContainer ref={navigationRef} linking={linkingConfig}>
        {/* One auth listener for the whole app. Two would double-redeem
            pending invites and burn the single-use link. */}
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
