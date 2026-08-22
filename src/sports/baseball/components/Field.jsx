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
import { baseballTheme } from '../theme.js';

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

function Diamond({ state, bases: basesProp, jerseyFor, onPressRunner, size = 250, interactive = true }) {
  // Takes the whole game state now, because the shared screen shouldn't have
  // to know that baseball tracks bases in order to pass them in. The explicit
  // `bases` prop is kept so this stays usable on its own in a test.
  const bases = basesProp ?? state?.bases ?? {};
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg viewBox="0 0 200 200" width={size} height={size}>
        {/*
          Grass, then dirt, then the lines on top of both.

          The outfield is a sector struck from home plate: two foul lines at
          45° out to a 132 radius, closed by an arc. That's the actual shape of
          a ball field, and it costs one path.

          Both surfaces are opaque rather than tinted overlays. The page behind
          this is now washed with the team's color, and anything translucent
          here would come out a different green on every team.
        */}
        <Path
          d="M100 172 L7 79 A132 132 0 0 1 193 79 Z"
          fill={baseballTheme.grass} stroke={baseballTheme.grassRim} strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* The infield skin — a diamond a little larger than the base paths,
            which is how a youth field is actually cut. */}
        <Path
          d="M100 184 L179 105 L100 26 L21 105 Z"
          fill={baseballTheme.dirt} stroke={baseballTheme.dirtRim} strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* The infield grass, inside the base paths.
            This is the shape that makes a diamond read as a diamond — without
            it the skin is one flat slab of brown and the base paths are just
            lines drawn on it. */}
        <Path
          d="M100 156 L151 105 L100 54 L49 105 Z"
          fill={baseballTheme.grass} stroke={baseballTheme.grassRim} strokeWidth={1}
          strokeLinejoin="round"
        />

        {/* Base paths */}
        <Path
          d="M100 170 L165 105 L100 40 L35 105 Z"
          fill="none" stroke={colors.white} strokeWidth={2.5} strokeLinejoin="round"
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
