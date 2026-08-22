/**
 * NewTeamSheet.jsx — Starting another team.
 *
 * Team creation already existed, but only inside SetupScreen — the first-run
 * flow, which is unreachable the moment you have one team. So a coach with a
 * spring team and a fall team, or a parent whose second child joined a
 * different club, had no path at all. This is that path.
 *
 * Deliberately shorter than setup: name, season, and a rule preset. Roster and
 * first game are skipped, because someone adding a second team already knows
 * where the Roster and Schedule tabs are — the three-step wizard exists to
 * teach that, and teaching it twice is padding.
 *
 * The sport picker only appears when more than one sport is registered, so it
 * costs nothing today and needs no edit when the second pack lands.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';

import { createTeam } from '../services/bootstrap.js';
import TeamColorPicker from './TeamColorPicker.jsx';
import { SPORTS, sportKeys, getSport } from '../sports/registry.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

/** "Fall 2026" — the season someone is most likely creating a team for. */
function currentSeasonGuess() {
  const now = new Date();
  const month = now.getMonth();
  const name = month <= 1 ? 'Winter' : month <= 4 ? 'Spring'
             : month <= 7 ? 'Summer' : 'Fall';
  return `${name} ${now.getFullYear()}`;
}

export default function NewTeamSheet({ visible, onClose, onCreated }) {
  const sports = sportKeys();
  const [sport, setSport] = useState('baseball');
  const [name, setName] = useState('');
  const [season, setSeason] = useState(currentSeasonGuess);
  const [preset, setPreset] = useState(null);
  const [colorId, setColorId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pack = getSport(sport);
  const presets = pack.PRESET_LABELS || [];
  // Defaulting to nothing would mean shipping a team with no rules at all.
  const chosenPreset = preset || presets[0]?.[0];

  const reset = useCallback(() => {
    setName(''); setSeason(currentSeasonGuess()); setPreset(null);
    setError(null); setSport('baseball'); setColorId(null);
  }, []);

  const create = useCallback(async () => {
    setError(null);
    if (!name.trim()) { setError('Give the team a name.'); return; }
    setBusy(true);
    try {
      const { teamId } = await createTeam({
        name: name.trim(),
        season: season.trim() || currentSeasonGuess(),
        division: presets.find(([k]) => k === chosenPreset)?.[1] || null,
        sport,
        rules: pack.RULE_PRESETS?.[chosenPreset] || {},
        colorId,
      });
      reset();
      // Switching to the new team is the whole point of having made it.
      onCreated?.(teamId);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }, [name, season, sport, colorId, chosenPreset, presets, pack, onCreated, reset]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>New team</Text>
          <Text style={styles.sub}>
            You'll be the head coach. Add players and games afterward from the
            Roster and Schedule tabs.
          </Text>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {sports.length > 1 && (
              <>
                <Text style={styles.label}>Sport</Text>
                <View style={styles.chips}>
                  {sports.map((k) => (
                    <Pressable key={k} onPress={() => { setSport(k); setPreset(null); }}
                      style={[styles.chip, sport === k && styles.chipOn]}>
                      <Text style={[styles.chipText, sport === k && styles.chipTextOn]}>
                        {SPORTS[k]?.displayName || k}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Team name</Text>
            <TextInput value={name} onChangeText={setName} style={inputStyle}
              autoCapitalize="words" placeholder="10U Seminoles"
              placeholderTextColor="#A0A8B8" autoFocus />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Season</Text>
            <TextInput value={season} onChangeText={setSeason} style={inputStyle}
              autoCapitalize="words" placeholder="Fall 2026"
              placeholderTextColor="#A0A8B8" />

            <View style={{ marginTop: spacing.md }}>
              <TeamColorPicker value={colorId} onChange={setColorId} />
              <Text style={styles.hint}>
                Their jersey color. Shows up on the scoreboard and celebrations.
                Changeable later in Settings.
              </Text>
            </View>

            {presets.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: spacing.md }]}>Rules</Text>
                <Text style={styles.hint}>
                  Sets pitch limits, innings, and mercy rules. Everything is
                  adjustable later in Settings.
                </Text>
                <View style={styles.chips}>
                  {presets.map(([k, l]) => (
                    <Pressable key={k} onPress={() => setPreset(k)}
                      style={[styles.chip, chosenPreset === k && styles.chipOn]}>
                      <Text style={[styles.chipText, chosenPreset === k && styles.chipTextOn]}>
                        {l}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.btns}>
            <Pressable onPress={() => { reset(); onClose(); }} style={[styles.cta, styles.ctaGhost]}>
              <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
            </Pressable>
            <Pressable onPress={create} disabled={busy} style={[styles.cta, styles.flex]}>
              {busy ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.ctaText}>CREATE TEAM</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sub: {
    ...text.body, fontSize: 12.5, color: colors.pencil,
    marginTop: 4, marginBottom: spacing.md, lineHeight: 17,
  },
  body: { flexGrow: 0 },
  flex: { flex: 1 },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  hint: { ...text.body, fontSize: 11.5, color: colors.pencil, marginBottom: 7, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  error: { ...text.body, fontSize: 12.5, color: colors.out, marginTop: spacing.md },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cta: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
