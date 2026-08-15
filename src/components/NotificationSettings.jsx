/**
 * NotificationSettings.jsx — Per-person notification preferences.
 *
 * Stored on the member document, so they're per team: a coach on one team and
 * a parent on another shouldn't get coach-volume alerts for both.
 *
 * Permission is requested from here rather than at launch. A cold "Allow
 * notifications?" on first open gets denied, and on iOS that denial is close to
 * permanent — the person has to go to Settings to undo it. Asking on the screen
 * that explains what the alerts are converts far better and is the honest
 * moment to ask.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Platform } from 'react-native';

import { db, doc, updateDoc } from '../services/firebase';
import { useAuth } from '../hooks/AuthProvider.jsx';
import { registerDevice } from '../services/authService.js';
import { requiresInstallFirst, pushSupported } from '../services/push';
import { notify } from '../utils/confirm.js';
import { call } from '../services/callable.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

const ROWS = [
  ['myPlayerAtBat', 'My player is up', 'A buzz when they come to the plate'],
  ['myPlayerResult', 'My player got a hit', 'Hits, walks, and RBIs'],
  ['gameStart', 'Game starting', 'First pitch'],
  ['finalScore', 'Final score', 'When a game ends'],
  ['announcements', 'Announcements', 'Coach posts'],
  ['chatter', 'Team chat', 'Every message in the team channel'],
  ['directMessages', 'Direct messages', 'Someone messages you'],
];

export default function NotificationSettings({ team, member, isFan }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({});
  const [granted, setGranted] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => { setPrefs(member?.notificationPrefs ?? {}); }, [member]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;
    setGranted(Notification.permission === 'granted');
  }, []);

  const toggle = useCallback(async (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await updateDoc(doc(db, 'teams', team.id, 'members', user.uid), {
        [`notificationPrefs.${key}`]: value,
      });
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: !value }));   // put it back
      notify('Could not save', e.message);
    }
  }, [team?.id, user?.uid]);

  const enable = useCallback(async () => {
    setStatus('Working…');
    const result = await registerDevice(user.uid);

    if (result.granted) {
      setGranted(true);
      setStatus(null);
      notify('Notifications on', 'Use "Send a test" to confirm they arrive.');
      return;
    }

    switch (result.reason) {
      case 'needs_install':
        setStatus('Add Fanfare to your home screen first');
        notify('Add to Home Screen first',
          'On iPhone, notifications only work from the installed app. Tap Share, then "Add to Home Screen", and open Fanfare from there.');
        break;
      case 'denied':
        setStatus('Blocked by your browser');
        notify('Notifications are off',
          'Your browser blocked them. Turn them back on in site settings, then try again.');
        break;
      case 'no_vapid_key':
        setStatus('Server not configured');
        notify('Missing VAPID key',
          'The app has no Web Push key set. In Firebase Console → Project settings → Cloud Messaging → Web Push certificates, generate a key pair and put it in .env as EXPO_PUBLIC_FIREBASE_VAPID_KEY, then rebuild.');
        break;
      case 'unsupported':
        setStatus('Not supported in this browser');
        break;
      default:
        setStatus('Could not register');
        notify('Could not turn on notifications', result.detail || 'Unknown error.');
    }
  }, [user?.uid]);

  /**
   * Delivery has a lot of moving parts — VAPID key, service worker, token
   * storage, the Cloud Function fan-out. This exercises the whole chain and
   * reports which link broke, which beats guessing from silence.
   */
  const sendTest = useCallback(async () => {
    setStatus('Sending…');
    try {
      await call('sendTestNotification', { teamId: team.id });
      setStatus('Sent — it should arrive within a few seconds');
    } catch (e) {
      setStatus(null);
      notify('Test failed', e.message);
    }
  }, [team?.id]);

  // Fans follow one child; team chat and DMs aren't theirs.
  const rows = isFan
    ? ROWS.filter(([k]) => !['chatter', 'announcements', 'directMessages'].includes(k))
    : ROWS;

  return (
    <>
      {granted === false && (
        <Pressable onPress={enable} style={styles.enable}>
          <Text style={styles.enableTitle}>Turn on notifications</Text>
          <Text style={styles.enableBody}>
            {requiresInstallFirst()
              ? 'Add Fanfare to your home screen first — iPhone only delivers alerts to the installed app.'
              : pushSupported()
                ? 'Get a buzz when your player is up, and when games start and end.'
                : 'This browser does not support notifications.'}
          </Text>
        </Pressable>
      )}

      {granted && (
        <Pressable onPress={sendTest} style={styles.test}>
          <Text style={styles.testText}>SEND A TEST</Text>
        </Pressable>
      )}
      {status ? <Text style={styles.status}>{status}</Text> : null}

      {rows.map(([key, label, hint]) => (
        <View key={key} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.hint}>{hint}</Text>
          </View>
          <Switch
            value={prefs[key] !== false}
            onValueChange={(v) => toggle(key, v)}
            trackColor={{ true: colors.primary, false: '#CBD5E1' }}
          />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingRight: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line,
  },
  label: { ...text.bodyStrong, fontSize: 14, color: colors.navy },
  hint: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2, lineHeight: 16 },
  enable: {
    backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#E8D9AE',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  enableTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 14, color: colors.navy },
  enableBody: { ...text.body, fontSize: 12, color: colors.pencil, marginTop: 4, lineHeight: 17 },
  test: {
    height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  testText: { ...text.buttonSecondary, fontSize: 11, color: colors.primary, letterSpacing: 0.8 },
  status: { ...text.body, fontSize: 11.5, color: colors.pencil, marginBottom: spacing.md, lineHeight: 16 },
});
