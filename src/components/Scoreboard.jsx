/**
 * Scoreboard.jsx — Compact game status.
 *
 * Team names and totals used to appear here AND in the line score below,
 * which wasted a third of the screen on duplication. This is now just the
 * situation: which half of which inning, and the count.
 *
 * "TOP 1" became "▲ 1st" — an arrow reads faster than a word, and everyone
 * already knows up means the visiting team.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, text, spacing } from '../theme/tokens.js';

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function HalfArrow({ up }) {
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
      <Path
        d={up ? 'M12 5 L20 17 L4 17 Z' : 'M12 19 L4 7 L20 7 Z'}
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
function Scoreboard({ state }) {
  const final = state.status === 'final';

  return (
    <View style={styles.bar}>
      <View style={styles.half}>
        {final ? (
          <Text style={styles.inning}>
            {state.endReason === 'mercy' ? 'FINAL · MERCY' : 'FINAL'}
          </Text>
        ) : (
          <>
            <HalfArrow up={state.isTop} />
            <Text style={styles.inning}>{ordinal(state.inning)}</Text>
          </>
        )}
      </View>

      {!final && (
        <View style={styles.pips}>
          {/* Three balls and two strikes shown: the fourth and third resolve
              the at-bat, so they never appear. */}
          <Pips label="B" filled={state.balls} total={3} />
          <Pips label="S" filled={state.strikes} total={2} />
          <Pips label="O" filled={state.outs} total={2} danger />
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  half: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inning: { ...text.inning, color: '#FFF', fontSize: 14 },
  pips: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  pipSet: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  pipDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  pipLabel: { ...text.label, fontSize: 9, color: '#7E88A3' },
  pip: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#5A6486' },
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
