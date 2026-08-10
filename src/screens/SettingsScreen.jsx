/**
 * SettingsScreen.jsx — League rules, team info, and the join code.
 *
 * Rules edited here apply to FUTURE games only. Every game freezes a snapshot
 * at creation, so a league amending a rule in June can't retroactively rescore
 * May's games.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Switch,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db, doc, updateDoc } from '../services/firebase';
import { useGameDay } from '../hooks/useGameDay.js';
import { useAuth } from '../hooks/AuthProvider.jsx';
import { signOut } from '../services/authService.js';
import { subscribeMembers, buildJoinUrl, ROLE_LABELS } from '../services/membership.js';
import { RULE_PRESETS, RULE_BOUNDS, PRESET_ORDER } from '../sports/baseball/rules.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

const NUMBERS = [
  ['inningsPerGame', 'Innings per game'],
  ['maxRunsPerInning', 'Run cap per inning'],
  ['mercyRuleDifferential', 'Mercy rule run difference'],
  ['mercyRuleAfterInning', 'Mercy rule after inning'],
  ['gameTimeLimitMinutes', 'Time limit (minutes)'],
  ['maxPitchesPerOuting', 'Max pitches per outing'],
];

const TOGGLES = [
  ['continuousBattingOrder', 'Bat the whole roster'],
  ['reverseBattingOrderEachInning', 'Reverse batting order each inning'],
  ['droppedThirdStrike', 'Dropped third strike'],
  ['stealingAllowed', 'Stealing allowed'],
  ['leadOffsAllowed', 'Lead-offs allowed'],
  ['infieldFlyRule', 'Infield fly rule'],
  ['walksAdvanceAllRunners', 'Walks advance all runners'],
  ['courtesyRunnerForCatcher', 'Courtesy runner for catcher'],
];

const PRESETS = PRESET_ORDER;

export default function SettingsScreen() {
  const { team, loading } = useGameDay();
  const { user } = useAuth();
  const [rules, setRules] = useState(null);
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (team?.rules) setRules({ ...team.rules }); }, [team?.id]);
  useEffect(() => {
    if (!team?.id) return undefined;
    return subscribeMembers(team.id, setMembers);
  }, [team?.id]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'teams', team.id), { rules });
      Alert.alert('Saved', 'Applies to games created from now on. Games already played keep their own rules.');
    } catch (e) { Alert.alert('Could not save', e.message); }
    setSaving(false);
  }, [team?.id, rules]);

  if (loading || !rules) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;
  if (!team) return <Centered><Text style={styles.msg}>No team yet.</Text></Centered>;

  const origin = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin : 'https://fanfare-sports.web.app';
  const joinUrl = buildJoinUrl(origin, team.id, team.joinCode);

  const setNum = (k, v) => setRules((r) => ({ ...r, [k]: v === '' ? null : Number(v) }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Settings</Text>
        <Text style={styles.h2}>{team.name} · {team.season}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Section title="Invite people"
                   sub="Anyone with this code can join the team. They won't see a player's stats until a coach links them to that child.">
            <View style={styles.codeBox}>
              <Text style={styles.code}>{team.joinCode}</Text>
            </View>
            <Text style={styles.url} selectable>{joinUrl}</Text>
            <Text style={styles.hint}>
              Text this link. It opens straight to the join screen with the code
              filled in.
            </Text>
          </Section>

          <Section title={`On this team · ${members.length}`}>
            {members.map((m) => (
              <View key={m.uid} style={styles.memberRow}>
                <Text style={styles.memberName}>
                  {m.displayName || (m.uid === user?.uid ? 'You' : 'Team member')}
                </Text>
                <Text style={styles.memberRole}>{ROLE_LABELS[m.role] || m.role}</Text>
              </View>
            ))}
          </Section>

          <Section title="Start from a preset"
                   sub="Overwrites the values below. Adjust anything afterward.">
            <View style={styles.chips}>
              {PRESETS.map(([k, l]) => (
                <Pressable key={k} onPress={() => setRules({ ...RULE_PRESETS[k] })} style={styles.chip}>
                  <Text style={styles.chipText}>{l}</Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="Limits" sub="Tap − and + to adjust. OFF means no limit.">
            {NUMBERS.map(([key, label]) => (
              <Stepper
                key={key} label={label} value={rules[key]}
                bounds={RULE_BOUNDS[key]}
                format={key.includes('Minutes') ? formatMinutes : undefined}
                onChange={(v) => setRules((r) => ({ ...r, [key]: v }))}
              />
            ))}
          </Section>

          <Section title="Rules of play" sub="These change how the scoring engine behaves.">
            {TOGGLES.map(([key, label]) => (
              <View key={key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Switch
                  value={!!rules[key]}
                  onValueChange={(v) => setRules((r) => ({ ...r, [key]: v }))}
                  trackColor={{ true: colors.primary, false: '#CBD5E1' }}
                />
              </View>
            ))}
          </Section>

          <Pressable onPress={save} disabled={saving} style={styles.cta}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>SAVE SETTINGS</Text>}
          </Pressable>

          <Pressable onPress={() => Alert.alert('Sign out?', '', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
          ])} style={[styles.cta, styles.ctaGhost]}>
            <Text style={[styles.ctaText, { color: colors.out }]}>SIGN OUT</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Free-text number fields invited typos that silently broke scoring — a
 * 60-inning game, a 3-pitch limit. A stepper can only produce values the rule
 * set allows.
 */
