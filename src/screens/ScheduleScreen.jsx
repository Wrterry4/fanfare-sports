/**
 * ScheduleScreen.jsx — Games.
 *
 * Only the opponent is required. Everything else — date, time, park, field,
 * notes — is optional, because a coach entering a season's schedule from a
 * league PDF often has half the details and shouldn't be blocked on the rest.
 *
 * The form stays open after saving so a full schedule goes in one sitting.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  db, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc,
} from '../services/firebase';
import { useGameDay } from '../hooks/useGameDay.js';
import { createGame } from '../services/bootstrap.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { inputStyle, multilineStyle } from '../theme/inputs.js';

const blank = {
  opponent: '', homeOrAway: 'home', dateStr: '', timeStr: '',
  park: '', field: '', notes: '',
};

export default function ScheduleScreen() {
  const { team, rules, loading } = useGameDay();
  const [games, setGames] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const opponentRef = useRef(null);

  useEffect(() => {
    if (!team?.id) return undefined;
    const q = query(collection(db, 'teams', team.id, 'games'), orderBy('date', 'asc'));
    return onSnapshot(q, (snap) =>
      setGames(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setGames([]));
  }, [team?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useCallback(async () => {
    if (!form.opponent.trim()) { Alert.alert('Who are you playing?'); return; }
    setBusy(true);
    try {
      const when = parseWhen(form.dateStr, form.timeStr);
      const payload = {
        opponent: form.opponent.trim(),
        homeOrAway: form.homeOrAway,
        date: when,
        park: form.park.trim() || null,
        field: form.field.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await updateDoc(doc(db, 'teams', team.id, 'games', editingId), payload);
        setEditingId(null);
      } else {
        await createGame({ teamId: team.id, rules, ...payload });
      }
      setForm(blank);
      setTimeout(() => opponentRef.current?.focus(), 60);
    } catch (e) { Alert.alert('Could not save', e.message); }
    setBusy(false);
  }, [form, team?.id, rules, editingId]);

  const beginEdit = (g) => {
    const d = g.date?.toDate?.() ?? (g.date ? new Date(g.date) : null);
    setEditingId(g.id);
    setForm({
      opponent: g.opponent || '', homeOrAway: g.homeOrAway || 'home',
      dateStr: d && !isNaN(d) ? `${d.getMonth() + 1}/${d.getDate()}` : '',
      timeStr: d && !isNaN(d) ? formatTime(d) : '',
      park: g.park || '', field: g.field || '', notes: g.notes || '',
    });
  };

  const setStatus = async (g, status) => {
    try { await updateDoc(doc(db, 'teams', team.id, 'games', g.id), { status }); }
    catch (e) { Alert.alert('Could not update', e.message); }
  };

  const remove = (g) => Alert.alert(`Delete game vs ${g.opponent}?`, 'This cannot be undone.',
    [{ text: 'Cancel', style: 'cancel' },
     { text: 'Delete', style: 'destructive',
       onPress: () => deleteDoc(doc(db, 'teams', team.id, 'games', g.id)).catch(() => {}) }]);

  if (loading) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;
  if (!team) return <Centered><Text style={styles.msg}>No team yet.</Text></Centered>;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Schedule</Text>
        <Text style={styles.h2}>{games.length} game{games.length === 1 ? '' : 's'}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.formTitle}>{editingId ? 'Edit game' : 'Add game'}</Text>

            <Text style={styles.label}>Opponent *</Text>
            <TextInput ref={opponentRef} value={form.opponent} onChangeText={(v) => set('opponent', v)}
              style={inputStyle} placeholder="Northgate" placeholderTextColor="#A0A8B8"
              autoCapitalize="words" />

            <View style={[styles.chips, { marginTop: spacing.md }]}>
              {[['home', 'Home'], ['away', 'Away']].map(([k, l]) => (
                <Pressable key={k} onPress={() => set('homeOrAway', k)}
                  style={[styles.chip, form.homeOrAway === k && styles.chipOn]}>
                  <Text style={[styles.chipText, form.homeOrAway === k && styles.chipTextOn]}>{l}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Date</Text>
                <TextInput value={form.dateStr} onChangeText={(v) => set('dateStr', v)}
                  style={inputStyle} placeholder="4/12" placeholderTextColor="#A0A8B8" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Time</Text>
                <TextInput value={form.timeStr} onChangeText={(v) => set('timeStr', v)}
                  style={inputStyle} placeholder="5:30 PM" placeholderTextColor="#A0A8B8" />
              </View>
            </View>

            <View style={[styles.row, { marginTop: spacing.md }]}>
              <View style={styles.flex}>
                <Text style={styles.label}>Park</Text>
                <TextInput value={form.park} onChangeText={(v) => set('park', v)}
                  style={inputStyle} placeholder="Rowlett Creek" placeholderTextColor="#A0A8B8"
                  autoCapitalize="words" />
              </View>
              <View style={{ width: 90 }}>
                <Text style={styles.label}>Field</Text>
                <TextInput value={form.field} onChangeText={(v) => set('field', v)}
                  style={inputStyle} placeholder="4" placeholderTextColor="#A0A8B8" />
              </View>
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Notes</Text>
            <TextInput value={form.notes} onChangeText={(v) => set('notes', v)}
              style={multilineStyle} multiline
              placeholder="Arrive 45 min early, snack duty: Miller"
              placeholderTextColor="#A0A8B8" />

            <View style={[styles.row, { marginTop: spacing.md }]}>
              {editingId && (
                <Pressable onPress={() => { setEditingId(null); setForm(blank); }}
                  style={[styles.cta, styles.ctaGhost]}>
                  <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
                </Pressable>
              )}
              <Pressable onPress={save} disabled={busy} style={[styles.cta, styles.flex]}>
                {busy ? <ActivityIndicator color="#FFF" />
                      : <Text style={styles.ctaText}>{editingId ? 'SAVE' : 'ADD & NEXT'}</Text>}
              </Pressable>
            </View>
          </View>

          {games.length === 0 && <Text style={styles.empty}>No games yet.</Text>}

          {games.map((g) => {
            const open = expanded === g.id;
            return (
              <Pressable key={g.id} onPress={() => setExpanded(open ? null : g.id)}
                style={[styles.card, g.status === 'live' && styles.cardLive]}>
                <View style={styles.cardTop}>
                  <View style={styles.flex}>
                    <Text style={styles.opponent}>
                      {g.homeOrAway === 'home' ? 'vs' : '@'} {g.opponent}
                    </Text>
                    <Text style={styles.meta}>
                      {[formatDate(g.date), formatTimeOf(g.date), g.park,
                        g.field ? `Field ${g.field}` : null]
                        .filter(Boolean).join(' · ') || 'No details yet'}
                    </Text>
                  </View>
                  <StatusPill game={g} />
                </View>

                {open && (
                  <View style={styles.cardBody}>
                    {g.notes ? <Text style={styles.notes}>{g.notes}</Text> : null}
                    <View style={styles.cardBtns}>
                      {g.status !== 'live' && g.status !== 'final' && (
                        <Pressable onPress={() => setStatus(g, 'live')} style={styles.smallBtn}>
                          <Text style={styles.smallBtnText}>START GAME</Text>
                        </Pressable>
                      )}
                      {g.status === 'live' && (
                        <Pressable onPress={() => setStatus(g, 'final')} style={styles.smallBtn}>
                          <Text style={styles.smallBtnText}>END GAME</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => beginEdit(g)} style={[styles.smallBtn, styles.smallGhost]}>
                        <Text style={[styles.smallBtnText, { color: colors.pencil }]}>EDIT</Text>
                      </Pressable>
                      <Pressable onPress={() => remove(g)} style={[styles.smallBtn, styles.smallGhost]}>
                        <Text style={[styles.smallBtnText, { color: colors.out }]}>DELETE</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusPill({ game }) {
  if (game.status === 'live') {
    return <View style={[styles.pill, styles.pillLive]}><Text style={styles.pillTextLive}>LIVE</Text></View>;
  }
  if (game.status === 'final' || game.status === 'amended') {
    return (
      <View style={styles.pill}>
        <Text style={styles.pillText}>
          {(game.score?.away ?? 0)}–{(game.score?.home ?? 0)}
        </Text>
      </View>
    );
  }
  return <View style={styles.pill}><Text style={styles.pillText}>SCHEDULED</Text></View>;
}

/**
 * Free-text date and time. A native picker is four taps for something a coach
 * copying from a league sheet can type in three seconds; anything unparseable
 * just becomes "today", which is recoverable.
 */
