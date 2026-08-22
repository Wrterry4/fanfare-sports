/**
 * JoinTeamScreen.jsx — Joining from a shared link.
 *
 * Works signed out, and creates the account inline. Bouncing someone to a
 * separate sign-up screen and hoping they find their way back is where invite
 * funnels lose people — and this link is how the whole product spreads.
 *
 * Three steps on one screen: see the team, make an account (if needed), pick
 * who you are. Claiming a specific child happens after joining, because it
 * needs a coach's approval.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { previewTeam, joinTeamWithCode, ROLE_LABELS } from '../services/membership.js';
import { signUp, signIn } from '../services/authService.js';
import { useAuth } from '../hooks/AuthProvider.jsx';
import { notify } from '../utils/confirm.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

/**
 * Three roles, in the order most people pick them.
 *
 * Scorekeeper was here and is gone: who keeps the book changes game to game,
 * and the app already models that properly as the baton on the game document.
 * Asking someone to commit to it at signup froze a two-hour job into a
 * season-long label — and a parent can score anyway.
 *
 * "Grandparent or family" became "Fan" to match the app's own vocabulary; the
 * description carries the meaning, so nothing is lost by naming it once.
 */
const ROLES = [
  ['parent', 'Parent', 'Full access to your own player, and team messages.'],
  ['fan', 'Fan', "Follow one player's games and stats."],
  ['coach', 'Coach', 'Manage the roster, schedule, and settings.'],
];

export default function JoinTeamScreen({ navigation, route }) {
  const params = route?.params ?? {};
  const { signedIn, user } = useAuth();

  const [teamId, setTeamId] = useState(params.team || '');
  const [code, setCode] = useState(params.code || '');
  const [role, setRole] = useState('parent');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      // Create the account first if there isn't one, then join in the same tap.
      if (!signedIn) {
        if (mode === 'signup') {
          if (!name.trim()) throw new Error('What should we call you?');
          if (password.length < 6) throw new Error('Password needs at least 6 characters.');
          await signUp({ email, password, displayName: name.trim() });
        } else {
          await signIn({ email, password });
        }
      }
      await joinTeamWithCode({ teamId, code, role });
      navigation.replace('Tabs');
    } catch (e) {
      notify('Could not join', friendly(e));
      setBusy(false);
    }
  }, [signedIn, mode, name, email, password, teamId, code, role, navigation]);

  const roleInfo = ROLES.find(([k]) => k === role);

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>{preview?.name || 'Join a team'}</Text>
            <Text style={styles.sub}>
              {preview
                ? `${preview.season}${preview.division ? ` · ${preview.division}` : ''}`
                : 'Enter the code your coach shared.'}
            </Text>

            {!params.team && (
              <>
                <Text style={styles.label}>Team ID</Text>
                <TextInput value={teamId} onChangeText={setTeamId} style={inputStyle}
                  placeholder="From your coach's link" placeholderTextColor="#A0A8B8"
                  autoCapitalize="none" />
                <View style={{ height: spacing.md }} />
              </>
            )}

            <Text style={styles.label}>Join code</Text>
            <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())}
              style={[inputStyle, styles.codeInput]} placeholder="ABC123"
              placeholderTextColor="#A0A8B8" autoCapitalize="characters" />

            <Text style={[styles.label, { marginTop: spacing.lg }]}>I am a…</Text>
            <View style={styles.chips}>
              {ROLES.map(([k, l]) => (
                <Pressable key={k} onPress={() => setRole(k)}
                  style={[styles.chip, role === k && styles.chipOn]}>
                  <Text style={[styles.chipText, role === k && styles.chipTextOn]}>{l}</Text>
                </Pressable>
              ))}
            </View>
            {roleInfo && <Text style={styles.roleHint}>{roleInfo[2]}</Text>}

            {!signedIn && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>
                  {mode === 'signup' ? 'Create your account' : 'Sign in'}
                </Text>

                {mode === 'signup' && (
                  <>
                    <Text style={styles.label}>Your name</Text>
                    <TextInput value={name} onChangeText={setName} style={inputStyle}
                      placeholder="Sarah Miller" placeholderTextColor="#A0A8B8"
                      autoCapitalize="words" />
                    <View style={{ height: spacing.md }} />
                  </>
                )}

                <Text style={styles.label}>Email</Text>
                <TextInput value={email} onChangeText={setEmail} style={inputStyle}
                  placeholder="you@example.com" placeholderTextColor="#A0A8B8"
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email" />

                <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
                <TextInput value={password} onChangeText={setPassword} style={inputStyle}
                  placeholder="••••••••" secureTextEntry
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />

                <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                  style={styles.switch}>
                  <Text style={styles.switchText}>
                    {mode === 'signup'
                      ? 'Already have an account? Sign in'
                      : 'New here? Create an account'}
                  </Text>
                </Pressable>
              </>
            )}

            {signedIn && (
              <Text style={styles.signedIn}>
                Joining as {user?.displayName || user?.email}
              </Text>
            )}
          </View>

          <Pressable onPress={join} disabled={busy || !teamId || !code} style={styles.cta}>
            {busy ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.ctaText}>
                      {signedIn ? 'JOIN TEAM' : 'CREATE ACCOUNT & JOIN'}
                    </Text>}
          </Pressable>

          <Text style={styles.fine}>
            You'll see the schedule, live games, and team messages right away.
            To see a specific player's stats, ask a coach to link you — you can
            request that from the Roster tab once you're in.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function friendly(e) {
  const code = e?.code || '';
  if (code.includes('email-already-in-use')) return 'That email already has an account — switch to Sign in.';
  if (code.includes('invalid-email')) return "That email doesn't look right.";
  if (code.includes('weak-password')) return 'Password needs at least 6 characters.';
  if (code.includes('wrong-password') || code.includes('invalid-credential'))
    return 'Email or password is incorrect.';
  if (code.includes('operation-not-allowed')) return 'Email sign-in is not enabled on this project yet.';
  return e?.message || 'Something went wrong.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 40, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: spacing.xl, ...shadow.card,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 21, color: colors.navy, textAlign: 'center' },
  sub: { ...text.body, color: colors.pencil, textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy, marginBottom: spacing.md },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  codeInput: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 20, letterSpacing: 4, textAlign: 'center', height: 54 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  roleHint: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 8, lineHeight: 16 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.lg },
  switch: { alignItems: 'center', paddingTop: spacing.md },
  switchText: { ...text.bodyStrong, fontSize: 12.5, color: colors.primary },
  signedIn: { ...text.body, fontSize: 12, color: colors.pencil, textAlign: 'center', marginTop: spacing.lg },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  fine: { ...text.body, fontSize: 11.5, color: colors.pencil, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
});
