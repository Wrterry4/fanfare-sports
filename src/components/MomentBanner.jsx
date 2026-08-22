/**
 * MomentBanner.jsx — "HOME RUN!" flashed briefly for everyone watching.
 *
 * Sport-agnostic on purpose: it renders whatever text and tone it's handed
 * and knows nothing about baseball or basketball. Which events deserve a
 * banner, and what they say, is each sport's own call — see describeMoment
 * in baseball/present.js and basketball/present.js.
 *
 * ── Why "everyone watching" needs no new backend ────────────────────────
 *
 * Every viewer's device already subscribes to the same live events feed —
 * that's how the scoreboard itself stays in sync. This rides the same
 * subscription: GameDayScreen watches for a NEW event arriving, asks the
 * sport pack whether it's worth celebrating, and shows this banner locally
 * if so. A parent watching from the stands sees "HOME RUN!" the moment the
 * scorekeeper taps it, with nothing written to Firestore beyond the event
 * that was already being recorded anyway.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import { colors, radius, spacing, shadow } from '../theme/tokens.js';

const TONE_COLORS = {
  big: { bg: '#F5B700', fg: '#241900' },
  good: { bg: colors.navy, fg: '#FFFFFF' },
  bad: { bg: colors.out, fg: '#FFFFFF' },
};

const DWELL_MS = 1800;

/**
 * @param moment  { text, tone } or null — a new object (even with identical
 *                text) is what triggers the animation to replay
 */
export default function MomentBanner({ moment }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const timer = useRef(null);

  useEffect(() => {
    if (!moment) return undefined;
    clearTimeout(timer.current);

    opacity.setValue(0);
    scale.setValue(0.85);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, DWELL_MS);

    return () => clearTimeout(timer.current);
    // moment is a fresh object each time one fires, even for repeated text
    // ("STRIKEOUT!" twice in an inning) — that's what makes the effect
    // re-run and replay the animation instead of only firing once.
  }, [moment, opacity, scale]);

  if (!moment) return null;
  const tone = TONE_COLORS[moment.tone] || TONE_COLORS.good;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[
        styles.card,
        { backgroundColor: tone.bg, opacity, transform: [{ scale }] },
      ]}>
        <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1}>
          {moment.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', zIndex: 997,
  },
  card: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderRadius: radius.lg, ...shadow.card,
    maxWidth: '86%',
  },
  text: {
    fontFamily: 'Archivo', fontWeight: '900', fontSize: 26,
    letterSpacing: 0.5, textAlign: 'center',
  },
});
