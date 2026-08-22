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
  ActivityIndicator, Platform, KeyboardAvoidingView, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db, doc, updateDoc } from '../services/firebase';
import { useGameDay } from '../hooks/useGameDay.js';
import { useAuth } from '../hooks/AuthProvider.jsx';
import {
  subscribeMembers, buildJoinUrl, ROLE_LABELS,
  subscribePendingClaims, resolvePlayerClaim,
} from '../services/membership.js';
import { useMyRole } from '../hooks/useMyRole.js';
import NotificationSettings from '../components/NotificationSettings.jsx';
import { sportForTeam } from '../sports/registry.js';
import { confirm, notify } from '../utils/confirm.js';
import AppHeader from '../components/AppHeader.jsx';
import AccountSheet from '../components/AccountSheet.jsx';
import TeamColorPicker from '../components/TeamColorPicker.jsx';
import { ensureStatsAccess } from '../services/statsService.js';
import { BUILD_INFO } from '../generated/buildInfo.js';
import { formatBuildLabel } from '../shared/buildLabel.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

export default function SettingsScreen() {
  const { team, loading } = useGameDay();
  const { user } = useAuth();
  // Not a hook — BUILD_INFO is fixed for the lifetime of this bundle, so
  // there's nothing to recompute on re-render.
  const buildLabel = formatBuildLabel(BUILD_INFO);
  const [rules, setRules] = useState(null);
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const [claims, setClaims] = useState([]);
  const [copied, setCopied] = useState(false);
  const { isStaff, isFan, member } = useMyRole();

  /**
   * Rule labels come from the team's sport.
   *
   * These were three hardcoded arrays in this file, all describing baseball —
   * a basketball team's settings offered "Innings per game" and "Dropped third
   * strike". Each pack now names the rules it actually has.
   */
  const sport = sportForTeam(team);
  const NUMBERS = sport.RULE_NUMBERS || [];
  const TOGGLES = sport.RULE_TOGGLES || [];
  const PRESETS = sport.PRESET_LABELS || [];
  const RULE_BOUNDS = sport.RULE_BOUNDS || {};
  const RULE_PRESETS = sport.RULE_PRESETS || {};

  useEffect(() => { if (team?.rules) setRules({ ...team.rules }); }, [team?.id]);
  useEffect(() => {
    if (!team?.id) return undefined;
    return subscribeMembers(team.id, setMembers);
  }, [team?.id]);

  useEffect(() => {
    if (!team?.id || !isStaff) return undefined;
    return subscribePendingClaims(team.id, setClaims);
  }, [team?.id, isStaff]);

  /**
   * Builds the link inside the callback rather than closing over it.
   *
   * The dependency array used to name `joinUrl`, which is declared further
   * down after the early returns — and a dependency array is evaluated during
   * render, so it read the binding before its declaration. That's a temporal
   * dead zone error, and it took down every screen that mounts Settings.
   */
  const copyInvite = useCallback(async () => {
    if (!team) return;
    const origin = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin : 'https://fanfare-sports.web.app';
    const url = buildJoinUrl(origin, team.id, team.joinCode);
    const message =
      `You're invited to follow ${team.name} on Fanfare Sports — live scoring, ` +
      `stats, and team messages.\n\nJoin here: ${url}\n\nJoin code: ${team.joinCode}`;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(message);
      } else {
        await Share.share({ message });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { notify('Could not copy', 'Long-press the code to copy it manually.'); }
  }, [team]);

  /**
   * Saved immediately rather than waiting for the Save button at the bottom.
   * That button belongs to the rules form; a swatch tap reads as a direct
   * action, and making someone scroll to confirm a color is how you end up
   * with teams whose color silently didn't stick.
   */
  const saveColor = useCallback(async (colorId) => {
    try {
      await updateDoc(doc(db, 'teams', team.id), { colorId: colorId || null });
    } catch (e) { notify('Could not save the color', e.message); }
  }, [team?.id]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'teams', team.id), { rules });
      notify('Saved', 'Applies to games created from now on. Games already played keep their own rules.');
    } catch (e) { notify('Could not save', e.message); }
    setSaving(false);
  }, [team?.id, rules]);

  if (loading || !rules) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;
  if (!team) return <Centered><Text style={styles.msg}>No team yet.</Text></Centered>;

  // Grandparents and family follow one child. They aren't part of the team's
  // adult roster, so they don't appear in this list — but staff can still see
  // them, otherwise nobody could manage who they'd let in.
  const visibleMembers = isStaff ? members : members.filter((m) => m.role !== 'fan');

  const setNum = (k, v) => setRules((r) => ({ ...r, [k]: v === '' ? null : Number(v) }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader team={team} onMenu={() => setMenu(true)} />
      <AccountSheet visible={menu} onClose={() => setMenu(false)} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Staff only. The join code adds people to the team, which isn't a
              fan's call to make — and a fan opening Settings to change their
              notification preferences shouldn't be handed one. */}
          {isStaff && (
          <Section title="Invite people"
                   sub="Anyone with this code can join the team. They see a player's stats only after you link them to that child.">
            <View style={styles.codeBox}>
              <Text style={styles.code}>{team.joinCode}</Text>
            </View>
            <Pressable onPress={copyInvite} style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>{copied ? 'COPIED ✓' : 'COPY INVITE'}</Text>
            </Pressable>
            <Text style={styles.hint}>
              Copies a short message with the link. Paste it into a text or your
              team's group chat.
            </Text>
          </Section>
          )}

          {isStaff && claims.length > 0 && (
            <Section title={`Requests · ${claims.length}`}
                     sub="Someone has asked to be linked to a player.">
              {claims.map((c) => (
                <View key={c.id} style={styles.claimRow}>
                  <View style={styles.flex}>
                    <Text style={styles.claimName}>{c.requestedByName}</Text>
                    <Text style={styles.claimMeta}>
                      wants to be linked as {c.kind === 'parent' ? 'a parent' : 'a fan'}
                    </Text>
                  </View>
                  <Pressable onPress={() => resolvePlayerClaim(c.id, false)}
                    style={[styles.claimBtn, styles.claimGhost]}>
                    <Text style={[styles.claimBtnText, { color: colors.pencil }]}>DENY</Text>
                  </Pressable>
                  <Pressable onPress={() => resolvePlayerClaim(c.id, true)} style={styles.claimBtn}>
                    <Text style={styles.claimBtnText}>APPROVE</Text>
                  </Pressable>
                </View>
              ))}
            </Section>
          )}

          <Section title={`On this team · ${visibleMembers.length}`}>
            {visibleMembers.map((m) => (
              <View key={m.uid} style={styles.memberRow}>
                <View style={styles.flex}>
                  <Text style={styles.memberName}>
                    {m.displayName || (m.uid === user?.uid ? 'You' : 'Team member')}
                  </Text>
                  <Text style={styles.memberRole}>{ROLE_LABELS[m.role] || m.role}</Text>
                </View>
                {m.uid === user?.uid && <Text style={styles.youTag}>YOU</Text>}
              </View>
            ))}
          </Section>

          <Section title="Notifications"
                   sub="Yours, on this team. Everyone chooses their own.">
            <NotificationSettings team={team} member={member} isFan={isFan} />
          </Section>

          {/* Rules of play are the coach's. Everyone else gets Settings for
              their own notification preferences and nothing more. */}
          {isStaff && (<>
          <Section title="Team color"
                   sub="Their jersey color. Shows on the scoreboard and celebrations.">
            <TeamColorPicker
              value={team.colorId ?? null}
              onChange={saveColor}
              label={null}
            />
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
          </>)}

          {/* Visible to every role, staff or not — this is a diagnostic
              anyone might need to read out loud on a phone call, not a
              staff-only setting. */}
          <Text style={styles.buildLabel}>{buildLabel}</Text>

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
  presetBtn: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  presetBtnText: { ...text.buttonSecondary, fontSize: 11, color: colors.navy, letterSpacing: 0.6 },
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
  copyBtn: {
    height: 46, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  copyBtnText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  claimRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line,
  },
  claimName: { ...text.bodyStrong, fontSize: 14, color: colors.navy },
  claimMeta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  claimBtn: {
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: colors.navy,
  },
  claimGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  claimBtnText: { ...text.buttonSecondary, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  youTag: { ...text.label, fontSize: 8.5, color: colors.primary },
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
  buildLabel: {
    ...text.label, fontSize: 9.5, color: colors.pencil, opacity: 0.6,
    textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.md,
  },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center' },
});
