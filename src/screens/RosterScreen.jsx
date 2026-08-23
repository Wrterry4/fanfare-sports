/**
 * RosterScreen.jsx — Players and per-game batting orders.
 *
 * Add and edit are separate gestures with separate affordances:
 *
 *   ADD lives in the header and toggles to DONE. While it's open the form
 *   stays put and refocuses after each save, because entering a roster is a
 *   batch task — but it disappears the moment you're finished, instead of
 *   permanently eating the top of the screen.
 *
 *   EDIT expands the row you tapped. Editing player #14 in a field at the top
 *   of a scrolled list means losing sight of the thing you're editing.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';

import { db, doc, updateDoc, deleteDoc, serverTimestamp } from '../services/firebase';
import { useGameDay } from '../hooks/useGameDay.js';
import { createPlayer } from '../services/bootstrap.js';
import { confirm, notify } from '../utils/confirm.js';
import WalkUpSheet from '../components/WalkUpSheet.jsx';
import { hasClip } from '../services/audioStore';
import AppHeader, { HeaderButton, SegmentedTabs } from '../components/AppHeader.jsx';
import AccountSheet from '../components/AccountSheet.jsx';
import { useMyRole } from '../hooks/useMyRole.js';
import DraggableList, { ROW_HEIGHT } from '../components/DraggableList.jsx';
import LinkParentSheet from '../components/LinkParentSheet.jsx';
import ImportPlayersSheet from '../components/ImportPlayersSheet.jsx';
import PlayerCardScreen from './PlayerCardScreen.jsx';
import { sportForTeam } from '../sports/registry.js';
import { requestPlayerClaim, subscribeMyClaims } from '../services/membership.js';
import ScreenRoot from '../components/ScreenRoot.jsx';
import Centered from '../components/Centered.jsx';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { useTeamSurface, sportThemeOf } from '../theme/useSportTheme.js';
import { resolveTeamColor } from '../shared/teamColors.js';
import Jersey from '../components/Jersey.jsx';
import { inputStyle } from '../theme/inputs.js';
import { leftLabel } from '../shared/rosterStatus.js';


export default function RosterScreen() {
  const { team, game, allGames, roster, formerPlayers, loading } = useGameDay();
  const surface = useTeamSurface();
  const { isStaff, isFan } = useMyRole();
  const [tab, setTab] = useState('roster');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);

  if (loading) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;
  if (!team) return <Centered><Text style={styles.msg}>No team yet.</Text></Centered>;

  return (
    <ScreenRoot style={[styles.root, { backgroundColor: surface }]}>
      <AppHeader
        team={team}
        onMenu={() => setMenu(true)}
        right={tab === 'roster' && isStaff
          ? <HeaderButton label={adding ? 'DONE' : '+ ADD'} active={adding}
              onPress={() => setAdding((a) => !a)} />
          : null}
      />
      {/* Fans see the roster but not the Lineup tab, which is every game's
          batting order past and future. Their view of a lineup is the live one
          on Game Day — who's up today, not how the coach plans to bat the
          team in three weeks.

          This is a UI restriction, not an enforced one: `lineup` is a field on
          the game document and Firestore rules are document-level, so hiding a
          single field isn't possible without moving lineups into their own
          subdocument. Worth doing if it ever needs to be airtight. */}
      {!isFan && (
        <SegmentedTabs
          options={[['roster', 'Roster'], ['lineup', 'Lineup']]}
          value={tab} onChange={setTab}
        />
      )}
      <AccountSheet visible={menu} onClose={() => setMenu(false)} />

      {tab === 'roster' || isFan
        ? <RosterTab team={team} roster={roster} formerPlayers={formerPlayers}
                     adding={adding} onDoneAdding={() => setAdding(false)} />
        : <LineupTab team={team} games={allGames} currentGame={game} roster={roster} />}
    </ScreenRoot>
  );
}

// ---------------------------------------------------------------------------

