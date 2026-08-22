/**
 * CorrectionSheet.jsx — The "more" sheet, in the slot baseball uses for
 * baserunning.
 *
 * Basketball has no runners to move, so this covers the two things a
 * scorekeeper actually needs mid-game that aren't on the pads: ending a
 * period, and setting the five on the floor when subs have drifted out of sync
 * with reality.
 *
 * That second one matters more than it looks. Minutes are only credited for
 * periods where the on-court five was known, so a scorekeeper who lost track
 * needs a way to re-establish it rather than logging fictional substitutions.
 */

import React, { useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView,
} from 'react-native';

import { EV } from '../events.js';
import { colors, radius, spacing, text } from '../../../theme/tokens.js';

export default function CorrectionSheet({ visible, state, rules, nameFor, onEvent, onClose }) {
  const [picked, setPicked] = useState([]);
  if (!visible) return null;

  const size = rules?.playersOnCourt || 5;
  const roster = state.roster || [];
  const toggle = (id) => setPicked((cur) =>
    cur.includes(id) ? cur.filter((x) => x !== id)
      : cur.length < size ? [...cur, id] : cur);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Game controls</Text>

        <Pressable
          onPress={() => { onEvent(EV.PERIOD_END, {}); onClose(); }}
          style={styles.action}
        >
          <Text style={styles.actionText}>END PERIOD {state.period}</Text>
        </Pressable>

        <Text style={styles.label}>SET WHO'S ON THE FLOOR</Text>
        <Text style={styles.hint}>
          Pick {size}. Use this if substitutions got out of step with the game —
          minutes only count for periods where the floor is known, so
          re-establishing it here is better than logging subs that didn't happen.
        </Text>

        <ScrollView style={styles.list}>
          <View style={styles.chips}>
            {roster.map((id) => {
              const on = picked.includes(id);
              const out = state.fouledOut?.includes(id);
              return (
                <Pressable key={id} onPress={() => !out && toggle(id)}
                  style={[styles.chip, on && styles.chipOn, out && styles.chipOut]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {nameFor?.(id) || id}
                  </Text>
                  {out && <Text style={styles.chipOutText}>FOULED OUT</Text>}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.btns}>
          <Pressable onPress={onClose} style={[styles.cta, styles.ctaGhost]}>
            <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
          </Pressable>
          <Pressable
            disabled={picked.length !== size}
            onPress={() => {
              onEvent(EV.LINEUP_SET, { playerIds: picked });
              setPicked([]);
              onClose();
            }}
            style={[styles.cta, styles.flex, picked.length !== size && styles.ctaOff]}
          >
            <Text style={styles.ctaText}>SET LINEUP ({picked.length}/{size})</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  action: {
    height: 46, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  actionText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.7 },
  label: { ...text.label, fontSize: 9, color: colors.pencil, marginTop: spacing.lg, marginBottom: 4 },
  hint: { ...text.body, fontSize: 11.5, color: colors.pencil, marginBottom: spacing.sm, lineHeight: 16 },
  list: { flexGrow: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipOut: { opacity: 0.45, borderStyle: 'dashed' },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.navy },
  chipTextOn: { color: '#FFF' },
  chipOutText: { ...text.label, fontSize: 6.5, color: colors.out },
  flex: { flex: 1 },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cta: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaOff: { opacity: 0.4 },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.7 },
});
