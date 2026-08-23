/**
 * Scoreboard.jsx — Compact game status.
 *
 * Team names and totals used to appear here AND in the line score below,
 * which wasted a third of the screen on duplication. This is now just the
 * situation: which period, and whatever counters the sport keeps.
 *
 * "TOP 1" became "▲ 1st" — an arrow reads faster than a word, and everyone
 * already knows up means the visiting team.
 *
 * Takes a `period` and `counters` from the sport's presenter rather than
 * reading game state. It used to compute an inning ordinal and hard-code
 * balls/strikes/outs, which meant a sport without innings couldn't use it.
 * Basketball sends a quarter and team fouls; the rendering is identical.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, text, spacing, radius } from '../theme/tokens.js';

/** Only drawn when the sport divides a period into halves. */
function HalfArrow({ direction }) {
  if (!direction) return null;
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
      <Path
        d={direction === 'up' ? 'M12 5 L20 17 L4 17 Z' : 'M12 19 L4 7 L20 7 Z'}
        fill={colors.gold}
      />
    </Svg>
  );
}

function Pips({ label, filled, total, danger }) {
  return (
    <View style={styles.pipSet}>
      <Text style={styles.pipLabel}>{label}</Text>
      <View style={styles.pipDots}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.pip, i < filled && (danger ? styles.pipOut : styles.pipOn)]} />
        ))}
      </View>
    </View>
  );
}

/**
 * The game situation, sized to sit in the header's right slot rather than on a
 * bar of its own. Sound and scoring mode moved down to the line score strip —
 * they're settings, and they were costing a full row on a screen where nothing
 * scrolls.
 */
function Scoreboard({ period, counters }) {
  if (!period) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.half}>
        <HalfArrow direction={period.direction} />
        <Text style={styles.inning}>{period.label}</Text>
      </View>

      {counters?.length > 0 && (
        <View style={styles.pips}>
          {counters.map((c) => (
            <Pips key={c.key} label={c.label} filled={c.filled}
                  total={c.total} danger={c.danger} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Carries its own dark ground rather than inheriting the header's.
   *
   * This used to sit on a permanently navy bar, so white pips and grey labels
   * were safe. The header now takes the team's colour, and on gold, silver or
   * white the count and outs simply disappeared — the one thing on the screen
   * a scorekeeper checks between every pitch. A fixed dark pill means the
   * count reads identically on all twenty-two team colours instead of needing
   * to be re-tuned for each.
   */
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(11,17,32,0.88)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.md,
  },
  half: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inning: { ...text.inning, color: '#FFF', fontSize: 14 },
  pips: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  pipSet: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  pipDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  // Measured against the pill over the lightest team colour in the palette,
  // which is the worst case: the label clears 9:1 and an unfilled pip 4.6:1.
  // The old #7E88A3 and #5A6486 were tuned for navy and vanished on gold.
  pipLabel: { ...text.label, fontSize: 9, color: '#C7D0E6' },
  pip: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#8A94B4' },
  pipOn: { backgroundColor: '#FFF', borderColor: '#FFF' },
  pipOut: { backgroundColor: colors.out, borderColor: colors.out },
  right: { alignItems: 'flex-end', gap: 4 },
  mute: { ...text.label, fontSize: 8.5, color: colors.gold },
  muteOff: { color: '#5F6980' },
  modeBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5,
    borderWidth: 1, borderColor: '#3A4560',
  },
  modeText: { ...text.label, fontSize: 8, color: '#A8B0C6' },
});

export default memo(Scoreboard);
