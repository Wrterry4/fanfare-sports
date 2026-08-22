/**
 * Court.jsx — The half-court, in the slot baseball uses for its diamond.
 *
 * Shows team fouls and the bonus rather than runners on base, because that's
 * the situational information basketball actually has. The shared screen
 * passes `state` and never knows the difference.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';

import { inBonus } from '../rules.js';
import { colors, radius, text } from '../../../theme/tokens.js';
import { basketballTheme as t } from '../theme.js';

function Court({ state, rules, size = 150 }) {
  const w = size;
  const h = size * 0.82;
  const idx = (state?.period || 1) - 1;
  const ours = state?.teamFouls?.[state.homeOrAway]?.[idx] || 0;
  const theirs = state?.teamFouls?.[state.homeOrAway === 'home' ? 'away' : 'home']?.[idx] || 0;
  const bonus = inBonus(theirs, rules);

  return (
    <View style={styles.wrap}>
      <Svg width={w} height={h} viewBox="0 0 100 82">
        {/* Floor */}
        <Rect x="0" y="0" width="100" height="82" rx="3" fill={t.fieldFill} />
        {/* Paint */}
        <Rect x="34" y="0" width="32" height="38" fill="none"
              stroke="#FFF6E8" strokeWidth="1.6" />
        {/* Free-throw circle */}
        <Circle cx="50" cy="38" r="11" fill="none" stroke="#FFF6E8" strokeWidth="1.6" />
        {/* Three-point arc */}
        <Path d="M12 0 L12 22 A38 38 0 0 0 88 22 L88 0"
              fill="none" stroke="#FFF6E8" strokeWidth="1.6" />
        {/* Backboard and rim */}
        <Rect x="42" y="3" width="16" height="1.8" fill="#FFF6E8" />
        <Circle cx="50" cy="8" r="3.4" fill="none" stroke={t.accent} strokeWidth="1.8" />
        {/* Half-court line */}
        <Rect x="0" y="78" width="100" height="1.6" fill="#FFF6E8" />
      </Svg>

      <View style={styles.fouls}>
        <View style={styles.foulRow}>
          <Text style={styles.foulLabel}>OUR FOULS</Text>
          <Text style={styles.foulValue}>{ours}</Text>
        </View>
        <View style={styles.foulRow}>
          <Text style={styles.foulLabel}>THEIRS</Text>
          <Text style={styles.foulValue}>{theirs}</Text>
        </View>
        {bonus && (
          <View style={styles.bonus}>
            <Text style={styles.bonusText}>BONUS</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  fouls: { width: '100%', gap: 3 },
  foulRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foulLabel: { ...text.label, fontSize: 7.5, color: colors.pencil },
  foulValue: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 12, color: colors.navy },
  bonus: {
    backgroundColor: colors.out, borderRadius: radius.sm,
    paddingVertical: 2, alignItems: 'center', marginTop: 2,
  },
  bonusText: { ...text.label, fontSize: 8, color: '#FFF' },
});

export default memo(Court);
