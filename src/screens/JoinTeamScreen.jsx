/**
 * JoinTeamScreen.jsx — Joining with a code.
 *
 * Reached from a shared link carrying the team id and code, or by typing the
 * code manually. Shows the team name before committing, so nobody joins
 * something they can't identify.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { previewTeam, joinTeamWithCode, ROLE_LABELS } from '../services/membership.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

const ROLES = ['parent', 'fan', 'scorekeeper', 'coach'];

export default function JoinTeamScreen({ navigation, route }) {
  const params = route?.params ?? {};
  const [teamId, setTeamId] = useState(params.team || '');
  const [code, setCode] = useState(params.code || '');
  const [role, setRole] = useState('parent');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  // Support ?team=&code= on the web even when navigation params are absent.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (!teamId && q.get('team')) setTeamId(q.get('team'));
    if (!code && q.get('code')) setCode(q.get('code'));
  }, []);

  useEffect(() => {
    if (!teamId) { setPreview(null); return; }
    previewTeam(teamId).then(setPreview).catch(() => setPreview(null));
  }, [teamId]);

  const join = useCallback(async () => {
    setBusy(true);
    try {
      await joinTeamWithCode({ teamId, code, role });
      navigation.replace('Tabs');
    } catch (e) {
      Alert.alert('Could not join', e.message);
      setBusy(false);
    }
  }, [teamId, code, role, navigation]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>{preview?.name || 'Join a team'}</Text>
        <Text style={styles.sub}>
          {preview ? `${preview.season}${preview.division ? ` · ${preview.division}` : ''}`
                   : 'Enter the code your coach shared.'}
        </Text>

        {!params.team && (
          <>
            <Text style={styles.label}>Team ID</Text>
            <TextInput value={teamId} onChangeText={setTeamId} style={inputStyle}
              placeholder="From your coach's link" placeholderTextColor="#A0A8B8"
              autoCapitalize="none" />
          </>
        )}

        <Text style={[styles.label, { marginTop: spacing.md }]}>Join code</Text>
        <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())}
          style={[inputStyle, styles.codeInput]} placeholder="ABC123"
          placeholderTextColor="#A0A8B8" autoCapitalize="characters" />

        <Text style={[styles.label, { marginTop: spacing.md }]}>I am a…</Text>
        <View style={styles.chips}>
          {ROLES.map((r) => (
            <Pressable key={r} onPress={() => setRole(r)}
              style={[styles.chip, role === r && styles.chipOn]}>
              <Text style={[styles.chipText, role === r && styles.chipTextOn]}>
                {ROLE_LABELS[r]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={join} disabled={busy || !teamId || !code} style={styles.cta}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>JOIN TEAM</Text>}
        </Pressable>

        <Text style={styles.fine}>
          Joining lets you see the schedule, live games, and team chat. A coach
          links you to your own player before you can see their stats.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl, ...shadow.card },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 21, color: colors.navy, textAlign: 'center' },
  sub: { ...text.body, color: colors.pencil, textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  codeInput: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 20, letterSpacing: 4, textAlign: 'center', height: 54 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.lg },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  cta: { height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  fine: { ...text.body, fontSize: 11, color: colors.pencil, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
});
