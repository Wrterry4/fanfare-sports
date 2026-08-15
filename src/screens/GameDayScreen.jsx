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

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import AppHeader from '../components/AppHeader.jsx';
import AccountSheet from '../components/AccountSheet.jsx';
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
  const sport = sportForTeam(team);
  const { Field, ActionPads, RunnerSheet, SCORING_MODES } = sport;
  const { user } = useAuth();
  const { height } = useWindowDimensions();

  const [mode, setMode] = useState(SCORING_MODES.FULL);
  const [runnerSheet, setRunnerSheet] = useState(null);
  const [muted, setMuted] = useState(false);
  const [playingFor, setPlayingFor] = useState(null);

  const { state, stats, canScore, isStale, record, undo } =
    useGame(team.id, game.id, { rules, config, names });

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
    enabled: canScore && !muted && game.status === 'live',
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

  if (!state) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;

  const battingSide = state.isTop ? 'away' : 'home';
  const batter = personFor(state.batterId);
  const batterStats = stats?.batting?.[state.batterId];
  const pitcherId = state.pitchers[state.isTop ? 'home' : 'away'];
  const pitcher = personFor(pitcherId);
  const pitchCount = state.pitchCounts[pitcherId] ?? 0;

  // Small phones can't fit a large diamond plus three rows of buttons.
  const fieldSize = height < 700 ? 118 : height < 800 ? 136 : 150;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Inning, count and outs sit in the header's right slot — right
          justified, and one bar fewer on a screen where nothing scrolls. */}
      {headerWith(<Scoreboard state={state} />)}

      <LineScore
        state={state} rules={rules}
        awayName={game.homeOrAway === 'home' ? game.opponent : team.name}
        homeName={game.homeOrAway === 'home' ? team.name : game.opponent}
        muted={muted} onToggleMute={() => setMuted((m) => !m)}
        modeLabel={mode === SCORING_MODES.FULL ? 'EVERY PITCH' : 'OUTCOMES ONLY'}
        onToggleMode={canScore
          ? () => setMode(mode === SCORING_MODES.FULL ? SCORING_MODES.CASUAL : SCORING_MODES.FULL)
          : null}
      />

      <BatonStrip
        game={game} teamId={team.id} uid={user?.uid}
        canScore={canScore} isStale={isStale} names={names}
      />

      <View style={styles.middle}>
        <View style={styles.leftCol}>
          <PersonCard
            label={`Batting ${ordinal(state.battingIndex[battingSide] + 1)}`}
            jersey={batter?.jerseyNumber}
            name={batter ? `${batter.firstName} ${batter.lastName}` : '—'}
            detail={batterStats
              ? `${batterStats.H}-for-${batterStats.AB}${batterStats.RBI ? `, ${batterStats.RBI} RBI` : ''}`
              : '0-for-0'}
            accent={colors.primary}
            // Auto-play fires once when the batter changes. This replays it —
            // for the kid who steps out, the song that didn't catch, or the
            // first tap of a session before the browser has allowed audio.
            playing={playingFor === batter?.playerId}
            onPlay={batter && audioConfig[batter.playerId]
              ? () => {
                  const id = batter.playerId;
                  if (playingFor === id) { stopClip(); setPlayingFor(null); return; }
                  const cfg = audioConfig[id];
                  const secs = cfg.durationSeconds ?? 15;
                  playClip(id, { startSeconds: cfg.startSeconds ?? 0, durationSeconds: secs })
                    .then((ok) => {
                      if (!ok) return;
                      setPlayingFor(id);
                      // Clear the pause state when the clip fades out on its own.
                      setTimeout(() => setPlayingFor((cur) => (cur === id ? null : cur)), secs * 1000);
                    })
                    .catch(() => {});
                }
              : null}
          />
          <PersonCard
            label="Pitching"
            jersey={pitcher?.jerseyNumber}
            name={pitcher ? `${pitcher.firstName} ${pitcher.lastName}` : 'Opponent'}
            detail={pitcher ? `${pitchCount} pitches` : '—'}
            accent={colors.gold}
            warn={!!rules.maxPitchesPerOuting && pitchCount >= rules.maxPitchesPerOuting}
          />
        </View>

        <View style={styles.rightCol}>
          <Field
            bases={state.bases}
            jerseyFor={jerseyFor}
            onPressRunner={(base, pid) => canScore && pid && setRunnerSheet({ base, playerId: pid })}
            interactive={canScore}
            size={fieldSize}
          />
        </View>
      </View>

      {game.status === 'scheduled' ? (
        <StartGate teamId={team.id} game={game} canScore={canScore} />
      ) : canScore ? (
        <>
          <ActionPads
            state={state} mode={mode} homeOrAway={game.homeOrAway}
            rules={rules}
            onEvent={record} onUndo={handleUndo}
            onMore={() => setRunnerSheet({ base: null, playerId: null })}
            disabled={state.status === 'final'}
          />
          <UpNext state={state} personFor={personFor} side={battingSide} />
        </>
      ) : (
        <ViewerPad state={state} />
      )}

      <RunnerSheet
        visible={!!runnerSheet} context={runnerSheet} state={state} rules={rules}
        nameFor={(id) => names[id]} onEvent={record}
        onClose={() => setRunnerSheet(null)}
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
 */
