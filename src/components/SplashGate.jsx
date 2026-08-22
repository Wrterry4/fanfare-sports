/**
 * SplashGate.jsx — Decides when the app knows what it's showing.
 *
 * Three independent async things settle at startup, in no guaranteed order:
 * the auth state, the team list from Firestore, and the active-team preference
 * from AsyncStorage. RootNavigator already waits on all three before choosing
 * a screen — but "waiting" rendered as a bare spinner, and the moment the team
 * list arrived empty for even one frame the answer was the Setup screen. An
 * existing coach got told to create a team on every launch.
 *
 * This holds the splash over exactly that window, using the same three signals
 * RootNavigator gates on. It sits inside the providers because that is the
 * only place those hooks can be called.
 *
 * Unmounts itself when finished — a full-screen absolute view left mounted
 * forever is a thing to trip over later, even with pointerEvents none.
 */

import React, { useCallback, useState } from 'react';

import { useAuth } from '../hooks/AuthProvider.jsx';
import { useActiveTeam } from '../hooks/ActiveTeam.jsx';
import SplashScreen from './SplashScreen.jsx';

export default function SplashGate() {
  const [done, setDone] = useState(false);
  const { loading: authLoading, signedIn } = useAuth();
  // This one flag already covers both remaining unknowns: ActiveTeamProvider
  // reports `loading || !restored`, which is the team list AND the stored
  // preference. Calling useTeams() here as well would open a second set of
  // Firestore listeners for data the provider is already subscribed to.
  const { loading: teamContextLoading } = useActiveTeam();

  const onHidden = useCallback(() => setDone(true), []);

  if (done) return null;

  // Signed out is a settled answer — the sign-in screen is correct and needs
  // no team data. Only a signed-in session has to wait for teams.
  const ready = !authLoading && (!signedIn || !teamContextLoading);

  return <SplashScreen ready={ready} onHidden={onHidden} />;
}