function RosterTab({ team, roster, formerPlayers = [], adding, onDoneAdding }) {
  // Resolved here rather than in RosterScreen: this is the component that
  // renders the rows, and the shirt needs both the sport's silhouette and the
  // team's colours.
  const sportTheme = sportThemeOf(sportForTeam(team));
  const teamColors = resolveTeamColor(team);
  const { isStaff, linkedPlayerIds } = useMyRole();
  const [myClaims, setMyClaims] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [walkUp, setWalkUp] = useState(null);
  const [linkFor, setLinkFor] = useState(null);
  const [cardFor, setCardFor] = useState(null);
  const [importing, setImporting] = useState(false);
  const [withAudio, setWithAudio] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(roster.map(async (p) => [p.playerId, await hasClip(p.playerId)]))
      .then((pairs) => { if (!cancelled) setWithAudio(Object.fromEntries(pairs)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [roster.map((p) => p.playerId).join(',')]);

  useEffect(() => subscribeMyClaims(setMyClaims), []);

  const claimFor = useCallback((playerId) =>
    myClaims.find((c) => c.playerId === playerId && c.status === 'pending'),
    [myClaims]);

  const claim = useCallback(async (player, kind) => {
    try {
      await requestPlayerClaim({ teamId: team.id, playerId: player.playerId, kind });
      notify('Request sent', `A coach will confirm you're linked to ${player.firstName}.`);
    } catch (e) { notify('Could not send', e.message); }
  }, [team.id]);

  const saveWalkUp = useCallback(async (cfg) => {
    if (!walkUp) return;
    try {
      await updateDoc(doc(db, 'teams', team.id, 'roster', walkUp.playerId), { audioConfig: cfg });
      setWithAudio((w) => ({ ...w, [walkUp.playerId]: !!cfg }));
    } catch (e) { notify('Could not save', e.message); }
  }, [team.id, walkUp]);

  /**
   * Leaving, not deleting.
   *
   * Deleting the roster entry took the player's NAME with it — it's the only
   * copy the whole team can read — so every box score they appeared in fell
   * back to a raw id. They come off every current-squad list and stay in the
   * record. See shared/rosterStatus.js.
   */
  const leave = useCallback(async (p) => {
    const ok = await confirm({
      title: `${p.firstName} left the team?`,
      message: 'They come off the roster and lineups. Their games, stats and '
             + 'name stay in the record, and you can bring them back.',
      confirmLabel: 'They left', destructive: true,
    });
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'teams', team.id, 'roster', p.playerId), {
        active: false, leftAt: serverTimestamp(),
      });
      setEditingId(null);
    } catch (e) { notify('Could not update', e.message); }
  }, [team.id]);

  const bringBack = useCallback(async (p) => {
    try {
      // The number is deliberately not restored — someone else is probably
      // wearing it by now.
      await updateDoc(doc(db, 'teams', team.id, 'roster', p.playerId), {
        active: true, leftAt: null,
      });
    } catch (e) { notify('Could not update', e.message); }
  }, [team.id]);

  /**
   * The escape hatch for a player added by mistake, and only reachable from
   * the former-players list. A wrong name typed this morning shouldn't be
   * preserved for the record forever — but a real player must never be one
   * tap from erasure, which is why it isn't offered on the squad itself.
   */
  const deleteForever = useCallback(async (p) => {
    const ok = await confirm({
      title: `Delete ${p.firstName} ${p.lastName || ''}`.trim() + '?',
      message: "For a player added by mistake. Their name comes out of every "
             + 'game they appear in. Their own record and career stats are kept.',
      confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'teams', team.id, 'roster', p.playerId));
    } catch (e) { notify('Could not delete', e.message); }
  }, [team.id]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {adding && isStaff && <AddPlayerForm team={team} onDone={onDoneAdding} />}

        {/* An empty roster is the one moment importing is worth more than
            typing, so on a new team it's a card rather than a line of text
            under a button people have to notice first. */}
        {roster.length === 0 && !adding && isStaff && (
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>Start your roster</Text>
            <Text style={styles.startBody}>
              Type players in with ADD above — or bring them over from another
              team you coach. Imported players keep their stats, career history
              and parent links.
            </Text>
            <Pressable onPress={() => setImporting(true)} style={styles.cta}
              accessibilityRole="button">
              <Text style={styles.ctaText}>⤓ IMPORT FROM ANOTHER TEAM</Text>
            </Pressable>
          </View>
        )}

        {roster.length === 0 && !adding && !isStaff && (
          <Text style={styles.empty}>No players yet.</Text>
        )}

        {/* Once there are players, ADD is the common action and this steps
            back to a quiet second. */}
        {roster.length > 0 && isStaff && (
          <Pressable onPress={() => setImporting(true)}
            style={[styles.cta, styles.ctaGhost, styles.importBtn]}
            accessibilityRole="button">
            <Text style={[styles.ctaText, { color: colors.primary }]}>
              ⤓ IMPORT FROM ANOTHER TEAM
            </Text>
          </Pressable>
        )}

        {roster.map((p) => (
          <PlayerRow
            key={p.playerId}
            player={p}
            team={team}
            sportTheme={sportTheme}
            teamColors={teamColors}
            expanded={editingId === p.playerId}
            hasAudio={!!withAudio[p.playerId]}
            canEdit={isStaff}
            linked={linkedPlayerIds.includes(p.playerId)}
            pendingClaim={!!claimFor(p.playerId)}
            onClaim={(kind) => claim(p, kind)}
            onStats={() => setCardFor(p)}
            onToggle={() => setEditingId(editingId === p.playerId ? null : p.playerId)}
            onWalkUp={() => setWalkUp(p)}
            onLink={() => setLinkFor(p)}
            onRemove={() => leave(p)}
          />
        ))}
        {formerPlayers.length > 0 && (
          <View style={styles.formerBlock}>
            <Text style={styles.formerHead}>
              LEFT THE TEAM · {formerPlayers.length}
            </Text>
            {formerPlayers.map((p) => (
              <View key={p.playerId} style={[styles.card, styles.formerRow]}>
                <View style={styles.flex}>
                  <Text style={styles.formerName}>
                    {p.firstName} {p.lastName}
                  </Text>
                  <Text style={styles.meta}>{leftLabel(p)}</Text>
                </View>
                {/* Their stats are still worth reading — that's the point of
                    keeping them. */}
                <Pressable onPress={() => setCardFor(p)} style={styles.iconBtn} hitSlop={6}
                           accessibilityRole="button"
                           accessibilityLabel={`${p.firstName}'s stats`}>
                  <Text style={styles.iconBtnText}>📊</Text>
                </Pressable>
                {isStaff && (
                  <>
                    <Pressable onPress={() => bringBack(p)} style={styles.iconBtn} hitSlop={6}>
                      <Text style={styles.iconBtnText}>BACK</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteForever(p)} style={styles.iconBtn} hitSlop={6}>
                      <Text style={[styles.iconBtnText, { color: colors.out }]}>DELETE</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <PlayerCardScreen
        visible={!!cardFor}
        player={cardFor}
        team={team}
        onClose={() => setCardFor(null)}
      />

      {/* Mounted only while open: the sheet subscribes to your membership on
          every team to work out which ones you coach, and that has no business
          running while nobody's importing. */}
      {importing && (
        <ImportPlayersSheet
          visible
          team={team}
          roster={roster}
          onClose={() => setImporting(false)}
        />
      )}

      <LinkParentSheet
        visible={!!linkFor}
        teamId={team.id}
        player={linkFor}
        onClose={() => setLinkFor(null)}
      />

      <WalkUpSheet
        visible={!!walkUp}
        player={walkUp}
        config={roster.find((p) => p.playerId === walkUp?.playerId)?.audioConfig}
        onSave={saveWalkUp}
        onClose={() => setWalkUp(null)}
      />
    </KeyboardAvoidingView>
  );
}

/** Stays open across saves and refocuses the number field. */
function AddPlayerForm({ team, onDone }) {
  // Baseball offers P/C/1B/…, basketball PG/SG/SF/PF/C. The list belongs to
  // the sport, not to this screen.
  const positions = sportForTeam(team).POSITIONS || [];
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const jerseyRef = useRef(null);

  const save = useCallback(async () => {
    if (!first.trim()) { notify('Add a first name.'); return; }
    setBusy(true);
    try {
      await createPlayer({
        teamId: team.id, firstName: first, lastName: last,
        jerseyNumber: jersey ? parseInt(jersey, 10) : null,
        primaryPosition: position,
      });
      setFirst(''); setLast(''); setJersey(''); setPosition(null);
      setAdded((n) => n + 1);
      setTimeout(() => jerseyRef.current?.focus(), 60);
    } catch (e) { notify('Could not add', e.message); }
    setBusy(false);
  }, [team.id, first, last, jersey, position]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>
        Add player{added > 0 ? ` · ${added} added` : ''}
      </Text>
      <PlayerFields
        jerseyRef={jerseyRef}
        jersey={jersey} setJersey={setJersey}
        first={first} setFirst={setFirst}
        last={last} setLast={setLast}
        position={position} setPosition={setPosition}
        positions={positions}
        onSubmit={save}
      />
      <View style={styles.formBtns}>
        <Pressable onPress={onDone} style={[styles.cta, styles.ctaGhost]}>
          <Text style={[styles.ctaText, { color: colors.pencil }]}>DONE</Text>
        </Pressable>
        <Pressable onPress={save} disabled={busy} style={[styles.cta, styles.flex]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>ADD & NEXT</Text>}
        </Pressable>
      </View>
    </View>
  );
}

/** Tapping a row expands it in place. */
function PlayerRow({ player, team, sportTheme, teamColors, expanded, hasAudio, canEdit, linked, pendingClaim,
                     onClaim, onToggle, onWalkUp, onLink, onRemove, onStats }) {
  const positions = sportForTeam(team).POSITIONS || [];
  const [first, setFirst] = useState(player.firstName || '');
  const [last, setLast] = useState(player.lastName || '');
  const [jersey, setJersey] = useState(player.jerseyNumber != null ? String(player.jerseyNumber) : '');
  const [position, setPosition] = useState(player.primaryPosition || null);
  const [busy, setBusy] = useState(false);

  // Re-seed when the row opens, so a cancelled edit doesn't leave stale text.
  useEffect(() => {
    if (!expanded) return;
    setFirst(player.firstName || '');
    setLast(player.lastName || '');
    setJersey(player.jerseyNumber != null ? String(player.jerseyNumber) : '');
    setPosition(player.primaryPosition || null);
  }, [expanded, player.playerId]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'players', player.playerId), {
        firstName: first.trim(), lastName: last.trim(),
      });
      await updateDoc(doc(db, 'teams', team.id, 'roster', player.playerId), {
        // Kept in step with /players so every member can still read a name.
        firstName: first.trim(),
        lastName: last.trim(),
        jerseyNumber: jersey ? parseInt(jersey, 10) : null,
        primaryPosition: position,
      });
      onToggle();
    } catch (e) { notify('Could not save', e.message); }
    setBusy(false);
  }, [player.playerId, team.id, first, last, jersey, position, onToggle]);

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      <Pressable onPress={onToggle} style={styles.cardHead}>
        {/* The same shirt the diamond and the batter card draw, so a number
            means one person everywhere it appears. */}
        <Jersey
          kind={sportTheme.jersey}
          colors={teamColors}
          number={player.jerseyNumber ?? '–'}
          size={40}
        />
        <View style={styles.flex}>
          <Text style={styles.name}>{player.firstName} {player.lastName}</Text>
          <Text style={styles.meta}>
            {player.primaryPosition || 'No position'}
            {hasAudio ? ' · walk-up set' : ''}
          </Text>
        </View>
        {/* Open to every member, fans included — the card is a team-wide
            scorebook, so gating this on canEdit or linked would contradict it. */}
        <Pressable onPress={onStats} style={styles.iconBtn} hitSlop={6}
                   accessibilityRole="button"
                   accessibilityLabel={`${player.firstName}'s stats`}>
          <Text style={styles.iconBtnText}>📊</Text>
        </Pressable>
        {(canEdit || linked) && (
          <Pressable onPress={onWalkUp} style={[styles.iconBtn, hasAudio && styles.iconBtnOn]}>
            <Text style={[styles.iconBtnText, hasAudio && styles.iconBtnTextOn]}>♪</Text>
          </Pressable>
        )}
        <Text style={styles.chev}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>

      {expanded && !canEdit && (
        <View style={styles.cardBody}>
          {linked ? (
            <Text style={styles.claimNote}>You're linked to this player.</Text>
          ) : pendingClaim ? (
            <Text style={styles.claimNote}>Request sent — waiting on a coach.</Text>
          ) : (
            <>
              <Text style={styles.claimNote}>
                Ask a coach to link you to {player.firstName} so you can see
                their stats and get game alerts.
              </Text>
              <View style={styles.formBtns}>
                <Pressable onPress={() => onClaim('parent')} style={[styles.cta, styles.flex]}>
                  <Text style={styles.ctaText}>I'M A PARENT</Text>
                </Pressable>
                <Pressable onPress={() => onClaim('fan')} style={[styles.cta, styles.ctaGhost]}>
                  <Text style={[styles.ctaText, { color: colors.pencil }]}>I'M A FAN</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {expanded && canEdit && (
        <View style={styles.cardBody}>
          <PlayerFields
            jersey={jersey} setJersey={setJersey}
            first={first} setFirst={setFirst}
            last={last} setLast={setLast}
            position={position} setPosition={setPosition}
            positions={positions}
            onSubmit={save}
          />
          <Pressable onPress={onLink} style={[styles.cta, styles.ctaGhost, { marginBottom: spacing.sm }]}>
            <Text style={[styles.ctaText, { color: colors.primary }]}>
              WHO FOLLOWS {player.firstName?.toUpperCase()}?
            </Text>
          </Pressable>

          <View style={styles.formBtns}>
            <Pressable onPress={onRemove} style={[styles.cta, styles.ctaGhost]}>
              <Text style={[styles.ctaText, { color: colors.out }]}>LEFT TEAM</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} style={[styles.cta, styles.flex]}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>SAVE</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function PlayerFields({ jerseyRef, jersey, setJersey, first, setFirst, last, setLast,
                        position, setPosition, onSubmit, positions = [] }) {
  return (
    <>
      <View style={styles.row}>
        <View style={{ width: 74 }}>
          <Text style={styles.label}>#</Text>
          <TextInput ref={jerseyRef} value={jersey} onChangeText={setJersey}
            keyboardType="number-pad" style={inputStyle}
            placeholder="12" placeholderTextColor="#A0A8B8" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>First</Text>
          <TextInput value={first} onChangeText={setFirst} style={inputStyle}
            placeholder="Jack" placeholderTextColor="#A0A8B8" autoCapitalize="words" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Last</Text>
          <TextInput value={last} onChangeText={setLast} style={inputStyle}
            placeholder="Miller" placeholderTextColor="#A0A8B8" autoCapitalize="words"
            onSubmitEditing={onSubmit} returnKeyType="done" />
        </View>
      </View>

      <Text style={[styles.label, { marginTop: spacing.md }]}>Position</Text>
      <View style={styles.chips}>
        {positions.map((p) => (
          <Pressable key={p} onPress={() => setPosition(p === position ? null : p)}
            style={[styles.chip, position === p && styles.chipOn]}>
            <Text style={[styles.chipText, position === p && styles.chipTextOn]}>{p}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * Lineups belong to a game, not the team — the order changes week to week and
 * a finished game's order is part of its record. Past games are shown for
 * reference and can't be edited.
 */
function LineupTab({ team, games, currentGame, roster }) {
  // Past games are reference material, not the common case — they're behind a
  // toggle so the picker isn't cluttered with a whole season by August.
  const [showPast, setShowPast] = useState(false);
  const isPast = (g) => g.status === 'final' || g.status === 'amended';
  const upcoming = (games || []).filter((g) => !isPast(g));
  const past = (games || []).filter(isPast);
  const visible = showPast ? past : upcoming;

  const [selectedId, setSelectedId] = useState(currentGame?.id ?? games?.[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState([]);
  const [out, setOut] = useState([]);

  const game = useMemo(
    () => games?.find((g) => g.id === selectedId) ?? null, [games, selectedId]);
  const locked = game?.status === 'final' || game?.status === 'amended';

  const byId = useMemo(
    () => Object.fromEntries(roster.map((p) => [p.playerId, p])), [roster]);

  useEffect(() => {
    if (!game) return;
    const saved = game.lineup?.length ? game.lineup.map((s) => s.playerId) : null;
    const all = roster.map((p) => p.playerId);
    setOrder(saved ?? all);
    setOut(saved ? all.filter((id) => !saved.includes(id)) : []);
  }, [game?.id, roster.length]);

  const toggle = (id) => {
    if (locked) return;
    setOut((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);
  };

  const save = async () => {
    if (!game || locked) return;
    setSaving(true);
    try {
      const lineup = order.filter((id) => !out.includes(id)).map((id, i) => ({
        playerId: id, battingOrder: i + 1, position: byId[id]?.primaryPosition ?? null,
      }));
      await updateDoc(doc(db, 'teams', team.id, 'games', game.id), {
        lineup, lineupLockedAt: new Date(),
      });
      notify('Lineup saved', `${lineup.length} in the order for ${game.opponent}.`);
    } catch (e) { notify('Could not save', e.message); }
    setSaving(false);
  };

  if (!games?.length) {
    return (
      <Centered inset={false}>
        <Text style={styles.msg}>Add a game first, then set its lineup.</Text>
      </Centered>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.lineupHead}>
        <Text style={styles.label}>Game</Text>
        <View style={styles.miniTabs}>
          <Pressable onPress={() => setShowPast(false)}
            style={[styles.miniTab, !showPast && styles.miniTabOn]}>
            <Text style={[styles.miniTabText, !showPast && styles.miniTabTextOn]}>
              Upcoming
            </Text>
          </Pressable>
          <Pressable onPress={() => setShowPast(true)}
            style={[styles.miniTab, showPast && styles.miniTabOn]}>
            <Text style={[styles.miniTabText, showPast && styles.miniTabTextOn]}>
              Past{past.length ? ` · ${past.length}` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {visible.length === 0 && (
        <Text style={styles.empty}>
          {showPast ? 'No finished games yet.' : 'No upcoming games.'}
        </Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gameChips}>
        {visible.map((g) => {
          const isFinal = g.status === 'final' || g.status === 'amended';
          return (
            <Pressable key={g.id} onPress={() => setSelectedId(g.id)}
              style={[styles.gameChip, selectedId === g.id && styles.gameChipOn,
                      isFinal && styles.gameChipPast]}>
              <Text style={[styles.gameChipText, selectedId === g.id && styles.gameChipTextOn]}>
                {g.homeOrAway === 'home' ? 'vs' : '@'} {g.opponent}
              </Text>
              <Text style={[styles.gameChipSub, selectedId === g.id && styles.gameChipTextOn]}>
                {isFinal ? 'final' : g.status === 'live' ? 'live' : shortDate(g.date)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {locked && (
        <Text style={styles.lockedNote}>
          This game is finished. Its batting order is part of the record and
          can't be changed.
        </Text>
      )}

      {!locked && (
        <Text style={styles.lineupHint}>
          Tap a name to sit them. Arrows reorder.
        </Text>
      )}

      <DraggableList
        items={order}
        disabled={locked}
        keyExtractor={(id) => id}
        onReorder={setOrder}
        renderItem={(id, i, isDragging) => {
          const p = byId[id];
          if (!p) return null;
          const sitting = out.includes(id);
          const battingPos = order.filter((x, k) => k < i && !out.includes(x)).length + 1;
          return (
            <View style={[styles.card, styles.lineupRow, sitting && styles.cardOut,
                          locked && styles.cardLocked, isDragging && styles.cardDragging]}>
              <Text style={styles.orderNum}>{sitting ? '–' : battingPos}</Text>
              <Pressable onPress={() => toggle(id)} style={styles.flex} disabled={locked}>
                <Text style={[styles.name, sitting && styles.nameOut]}>
                  #{p.jerseyNumber ?? '–'} {p.firstName} {p.lastName}
                </Text>
                <Text style={styles.meta}>
                  {sitting ? 'Not batting' : (p.primaryPosition || 'No position')}
                </Text>
              </Pressable>
              {!locked && <Text style={styles.grip}>⠿</Text>}
            </View>
          );
        }}
      />

      {!locked && (
        <Pressable onPress={save} disabled={saving} style={[styles.cta, { marginTop: spacing.md }]}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>SAVE LINEUP</Text>}
        </Pressable>
      )}
    </ScrollView>
  );
}

const shortDate = (d) => {
  const date = d?.toDate?.() ?? (d ? new Date(d) : null);
  if (!date || isNaN(date)) return '—';
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  header: { backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  h1: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 18, color: '#FFF' },
  headerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.14)' },
  headerBtnOn: { backgroundColor: colors.gold },
  headerBtnText: { ...text.buttonSecondary, fontSize: 11, color: '#FFF', letterSpacing: 0.8 },
  headerBtnTextOn: { color: colors.navy },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)' },
  tabOn: { backgroundColor: '#FFF' },
  tabText: { ...text.bodyStrong, fontSize: 12.5, color: '#A8B0C6' },
  tabTextOn: { color: colors.navy },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  form: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  formTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 12, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  formBtns: { flexDirection: 'row', gap: spacing.sm },
  cta: { height: 46, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, marginBottom: spacing.sm, ...shadow.card },
  cardExpanded: { borderColor: colors.primary },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  cardBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  cardOut: { opacity: 0.5 },
  cardLocked: { backgroundColor: '#F4F5F7' },
  lineupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: ROW_HEIGHT - 8, marginBottom: 0 },
  jersey: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  jerseyText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 16, color: '#FFF' },
  orderNum: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 16, color: colors.pencil, width: 26, textAlign: 'center' },
  name: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  nameOut: { textDecorationLine: 'line-through' },
  meta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  iconBtnText: { ...text.buttonSecondary, fontSize: 11, color: colors.pencil },
  iconBtnOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  iconBtnTextOn: { color: colors.navy, fontSize: 14 },
  chev: { fontSize: 16, color: colors.pencil, paddingHorizontal: 4 },
  importBtn: { borderColor: colors.primary, marginBottom: spacing.md },
  startCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
    ...shadow.card,
  },
  startTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 16, color: colors.navy },
  startBody: { ...text.body, fontSize: 12.5, color: colors.pencil, lineHeight: 18, marginTop: 6, marginBottom: spacing.md },
  formerBlock: { marginTop: spacing.xl },
  formerHead: { ...text.label, color: colors.pencil, marginBottom: spacing.sm },
  formerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, opacity: 0.7 },
  formerName: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.pencil },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30 },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center' },
  lineupHint: { ...text.body, fontSize: 12.5, color: colors.pencil, marginBottom: spacing.md, lineHeight: 18 },
  claimNote: { ...text.body, fontSize: 13, color: colors.navy, lineHeight: 19, marginBottom: spacing.md },
  lineupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  miniTabs: { flexDirection: 'row', gap: 5 },
  miniTab: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  miniTabOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  miniTabText: { ...text.bodyStrong, fontSize: 11.5, color: colors.pencil },
  miniTabTextOn: { color: '#FFF' },
  cardDragging: { borderColor: colors.primary, borderWidth: 2 },
  grip: { fontSize: 18, color: colors.line, paddingHorizontal: 6 },
  lockedNote: { ...text.body, fontSize: 12.5, color: '#8A6A12', backgroundColor: '#FFF7E6', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, lineHeight: 17 },
  gameChips: { gap: 7, paddingBottom: spacing.md },
  gameChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, minWidth: 108 },
  gameChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  gameChipPast: { opacity: 0.65 },
  gameChipText: { ...text.bodyStrong, fontSize: 13, color: colors.navy },
  gameChipSub: { ...text.body, fontSize: 10.5, color: colors.pencil, marginTop: 2 },
  gameChipTextOn: { color: '#FFF' },
});
