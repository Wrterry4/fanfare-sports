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

/** Standalone renders — a test, a preview — still need a shirt to draw. */
const DEFAULT_JERSEY = { fill: colors.clay, onFill: '#FFFFFF', numberOn: '#FFFFFF' };

/**
 * A jersey, drawn around its centre so it can be dropped on any base.
 *
 * Body, then two sleeves, then the collar notch cut back in the shirt color.
 * The proportions are a youth tee rather than a tapered adult jersey — wide
 * shoulders, short body — because at 34px the number has to fit inside it and
 * a realistic silhouette leaves no room.
 */
function Jersey({ cx, cy, w = 34, fill, stroke, numberColor, number }) {
  const h = w * 0.95;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const s = w / 34;   // everything below is authored at w=34

  return (
    <G>
      {/* Sleeves first so the body's rounded corners sit over them. */}
      <Path
        d={`M${x - 4 * s} ${y + 4 * s}
            L${x + 8 * s} ${y}
            L${x + 8 * s} ${y + 12 * s}
            L${x - 4 * s} ${y + 11 * s} Z`}
        fill={fill} stroke={stroke} strokeWidth={1.5 * s} strokeLinejoin="round"
      />
      <Path
        d={`M${x + w + 4 * s} ${y + 4 * s}
            L${x + w - 8 * s} ${y}
            L${x + w - 8 * s} ${y + 12 * s}
            L${x + w + 4 * s} ${y + 11 * s} Z`}
        fill={fill} stroke={stroke} strokeWidth={1.5 * s} strokeLinejoin="round"
      />

      <Rect
        x={x} y={y} width={w} height={h} rx={5 * s}
        fill={fill} stroke={stroke} strokeWidth={1.5 * s}
      />

      {/* Collar — a notch of the field showing through the shoulders. */}
      <Path
        d={`M${cx - 6 * s} ${y}
            Q${cx} ${y + 7 * s} ${cx + 6 * s} ${y}Z`}
        fill={stroke} opacity={0.55}
      />

      <SvgText
        x={cx} y={cy + 6 * s} fontSize={16 * s} fontWeight="900"
        fill={numberColor} textAnchor="middle"
      >
        {number}
      </SvgText>
    </G>
  );
}

/**
 * An empty base stays a base — the rotated square everyone who has kept a book
 * already reads. Only an OCCUPIED one becomes a jersey, which is what makes
 * "who is on second" answerable at a glance from the bleachers.
 */
function Base({ base, runner, jersey, teamColors }) {
  const [x, y] = BASE_XY[base];

  if (!runner) {
    return (
      <Rect
        x={x - 11} y={y - 11} width={22} height={22} rx={3}
        transform={`rotate(45 ${x} ${y})`}
        fill={colors.card} stroke={colors.navy} strokeWidth={2.5}
      />
    );
  }

  return (
    <Jersey
      cx={x} cy={y}
      fill={teamColors.fill}
      stroke={teamColors.onFill === '#FFFFFF' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.2)'}
      numberColor={teamColors.numberOn}
      number={jersey ?? '•'}
    />
  );
}

function Diamond({
  state, bases: basesProp, jerseyFor, onPressRunner,
  teamColors = DEFAULT_JERSEY, size = 250, interactive = true,
}) {
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
            teamColors={teamColors}
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
