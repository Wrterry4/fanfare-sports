/**
 * JoinScreen.jsx — What a parent sees when they tap the coach's text.
 *
 * Works signed out. previewInvite is unauthenticated by design: this screen
 * has to say "You'll be added as Jack's parent" BEFORE any account form, or
 * most people close the tab.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

import { previewInvite, describeInvite, redeemInvite, postRedeemDestination }
  from '../services/inviteService.js';
import { peekPendingInvite } from '../navigation/linking.js';
import { useAuth } from '../hooks/AuthProvider.jsx';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

const BENEFITS = (name) => [
  `A buzz when ${name} is on deck and after every at-bat`,
  'Live scoring you can watch from anywhere',
  `${name}'s stats — visible only to you and the coaches`,
  'Team schedule, RSVPs, and messages',
];

function Check() {
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14}>
      <Path d="M4 12l6 6L20 6" fill="none" stroke={colors.grass} strokeWidth={2.6}
            strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function JoinScreen({ navigation }) {
  const { signedIn } = useAuth();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const pending = await peekPendingInvite();
      if (!pending) { setPreview({ ok: false, message: 'This link is missing its invite code.' }); return; }
      const url = `x/join/${pending.inviteId}#${pending.token}`;
      setPreview(await previewInvite(url));
    })();
  }, []);

  const handleJoin = useCallback(async () => {
    if (!signedIn) { navigation.navigate('SignUp'); return; }
    setBusy(true);
    const pending = await peekPendingInvite();
    const result = await redeemInvite(`x/join/${pending.inviteId}#${pending.token}`);
    setBusy(false);
    const dest = postRedeemDestination(result);
    navigation.replace(dest.screen, dest.params);
  }, [signedIn, navigation]);

  if (!preview) {
    return (
      <SafeAreaView style={styles.center}><ActivityIndicator color={colors.clay} /></SafeAreaView>
    );
  }

  if (!preview.ok) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>Can't open this invite</Text>
        <Text style={styles.errorBody}>{preview.message}</Text>
      </SafeAreaView>
    );
  }

  const name = preview.playerFirstName || 'your player';

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.crest}>
            <Svg viewBox="0 0 24 24" width={30} height={30}>
              <Circle cx={12} cy={12} r={9} fill="none" stroke={colors.white} strokeWidth={2} />
              <Path d="M5 6c3 3 3 9 0 12M19 6c-3 3-3 9 0 12" fill="none"
                    stroke={colors.white} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>

          <Text style={styles.team}>{preview.teamName}</Text>
          {preview.season ? <Text style={styles.season}>{preview.season}</Text> : null}
          <Text style={styles.desc}>{describeInvite(preview)}</Text>

          <View style={styles.benefits}>
            {BENEFITS(name).map((b) => (
              <View key={b} style={styles.benefitRow}>
                <Check />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={handleJoin} disabled={busy} style={styles.cta}>
          <Text style={styles.ctaText}>
            {busy ? 'JOINING…' : `JOIN AS ${name.toUpperCase()}'S PARENT`}
          </Text>
        </Pressable>

        <Text style={styles.fine}>
          Family members get game alerts and {name}'s stats.
          Only parents can approve roster changes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.chalk, padding: spacing.xl,
  },
  scroll: { padding: spacing.lg },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: 22, alignItems: 'center', ...shadow.card,
  },
  crest: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.clay,
    alignItems: 'center', justifyContent: 'center', marginBottom: 13,
  },
  team: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 19, color: colors.navy },
  season: { ...text.label, color: colors.pencil, marginTop: 5, marginBottom: 13 },
  desc: { ...text.body, fontSize: 13.5, lineHeight: 21, color: colors.navy, textAlign: 'center' },
  benefits: { marginTop: 15, gap: 8, alignSelf: 'stretch' },
  benefitRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  benefitText: { ...text.body, fontSize: 12.5, lineHeight: 18, flex: 1, color: colors.navy },
  cta: {
    marginTop: 14, height: 52, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...text.buttonSecondary, color: colors.white, letterSpacing: 0.8 },
  fine: {
    ...text.body, fontSize: 10.5, lineHeight: 16, color: colors.pencil,
    textAlign: 'center', marginTop: 10,
  },
  errorTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  errorBody: { ...text.body, color: colors.pencil, textAlign: 'center', marginTop: 8 },
});
