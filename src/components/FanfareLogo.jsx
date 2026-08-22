/**
 * FanfareLogo.jsx — The mark and the wordmark, in one place.
 *
 * Both live here rather than inside SplashScreen because the lockup belongs in
 * more than one spot — a splash, an empty state, a share card, a header — and
 * a logo that gets redrawn per screen drifts within a release.
 *
 * ── The mark ────────────────────────────────────────────────────────────────
 *
 * A rounded square in royal blue holding an F that doubles as a level meter:
 * a white stem, and three bars standing clear of it — long gold, short sky,
 * long gold.
 *
 * Two earlier versions are worth remembering. Three evenly stacked bars of
 * equal length read as a hamburger menu, not a letter; the tell that a mark
 * has stopped being a monogram is needing to be told what it stands for. Then
 * arms welded onto the stem read as an F but said nothing about audio. Holding
 * the bars off the stem is what lets it be both: the eye closes the gap and
 * still sees an F, while the detached bars read as signal.
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

      {/* An F that is also a level meter.
          The bars stand clear of the stem, which is what turns them from
          serifs into signal — an equalizer beside the letter rather than
          welded onto it. The two long gold bars are the arms that keep it
          legible as an F; the short sky bar between them is the one that says
          audio. The stem runs on below all three, so the F still has a foot. */}
      <Rect x="38" y="32" width="30" height="128" rx="15" fill={BRAND.white} />
      <Rect x="80" y="32" width="74" height="24" rx="12" fill={BRAND.gold} />
      <Rect x="80" y="64" width="44" height="24" rx="12" fill={BRAND.sky} />
      <Rect x="80" y="96" width="74" height="24" rx="12" fill={BRAND.gold} />
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
          <Text
            style={[styles.tagline, { fontSize: s(10), letterSpacing: 1.6 * scale }]}
            numberOfLines={1}
          >
            EVERY PLAYER DESERVES A FANFARE
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
    // letterSpacing is applied by the caller, multiplied by scale. A fixed
    // value stays wide while the type shrinks, which is exactly what crowds a
    // long tagline on a small phone.
    color: '#94A3B8', marginTop: 5, textAlign: 'center',
  },
});
