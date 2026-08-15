/**
 * LineScore.jsx — Runs by inning, plus R/H/E.
 *
 * The strip a scorebook shows across the top. Inning count comes from the
 * rules, so changing "innings per game" in Settings is visible here
 * immediately rather than after a restart.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, text } from '../theme/tokens.js';

function LineScore({ state, rules, awayName, homeName, muted, onToggleMute, modeLabel, onToggleMode }) {
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

  return (
    <View style={styles.wrap}>
      {/* Names in a fixed left column, the grid scrolls on the right. Team
          names get the room they need without squeezing the innings. */}
      <View style={styles.names}>
        <View style={styles.headSpacer} />
        {[['away', awayName], ['home', homeName]].map(([side, name]) => {
          const batting = (side === 'away') === state.isTop && state.status !== 'final';
          return (
            <Text key={side} style={[styles.team, batting && styles.teamBatting]}
                  numberOfLines={1}>
              {name}
            </Text>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scroll}
                  style={styles.gridScroll}>
        <View>
          <View style={styles.row}>
            {Array.from({ length: columns }, (_, i) => (
              <Text key={i} style={[styles.cell, styles.headCell,
                     state.inning === i + 1 && styles.headCurrent]}>{i + 1}</Text>
            ))}
            <Text style={[styles.cell, styles.headCell, styles.total]}>R</Text>
            <Text style={[styles.cell, styles.headCell, styles.total]}>E</Text>
          </View>

          {['away', 'home'].map((side) => {
            return (
              <View key={side} style={styles.row}>
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

      {/* Sound and scoring mode. Settings, glanced at rarely — they ride along
          on this strip instead of occupying a bar of their own. */}
      {(onToggleMute || onToggleMode) && (
        <View style={styles.controls}>
          {onToggleMute && (
            <Text onPress={onToggleMute} style={[styles.control, muted && styles.controlOff]}>
              {muted ? 'SOUND OFF' : 'SOUND ON'}
            </Text>
          )}
          {onToggleMode && (
            <Pressable onPress={onToggleMode} style={styles.modeBtn}>
              <Text style={styles.modeText}>{modeLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0B1220', paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center',
  },
  names: { paddingLeft: 12, paddingRight: 8 },
  headSpacer: { height: 18 },
  // The name column and the grid are separate views, so their rows only line
  // up if both declare the same height rather than relying on line height.
  gridScroll: { flex: 1 },
  // flexGrow pushes a short grid to the right edge rather than leaving it
  // stranded in the middle.
  scroll: { paddingRight: 12, flexGrow: 1, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center' },
  team: {
    maxWidth: 120, ...text.teamName, fontSize: 10, color: '#8A93AB',
    height: 20, lineHeight: 20,
  },
  teamBatting: { color: '#FFF' },
  cell: {
    width: 22, textAlign: 'center',
    fontFamily: 'Archivo', fontWeight: '700', fontSize: 12,
    color: '#D5DAE6', fontVariant: ['tabular-nums'],
    height: 20, lineHeight: 20,
  },
  headCell: { color: '#5F6980', fontSize: 9.5, fontWeight: '800', height: 18, lineHeight: 18 },
  headCurrent: { color: colors.gold },
  total: { color: '#FFF', fontWeight: '900' },
  controls: { paddingLeft: 8, paddingRight: 10, alignItems: 'flex-end', gap: 4 },
  control: { ...text.label, fontSize: 8, color: colors.gold },
  controlOff: { color: '#5F6980' },
  modeBtn: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
    borderWidth: 1, borderColor: '#3A4560',
  },
  modeText: { ...text.label, fontSize: 7.5, color: '#A8B0C6' },
});

export default memo(LineScore);
