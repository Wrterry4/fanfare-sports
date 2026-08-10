/**
 * BatterBar.jsx — Who's up, and how they've done today.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, text, shadow } from '../../../theme/tokens.js';

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function BatterBar({ player, stats, battingOrder }) {
  if (!player) return null;
  const line = stats
    ? `${stats.H}-for-${stats.AB}${stats.RBI ? `, ${stats.RBI} RBI` : ''}`
    : '0-for-0';

  return (
    <View style={styles.bar}>
      <View style={styles.jersey}>
        <Text style={styles.jerseyText}>{player.jerseyNumber ?? '–'}</Text>
      </View>
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {player.firstName} {player.lastName}
        </Text>
        <Text style={styles.meta}>
          Batting {ordinal(battingOrder)}
          {player.primaryPosition ? ` · ${player.primaryPosition}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.rightLabel}>TODAY</Text>
        <Text style={styles.rightLine}>{line}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginHorizontal: 14, marginBottom: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: 11, ...shadow.card,
  },
  jersey: {
    width: 38, height: 38, borderRadius: 8, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  jerseyText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 16, color: colors.white },
  middle: { flex: 1 },
  name: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  meta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  rightLabel: { ...text.label, color: colors.pencil },
  rightLine: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 13,
    color: colors.clay, fontVariant: ['tabular-nums'],
  },
});

export default memo(BatterBar);
