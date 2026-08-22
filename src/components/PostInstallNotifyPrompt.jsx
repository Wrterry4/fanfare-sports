/**
 * PostInstallNotifyPrompt.jsx — Ask the moment it can actually work, not
 * whenever someone happens to find Settings.
 *
 * ── The real constraint ──────────────────────────────────────────────────
 *
 * No browser lets a site pop the OS permission dialog on its own — that's
 * exactly the kind of unsolicited prompt permission systems exist to block.
 * "Force a notification prompt" isn't literally available. What IS available,
 * and what this does: detect the moment notifications become POSSIBLE — the
 * first time the app is opened from the Home Screen icon rather than a
 * Safari tab — and put one unmissable, one-tap button in front of the person
 * right then, instead of leaving them to discover Settings on their own.
 * The tap itself is what triggers the real permission dialog; nothing here
 * bypasses that.
 *
 * ── Detecting "just installed" ───────────────────────────────────────────
 *
 * There's no reliable cross-browser "installed" event — Chrome fires
 * `appinstalled`, Safari never does. The portable signal is standalone
 * display mode itself: the first launch where isInstalled() is true is, for
 * practical purposes, the first launch after adding the icon, since nothing
 * else produces that display mode. A flag in AsyncStorage remembers that
 * we've already seen it, so this offers once — not every time the app opens.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isInstalled, pushSupported } from '../services/push';
import { registerDevice } from '../services/authService.js';
import { isEligibleForPostInstallPrompt } from '../shared/pushEligibility.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

const SEEN_KEY = 'postInstallPromptSeen';

export default function PostInstallNotifyPrompt({ uid }) {
  const [show, setShow] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      const alreadySeen = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      if (alreadySeen || cancelled) return;

      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
      const eligible = isEligibleForPostInstallPrompt({
        installed: isInstalled(), supported: pushSupported(), permission,
      });
      if (eligible && !cancelled) setShow(true);

      // Marked seen either way. If the conditions weren't met this time —
      // not installed yet, or already decided — there's no reason to keep
      // re-checking on every future launch.
      await AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
    })();

    return () => { cancelled = true; };
  }, [uid]);

  const enable = useCallback(async () => {
    setWorking(true);
    await registerDevice(uid);
    setWorking(false);
    setShow(false);
    // Silent on every outcome, including failure. This is a proactive nudge,
    // not a request the person made — surfacing an error dialog for a prompt
    // they didn't ask for would be worse than saying nothing. Settings still
    // has the full "Turn on notifications" flow with real error messages for
    // anyone who wants to retry deliberately.
  }, [uid]);

  if (!show) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.title}>You're all set — turn on alerts?</Text>
        <Text style={styles.body}>
          Get a buzz when your player is up, and when games start and end.
          One tap, and you can change your mind anytime in Settings.
        </Text>
        <View style={styles.btns}>
          <Pressable onPress={() => setShow(false)} style={styles.later} disabled={working}>
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
          <Pressable onPress={enable} style={styles.cta} disabled={working}>
            <Text style={styles.ctaText}>{working ? 'WORKING…' : 'TURN ON ALERTS'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'flex-end', zIndex: 998,
  },
  card: {
    width: '100%', margin: spacing.md, padding: spacing.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, ...shadow.card,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 16, color: colors.navy },
  body: { ...text.body, lineHeight: 19, color: colors.pencil, marginTop: 6 },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  later: {
    flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  laterText: { ...text.buttonSecondary, fontSize: 11, color: colors.pencil, letterSpacing: 0.6 },
  cta: {
    flex: 2, height: 46, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
