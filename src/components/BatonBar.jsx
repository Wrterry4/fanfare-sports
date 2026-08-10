/**
 * BatonBar.jsx — Handoff and scoring mode.
 *
 * Passing the book between innings is the intended pattern, not an edge case.
 * One parent doing 400 taps burns out by week four; three parents splitting it
 * is a workload nobody notices.
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { approveBaton, denyBaton } from '../services/gameService.js';
import { SCORING_MODES, MODE_TRADEOFFS, estimateTaps } from '../sports/baseball/scoringModes.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

function BatonBar({ game, teamId, gameId, mode, onChangeMode }) {
  const requester = game?.batonRequestedBy;

  const handleApprove = useCallback(() => {
    approveBaton(teamId, gameId, requester).catch(() => {});
  }, [teamId, gameId, requester]);

  const toggleMode = useCallback(() => {
    const next = mode === SCORING_MODES.FULL ? SCORING_MODES.CASUAL : SCORING_MODES.FULL;
    const t = MODE_TRADEOFFS[next];
    const taps = estimateTaps(next);
    Alert.alert(
      t.label,
      `${t.detail}\n\nAbout ${taps.total} taps per game.` +
      (t.loses.length ? `\n\nYou give up: ${t.loses.join(', ')}.` : ''),
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Switch', onPress: () => onChangeMode(next) }]
    );
  }, [mode, onChangeMode]);

  return (
    <View style={styles.wrap}>
      {requester && (
        <View style={styles.request}>
          <Text style={styles.requestText}>
            Someone has asked for the book.
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={() => denyBaton(teamId, gameId)} style={styles.ghost}>
              <Text style={styles.ghostText}>NOT NOW</Text>
            </Pressable>
            <Pressable onPress={handleApprove} style={styles.primary}>
              <Text style={styles.primaryText}>PASS IT</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable onPress={toggleMode} style={styles.mode}>
        <Text style={styles.modeLabel}>SCORING</Text>
        <Text style={styles.modeValue}>{MODE_TRADEOFFS[mode].label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 14, marginBottom: spacing.md, gap: spacing.sm },
  request: {
    backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#E8D9AE',
    borderRadius: radius.md, padding: 11, gap: 9,
  },
  requestText: { ...text.bodyStrong, fontSize: 12.5, color: colors.navy },
  actions: { flexDirection: 'row', gap: spacing.sm },
  ghost: {
    flex: 1, height: 36, borderRadius: 7, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostText: { ...text.buttonSecondary, fontSize: 11, color: colors.pencil },
  primary: {
    flex: 1, height: 36, borderRadius: 7, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { ...text.buttonSecondary, fontSize: 11, color: colors.white },
  mode: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 11,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.card,
  },
  modeLabel: { ...text.label, color: colors.pencil },
  modeValue: { ...text.buttonSecondary, fontSize: 12, color: colors.navy },
});

export default memo(BatonBar);
