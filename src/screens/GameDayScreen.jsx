/**
 * GameDayScreen.jsx — Live scoring.
 *
 * Nothing scrolls. Every control is on screen at once, because scrolling to
 * find the strike button between pitches is unusable at a real game.
 *
 * The field is compact and sits beside the batter/pitcher card rather than
 * above it — a diamond is square, a phone is tall, and centering it wasted the
 * width on both sides while pushing the buttons off screen.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions,
  Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import AppHeader from '../components/AppHeader.jsx';
import AccountSheet from '../components/AccountSheet.jsx';
import SoundboardSheet from '../components/SoundboardSheet.jsx';
import MomentBanner from '../components/MomentBanner.jsx';
import { findNewMoment } from '../shared/momentDetection.js';
import { resolveTeamColor } from '../shared/teamColors.js';
import { describeOutcome } from '../shared/gameOutcome.js';
import WinCelebration from '../components/WinCelebration.jsx';
import { checkGameReadiness } from '../shared/gameReadiness.js';
import PlayerCardScreen from './PlayerCardScreen.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import LineScore from '../components/LineScore.jsx';
import { sportForTeam } from '../sports/registry.js';
import { useGameDay } from '../hooks/useGameDay.js';
import { useGame } from '../hooks/useGame.js';
import { useWalkUp } from '../hooks/useWalkUp.js';
import { playClip, stopClip, isPlaying } from '../services/audioStore';
import { useAuth } from '../hooks/AuthProvider.jsx';
import { requestBaton, approveBaton, denyBaton } from '../services/gameService.js';
import { db, doc, updateDoc } from '../services/firebase';
import { confirm, notify } from '../utils/confirm.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { sportThemeOf } from '../theme/useSportTheme.js';

export default function GameDayScreen() {
  const { team, game, allGames, roster, rules, config, names, loading, error } = useGameDay();
  const navigation = useNavigation();

  /**
   * Once a game is on screen it STAYS there, even after it goes final — so the
   * scorekeeper can look at the finished line score instead of being thrown
   * onto next week's game the moment they record the last out.
   *
   * The pin clears when the tab loses focus, so coming back shows whatever is
   * next up with a Start button.
   */
  const [pinnedId, setPinnedId] = useState(null);

  useEffect(() => {
    const unsub = navigation.addListener('blur', () => setPinnedId(null));
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (game?.id) setPinnedId((cur) => cur ?? game.id);
  }, [game?.id]);

  const shown = useMemo(() => {
    if (!pinnedId) return game;
    return allGames?.find((g) => g.id === pinnedId) ?? game;
  }, [pinnedId, allGames, game]);

  const [menu, setMenu] = useState(false);
  const header = (
    <>
      <AppHeader team={team} onMenu={() => setMenu(true)} />
      <AccountSheet visible={menu} onClose={() => setMenu(false)} />
    </>
  );
  const headerWith = (right) => (
    <>
      <AppHeader team={team} onMenu={() => setMenu(true)} right={right} />
      <AccountSheet visible={menu} onClose={() => setMenu(false)} />
    </>
  );

  if (loading) {
    return <Shell header={header}><Centered><ActivityIndicator color={colors.primary} /></Centered></Shell>;
  }
  if (error) {
    return <Shell header={header}><Centered><Text style={styles.msg}>{error.message}</Text></Centered></Shell>;
  }
  if (!team) {
    return <Shell header={header}><Centered><Text style={styles.msg}>No team yet.</Text></Centered></Shell>;
  }
  if (!shown || !config) {
    return (
      <Shell header={header}>
        <Centered>
          <Text style={styles.emptyTitle}>No game scheduled</Text>
          <Text style={styles.msg}>Add one from the Schedule tab and start it there.</Text>
        </Centered>
      </Shell>
    );
  }

  return (
    <LiveGame key={shown.id} headerWith={headerWith}
      team={team} game={shown} roster={roster}
      rules={rules} config={config} names={names} />
  );
}

