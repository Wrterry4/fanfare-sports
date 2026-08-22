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
import { useActiveTeam } from '../hooks/ActiveTeam.jsx';
import { useMyRole } from '../hooks/useMyRole.js';
import { useBottomInset } from '../hooks/useBottomInset';
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
  // Fans see the game, the schedule, the roster and settings.
  //
  // Settings is on the list because notifications live there, and a
  // notification is the entire reason a grandparent installed this. Without it
  // they had no way to grant permission or send themselves a test — the one
  // feature they came for was unreachable. The screen itself hides the join
  // code and the rules editor from anyone who isn't staff.
  //
  // Messages stays closed: the rules block fans from team chat, so the tab
  // would open onto nothing.
  const { isFan } = useMyRole();
  /**
   * The real inset, not a guess.
   *
   * This used to floor at 20px to cover the home indicator, which put 20px of
   * dead space under the bar on hardware with no inset and still wasn't
   * enough on an iPhone that reports 34. useBottomInset reads
   * env(safe-area-inset-bottom) directly on web and the OS value on native,
   * so the bar sits exactly as low as it can without the labels running into
   * the indicator.
   *
   * The clipping you'd have seen before this was NOT caused here, though —
   * see the note in scripts/finalize-web.mjs about -webkit-fill-available
   * making #root taller than the viewport. Both changes are needed.
   */
  const bottomInset = useBottomInset();
  // 4px keeps the labels off a hard screen edge on a device with no inset.
  const bottomPad = bottomInset > 0 ? bottomInset : 4;
  const barHeight = 62 + bottomPad;

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
        // 62, not 52. The label sat in a 13px line box inside a 52px item and
        // the descenders in "Schedule" and "Game Day" were clipped off the
        // bottom — a g and a y are the whole difference between a label that
        // reads and one that looks broken. Icon 4 + 22, label 15, and room
        // underneath so nothing lands on the item's edge.
        tabBarItemStyle: { paddingVertical: 0, height: 62, justifyContent: 'center' },
        tabBarLabelStyle: {
          fontFamily: 'PublicSans', fontWeight: '700', fontSize: 10,
          lineHeight: 15, marginTop: 1, marginBottom: 6, includeFontPadding: false,
        },
        tabBarIconStyle: { marginTop: 5, marginBottom: 0 },
      }}
    >
      {TABS.filter(([name]) => !isFan
                    || ['GameDay', 'Schedule', 'Roster', 'Settings'].includes(name))
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
  /**
   * The team list arriving isn't the same moment as knowing WHICH team is
   * active — that also needs the stored preference read from AsyncStorage,
   * which is a second, independent async operation with no ordering
   * guarantee against the Firestore fetch above. Gating only on `teamsLoading`
   * let the navigator start rendering real screens the instant the team list
   * arrived, sometimes before the stored preference had loaded — during that
   * gap `team` (from useActiveTeam) was resolving to an arbitrary team, and
   * several screens read it without checking its own loading flag, so the
   * wrong team's name and content would flash before correcting a moment
   * later. Waiting on activeTeamLoading here closes that window at the one
   * place all of those screens share, rather than needing each one fixed
   * individually.
   */
  const { loading: activeTeamLoading } = useActiveTeam();

  const needsSetup = signedIn && !teamsLoading && (teams?.length ?? 0) === 0;

  if (loading || (signedIn && (teamsLoading || activeTeamLoading))) {
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
