/**
 * LineScore.jsx — Score by period, plus totals.
 *
 * The strip a scorebook shows across the top.
 *
 * Takes a `grid` from the sport's presenter rather than reading game state. It
 * used to compute runs-by-inning itself and hard-code an R and an E column,
 * which only describes baseball — basketball has quarters and one total. The
 * grid says how many columns there are, what the totals are called, and which
 * row is currently acting; this renders whatever it's handed.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import TickingNumber from './TickingNumber.jsx';
import { colors, text } from '../theme/tokens.js';

function LineScore({ grid, awayName, homeName, muted, onToggleMute, modeLabel, onToggleMode }) {
  if (!grid) return null;
  const nameFor = { away: awayName, home: homeName };

  return (
    <View style={styles.wrap}>
      {/* Names in a fixed left column, the grid scrolls on the right. Team
          names get the room they need without squeezing the innings. */}
      <View style={styles.names}>
        <View style={styles.headSpacer} />
        {grid.rows.map((row) => (
          <Text key={row.side} style={[styles.team, row.active && styles.teamBatting]}
                numberOfLines={1}>
            {nameFor[row.side]}
          </Text>
        ))}
      </View>

      {/* Innings scroll. Totals do NOT.
          R, H and E are the numbers anyone actually looks up, and in a long
          game they were the first thing pushed off the right edge — you had to
          scroll to find the score, which is the one thing a scoreboard exists
          to show. They're pinned in their own column outside the scroller. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scroll}
                  style={styles.gridScroll}>
        <View>
          <View style={styles.row}>
            {grid.headers.map((h, i) => (
              <Text key={i} style={[styles.cell, styles.headCell,
                     grid.activeColumn === i && styles.headCurrent]}>{h}</Text>
            ))}
          </View>

          {grid.rows.map((row) => (
            <View key={row.side} style={styles.row}>
              {row.cells.map((c, i) => (
                <Text key={i} style={styles.cell}>{c}</Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.totals}>
        <View style={styles.row}>
          {grid.totalColumns.map((t) => (
            <Text key={t} style={[styles.cell, styles.headCell, styles.total, styles.totalHead]}>{t}</Text>
          ))}
        </View>
        {grid.rows.map((row) => (
          <View key={row.side} style={styles.row}>
            {row.totals.map((t, i) => (
              <TickingNumber key={i} style={[styles.cell, styles.total, styles.totalValue]} value={t} />
            ))}
          </View>
        ))}
      </View>

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
  scroll: { paddingRight: 8, flexGrow: 1, justifyContent: 'flex-end' },
  // Pinned outside the scroller, with a rule separating it from the innings
  // so the boundary reads as deliberate rather than as a gap.
  totals: {
    paddingLeft: 8, paddingRight: 12,
    borderLeftWidth: 1, borderLeftColor: '#243049',
  },
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
  // The pinned column is the only place the score appears, and at 12px
  // Archivo Black is indistinguishable from any bold system face. Bigger, but
  // still inside the 20px row box so it stays aligned with the name column.
  totalValue: { fontSize: 16, width: 26 },
  totalHead: { width: 26 },
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
