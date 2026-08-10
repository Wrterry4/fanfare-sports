/**
 * RootNavigator.jsx — Auth gate and tabs.
 *
 * Join sits OUTSIDE the auth gate: someone opening a shared link needs to see
 * what they're joining before being asked for an account.
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../hooks/AuthProvider.jsx';
import { useTeams } from '../hooks/useTeams.js';
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

const TABS = [
  ['GameDay', 'Game Day', GameDayIcon, GameDayScreen],
  ['Schedule', 'Schedule', ScheduleIcon, ScheduleScreen],
  ['Roster', 'Roster', RosterIcon, RosterScreen],
  ['Messages', 'Messages', MessagesIcon, MessagesScreen],
  ['Settings', 'Settings', SettingsIcon, SettingsScreen],
];

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.pencil,
        // Height must clear the home indicator on iPhone or the labels sit on
        // top of it and the icons get clipped. borderTopWidth 0 removes the
        // hairline that content was scrolling under.
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          height: 78,
          paddingTop: 8,
          paddingBottom: 22,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: {
          fontFamily: 'PublicSans', fontWeight: '700', fontSize: 10,
          marginTop: 2, marginBottom: 0,
        },
      }}
    >
      {TABS.map(([name, title, Icon, Component]) => (
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
