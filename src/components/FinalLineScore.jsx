/**
 * FinalLineScore.jsx — The inning-by-inning box for a finished game.
 *
 * Reads the lineScore mirrored onto the game document when the score was last
 * synced, so it needs no event log. Falls back to totals only if a game was
 * played before that mirroring existed.
 */

import React, { memo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, text } from '../theme/tokens.js';

function FinalLineScore({ game, ourName }) {
  const away = game.lineScore?.away ?? [];
  const home = game.lineScore?.home ?? [];
  const columns = Math.max(away.length, home.length);

  const awayName = game.homeOrAway === 'home' ? game.opponent : ourName;
  const homeName = game.homeOrAway === 'home' ? ourName : game.opponent;

  if (!columns) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          {awayName} {game.score?.away ?? 0} — {homeName} {game.score?.home ?? 0}
        </Text>
      </View>
    );
  }

  const row = (name, runs, total, errs, key) => (
    <View style={styles.row} key={key}>
      <Text style={styles.team} numberOfLines={1}>{name}</Text>
      <View style={styles.cells}>
        {Array.from({ length: columns }, (_, i) => (
          <Text key={i} style={styles.cell}>{runs[i] ?? 0}</Text>
        ))}
        <Text style={[styles.cell, styles.total]}>{total}</Text>
        <Text style={[styles.cell, styles.total]}>{errs}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.row}>
            <Text style={styles.team} />
            <View style={styles.cells}>
              {Array.from({ length: columns }, (_, i) => (
                <Text key={i} style={[styles.cell, styles.head]}>{i + 1}</Text>
              ))}
              <Text style={[styles.cell, styles.head, styles.total]}>R</Text>
              <Text style={[styles.cell, styles.head, styles.total]}>E</Text>
            </View>
          </View>
          {row(awayName, away, game.score?.away ?? 0, game.errors?.away ?? 0, 'a')}
          {row(homeName, home, game.score?.home ?? 0, game.errors?.home ?? 0, 'h')}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#0B1220', paddingVertical: 8, paddingHorizontal: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  cells: { flexDirection: 'row' },
  team: {
    width: 96, ...text.teamName, fontSize: 10, color: '#8A93AB',
    height: 20, lineHeight: 20, paddingRight: 6,
  },
  cell: {
    width: 21, textAlign: 'center', fontFamily: 'Archivo', fontWeight: '700',
    fontSize: 12, color: '#D5DAE6', height: 20, lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  head: { color: '#5F6980', fontSize: 9.5, fontWeight: '800' },
  total: { color: '#FFF', fontWeight: '900' },
  fallback: { backgroundColor: '#F1F4F9', padding: 12 },
  fallbackText: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy },
});

export default memo(FinalLineScore);
