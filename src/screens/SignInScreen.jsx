/**
 * SignInScreen.jsx — Sign in and sign up in one screen.
 *
 * One screen rather than two: the only difference is a name field and which
 * function fires, and a separate route means an extra navigation step during
 * the moment a person is most likely to give up.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { signIn, signUp, resetPassword } from '../services/authService.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

function Wordmark() {
  return (
    <View style={styles.mark}>
      <Svg viewBox="0 0 100 100" width={46} height={46}>
        <Rect x={30} y={22} width={13} height={56} rx={4} fill="#FFFFFF" />
        <Rect x={30} y={22} width={42} height={13} rx={4} fill={colors.gold} />
        <Rect x={30} y={44} width={32} height={13} rx={4} fill={colors.primary} />
      </Svg>
    </View>
  );
}

export default function SignInScreen() {
  const [mode, setMode] = useState('signin');
  const [displayName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isSignUp = mode === 'signup';

  const submit = useCallback(async () => {
    setError(null); setNotice(null); setBusy(true);
    try {
      if (isSignUp) {
        if (!displayName.trim()) throw new Error('What should we call you?');
        if (password.length < 6) throw new Error('Password needs at least 6 characters.');
        await signUp({ email, password, displayName: displayName.trim() });
      } else {
        await signIn({ email, password });
      }
      // AuthProvider picks it up from here and the navigator swaps stacks.
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }, [isSignUp, displayName, email, password]);

  const forgot = useCallback(async () => {
    if (!email.trim()) { setError('Enter your email first.'); return; }
    try {
      await resetPassword(email);
      setNotice('Check your email for a reset link.');
      setError(null);
    } catch (e) { setError(friendly(e)); }
  }, [email]);

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Wordmark />
          <Text style={styles.title}>Fanfare Sports</Text>
          <Text style={styles.sub}>
            {isSignUp ? 'Create an account to get started.' : 'Welcome back.'}
          </Text>

          <View style={styles.card}>
            {isSignUp && (
              <Field label="Your name" value={displayName} onChange={setName}
                     placeholder="Coach Wallace" autoCapitalize="words" />
            )}
            <Field label="Email" value={email} onChange={setEmail}
                   placeholder="you@example.com" keyboardType="email-address"
                   autoCapitalize="none" autoComplete="email" />
            <Field label="Password" value={password} onChange={setPassword}
                   placeholder="••••••••" secureTextEntry
                   autoComplete={isSignUp ? 'new-password' : 'current-password'} />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <Pressable onPress={submit} disabled={busy} style={styles.cta}>
              {busy
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.ctaText}>{isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</Text>}
            </Pressable>

            {!isSignUp && (
              <Pressable onPress={forgot} style={styles.link}>
                <Text style={styles.linkText}>Forgot your password?</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(null); }}
            style={styles.switch}
          >
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? Sign in' : "New here? Create an account"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.input}
        placeholderTextColor="#A0A8B8"
        {...rest}
      />
    </View>
  );
}

/** Firebase error codes are not sentences a person should have to read. */
function friendly(e) {
  const code = e?.code || '';
  if (code.includes('invalid-email')) return "That email doesn't look right.";
  if (code.includes('user-not-found')) return 'No account with that email.';
  if (code.includes('wrong-password') || code.includes('invalid-credential'))
    return 'Email or password is incorrect.';
  if (code.includes('email-already-in-use')) return 'That email already has an account. Try signing in.';
  if (code.includes('weak-password')) return 'Password needs at least 6 characters.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a minute and try again.';
  if (code.includes('network')) return 'No connection. Check your signal and try again.';
  if (code.includes('operation-not-allowed'))
    return 'Email sign-in is not enabled on this project yet.';
  return e?.message || 'Something went wrong.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 48, minHeight: '100%' },
  mark: {
    width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  title: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 24, color: colors.navy,
    textAlign: 'center', marginTop: spacing.md,
  },
  sub: { ...text.body, color: colors.pencil, textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: spacing.lg, ...shadow.card,
  },
  field: { marginBottom: spacing.md },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: 12, height: 46, fontSize: 16, color: colors.navy,
    backgroundColor: '#FDFDFC',
  },
  cta: {
    height: 50, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  link: { alignItems: 'center', paddingTop: spacing.md },
  linkText: { ...text.body, fontSize: 12.5, color: colors.primary },
  switch: { alignItems: 'center', paddingVertical: spacing.lg },
  switchText: { ...text.bodyStrong, fontSize: 13, color: colors.primary },
  error: {
    ...text.bodyStrong, fontSize: 12.5, color: colors.out,
    marginBottom: spacing.md, lineHeight: 18,
  },
  notice: {
    ...text.bodyStrong, fontSize: 12.5, color: colors.grass,
    marginBottom: spacing.md, lineHeight: 18,
  },
});
