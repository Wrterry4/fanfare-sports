/**
 * RunnerSheet.jsx — Baserunning and miscues.
 *
 * Opened by tapping a runner on the diamond, which scopes the actions to that
 * runner, or by "More", which shows everything. Scoping matters: a stolen base
 * needs to know WHICH runner, and asking afterward is a second tap during a
 * play that's already over.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { EV } from '../events.js';
import { colors, radius, spacing, text } from '../../../theme/tokens.js';

const RUNNER_ACTIONS = [
  [EV.STOLEN_BASE, 'Stolen base'],
  [EV.CAUGHT_STEALING, 'Caught stealing'],
  [EV.PICKED_OFF, 'Picked off'],
];

const MISCUES = [
  [EV.WILD_PITCH, 'Wild pitch'],
  [EV.PASSED_BALL, 'Passed ball'],
  [EV.BALK, 'Balk'],
];

function Row({ label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.rowPressed,
                               disabled && styles.rowDisabled]}>
      <Text style={[styles.rowText, disabled && styles.rowTextDisabled]}>
        {label}{disabled ? '  — not allowed at this level' : ''}
      </Text>
    </Pressable>
  );
}

function RunnerSheet({ visible, context, state, rules, nameFor, onEvent, onClose }) {
  if (!visible || !context) return null;
  const { base, playerId } = context;
  const scoped = !!playerId;

  const fire = (type) => {
    onEvent(type, scoped ? { runnerId: playerId, fromBase: base, runners: [base] } : {});
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          {scoped ? nameFor(playerId) : 'Other actions'}
        </Text>
        {scoped && (
          <Text style={styles.subtitle}>
            On {base === 1 ? 'first' : base === 2 ? 'second' : 'third'}
          </Text>
        )}

        {scoped && RUNNER_ACTIONS.map(([ev, label]) => {
          // Settings are reactive: turning stealing off in a t-ball or coach
          // pitch league greys these out rather than allowing an event the
          // league's rules don't have.
          const stealing = ev === EV.STOLEN_BASE || ev === EV.CAUGHT_STEALING;
          const disabled = stealing && rules && rules.stealingAllowed === false;
          return (
            <Row key={ev} label={label} disabled={disabled}
                 onPress={() => !disabled && fire(ev)} />
          );
        })}

        <Text style={styles.section}>Miscues</Text>
        {MISCUES.map(([ev, label]) => (
          <Row key={ev} label={label} onPress={() => fire(ev)} />
        ))}

        <Pressable onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,33,58,0.35)' },
  sheet: {
    backgroundColor: colors.chalk,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  subtitle: { ...text.body, fontSize: 12, color: colors.pencil, marginTop: 2, marginBottom: 6 },
  section: { ...text.label, color: colors.pencil, marginTop: spacing.md, marginBottom: 4 },
  row: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 14, marginTop: 6,
  },
  rowPressed: { backgroundColor: '#F0EDE6' },
  rowDisabled: { opacity: 0.4 },
  rowTextDisabled: { color: colors.pencil },
  rowText: { ...text.bodyStrong, fontSize: 14, color: colors.navy },
  cancel: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  cancelText: { ...text.buttonSecondary, fontSize: 12, color: colors.pencil },
});

export default memo(RunnerSheet);