function LiveGame({ headerWith, team, game, roster, rules, config, names }) {
  // Own hook call rather than a prop: the readiness warnings link to the
  // Roster and Schedule tabs, and threading navigation down for that alone
  // would couple the parent to a detail of this component.
  const navigation = useNavigation();
  const sport = sportForTeam(team);
  // The one color this shared screen borrows from the active sport, rather
  // than deciding on its own what "selected" should look like. Derived from
  // `sport` above, not a second team lookup — this screen's own team prop is
  // already the correct source.
  const sportTheme = sportThemeOf(sport);
  const {
    Field, ActionPads, RunnerSheet, SCORING_MODES,
    describePeriod, describeCounters, describePeriodScores,
    describeParticipants, describeSubstitution, describeUpNext,
    describeFeedEntry, describeStatLine, EMPTY_FEED_TEXT,
  } = sport;
  const { user } = useAuth();
  const { height } = useWindowDimensions();

  const [mode, setMode] = useState(SCORING_MODES.FULL);
  const [runnerSheet, setRunnerSheet] = useState(null);
  // Which participant slot is being substituted, by key. Sport-neutral.
  const [subSheet, setSubSheet] = useState(null);
  /** The soundboard is sport-agnostic and always reachable during a live
      game — a crowd doesn't know which sport it's watching. */
  const [soundboard, setSoundboard] = useState(false);
  /**
   * Who the next scoring action applies to, for sports whose cards work as a
   * picker (basketball) rather than opening stats on tap (baseball). Lives
   * here rather than inside ActionPads because the card that shows the
   * orange "armed" state lives in this screen, not in the pad — one piece of
   * state, read by both.
   */
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [cardFor, setCardFor] = useState(null);
  const [muted, setMuted] = useState(false);
  const [playingFor, setPlayingFor] = useState(null);

  const { state, stats, canScore, isStale, record, undo, events } =
    useGame(team.id, game.id, { rules, config, names, sport });

  const byId = useMemo(
    () => Object.fromEntries(roster.map((p) => [p.playerId, p])), [roster]);

  // Trim config lives on the roster doc (synced); the audio itself is local.
  const audioConfig = useMemo(() => Object.fromEntries(
    roster.filter((p) => p.audioConfig).map((p) => [p.playerId, p.audioConfig])
  ), [roster]);

  const jerseyFor = useCallback((id) => {
    if (byId[id]) return byId[id].jerseyNumber ?? null;
    // opp_4 -> 4, so the diamond and the up-next strip aren't full of dashes
    // while the other team bats.
    const m = /^opp_(\d+)$/.exec(String(id));
    return m ? Number(m[1]) : null;
  }, [byId]);

  /** Roster player if we have one, otherwise a numbered opponent slot. */
  const personFor = useCallback((id) => {
    if (byId[id]) return byId[id];
    const m = /^opp_(\d+)$/.exec(String(id));
    if (!m) return null;
    return { playerId: id, jerseyNumber: Number(m[1]),
             firstName: 'Batter', lastName: m[1], primaryPosition: null };
  }, [byId]);

  // Only the device keeping the book plays anything — it's the one wired to
  // the speaker. Thirty phones in the bleachers would be chaos.
  useWalkUp({
    batterId: state?.batterId,
    // state.status, not game.status: the engine's own status is derived
    // straight from the event log and is never out of sync with it. The
    // Firestore document's status field is a separate write (from StartGate)
    // that exists for list views to query cheaply — it's supposed to agree,
    // but nothing enforces that at read time, and this component already has
    // the authoritative value sitting in scope.
    // Same fallback as the participants call below: state.status alone gets
    // permanently stuck at 'pending' for a game whose log is missing a
    // GAME_START event, and nothing server-side ever backfills that. See the
    // longer note there.
    enabled: canScore && !muted && (state?.status === 'live' || game.status === 'live'),
    audioConfig,
  });

  const handleUndo = useCallback(async () => {
    const ok = await confirm({
      title: 'Undo last entry?',
      message: 'Removes the most recent play from the book.',
      confirmLabel: 'Undo', destructive: true,
    });
    if (ok) undo();
  }, [undo]);

  /**
   * Readiness warnings.
   *
   * MUST stay above the early return below. Hooks have to run in the same
   * order on every render, and `state` is null on the first pass while the
   * game loads — a useMemo after that return runs on the second render and
   * not the first, which is React error #310.
   *
   * Recomputed rather than stored, so a coach who adds a player sees the
   * warning clear without leaving the screen.
   */
  const readiness = useMemo(
    () => checkGameReadiness(sport, roster, game?.lineup || [], rules),
    [sport, roster, game?.lineup, rules]);

  /**
   * The celebration banner. Also above the early return, for the same
   * hooks-ordering reason as readiness just above — state is null on the
   * first render while the game loads, and a hook placed after that return
   * would run on some renders and not others.
   *
   * lastSeenSeqRef starts at null specifically so the first real run adopts
   * wherever the log currently ends as a baseline WITHOUT celebrating
   * anything already in it — opening a game already in progress must not
   * replay every home run that's already happened. See momentDetection.js.
   */
  const [moment, setMoment] = useState(null);
  const lastSeenSeqRef = useRef(null);
  useEffect(() => {
    if (!state) return;
    const { moment: next, seq } = findNewMoment(
      events, lastSeenSeqRef.current, sport.describeMoment, state, { personFor });
    lastSeenSeqRef.current = seq;
    if (next) setMoment(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, state]);

  /**
   * The final whistle, celebrated once.
   *
   * Fires on the TRANSITION into final, never on arriving at a game that is
   * already over — same reasoning as the moment watermark above. Opening
   * last Saturday's box score should not throw confetti, and a parent
   * switching tabs during the handshake should not get it twice.
   */
  const [celebration, setCelebration] = useState(null);
  const wasFinalRef = useRef(null);
  useEffect(() => {
    if (!state) return;
    const isFinal = state.status === 'final';
    const first = wasFinalRef.current === null;
    wasFinalRef.current = isFinal;
    if (first || !isFinal) return;
    setCelebration(describeOutcome(state, game?.homeOrAway));
  }, [state?.status, state, game?.homeOrAway]);

  if (!state) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;

  /**
   * Everything this screen knows about the sport comes through the presenter.
   *
   * It used to read state.isTop, state.bases, state.battingIndex and
   * state.pitchers directly, which meant the "shared" screen was really a
   * baseball screen. Now the pack describes the period, the counters, the
   * score grid and the people involved, and this renders whatever it's given.
   */
  const period = describePeriod(state, rules);
  const counters = describeCounters(state, rules);
  const scoreGrid = describePeriodScores(state, rules);
  /**
   * The bug: this compared `game.status` — the Firestore document field,
   * written separately by StartGate as a convenience for list views — to
   * `'live'`, instead of using `state.status`, the engine's own status
   * derived straight from the event log. They're supposed to agree, but
   * nothing enforces that at read time, and `state` — the authoritative
   * value — was already sitting right here in scope.
   *
   * The visible effect: basketball's participant cards are the scoring
   * picker only when `selectableForScoring` is true, which only happens when
   * this `canScore` comes through as true. Whenever `game.status` didn't
   * read exactly 'live' — even though the game plainly was, and the rest of
   * the screen (ActionPads, the Start/Live gate) had no trouble agreeing on
   * that — every card silently fell back to its non-selectable behavior and
   * opened stats on tap instead of arming for scoring. Nothing crashed and
   * nothing looked obviously wrong; it just quietly used the wrong branch.
   */
  /**
   * canScore here checks BOTH state.status and game.status, not state.status
   * alone.
   *
   * state.status is the reliable source when it's available — that's what
   * the earlier fix here established, and it's still correct for any game
   * started under the current code. But it depends entirely on a GAME_START
   * event existing in that game's own history, and a game started before
   * THAT was fixed to actually record one has no such event and never will —
   * nothing server-side backfills it, so state.status is stuck at 'pending'
   * FOREVER for that specific game, no matter how many times the app is
   * redeployed. Scoring still works fine in that state (nothing in the
   * engine gates made shots or fouls on status), which is exactly why this
   * was so easy to miss: everything except card selection looked normal.
   *
   * game.status doesn't have this problem — StartGate has always written it
   * directly to the document regardless of the event log. Falling back to it
   * here means a game missing its GAME_START event still works correctly,
   * without needing to touch that game's history at all.
   */
  const participants = describeParticipants(state, rules, {
    personFor, homeOrAway: game.homeOrAway,
    canScore: canScore && (state.status === 'live' || game.status === 'live'),
  });

  const batting = participants.find((p) => p.key === 'batting');
  const batter = batting?.person;
  const batterStats = stats?.batting?.[batting?.playerId];
  const upNext = describeUpNext(state, { personFor });

  /**
   * The line under a participant's name. Baseball wants a batting line,
   * basketball wants points — so the sport writes it, not this screen.
   */
  const statLineFor = (p) =>
    describeStatLine(p.key, stats?.batting?.[p.playerId] ?? stats?.players?.[p.playerId]);

  // Small phones can't fit a large diamond plus three rows of buttons.
  const fieldSize = height < 700 ? 118 : height < 800 ? 136 : 150;

  /**
   * Every-pitch mode adds a label and a 56pt pitch row on top of everything
   * else, which is about 80pt more than outcome-only. On anything shorter than
   * a Pro Max — and on an installed PWA, where the tab bar and the home
   * indicator eat another 74 — that's the difference between fitting and not.
   * Compact trims the secondary keys rather than dropping any control.
   */
  /**
   * Both numbers below used to be one-size-fits-all constants tuned against
   * baseball. Basketball's control stack is taller even in casual mode — a
   * player picker, a box score, fouls, and opponent scoring — so it needs the
   * compact layout on more phones, and it has no field visual at all. Each
   * sport now says so itself rather than the screen guessing.
   */
  const compact = height < (sport.COMPACT_HEIGHT_THRESHOLD ?? 860);
  const showField = sport.HAS_FIELD_VISUAL !== false;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Absolutely positioned and non-interactive — see MomentBanner.jsx.
          Placed first so it overlays everything below regardless of where
          in the tree it sits. */}
      <MomentBanner moment={moment} teamColor={resolveTeamColor(team)} />

      <WinCelebration
        outcome={celebration}
        teamName={team?.name}
        opponent={game?.opponent}
        teamColor={resolveTeamColor(team)}
        onDismiss={() => setCelebration(null)}
      />

      {/* Inning, count and outs sit in the header's right slot — right
          justified, and one bar fewer on a screen where nothing scrolls. */}
      {headerWith(
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setSoundboard(true)}
            hitSlop={8} style={styles.soundBtn}
            accessibilityRole="button" accessibilityLabel="Open soundboard"
          >
            <Text style={styles.soundBtnText}>🔊</Text>
          </Pressable>
          <Scoreboard period={period} counters={counters} />
        </View>
      )}

      <LineScore
        grid={scoreGrid}
        awayName={game.homeOrAway === 'home' ? game.opponent : team.name}
        homeName={game.homeOrAway === 'home' ? team.name : game.opponent}
        muted={muted} onToggleMute={() => setMuted((m) => !m)}
        // Each sport names its own modes: baseball says "Every pitch" /
        // "Outcomes only", basketball "Full box score" / "Points only". This
        // used to be hardcoded baseball text on the shared screen.
        modeLabel={(sport.MODE_TRADEOFFS?.[mode]?.label || mode).toUpperCase()}
        onToggleMode={canScore
          ? () => setMode(mode === SCORING_MODES.FULL ? SCORING_MODES.CASUAL : SCORING_MODES.FULL)
          : null}
      />

      <BatonStrip
        game={game} teamId={team.id} uid={user?.uid}
        canScore={canScore} isStale={isStale} names={names}
      />

      <View style={styles.middle}>
        {/*
          Two layouts, chosen by how many participants the sport reports, not
          by which sport it is. Baseball's two cards (batter, pitcher) stack in
          a single full-width column, unchanged. A sport reporting more —
          basketball's five on the floor — wraps into a two-up grid instead,
          which is what actually reclaims the vertical space freed by dropping
          the court: five cards in a single column ran long enough on their
          own to matter regardless of anything beside them.
        */}
        <View style={[styles.leftCol, participants.length > 2 && styles.leftColGrid]}>
          {participants.map((p) => {
            const isBatter = p.key === 'batting';
            const person = p.person;
            const clip = person && audioConfig[person.playerId];
            const displayName = person ? `${person.firstName} ${person.lastName}` : 'Opponent';
            return (
              <View key={p.key}
                style={participants.length > 2 ? styles.personGridItem : styles.personFullItem}>
              <PersonCard
                label={p.detail && isBatter ? p.detail : p.label}
                jersey={person?.jerseyNumber}
                name={displayName}
                detail={statLineFor(p)
                  ?? (p.detail
                      ? `${p.detail}${p.substitutable ? ' · tap to change' : ''}`
                      : '—')}
                accent={p.accent === 'gold' ? colors.gold : colors.primary}
                warn={p.warn}
                /**
                 * Two different jobs for a tap, chosen per sport.
                 *
                 * Basketball's cards ARE the player picker now — tapping arms
                 * someone as the target for the next action, and a small icon
                 * opens their stats. Baseball's cards still open stats on tap
                 * (the engine already knows who's batting; nobody needs to
                 * pick them), with the icon reserved for substituting the
                 * pitcher. `selectableForScoring` is what the sport uses to
                 * say which behavior its cards want, so this screen never has
                 * to check which sport it's rendering.
                 */
                onPress={p.selectableForScoring
                  ? () => setSelectedPlayerId((cur) => (cur === p.playerId ? null : p.playerId))
                  : (person && byId[person.playerId] ? () => setCardFor(person) : null)}
                selected={p.selectableForScoring ? selectedPlayerId === p.playerId : undefined}
                showChevron={!p.selectableForScoring}
                onIcon={p.selectableForScoring
                  ? (person && byId[person.playerId] ? () => setCardFor(person) : null)
                  : (p.substitutable ? () => setSubSheet(p.key) : null)}
                iconGlyph={p.selectableForScoring ? '📊' : '⇄'}
                iconLabel={p.selectableForScoring ? `${displayName} stats` : `Substitute ${displayName}`}
                accentColor={sportTheme.accent}
                // Opponent slots are synthetic ids with no player record, so
                // stats are only offered for our own roster.
                // Auto-play fires once when the batter changes. This replays
                // it — for the kid who steps out, the song that didn't catch,
                // or the first tap before the browser has allowed audio.
                playing={isBatter && playingFor === person?.playerId}
                onPlay={isBatter && person && clip
                  ? () => {
                      const id = person.playerId;
                      if (playingFor === id) { stopClip(); setPlayingFor(null); return; }
                      const secs = clip.durationSeconds ?? 15;
                      playClip(id, { startSeconds: clip.startSeconds ?? 0, durationSeconds: secs })
                        .then((ok) => {
                          if (!ok) return;
                          setPlayingFor(id);
                          // Clear the pause state when the clip fades out.
                          setTimeout(() => setPlayingFor((cur) => (cur === id ? null : cur)), secs * 1000);
                        })
                        .catch(() => {});
                    }
                  : null}
              />
              </View>
            );
          })}
        </View>

        {/* A sport declares whether it wants a field/court visual at all —
            basketball doesn't (HAS_FIELD_VISUAL: false). The old court
            graphic took no taps and duplicated the fouls counter already in
            the header, so it cost real vertical space for nothing. */}
        {showField && (
          <View style={styles.rightCol}>
            <Field
              state={state}
              jerseyFor={jerseyFor}
              onPressRunner={(base, pid) => canScore && pid && setRunnerSheet({ base, playerId: pid })}
              interactive={canScore}
              size={fieldSize}
            />
          </View>
        )}
      </View>

      {game.status === 'scheduled' ? (
        <StartGate
          teamId={team.id} game={game} canScore={canScore} sport={sport}
          warnings={readiness}
          onStart={() => record(sport.EV.GAME_START, {})}
          onFix={(where) => navigation.navigate(where === 'roster' ? 'Roster' : 'Schedule')}
        />
      ) : canScore ? (
        <>
          {/* On deck / in the hole is rendered BEFORE the pads on purpose.
              Nothing on this screen scrolls, so whatever comes last is what
              falls off the bottom — and in every-pitch mode the pad stack is
              tall enough to do exactly that. Laying this out first guarantees
              it a slot; the pads shrink into what's left. */}
          <UpNext slots={upNext} />
          <ActionPads
            state={state} mode={mode} homeOrAway={game.homeOrAway}
            rules={rules} compact={compact}
            // The picker used to live inside ActionPads itself, duplicating
            // the same five players already shown as cards above it. Now the
            // cards ARE the picker (selectableForScoring), and the selection
            // lives in this screen so both can read it.
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={setSelectedPlayerId}
            participants={participants}
            onEvent={record} onUndo={handleUndo}
            onMore={() => setRunnerSheet({ base: null, playerId: null })}
            disabled={state.status === 'final'}
          />
        </>
      ) : (
        <ViewerPad state={state} describeFeed={describeFeedEntry} emptyText={EMPTY_FEED_TEXT} />
      )}

      <RunnerSheet
        visible={!!runnerSheet} context={runnerSheet} state={state} rules={rules}
        nameFor={(id) => names[id]} onEvent={record}
        onClose={() => setRunnerSheet(null)}
      />

      <SoundboardSheet visible={soundboard} onClose={() => setSoundboard(false)} sport={sport} />

      <PlayerCardScreen
        visible={!!cardFor}
        player={cardFor}
        team={team}
        // Today's numbers come from the live event log — the season document
        // doesn't move until the game is finalized.
        liveLine={cardFor ? stats?.batting?.[cardFor.playerId] : null}
        onClose={() => setCardFor(null)}
      />

      <SubstitutionSheet
        spec={subSheet
          ? describeSubstitution(state, rules, subSheet,
              { personFor, homeOrAway: game.homeOrAway })
          : null}
        onSelect={(playerId, eventType, extra) => {
          // Baseball's substitution needs only the incoming player; basketball
          // needs both sides of the swap, so the spec can attach whatever else
          // its engine requires rather than the screen knowing either sport.
          record(eventType, { playerId, ...(extra || {}) });
          setSubSheet(null);
        }}
        onClose={() => setSubSheet(null)}
      />
    </SafeAreaView>
  );
}

