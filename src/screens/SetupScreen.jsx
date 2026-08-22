/**
 * SetupScreen.jsx — First run: team, roster, first game.
 *
 * One screen with three steps rather than three routes. A coach setting up at
 * a kitchen table wants to finish in one sitting, and every navigation
 * transition is somewhere to abandon the process.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTeam, createPlayers, createGame, SPARK_MODE } from '../services/bootstrap.js';
import { getSport } from '../sports/registry.js';
import { confirm, notify } from '../utils/confirm.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

/**
 * First run creates a baseball team. Other sports are created afterward from
 * the account menu, which has a sport picker — a three-step wizard is for
 * teaching the app, and a sport choice on step one is a question a first-time
 * user has no context to answer.
 */
const SETUP_SPORT = 'baseball';
const PRESETS = getSport(SETUP_SPORT).PRESET_LABELS;

export default function SetupScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [teamName, setTeamName] = useState('');
  const [season, setSeason] = useState('Spring 2027');
  const [preset, setPreset] = useState('kidPitch10U');
  const [teamId, setTeamId] = useState(null);

  // One player per line: "12 Jack Miller"
  const [rosterText, setRosterText] = useState('');
  const [opponent, setOpponent] = useState('');
  const [homeOrAway, setHomeOrAway] = useState('home');

  const parsedRoster = parseRoster(rosterText);

  const doCreateTeam = useCallback(async () => {
    setError(null); setBusy(true);
    try {
      if (!teamName.trim()) throw new Error('Give the team a name.');
      const { teamId: id } = await createTeam({
        name: teamName, season, division: PRESETS.find(p => p[0] === preset)?.[1],
        rules: getSport(SETUP_SPORT).RULE_PRESETS[preset], sport: SETUP_SPORT,
      });
      setTeamId(id);
      setStep(2);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }, [teamName, season, preset]);

  const doCreateRoster = useCallback(async () => {
    setError(null); setBusy(true);
    try {
      if (!parsedRoster.length) throw new Error('Add at least one player.');
      await createPlayers(teamId, parsedRoster);
      setStep(3);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }, [teamId, parsedRoster]);

  const doCreateGame = useCallback(async () => {
    setError(null); setBusy(true);
    try {
      if (!opponent.trim()) throw new Error('Who are you playing?');
      await createGame({
        teamId, opponent, homeOrAway,
        rules: getSport(SETUP_SPORT).RULE_PRESETS[preset], date: new Date(),
      });
      navigation.replace('Tabs');
    } catch (e) { setError(e.message); setBusy(false); }
  }, [teamId, opponent, homeOrAway, preset, navigation]);

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.steps}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={[styles.dot, step >= n && styles.dotOn]} />
            ))}
          </View>

          {step === 1 && (
            <Card title="Create your team" sub="You can change any of this later.">
              <Field label="Team name" value={teamName} onChange={setTeamName}
                     placeholder="Ridgeview Reds" autoCapitalize="words" />
              <Field label="Season" value={season} onChange={setSeason}
                     placeholder="Spring 2027" />
              <Text style={styles.label}>Level of play</Text>
              <View style={styles.chips}>
                {PRESETS.map(([key, label]) => (
                  <Pressable key={key} onPress={() => setPreset(key)}
                    style={[styles.chip, preset === key && styles.chipOn]}>
                    <Text style={[styles.chipText, preset === key && styles.chipTextOn]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>
                Sets innings, run caps, pitch limits, and rest days. All editable
                in team settings.
              </Text>
              <Cta onPress={doCreateTeam} busy={busy} label="CONTINUE" />
            </Card>
          )}

          {step === 2 && (
            <Card title="Add your roster"
                  sub="One player per line. Jersey number first, then name.">
              <TextInput
                value={rosterText}
                onChangeText={setRosterText}
                multiline
                style={styles.textarea}
                placeholder={"12 Jack Miller\n7 Wu Chen\n23 Luis Ortiz"}
                placeholderTextColor="#A0A8B8"
                autoCapitalize="words"
              />
              <Text style={styles.hint}>
                {parsedRoster.length} player{parsedRoster.length === 1 ? '' : 's'} detected
              </Text>
              <Cta onPress={doCreateRoster} busy={busy} label="CONTINUE" />
            </Card>
          )}

          {step === 3 && (
            <Card title="Your first game" sub="Start one now so you can try scoring.">
              <Field label="Opponent" value={opponent} onChange={setOpponent}
                     placeholder="Northgate" autoCapitalize="words" />
              <Text style={styles.label}>Home or away</Text>
              <View style={styles.chips}>
                {[['home', 'Home'], ['away', 'Away']].map(([k, l]) => (
                  <Pressable key={k} onPress={() => setHomeOrAway(k)}
                    style={[styles.chip, homeOrAway === k && styles.chipOn]}>
                    <Text style={[styles.chipText, homeOrAway === k && styles.chipTextOn]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <Cta onPress={doCreateGame} busy={busy} label="START SCORING" />
            </Card>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {SPARK_MODE && (
            <Text style={styles.devNote}>
              Test mode: running without Cloud Functions. Parent invites and
              career stats need the Blaze plan.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** "12 Jack Miller" -> { jerseyNumber: 12, firstName: 'Jack', lastName: 'Miller' } */
function parseRoster(t) {
  return String(t).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(\d+)\s+(.*)$/);
    const jersey = m ? parseInt(m[1], 10) : null;
    const nameStr = m ? m[2] : line;
    const parts = nameStr.split(/\s+/);
    return {
      jerseyNumber: jersey,
      firstName: parts[0] || 'Player',
      lastName: parts.slice(1).join(' '),
    };
  });
}

const Card = ({ title, sub, children }) => (
  <View style={styles.card}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.sub}>{sub}</Text>
    {children}
  </View>
);

const Cta = ({ onPress, busy, label }) => (
  <Pressable onPress={onPress} disabled={busy} style={styles.cta}>
    {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>{label}</Text>}
  </Pressable>
);

const Field = ({ label, value, onChange, ...rest }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} style={styles.input}
               placeholderTextColor="#A0A8B8" {...rest} />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 32 },
  steps: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: spacing.lg },
  dot: { width: 26, height: 4, borderRadius: 2, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.primary },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: spacing.lg, ...shadow.card,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 19, color: colors.navy },
  sub: { ...text.body, color: colors.pencil, marginTop: 4, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: 12, height: 46, fontSize: 16, color: colors.navy,
    backgroundColor: '#FDFDFC',
  },
  textarea: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: 12, minHeight: 170, fontSize: 16, color: colors.navy,
    backgroundColor: '#FDFDFC', textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC',
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  hint: { ...text.body, fontSize: 11.5, color: colors.pencil, marginBottom: spacing.md, lineHeight: 17 },
  cta: {
    height: 50, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  error: { ...text.bodyStrong, fontSize: 13, color: colors.out, marginTop: spacing.md, textAlign: 'center' },
  devNote: {
    ...text.body, fontSize: 11, color: colors.pencil, textAlign: 'center',
    marginTop: spacing.lg, lineHeight: 16,
  },
});
