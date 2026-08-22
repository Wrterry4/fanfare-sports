/**
 * FanfareLogo.jsx — The mark and the wordmark, in one place.
 *
 * Both live here rather than inside SplashScreen because the lockup belongs in
 * more than one spot — a splash, an empty state, a share card, a header — and
 * a logo that gets redrawn per screen drifts within a release.
 *
 * ── The mark ────────────────────────────────────────────────────────────────
 *
 * A rounded square in royal blue holding an F built from pills: a white stem,
 * a long gold top arm, a shorter sky-blue middle arm.
 *
 * It was three evenly stacked bars first, and that version read as a list or
 * a hamburger menu rather than a letter — the giveaway that a mark has stopped
 * being a monogram is when you have to be told what it stands for. Dropping
 * the bottom bar and starting the arms at the stem is the whole difference.
 *
 * Everything is expressed against a 192 viewBox so a single `size` prop scales
 * the whole thing, and every bar is a Rect with rx at half its height, which
 * is what makes a pill a pill at any size.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens.js';

export const BRAND = {
  blue: '#4169E1',
  blueLight: '#5B82F5',
  blueDeep: '#2F4FC7',
  gold: '#FFC107',
  sky: '#64C8FF',
  white: '#FFFFFF',
};

/**
 * @param size    rendered square size in px
 * @param rounded false draws the glyph alone, with no tile behind it — for
 *                placing on a surface that already has its own background
 */
export function FanfareMark({ size = 96, rounded = true }) {
  // Unique-ish id: two gradients with the same id on one screen would make the
  // second silently adopt the first.
  const gid = `fanfare-grad-${size}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 192 192">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.blueLight} />
          <Stop offset="1" stopColor={BRAND.blueDeep} />
        </LinearGradient>
      </Defs>

      {/* 52 of 192 is 27% — the large radius that reads as a modern app tile
          rather than a rounded rectangle. */}
      {rounded && <Rect x="0" y="0" width="192" height="192" rx="52" fill={`url(#${gid})`} />}

      {/* An F, built from the same pills.
          Three stacked bars read as a list or a menu — which is what the first
          version looked like. An F is a stem and TWO arms, the lower one
          shorter, so the bottom bar is gone and the arms start at the stem
          rather than beside it. Same three colours, same pill language. */}
      <Rect x="46" y="32" width="32" height="128" rx="16" fill={BRAND.white} />
      <Rect x="46" y="32" width="100" height="28" rx="14" fill={BRAND.gold} />
      <Rect x="46" y="82" width="78" height="28" rx="14" fill={BRAND.sky} />
    </Svg>
  );
}

/**
 * Icon beside the wordmark.
 *
 * @param scale  multiplies every dimension. The caller sizes this against the
 *               screen rather than the component guessing — a splash and a
 *               header want very different sizes from the same lockup.
 */
export function FanfareLockup({ scale = 1, tagline = true }) {
  const s = (n) => Math.round(n * scale);

  return (
    <View style={styles.row}>
      <FanfareMark size={s(84)} />
      <View style={styles.words}>
        <Text style={[styles.wordmark, { fontSize: s(30) }]} numberOfLines={1}>
          FANFARE<Text style={styles.sports}> SPORTS</Text>
        </Text>
        {tagline && (
          <Text style={[styles.tagline, { fontSize: s(10) }]} numberOfLines={1}>
            TEAM HUB &amp; GAME AUDIO
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // Centred on the wordmark above it rather than flush left — the tagline is
  // a caption to "FANFARE SPORTS", and hanging it off the left edge made it
  // read as a separate third line.
  words: { justifyContent: 'center', alignItems: 'center' },
  wordmark: {
    fontFamily: 'Archivo', fontWeight: '900',
    color: '#FFFFFF', letterSpacing: 0.5,
  },
  // Same size and weight as FANFARE — only the color separates them, which is
  // what keeps it one word rather than a name with a suffix bolted on.
  sports: { color: colors.gold },
  tagline: {
    fontFamily: 'PublicSans', fontWeight: '600',
    color: '#94A3B8', letterSpacing: 1.6, marginTop: 5, textAlign: 'center',
  },
});