function parseWhen(dateStr, timeStr) {
  const now = new Date();
  let month = now.getMonth(), day = now.getDate(), year = now.getFullYear();

  const dm = String(dateStr).match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/);
  if (dm) {
    month = parseInt(dm[1], 10) - 1;
    day = parseInt(dm[2], 10);
    if (dm[3]) { const y = parseInt(dm[3], 10); year = y < 100 ? 2000 + y : y; }
  }

  let hours = 12, minutes = 0;
  const tm = String(timeStr).match(/(\d{1,2})(?::(\d{2}))?\s*(a|p)?/i);
  if (tm) {
    hours = parseInt(tm[1], 10);
    minutes = tm[2] ? parseInt(tm[2], 10) : 0;
    const ap = (tm[3] || '').toLowerCase();
    if (ap === 'p' && hours < 12) hours += 12;
    if (ap === 'a' && hours === 12) hours = 0;
    if (!ap && hours < 8) hours += 12;   // "5:30" at a ballpark means evening
  }
  return new Date(year, month, day, hours, minutes);
}

const toDate = (d) => d?.toDate?.() ?? (d ? new Date(d) : null);

function formatDate(d) {
  const date = toDate(d);
  if (!date || isNaN(date)) return null;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTimeOf(d) {
  const date = toDate(d);
  if (!date || isNaN(date)) return null;
  return formatTime(date);
}
function formatTime(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const Centered = ({ children }) => (
  <SafeAreaView style={styles.centered}>{children}</SafeAreaView>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chalk, padding: spacing.xl },
  header: { backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  h1: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 18, color: '#FFF' },
  h2: { ...text.body, fontSize: 12, color: '#A8B0C6', marginTop: 2 },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  form: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  formTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy, marginBottom: spacing.md },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: 'row', gap: 7 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  cta: { height: 46, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card },
  cardLive: { borderColor: colors.out, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardBody: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  cardBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  opponent: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  meta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 3, lineHeight: 16 },
  notes: { ...text.body, fontSize: 13, color: colors.navy, marginBottom: spacing.md, lineHeight: 18 },
  pill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#EEF1F6' },
  pillLive: { backgroundColor: '#FDECEC' },
  pillText: { ...text.buttonSecondary, fontSize: 9.5, color: colors.pencil, letterSpacing: 0.6 },
  pillTextLive: { ...text.buttonSecondary, fontSize: 9.5, color: colors.out, letterSpacing: 0.6 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: colors.navy },
  smallGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  smallBtnText: { ...text.buttonSecondary, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30 },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center' },
});