function Stepper({ label, value, bounds, onChange, format }) {
  const b = bounds || { min: 0, max: 99, step: 1, nullable: true };
  const isOff = value == null;

  const clamp = (v) => Math.max(b.min, Math.min(b.max, v));
  const dec = () => {
    if (isOff) return onChange(b.max);
    const next = value - b.step;
    if (next < b.min) return b.nullable ? onChange(null) : onChange(b.min);
    onChange(next);
  };
  const inc = () => {
    if (isOff) return onChange(b.min);
    onChange(clamp(value + b.step));
  };

  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={dec} style={styles.stepBtn} hitSlop={6}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>
          {isOff ? 'OFF' : (format ? format(value) : value)}
        </Text>
        <Pressable onPress={inc} style={styles.stepBtn} hitSlop={6}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 105 reads as "1h 45m" — nobody thinks about game length in raw minutes. */
function formatMinutes(m) {
  const h = Math.floor(m / 60), mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

const Section = ({ title, sub, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    {children}
  </View>
);

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
  scroll: { padding: spacing.md, paddingBottom: 50 },
  section: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  sectionTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy },
  sectionSub: { ...text.body, fontSize: 12, color: colors.pencil, marginTop: 4, marginBottom: spacing.md, lineHeight: 17 },
  codeBox: { backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  code: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 30, color: '#FFF', letterSpacing: 5 },
  url: { ...text.body, fontSize: 11.5, color: colors.primary, marginTop: spacing.md, lineHeight: 17 },
  hint: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 6, lineHeight: 16 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  memberName: { ...text.bodyStrong, fontSize: 14, color: colors.navy },
  memberRole: { ...text.body, fontSize: 11.5, color: colors.pencil },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC' },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.navy },
  field: { marginBottom: spacing.md },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line, gap: spacing.md,
  },
  stepLabel: { ...text.bodyStrong, fontSize: 14, color: colors.navy, flex: 1 },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: '#FDFDFC',
  },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 20, color: colors.navy },
  stepValue: {
    minWidth: 62, textAlign: 'center',
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 14, color: colors.navy,
  },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line },
  toggleLabel: { ...text.bodyStrong, fontSize: 14, color: colors.navy, flex: 1, paddingRight: spacing.md },
  cta: { height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center' },
});
