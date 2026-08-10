/**
 * Diamond.jsx — The field view.
 *
 * This is the scorebook glyph, scaled up: the same small diamond a coach fills
 * in by hand for every at-bat. Chosen over a stadium illustration because it
 * needs no learning — anyone who has kept a book already reads it.
 *
 * Occupied bases fill with clay and carry the runner's jersey number. Tapping
 * a base opens the baserunning drawer scoped to that runner.
 */

import React, { memo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Text as SvgText, G } from 'react-native-svg';
import { colors } from '../../../theme/tokens.js';

const BASE_XY = { 1: [165, 105], 2: [100, 40], 3: [35, 105] };

function Base({ base, runner, jersey, onPress }) {
  const [x, y] = BASE_XY[base];
  const occupied = !!runner;
  return (
    <G>
      <Rect
        x={x - 13} y={y - 13} width={26} height={26} rx={4}
        transform={`rotate(45 ${x} ${y})`}
        fill={occupied ? colors.clay : colors.card}
        stroke={occupied ? colors.clay : colors.navy}
        strokeWidth={2.5}
      />
      {occupied && (
        <SvgText
          x={x} y={y + 5} fontSize={14} fontWeight="900"
          fill={colors.white} textAnchor="middle"
        >
          {jersey ?? '•'}
        </SvgText>
      )}
    </G>
  );
}

function Diamond({ bases, jerseyFor, onPressRunner, size = 250, interactive = true }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg viewBox="0 0 200 200" width={size} height={size}>
        {/* Base paths */}
        <Path
          d="M100 170 L165 105 L100 40 L35 105 Z"
          fill="none" stroke={colors.navy} strokeWidth={2.5} strokeLinejoin="round"
        />

        {[1, 2, 3].map((b) => (
          <Base
            key={b}
            base={b}
            runner={bases[b]}
            jersey={bases[b] ? jerseyFor(bases[b]) : null}
          />
        ))}

        {/* Home plate */}
        <Path
          d="M89 163 L111 163 L111 173 L100 180 L89 173 Z"
          fill={colors.card} stroke={colors.navy} strokeWidth={2.5}
        />

      </Svg>

      {/* Touch targets sit above the SVG. Generous hit areas — a runner label
          is small, and this gets tapped with a thumb while standing up. */}
      {interactive && [1, 2, 3].map((b) => {
        const [x, y] = BASE_XY[b];
        const scale = size / 200;
        return (
          <Pressable
            key={`t${b}`}
            disabled={!bases[b]}
            onPress={() => onPressRunner?.(b, bases[b])}
            style={[styles.hit, {
              left: x * scale - 24, top: y * scale - 24,
              width: 48, height: 48,
            }]}
            accessibilityRole="button"
            accessibilityLabel={
              bases[b] ? `Runner on ${b === 1 ? 'first' : b === 2 ? 'second' : 'third'}`
                       : `${b === 1 ? 'First' : b === 2 ? 'Second' : 'Third'} base empty`
            }
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', position: 'relative' },
  hit: { position: 'absolute' },
});

export default memo(Diamond);
