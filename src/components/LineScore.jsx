/**
 * LineScore.jsx — Runs by inning, plus R/H/E.
 *
 * The strip a scorebook shows across the top. Inning count comes from the
 * rules, so changing "innings per game" in Settings is visible here
 * immediately rather than after a restart.
 */

import React, { memo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, text } from '../theme/tokens.js';

function LineScore({ state, rules, awayName, homeName, compact }) {
  const scheduled = rules?.inningsPerGame ?? 6;
  // Extra innings widen the strip rather than truncating the game.
  const columns = Math.max(scheduled, state.lineScore.away.length, state.lineScore.home.length,
                           state.inning);

  const cell = (side, i) => {
    const played = state.lineScore[side][i];
    if (played != null) return String(played);
    // A half-inning not yet reached shows blank; one in progress shows 0.
    const reached = state.inning > i + 1
      || (state.inning === i + 1 && (side === 'away' || !state.isTop));
    return reached ? '0' : '';
  };

  const hits = (side) => state.lineScore[side].length ? undefined : undefined;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scroll}>
        <View>
          <View style={styles.row}>
            <Text style={[styles.team, styles.headCell]} />
            {Array.from({ length: columns }, (_, i) => (
              <Text key={i} style={[styles.cell, styles.headCell,
                     state.inning === i + 1 && styles.headCurrent]}>{i + 1}</Text>
            ))}
            <Text style={[styles.cell, styles.headCell, styles.total]}>R</Text>
            <Text style={[styles.cell, styles.headCell, styles.total]}>E</Text>
          </View>

          {[['away', awayName], ['home', homeName]].map(([side, name]) => {
            const batting = (side === 'away') === state.isTop && state.status !== 'final';
            return (
              <View key={side} style={styles.row}>
                <Text style={[styles.team, batting && styles.teamBatting]} numberOfLines={1}>
                  {name}
                </Text>
                {Array.from({ length: columns }, (_, i) => (
                  <Text key={i} style={styles.cell}>{cell(side, i)}</Text>
                ))}
                <Text style={[styles.cell, styles.total]}>{state.score[side]}</Text>
                <Text style={[styles.cell, styles.total]}>{state.errors[side]}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#0B1220', paddingVertical: 6 },
  scroll: { paddingHorizontal: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  team: {
    width: 78, ...text.teamName, fontSize: 10, color: '#8A93AB',
    paddingRight: 6,
  },
  teamBatting: { color: '#FFF' },
  cell: {
    width: 22, textAlign: 'center',
    fontFamily: 'Archivo', fontWeight: '700', fontSize: 12,
    color: '#D5DAE6', fontVariant: ['tabular-nums'], paddingVertical: 2,
  },
  headCell: { color: '#5F6980', fontSize: 9.5, fontWeight: '800' },
  headCurrent: { color: colors.gold },
  total: { color: '#FFF', fontWeight: '900' },
});

export default memo(LineScore);
