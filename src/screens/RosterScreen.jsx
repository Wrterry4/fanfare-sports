/**
 * RosterScreen.jsx — Players and the batting order.
 *
 * Two tabs. Roster is the season list: add, edit, remove. Lineup is per-game:
 * who's in, and in what order.
 *
 * The add form stays open after each save and refocuses the number field —
 * typing in fifteen players should be fifteen entries, not fifteen round trips
 * through a button.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db, doc, updateDoc, deleteDoc } from '../services/firebase';
import { useGameDay } from '../hooks/useGameDay.js';
import { createPlayer } from '../services/bootstrap.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

const POSITIONS = ['P','C','1B','2B','3B','SS','LF','CF','RF','DH'];

export default function RosterScreen() {
  const { team, game, roster, loading } = useGameDay();
  const [tab, setTab] = useState('roster');

  if (loading) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;
  if (!team) return <Centered><Text style={styles.msg}>No team yet.</Text></Centered>;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>{team.name}</Text>
        <View style={styles.tabs}>
          {[['roster', 'Roster'], ['lineup', 'Lineup']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)}
              style={[styles.tab, tab === k && styles.tabOn]}>
              <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'roster'
        ? <RosterTab team={team} roster={roster} />
        : <LineupTab team={team} game={game} roster={roster} />}
    </SafeAreaView>
  );
}

function RosterTab({ team, roster }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState(null);
  const jerseyRef = useRef(null);

  const reset = () => {
    setFirst(''); setLast(''); setJersey(''); setPosition(null); setEditing(null);
  };

  const save = useCallback(async () => {
    if (!first.trim()) { Alert.alert('Add a first name.'); return; }
    setBusy(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'players', editing), {
          firstName: first.trim(), lastName: last.trim(),
        });
        await updateDoc(doc(db, 'teams', team.id, 'roster', editing), {
          jerseyNumber: jersey ? parseInt(jersey, 10) : null,
          primaryPosition: position,
        });
      } else {
        await createPlayer({
          teamId: team.id, firstName: first, lastName: last,
          jerseyNumber: jersey ? parseInt(jersey, 10) : null,
          primaryPosition: position,
        });
      }
      reset();
      // Stay in the form and refocus — entering a roster is a batch task.
      setTimeout(() => jerseyRef.current?.focus(), 60);
    } catch (e) { Alert.alert('Could not save', e.message); }
    setBusy(false);
  }, [team.id, first, last, jersey, position, editing]);

  const beginEdit = (p) => {
    setEditing(p.playerId);
    setFirst(p.firstName || ''); setLast(p.lastName || '');
    setJersey(p.jerseyNumber != null ? String(p.jerseyNumber) : '');
    setPosition(p.primaryPosition || null);
  };

  const remove = (p) => {
    Alert.alert(
      `Remove ${p.firstName}?`,
      'Takes them off this roster. Their stats and history are kept.',
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Remove', style: 'destructive', onPress: async () => {
           try { await deleteDoc(doc(db, 'teams', team.id, 'roster', p.playerId)); }
           catch (e) { Alert.alert('Could not remove', e.message); }
         } }]
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editing ? 'Edit player' : 'Add player'}</Text>
          <View style={styles.row}>
            <View style={{ width: 76 }}>
              <Text style={styles.label}>#</Text>
              <TextInput ref={jerseyRef} value={jersey} onChangeText={setJersey}
                keyboardType="number-pad" style={inputStyle}
                placeholder="12" placeholderTextColor="#A0A8B8" returnKeyType="next" />
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
                onSubmitEditing={save} returnKeyType="done" />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Position</Text>
          <View style={styles.chips}>
            {POSITIONS.map((p) => (
              <Pressable key={p} onPress={() => setPosition(p === position ? null : p)}
                style={[styles.chip, position === p && styles.chipOn]}>
                <Text style={[styles.chipText, position === p && styles.chipTextOn]}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.formBtns}>
            {editing && (
              <Pressable onPress={reset} style={[styles.cta, styles.ctaGhost]}>
                <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
              </Pressable>
            )}
            <Pressable onPress={save} disabled={busy} style={[styles.cta, styles.flex]}>
              {busy ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.ctaText}>{editing ? 'SAVE' : 'ADD & NEXT'}</Text>}
            </Pressable>
          </View>
        </View>

        {roster.length === 0 && <Text style={styles.empty}>No players yet.</Text>}

        {roster.map((p) => (
          <View key={p.playerId} style={[styles.card, editing === p.playerId && styles.cardEditing]}>
            <View style={styles.jersey}>
              <Text style={styles.jerseyText}>{p.jerseyNumber ?? '–'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{p.firstName} {p.lastName}</Text>
              <Text style={styles.meta}>
                {p.primaryPosition || 'No position'}
                {p.guardianUserIds?.length ? ' · parent linked' : ''}
              </Text>
            </View>
            <Pressable onPress={() => beginEdit(p)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>EDIT</Text>
            </Pressable>
            <Pressable onPress={() => remove(p)} style={styles.iconBtn}>
              <Text style={[styles.iconBtnText, { color: colors.out }]}>✕</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Lineup is per game and stored on the game document, so changing it never
 * rewrites history for a game already played.
 */
