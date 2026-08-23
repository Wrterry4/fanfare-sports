/**
 * SignInScreen.jsx — Sign in and sign up in one screen.
 *
 * One screen rather than two: the only difference is a name field and which
 * function fires, and a separate route means an extra navigation step during
 * the moment a person is most likely to give up.
 *
 * The header is the same lockup and tagline the splash shows, on the same navy
 * — this screen used to draw its own, older mark, so the first two screens of
 * the app disagreed about what the app was called and what it looked like.
 * A person arriving from a coach's text link sees one brand, twice.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { signIn, signUp, resetPassword } from '../services/authService.js';
import { SOCIAL_PROVIDERS, signInWithProvider } from '../services/socialAuth.js';
import { FanfareLockup } from '../components/FanfareLogo.jsx';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

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

  /**
   * A redirect leaves the page, so there is nothing to unset afterwards —
   * `busy` stays true and the screen stays disabled while the browser
   * navigates away, which is exactly right.
   */
  const social = useCallback(async (id) => {
    setError(null); setNotice(null); setBusy(true);
    try {
      const user = await signInWithProvider(id);
      // null means the person closed the chooser, or a redirect is in flight.
      if (!user) setBusy(false);
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }, []);

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
          {/* Same navy panel as the splash, so the app doesn't appear to
              change identity between the two screens. */}
          <View style={styles.brand}>
            <FanfareLockup scale={0.72} />
          </View>
          <Text style={styles.sub}>
            {isSignUp ? 'Create an account to get started.' : 'Welcome back.'}
          </Text>

          <View style={styles.card}>
            {SOCIAL_PROVIDERS.length > 0 && (
              <>
                {/* Above the fields, not below: for most parents this is the
                    whole sign-up, and burying it under a form they don't need
                    to fill in is what makes people abandon one. */}
                {SOCIAL_PROVIDERS.map((p) => (
                  <Pressable key={p.id} onPress={() => social(p.id)} disabled={busy}
                    style={styles.social} accessibilityRole="button">
                    <ProviderGlyph id={p.id} />
                    <Text style={styles.socialText}>{p.label}</Text>
                  </Pressable>
                ))}
                <View style={styles.orRow}>
                  <View style={styles.rule} />
                  <Text style={styles.orText}>or use email</Text>
                  <View style={styles.rule} />
                </View>
              </>
            )}

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

/**
 * The provider marks, drawn rather than fetched.
 *
 * Both brands publish exact-colour guidelines and both forbid recolouring, so
 * these are the real marks at the real values — and drawn as SVG so there's no
 * remote asset to load on the one screen that has to work before anything else
 * does.
 */
function ProviderGlyph({ id }) {
  if (id === 'google.com') {
    return (
      <Svg width={18} height={18} viewBox="0 0 48 48">
        <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.1h12.1c-.2 1.8-1.6 4.6-4.5 6.4l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15z" />
        <Path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z" />
        <Path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10z" />
        <Path fill="#EA4335" d="M24 10.6c4.1 0 6.9 1.8 8.5 3.2l6.2-6C34.9 4.3 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14l7.1 5.5c1.8-5.3 6.7-8.9 12.5-8.9z" />
      </Svg>
    );
  }
  if (id === 'facebook.com') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.8V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z" />
      </Svg>
    );
  }
  return null;
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
    return 'That sign-in method is not enabled on this project yet.';
  // One email, one account: Firebase links providers only after the person
  // proves they own the account, and this is the message that says so.
  if (code.includes('account-exists-with-different-credential'))
    return 'That email already has an account. Sign in the way you did last '
         + 'time, then link the other method from your account settings.';
  if (code.includes('unauthorized-domain'))
    return "This site isn't on the project's authorized domains list yet.";
  return e?.message || 'Something went wrong.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 48, minHeight: '100%' },
  brand: {
    backgroundColor: colors.navy, borderRadius: radius.lg,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },
  sub: { ...text.body, color: colors.pencil, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  social: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 48, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFF',
    marginBottom: spacing.sm,
  },
  socialText: { ...text.bodyStrong, fontSize: 14.5, color: colors.navy },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { ...text.label, color: colors.pencil },
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