function StartGate({ teamId, game, canScore }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try { await updateDoc(doc(db, 'teams', teamId, 'games', game.id), { status: 'live', actualStartAt: new Date() }); }
    catch (e) { notify('Could not start', e.message); setBusy(false); }
  };
  return (
    <View style={styles.gate}>
      <Text style={styles.gateTitle}>
        {game.homeOrAway === 'home' ? 'vs' : '@'} {game.opponent}
      </Text>
      <Text style={styles.gateSub}>
        {[whenText(game.date), game.park, game.field ? `Field ${game.field}` : null]
          .filter(Boolean).join(' · ') || 'No details yet'}
      </Text>
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
function UpNext({ state, personFor, side }) {
  const lineup = state.lineups[side];
  if (!lineup?.length) return null;
  const idx = state.battingIndex[side];
  const at = (offset) => personFor(lineup[(idx + offset) % lineup.length]?.playerId);

  const onDeck = at(1);
  const inHole = at(2);

  const label = (p) => p ? `#${p.jerseyNumber ?? '–'} ${p.lastName || p.firstName}` : '—';

  return (
    <View style={styles.upNext}>
      <View style={styles.upNextItem}>
        <Text style={styles.upNextLabel}>ON DECK</Text>
        <Text style={styles.upNextName} numberOfLines={1}>{label(onDeck)}</Text>
      </View>
      <View style={styles.upNextDivider} />
      <View style={styles.upNextItem}>
        <Text style={styles.upNextLabel}>IN THE HOLE</Text>
        <Text style={styles.upNextName} numberOfLines={1}>{label(inHole)}</Text>
      </View>
    </View>
  );
}

/** What a spectator gets instead of the button pad: the story of the game. */
function ViewerPad({ state }) {
  const plays = [...state.playByPlay].reverse().slice(0, 7);
  return (
    <View style={styles.viewer}>
      <Text style={styles.viewerLabel}>PLAY BY PLAY</Text>
      {plays.length === 0 && <Text style={styles.viewerEmpty}>Waiting for the first pitch.</Text>}
      {plays.map((p, i) => (
        <View key={i} style={styles.play}>
          <Text style={styles.playInning}>
            {p.kind === 'lifecycle' ? '' : `${p.isTop ? 'T' : 'B'}${p.inning}`}
          </Text>
          <Text style={styles.playText} numberOfLines={2}>{p.text}</Text>
        </View>
      ))}
    </View>
  );
}

function PersonCard({ label, jersey, name, detail, accent, warn, onPlay, playing }) {
  return (
    <View style={[styles.person, warn && styles.personWarn]}>
      <Text style={styles.personLabel}>{label}</Text>
      <View style={styles.personRow}>
        <View style={[styles.personJersey, { backgroundColor: accent }]}>
          <Text style={styles.personJerseyText}>{jersey ?? '–'}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.personName} numberOfLines={1}>{name}</Text>
          <Text style={[styles.personDetail, warn && styles.personDetailWarn]} numberOfLines={1}>
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
      </View>
    </View>
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
  rightCol: { alignItems: 'center', justifyContent: 'center' },

  person: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: 9, ...shadow.card,
  },
  personWarn: { borderColor: '#E5B33F', backgroundColor: '#FFFBF0' },
  personLabel: { ...text.label, fontSize: 8.5, color: colors.pencil, marginBottom: 5 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personJersey: {
    width: 32, height: 32, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  personJerseyText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 14, color: '#FFF' },
  personName: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 13.5, color: colors.navy },
  personDetail: { ...text.body, fontSize: 11, color: colors.pencil, marginTop: 1 },
  personDetailWarn: { color: '#8A6A12', fontWeight: '700' },

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
  gateBtn: {
    marginTop: spacing.lg, height: 52, borderRadius: radius.md,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 34,
  },
  gateBtnText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },

  playBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnText: { fontSize: 12, color: colors.gold, marginLeft: 2 },
  playBtnOn: { backgroundColor: colors.gold },
  playBtnTextOn: { color: colors.navy, fontSize: 10, marginLeft: 0 },
});
