/**
 * AdvanceSheet.jsx — Where did the runners end up?
 *
 * Shown only when a runner genuinely had a choice. The sport pack decides
 * that (describeAdvancePrompt) and hands over a ready-made spec, so this
 * component renders rows and buttons and knows nothing about bases.
 *
 * ── Pre-filled, never blank ─────────────────────────────────────────────────
 *
 * Every runner arrives with the old automatic answer already selected, so the
 * fastest path is one tap on CONFIRM and the play is recorded exactly as it
 * would have been before this existed. That matters more than it sounds: this
 * sheet interrupts a person watching a live game, and an interruption that
 * demands thought on every appearance gets dismissed on reflex until it may as
 * well not be there.
 *
 * Only legal destinations are offered. A runner who cannot hold is not shown a
 * HOLD button to be told off for pressing — the sport pack has already worked
 * out what's possible, so nothing here can be rejected after the fact.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';

import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

/**
 * @param spec      from the sport's describeAdvancePrompt, or null to hide
 * @param onConfirm (advances) => void — a { fromBase: destination } map
 * @param onCancel  dismiss without recording anything
 */
export default function AdvanceSheet({ spec, onConfirm, onCancel }) {
  const [picked, setPicked] = useState({});

  // Re-seed whenever a new play opens the sheet. Without this, a second hit
  // would inherit the previous play's answers.
  useEffect(() => {
    if (!spec) return;
    const seed = {};
    for (const r of spec.runners) seed[r.from] = r.selected;
    setPicked(seed);
  }, [spec]);

  if (!spec) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Where did the runners stop?</Text>
        <Text style={styles.sub}>
          Already set to the usual result — tap Record if that's what happened.
        </Text>

        {spec.runners.map((r) => (
          <View key={r.from} style={styles.row}>
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>
                {r.jersey != null ? `#${r.jersey} ` : ''}{r.name}
              </Text>
              <Text style={styles.from}>
                {r.from === 1 ? 'On 1st' : r.from === 2 ? 'On 2nd' : 'On 3rd'}
                {r.forced ? ' · forced' : ''}
              </Text>
            </View>

            <View style={styles.choices}>
              {r.choices.map((c) => {
                const on = picked[r.from] === c.dest;
                return (
                  <Pressable
                    key={c.dest}
                    onPress={() => setPicked((p) => ({ ...p, [r.from]: c.dest }))}
                    style={[styles.choice, on && styles.choiceOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${r.name} ${c.label}`}
                  >
                    <Text style={[styles.choiceText, on && styles.choiceTextOn]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.btns}>
          <Pressable onPress={onCancel} style={[styles.cta, styles.ctaGhost]}>
            <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm?.(picked)} style={[styles.cta, styles.flex]}>
            <Text style={styles.ctaText}>RECORD</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: colors.chalk,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, ...shadow.card,
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
  row: {
    backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  who: { flex: 1, minWidth: 0 },
  name: { ...text.bodyStrong, fontSize: 13.5, color: colors.navy },
  from: { ...text.label, fontSize: 9, color: colors.pencil, marginTop: 2 },
  choices: { flexDirection: 'row', gap: 5 },
  choice: {
    paddingHorizontal: 11, paddingVertical: 9, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.chalk,
    minWidth: 46, alignItems: 'center',
  },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { ...text.buttonSecondary, fontSize: 11, color: colors.navy },
  choiceTextOn: { color: '#FFFFFF' },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  cta: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
  },
  ctaGhost: { backgroundColor: 'transparent' },
  ctaText: { ...text.buttonPrimary, color: '#FFFFFF' },
});
