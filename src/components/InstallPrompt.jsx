/**
 * InstallPrompt.jsx — "Add to Home Screen".
 *
 * On the web this is not a nice-to-have. Two things depend on it:
 *
 *   1. iOS delivers Web Push ONLY to an installed PWA. Safari in a tab cannot
 *      receive notifications at all. The on-deck alert — the single feature
 *      that gets a grandparent to bother — does not exist until this happens.
 *
 *   2. Safari evicts IndexedDB for sites unused for seven days. An installed
 *      PWA is exempt. For a scorekeeper, that's the difference between a
 *      durable offline write queue and one that quietly vanishes between games.
 *
 * So the ask is framed around what the person gets, and it's shown at the
 * moment they've just been told about alerts — not on first load, where it
 * reads as a nag and gets dismissed.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

const isIOS = () =>
  Platform.OS === 'web' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const isInstalled = () =>
  Platform.OS !== 'web' ||
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

export default function InstallPrompt({ reason = 'alerts', onDismiss }) {
  const [deferred, setDeferred] = useState(null);
  const [hidden, setHidden] = useState(isInstalled());

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    // Chrome and Edge fire this; it's the one-tap path. Safari never does,
    // which is why the iOS branch below gives manual instructions instead.
    const handler = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (hidden) return null;
  if (!deferred && !isIOS()) return null; // No install path available.

  const headline = reason === 'scoring'
    ? 'Install before you keep the book'
    : 'Install to get game alerts';

  const body = reason === 'scoring'
    ? 'Installing keeps your scoring safe if you lose signal at the field. In a browser tab, entries can be cleared between games.'
    : 'Notifications only work from the installed app. Install to get a buzz when your player is on deck.';

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{headline}</Text>
      <Text style={styles.body}>{body}</Text>

      {isIOS() ? (
        <View style={styles.steps}>
          <Text style={styles.step}>1. Tap the Share button below</Text>
          <Text style={styles.step}>2. Choose "Add to Home Screen"</Text>
          <Text style={styles.step}>3. Open Ridgeview from your home screen</Text>
        </View>
      ) : (
        <Pressable onPress={install} style={styles.cta}>
          <Text style={styles.ctaText}>INSTALL</Text>
        </Pressable>
      )}

      <Pressable onPress={() => { setHidden(true); onDismiss?.(); }} style={styles.later}>
        <Text style={styles.laterText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: spacing.md, padding: spacing.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, ...shadow.card,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 16, color: colors.navy },
  body: { ...text.body, lineHeight: 19, color: colors.pencil, marginTop: 6 },
  steps: { marginTop: spacing.md, gap: 6 },
  step: { ...text.bodyStrong, fontSize: 13, color: colors.navy },
  cta: {
    marginTop: spacing.md, height: 46, borderRadius: radius.md,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...text.buttonSecondary, color: colors.white, letterSpacing: 0.8 },
  later: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  laterText: { ...text.body, fontSize: 12, color: colors.pencil },
});
