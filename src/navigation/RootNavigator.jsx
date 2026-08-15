/**
 * RootNavigator.jsx — Auth gate and tabs.
 *
 * Join sits OUTSIDE the auth gate: someone opening a shared link needs to see
 * what they're joining before being asked for an account.
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../hooks/AuthProvider.jsx';
import { useTeams } from '../hooks/useTeams.js';
import { useMyRole } from '../hooks/useMyRole.js';
import { navigate } from './navigationRef.js';
import { colors } from '../theme/tokens.js';

import GameDayScreen from '../screens/GameDayScreen.jsx';
import ScheduleScreen from '../screens/ScheduleScreen.jsx';
import RosterScreen from '../screens/RosterScreen.jsx';
import MessagesScreen from '../screens/MessagesScreen.jsx';
import SettingsScreen from '../screens/SettingsScreen.jsx';
import SignInScreen from '../screens/SignInScreen.jsx';
import SetupScreen from '../screens/SetupScreen.jsx';
import JoinScreen from '../screens/JoinScreen.jsx';
import JoinTeamScreen from '../screens/JoinTeamScreen.jsx';

import {
  GameDayIcon, ScheduleIcon, RosterIcon, MessagesIcon, SettingsIcon,
} from '../components/TabIcons.jsx';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Game Day sits in the middle: it's the most-used tab, and the centre is the
 * easiest reach one-handed. The rest read left to right in the order a season
 * actually happens — schedule it, roster it, play it, talk about it.
 */
const TABS = [
  ['Schedule', 'Schedule', ScheduleIcon, ScheduleScreen],
  ['Roster', 'Roster', RosterIcon, RosterScreen],
  ['GameDay', 'Game Day', GameDayIcon, GameDayScreen],
  ['Messages', 'Messages', MessagesIcon, MessagesScreen],
  ['Settings', 'Settings', SettingsIcon, SettingsScreen],
];

function Tabs() {
  // Fans see the game and the schedule. Not the roster — that would be a
  // directory of other people's children — and not chat or team settings.
  const { isFan } = useMyRole();
  // Hard-coding paddingBottom was the bug: on an installed PWA the browser
  // reports a bottom inset that a fixed number can't account for, so the bar
  // ran off the bottom of the viewport. Measure it instead.
  const insets = useSafeAreaInsets();
  // An installed PWA reports a bottom inset that lags the real one — iOS
  // resolves env(safe-area-inset-bottom) after the first paint, so a bar sized
  // from it on mount ends up short and the labels sit under the home
  // indicator.
  //
  // A floor of 20 covers the gesture bar on every current iPhone; on hardware
  // that genuinely has no inset it's a little breathing room rather than a
  // clipped label.
  const bottomPad = Math.max(insets.bottom, 20);
  const barHeight = 54 + bottomPad;

  return (
    <Tab.Navigator
      initialRouteName="GameDay"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.pencil,
        // Height must clear the home indicator on iPhone or the labels sit on
        // top of it and the icons get clipped. borderTopWidth 0 removes the
        // hairline that content was scrolling under.
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          height: barHeight,
          // paddingTop was the empty strip above the icons. The item fills the
          // bar instead.
          paddingTop: 0,
          paddingBottom: bottomPad,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { paddingVertical: 0, height: 52, justifyContent: 'center' },
        tabBarLabelStyle: {
          fontFamily: 'PublicSans', fontWeight: '700', fontSize: 10,
          lineHeight: 13, marginTop: 0, marginBottom: 2, includeFontPadding: false,
        },
        tabBarIconStyle: { marginTop: 4, marginBottom: 0 },
      }}
    >
      {TABS.filter(([name]) => !isFan || name === 'GameDay' || name === 'Schedule')
        .map(([name, title, Icon, Component]) => (
        <Tab.Screen key={name} name={name} component={Component}
          options={{
            title,
            tabBarIcon: ({ color }) => <Icon color={color} size={22} />,
          }} />
      ))}
    </Tab.Navigator>
  );
}

function PendingInviteHandler({ destination, onHandled }) {
  useEffect(() => {
    if (!destination) return;
    navigate(destination.screen, destination.params);
    onHandled();
  }, [destination, onHandled]);
  return null;
}

export default function RootNavigator() {
  const { loading, signedIn, pendingDestination, clearPendingDestination } = useAuth();
  const { teams, loading: teamsLoading } = useTeams();

  const needsSetup = signedIn && !teamsLoading && (teams?.length ?? 0) === 0;

  if (loading || (signedIn && teamsLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <PendingInviteHandler destination={pendingDestination} onHandled={clearPendingDestination} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signedIn ? (
          <>
            {needsSetup && <Stack.Screen name="Setup" component={SetupScreen} />}
            <Stack.Screen name="Tabs" component={Tabs} />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
        {/* Reachable signed in or out. */}
        <Stack.Screen name="Join" component={JoinScreen} />
        <Stack.Screen name="JoinTeam" component={JoinTeamScreen} />
      </Stack.Navigator>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chalk },
});