function LineupTab({ team, game, roster }) {
  const [saving, setSaving] = useState(false);
  const current = game?.lineup?.length
    ? game.lineup
    : roster.map((p, i) => ({ playerId: p.playerId, battingOrder: i + 1, position: p.primaryPosition }));
  const [order, setOrder] = useState(current.map((s) => s.playerId));
  const [out, setOut] = useState([]);

  const byId = Object.fromEntries(roster.map((p) => [p.playerId, p]));

  const move = (i, dir) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const toggle = (id) => setOut((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const save = async () => {
    if (!game) { Alert.alert('No game', 'Add a game on the Schedule tab first.'); return; }
    setSaving(true);
    try {
      const lineup = order.filter((id) => !out.includes(id)).map((id, i) => ({
        playerId: id, battingOrder: i + 1, position: byId[id]?.primaryPosition ?? null,
      }));
      await updateDoc(doc(db, 'teams', team.id, 'games', game.id), {
        lineup, lineupLockedAt: new Date(),
      });
      Alert.alert('Lineup saved', `${lineup.length} in the order.`);
    } catch (e) { Alert.alert('Could not save', e.message); }
    setSaving(false);
  };

  if (!game) {
    return <Centered><Text style={styles.msg}>Add a game first, then set the lineup.</Text></Centered>;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.lineupHint}>
        Batting order for {game.homeOrAway === 'home' ? 'vs' : '@'} {game.opponent}.
        Tap a name to sit them; arrows reorder.
      </Text>

      {order.map((id, i) => {
        const p = byId[id];
        if (!p) return null;
        const sitting = out.includes(id);
        return (
          <View key={id} style={[styles.card, sitting && styles.cardOut]}>
            <Text style={styles.orderNum}>{sitting ? '–' : i + 1}</Text>
            <Pressable onPress={() => toggle(id)} style={styles.flex}>
              <Text style={[styles.name, sitting && styles.nameOut]}>
                #{p.jerseyNumber ?? '–'} {p.firstName} {p.lastName}
              </Text>
              <Text style={styles.meta}>{sitting ? 'Not batting' : (p.primaryPosition || 'No position')}</Text>
            </Pressable>
            <Pressable onPress={() => move(i, -1)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>▲</Text>
            </Pressable>
            <Pressable onPress={() => move(i, 1)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>▼</Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable onPress={save} disabled={saving} style={[styles.cta, { marginTop: spacing.md }]}>
        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>SAVE LINEUP</Text>}
      </Pressable>
    </ScrollView>
  );
}

const Centered = ({ children }) => (
  <SafeAreaView style={styles.centered}>{children}</SafeAreaView>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chalk, padding: spacing.xl },
  header: { backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  h1: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 18, color: '#FFF', marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)' },
  tabOn: { backgroundColor: '#FFF' },
  tabText: { ...text.bodyStrong, fontSize: 12.5, color: '#A8B0C6' },
  tabTextOn: { color: colors.navy },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  form: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card,
  },
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
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card,
  },
  cardEditing: { borderColor: colors.primary, backgroundColor: '#F5F8FF' },
  cardOut: { opacity: 0.5 },
  jersey: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  jerseyText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 16, color: '#FFF' },
  orderNum: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 16, color: colors.pencil, width: 26, textAlign: 'center' },
  name: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  nameOut: { textDecorationLine: 'line-through' },
  meta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  iconBtnText: { ...text.buttonSecondary, fontSize: 11, color: colors.pencil },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30 },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center' },
  lineupHint: { ...text.body, fontSize: 12.5, color: colors.pencil, marginBottom: spacing.md, lineHeight: 18 },
});