/**
 * The handoff strip.
 *
 * It only appears when there's something to act on: an incoming request, your
 * own pending request, or a stale feed. Holding the book quietly needs no
 * banner, and the mode toggle that used to share this bar has moved into the
 * scoreboard corner — so in the ordinary case this costs no vertical space at
 * all.
 */
function BatonStrip({ game, teamId, uid, canScore, isStale, names }) {
  const requester = game.batonRequestedBy;
  const iRequested = requester === uid;
  const incoming = canScore && requester && !iRequested;

  if (incoming) {
    return (
      <View style={styles.strip}>
        <Text style={styles.stripText} numberOfLines={1}>
          {names?.[requester] ? `${names[requester]} wants the book` : 'Someone asked for the book'}
        </Text>
        <View style={styles.stripBtns}>
          <Pressable onPress={() => denyBaton(teamId, game.id)} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>NOT NOW</Text>
          </Pressable>
          <Pressable onPress={() => approveBaton(teamId, game.id, requester)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>PASS IT</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (canScore) return null;   // keeping the book quietly needs no banner

  return (
    <View style={[styles.strip, isStale && styles.stripStale]}>
      <Text style={styles.stripText} numberOfLines={1}>
        {isStale ? 'Scorer may be offline — this may be behind' : 'Watching live'}
      </Text>
      {iRequested ? (
        <Pressable onPress={() => denyBaton(teamId, game.id)} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnText}>CANCEL REQUEST</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => requestBaton(teamId, game.id, uid)} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>ASK FOR THE BOOK</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * A game doesn't start itself. Someone taps Start — here or on Schedule — and
 * both screens reflect it, because both read the same status field.
 *
 * ── Why this also writes an event ───────────────────────────────────────────
 *
 * Starting used to set status:'live' on the game document and nothing else.
 * Baseball tolerated that because its screens read game.status, so the engine
 * sitting at status:'pending' forever never showed. Basketball's engine gates
 * minutes and substitutions on ITS OWN status, derived from the log — so a
 * basketball game looked started, and nothing worked.
 *
 * The event log is the source of truth for game state; the document field is a
 * convenience for list views. Starting has to write both.
 */
function StartGate({ teamId, game, canScore, sport, warnings, onFix, onStart }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      // Event first. If the document write fails the log still says the game
      // began, which is recoverable; the reverse leaves the engine dead.
      await onStart();
      await updateDoc(doc(db, 'teams', teamId, 'games', game.id),
        { status: 'live', actualStartAt: new Date() });
    } catch (e) { notify('Could not start', e.message); setBusy(false); }
  };

  const fieldWord = sport?.FIELD_WORD || 'Field';

  return (
    <View style={styles.gate}>
      <Text style={styles.gateTitle}>
        {game.homeOrAway === 'home' ? 'vs' : '@'} {game.opponent}
      </Text>
      <Text style={styles.gateSub}>
        {[whenText(game.date), game.location,
          game.field ? `${fieldWord} ${game.field}` : null]
          .filter(Boolean).join(' · ') || 'No details yet'}
      </Text>

      {/* Warnings, never blocks. A coach with seven kids is going to play the
          game regardless — refusing would send it to a paper scorebook and
          lose every stat that game would have produced. */}
      {canScore && warnings?.map((w) => (
        <Pressable key={w.key} onPress={() => onFix?.(w.fix)}
          style={[styles.warnCard, w.severity === 'high' && styles.warnCardHigh]}>
          <Text style={styles.warnTitle}>{w.title}</Text>
          <Text style={styles.warnBody}>{w.body}</Text>
        </Pressable>
      ))}

      {canScore ? (
        <Pressable onPress={start} disabled={busy} style={styles.gateBtn}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.gateBtnText}>START GAME</Text>}
        </Pressable>
      ) : (
        <Text style={styles.gateSub}>Waiting for a coach to start the game.</Text>
      )}
    </View>
  );
}

/**
 * On deck and in the hole. A scorekeeper is usually also the person shouting
 * "Jack, you're up next" — having it on screen saves them counting down the
 * lineup card between pitches.
 */
/** The read-only view for anyone who isn't holding the book. */
function ViewerPad({ state, describeFeed, emptyText }) {
  const plays = [...state.playByPlay].reverse().slice(0, 7);
  return (
    <View style={styles.viewer}>
      <Text style={styles.viewerLabel}>PLAY BY PLAY</Text>
      {plays.length === 0 && (
        <Text style={styles.viewerEmpty}>{emptyText}</Text>
      )}
      {plays.map((p, i) => {
        const row = describeFeed(p);
        return (
          <View key={i} style={styles.play}>
            <Text style={styles.playInning}>{row.marker}</Text>
            <Text style={styles.playText} numberOfLines={2}>{row.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One participant. Tappable when there's somewhere to go — a stats card for
 * anyone on our roster, or a substitution sheet for a slot the sport says can
 * be changed.
 */
function PersonCard({
  label, jersey, name, detail, accent, warn, onPlay, playing, onPress,
  onIcon, iconGlyph, iconLabel, selected, showChevron,
  // Sourced from the active sport's theme by the caller — this file has no
  // business knowing basketball's orange is basketball's orange.
  accentColor = colors.navy,
}) {
  const base = [
    styles.person,
    warn && styles.personWarn,
    // Selected wins over warn visually — the accent fill IS the "this is who
    // taps apply to" signal, and the foul count stays legible in the detail
    // line underneath rather than needing its own border color too.
    selected && { backgroundColor: accentColor, borderColor: accentColor },
  ];
  const body = (
    <PersonBody {...{
      label, jersey, name, detail, accent, warn, onPlay, playing,
      onIcon, iconGlyph, iconLabel, selected, showChevron: !!onPress && !!showChevron,
    }} />
  );

  if (!onPress) return <View style={base}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={selected != null
        ? `${name}${selected ? ', selected' : ''}. Tap to ${selected ? 'deselect' : 'select for scoring'}.`
        : `${label}: ${name}. Tap for stats.`}
      // Pressable takes a function for style; View does not — hence the split
      // above rather than one component handling both.
      style={({ pressed }) => [
        ...base, styles.personTappable, pressed && styles.personPressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

/** Card contents, shared by the tappable and non-tappable forms. */
function PersonBody({
  label, jersey, name, detail, accent, warn, onPlay, playing, showChevron,
  onIcon, iconGlyph, iconLabel, selected,
}) {
  return (
    <>
      <Text style={[styles.personLabel, selected && styles.personLabelSelected]}>
        {label}
      </Text>
      <View style={styles.personRow}>
        <View style={[
          styles.personJersey,
          { backgroundColor: selected ? '#FFFFFF38' : accent },
        ]}>
          <Text style={[styles.personJerseyText, selected && styles.personJerseyTextSelected]}>
            {jersey ?? '–'}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.personName, selected && styles.personNameSelected]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[
            styles.personDetail,
            warn && styles.personDetailWarn,
            selected && styles.personDetailSelected,
          ]} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        {onPlay && (
          <Pressable onPress={onPlay} style={[styles.playBtn, playing && styles.playBtnOn]}
            hitSlop={8} accessibilityRole="button"
            accessibilityLabel={playing ? 'Stop walk-up song' : 'Play walk-up song'}>
            <Text style={[styles.playBtnText, playing && styles.playBtnTextOn]}>
              {playing ? '❚❚' : '▶'}
            </Text>
          </Pressable>
        )}
        {onIcon && (
          /**
           * A second, independent tap target inside the card's own Pressable.
           * stopPropagation keeps this from also firing the card's onPress —
           * without it, tapping the icon would also arm or open the card
           * underneath it. What the icon DOES is entirely up to the caller:
           * baseball uses it for "substitute the pitcher"; basketball uses it
           * for "view stats" now that the card's own tap arms the player for
           * scoring instead.
           */
          <Pressable
            onPress={(e) => { e?.stopPropagation?.(); onIcon(); }}
            style={[styles.subBtn, selected && styles.subBtnSelected]} hitSlop={8}
            accessibilityRole="button" accessibilityLabel={iconLabel || `${name} options`}
          >
            <Text style={[styles.subBtnText, selected && styles.subBtnTextSelected]}>
              {iconGlyph || '⇄'}
            </Text>
          </Pressable>
        )}
        {showChevron && <Text style={styles.personChevron}>›</Text>}
      </View>
    </>
  );
}

function UpNext({ slots }) {
  if (!slots?.length) return null;

  const label = (p) => p ? `#${p.jerseyNumber ?? '–'} ${p.lastName || p.firstName}` : '—';

  return (
    <View style={styles.upNext}>
      {slots.map((slot, i) => (
        <React.Fragment key={slot.key}>
          {i > 0 && <View style={styles.upNextDivider} />}
          <View style={styles.upNextItem}>
            <Text style={styles.upNextLabel}>{slot.label}</Text>
            <Text style={styles.upNextName} numberOfLines={1}>{label(slot.person)}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * Substituting a player into a role.
 *
 * Was PitcherSheet, and knew about pitchers: it took a lineup, pitch counts
 * and rule limits, and hard-coded "Who's pitching?". That put a baseball
 * concept in the shared screen, so basketball couldn't have used it for the
 * subs it needs constantly.
 *
 * It now renders a spec the sport produces — title, options, and the event to
 * record. Baseball fills it with pitchers and pitch counts; another sport
 * fills it with whatever its bench looks like. The write still goes through
 * record() in the parent, so there's one path to the event log.
 */
function SubstitutionSheet({ spec, onSelect, onClose }) {
  if (!spec) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{spec.title}</Text>
        {spec.subtitle && <Text style={styles.sheetSub}>{spec.subtitle}</Text>}

        <ScrollView style={styles.sheetList}>
          {spec.options.length === 0 && (
            <Text style={styles.sheetEmpty}>{spec.emptyText}</Text>
          )}

          {spec.options.map((opt) => {
            const isCurrent = opt.playerId === spec.currentId;
            return (
              <Pressable
                key={opt.playerId}
                onPress={() => !isCurrent && onSelect(opt.playerId, spec.event, spec.extraPayload)}
                style={({ pressed }) => [
                  styles.pitcherRow,
                  isCurrent && styles.pitcherRowOn,
                  pressed && styles.keyPressedRow,
                ]}
              >
                <View style={[styles.personJersey, { backgroundColor: colors.gold }]}>
                  <Text style={styles.personJerseyText}>
                    {opt.person.jerseyNumber ?? '–'}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.pitcherName} numberOfLines={1}>
                    {opt.person.firstName} {opt.person.lastName}
                  </Text>
                  <Text style={[styles.pitcherDetail, opt.warn && styles.pitcherDetailWarn]}>
                    {opt.detail}{opt.warn && opt.warnLabel ? ` · ${opt.warnLabel}` : ''}
                  </Text>
                </View>
                {isCurrent && <Text style={styles.pitcherCurrent}>CURRENT</Text>}
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable onPress={onClose} style={styles.sheetDone}>
          <Text style={styles.sheetDoneText}>CANCEL</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function whenText(d) {
  const date = d?.toDate?.() ?? (d ? new Date(d) : null);
  if (!date || isNaN(date)) return null;
  const day = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Keeps the header on screen for the loading and empty states too. */
const Shell = ({ header, children }) => (
  <SafeAreaView style={styles.root} edges={['top']}>
    {header}
    {children}
  </SafeAreaView>
);

const Centered = ({ children }) => (
  <View style={styles.centered}>{children}</View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.chalk, padding: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 17,
    color: colors.navy, marginBottom: 6,
  },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center', lineHeight: 19 },

  strip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 8, gap: spacing.sm,
    backgroundColor: '#FFF7E6', borderBottomWidth: 1, borderBottomColor: '#E8D9AE',
  },
  stripStale: { backgroundColor: '#FDECEC', borderBottomColor: '#F3C9C9' },
  stripText: { ...text.bodyStrong, fontSize: 12, color: colors.navy, flexShrink: 1 },
  stripBtns: { flexDirection: 'row', gap: 6 },
  ghostBtn: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
  },
  ghostBtnText: { ...text.buttonSecondary, fontSize: 10, color: colors.pencil, letterSpacing: 0.6 },
  primaryBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: colors.navy,
  },
  primaryBtnText: { ...text.buttonSecondary, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  pending: { ...text.buttonSecondary, fontSize: 10, color: colors.pencil, letterSpacing: 0.6 },

  middle: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md,
  },
  leftCol: { flex: 1, gap: spacing.sm },
  // Chosen by participant count in the render, not by sport — see the JSX.
  leftColGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  personFullItem: { width: '100%' },
  personGridItem: { width: '48%' },
  rightCol: { alignItems: 'center', justifyContent: 'center' },

  person: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: 9, ...shadow.card,
  },
  personWarn: { borderColor: '#E5B33F', backgroundColor: '#FFFBF0' },
  personLabel: { ...text.label, fontSize: 8.5, color: colors.pencil, marginBottom: 5 },
  personLabelSelected: { color: '#FFFFFFCC' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personJersey: {
    width: 32, height: 32, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  personJerseyText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 14, color: '#FFF' },
  personJerseyTextSelected: { color: '#FFF' },
  personName: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 13.5, color: colors.navy },
  personNameSelected: { color: '#FFF' },
  personDetail: { ...text.body, fontSize: 11, color: colors.pencil, marginTop: 1 },
  personDetailWarn: { color: '#8A6A12', fontWeight: '700' },
  personDetailSelected: { color: '#FFFFFFDD', fontWeight: '600' },

  viewer: {
    flex: 1, marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, ...shadow.card,
  },
  viewerLabel: { ...text.label, color: colors.pencil, marginBottom: 8 },
  viewerEmpty: { ...text.body, color: colors.pencil, paddingVertical: 12 },
  play: {
    flexDirection: 'row', gap: 10, paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  playInning: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 10,
    color: colors.pencil, width: 26, paddingTop: 2,
  },
  playText: { ...text.body, fontSize: 13, flex: 1, lineHeight: 18 },

  upNext: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.md,
  },
  upNextItem: { flex: 1 },
  upNextDivider: { width: 1, height: 26, backgroundColor: colors.line, marginHorizontal: spacing.md },
  upNextLabel: { ...text.label, fontSize: 8, color: colors.pencil },
  upNextName: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 13, color: colors.navy, marginTop: 2 },

  gate: {
    flex: 1, margin: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', padding: spacing.xl, ...shadow.card,
  },
  gateTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 20, color: colors.navy },
  gateSub: { ...text.body, color: colors.pencil, marginTop: 6, textAlign: 'center' },
  warnCard: {
    backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#E8D9AE',
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
    width: '100%',
  },
  warnCardHigh: { backgroundColor: '#FDECEC', borderColor: '#E8B4B4' },
  warnTitle: { ...text.bodyStrong, fontSize: 13, color: colors.navy },
  warnBody: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 3, lineHeight: 16 },
  gateBtn: {
    marginTop: spacing.lg, height: 52, borderRadius: radius.md,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 34,
  },
  gateBtnText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },

  personTappable: { borderColor: colors.gold },
  personPressed: { transform: [{ scale: 0.985 }], backgroundColor: '#F0EDE6' },
  personChevron: { fontSize: 20, color: colors.pencil, marginLeft: 2, marginTop: -2 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, maxHeight: '80%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  sheetTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sheetSub: {
    ...text.body, fontSize: 12.5, color: colors.pencil,
    marginTop: 4, marginBottom: spacing.md, lineHeight: 17,
  },
  sheetList: { flexGrow: 0 },
  sheetEmpty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30 },
  sheetDone: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  sheetDoneText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },

  pitcherRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  pitcherRowOn: { borderColor: colors.gold, backgroundColor: '#FFFBF0' },
  keyPressedRow: { transform: [{ scale: 0.985 }], backgroundColor: '#F0EDE6' },
  pitcherName: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  pitcherDetail: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  pitcherDetailWarn: { color: colors.out, fontWeight: '700' },
  pitcherCurrent: { ...text.label, fontSize: 8, color: colors.gold },

  playBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnText: { fontSize: 12, color: colors.gold, marginLeft: 2 },
  playBtnOn: { backgroundColor: colors.gold },
  playBtnTextOn: { color: colors.navy, fontSize: 10, marginLeft: 0 },
  subBtn: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, marginLeft: 4,
  },
  subBtnText: { fontSize: 15, color: colors.pencil },
  subBtnSelected: { backgroundColor: '#FFFFFF38', borderColor: '#FFFFFF55' },
  subBtnTextSelected: { color: '#FFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soundBtn: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF1E',
  },
  soundBtnText: { fontSize: 15 },
});
