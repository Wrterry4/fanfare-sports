/**
 * Jersey.jsx — A player's number, wearing the right sport's shirt.
 *
 * One component, four silhouettes, keyed by sport. Baseball and basketball are
 * wired today; soccer and football are drawn and unreferenced, waiting on a
 * registry entry rather than a design pass. Designing all four together is
 * what makes them distinguishable — done separately they all drift toward
 * "a shirt with sleeves".
 *
 * ── The number sets the geometry ────────────────────────────────────────────
 *
 * A jersey number is the entire reason this glyph exists, so it is sized
 * first and the shapes are cut to hold it. The first version got this
 * backwards: shapes were drawn at a comfortable size, a fixed 30px number was
 * dropped in, and every two-digit number hung off the edge of the shirt. A
 * 900-weight "22" is close to twice the width of a "7" — no single size could
 * ever have fitted both.
 *
 * ── Why the number is drawn twice ───────────────────────────────────────────
 *
 * A thick stroke in the SHIRT color underneath, then the number on top. That
 * punches a clean hole through stripes, plackets and yokes so a number never
 * sits half on a stripe and half off. SVG's paint-order property does this in
 * one element, but it is not reliable across every platform react-native-svg
 * runs on, and two draw calls always work.
 *
 * Everything is authored in a 100x100 box, so one `size` scales the lot.
 */

import React from 'react';
import Svg, { Path, Rect, Text as SvgText, G } from 'react-native-svg';

const EDGE = 'rgba(0,0,0,0.30)';

/** 30 / 24 / 19 for one / two / three digits. Measured, not guessed. */
export function numberSize(value) {
  const digits = String(value ?? '').length;
  return digits >= 3 ? 19 : digits === 2 ? 24 : 30;
}

/** Where the number's baseline sits, per silhouette. */
const BASELINE = { baseball: 67, basketball: 68, soccer: 67, football: 69 };

/**
 * Shirt outlines. Every torso is wide enough for two digits at the size above
 * — the tank and the football body were both originally cut for one.
 */
function Shape({ kind, fill, numberColor }) {
  const common = {
    fill, stroke: EDGE, strokeWidth: 2, strokeLinejoin: 'round',
  };

  if (kind === 'basketball') {
    // Sleeveless, deep armholes, scooped neck — the strongest outline in the
    // set, and the only one that needs no detail at all to read.
    return (
      <Path
        d="M32 21 h11 q7 8 14 0 h11 l4 13 q-5 3 -5 12 v34 q-17 4 -34 0 v-34 q0 -9 -5 -12 z"
        {...common}
      />
    );
  }

  if (kind === 'soccer') {
    return (
      <G>
        <Path d="M30 26 L13 33 L17 45 L30 41 Z" {...common} />
        <Path d="M70 26 L87 33 L83 45 L70 41 Z" {...common} />
        <Path d="M29 22 H71 L73 38 Q66 58 70 79 Q50 83 30 79 Q34 58 27 38 Z" {...common} />
        <G opacity={0.92}>
          <Rect x="33" y="24" width="8" height="55" fill={numberColor} />
          <Rect x="59" y="24" width="8" height="55" fill={numberColor} />
        </G>
        <Path d="M40 22 L50 36 L60 22" fill="none" stroke={EDGE} strokeWidth={2.5} />
      </G>
    );
  }

  if (kind === 'football') {
    return (
      <G>
        <Path
          d="M22 33 L36 22 H64 L78 33 L74 47 L69 44 V79 Q50 83 31 79 V44 L26 47 Z"
          {...common}
        />
        <Rect x="23" y="35" width="13" height="4" fill={numberColor}
              transform="rotate(-22 29 37)" />
        <Rect x="64" y="35" width="13" height="4" fill={numberColor}
              transform="rotate(22 70 37)" />
      </G>
    );
  }

  // Baseball. Set-in sleeves and a button placket — the placket is the one
  // mark that says baseball and nothing else, and a vertical line survives the
  // shrink to field size because it runs the way the eye already travels.
  // The body tapers rather than being a straight rectangle, which read as a
  // sandwich board.
  return (
    <G>
      <Path d="M28 27 L9 35 L13 49 L28 45 Z" {...common} />
      <Path d="M72 27 L91 35 L87 49 L72 45 Z" {...common} />
      <Path d="M28 22 H72 L74 38 Q66 58 70 79 Q50 83 30 79 Q34 58 26 38 Z" {...common} />
      <Path d="M41 22 Q50 29 59 22" fill="none" stroke={EDGE} strokeWidth={2.5} />
      <Path d="M50 26 V43" stroke={numberColor} strokeWidth={2.5} opacity={0.85} />
    </G>
  );
}

/**
 * @param kind    'baseball' | 'basketball' | 'soccer' | 'football'
 * @param colors  from resolveTeamColor: { fill, numberOn }
 * @param number  jersey number; anything falsy renders a dot
 * @param size    rendered square size in px
 */
export default function Jersey({
  kind = 'baseball', colors, number, size = 34,
}) {
  const fill = colors?.fill || '#B5451B';
  const numberColor = colors?.numberOn || '#FFFFFF';
  const label = number == null || number === '' ? '•' : String(number);
  const fontSize = numberSize(label);
  const y = BASELINE[kind] ?? BASELINE.baseball;

  const numberProps = {
    x: 50, y, fontSize, fontWeight: '900',
    textAnchor: 'middle', fontFamily: 'Archivo',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Shape kind={kind} fill={fill} numberColor={numberColor} />
      {/* The halo. See the header — this is what keeps a number off the
          stripes rather than dissolved into them. */}
      <SvgText {...numberProps} fill={fill} stroke={fill} strokeWidth={6}
               strokeLinejoin="round">
        {label}
      </SvgText>
      <SvgText {...numberProps} fill={numberColor}>{label}</SvgText>
    </Svg>
  );
}

/**
 * The same jersey as bare children, for callers already inside an <Svg> — the
 * diamond draws three of these into one canvas rather than nesting four.
 */
export function JerseyGlyph({ kind = 'baseball', colors, number, cx, cy, w = 34 }) {
  const fill = colors?.fill || '#B5451B';
  const numberColor = colors?.numberOn || '#FFFFFF';
  const label = number == null || number === '' ? '•' : String(number);
  const s = w / 100;
  const y = BASELINE[kind] ?? BASELINE.baseball;

  const numberProps = {
    x: 50, y, fontSize: numberSize(label), fontWeight: '900',
    textAnchor: 'middle', fontFamily: 'Archivo',
  };

  // x/y/scale props rather than a transform string: react-native-svg's own
  // form, and it keeps the 100-unit authoring space independent of where the
  // glyph lands on the caller's canvas.
  return (
    <G x={cx - w / 2} y={cy - w / 2} scale={s}>
      <Shape kind={kind} fill={fill} numberColor={numberColor} />
      <SvgText {...numberProps} fill={fill} stroke={fill} strokeWidth={6}
               strokeLinejoin="round">
        {label}
      </SvgText>
      <SvgText {...numberProps} fill={numberColor}>{label}</SvgText>
    </G>
  );
}
