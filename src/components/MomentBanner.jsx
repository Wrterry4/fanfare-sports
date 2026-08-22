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
 *
 * ── Why tone drives size, not just color ────────────────────────────────
 *
 * Every moment used to render the identical card and differ only in
 * background color, so a home run and a routine strikeout landed with
 * exactly the same weight. Tone is the only sport-agnostic signal of how
 * much an event matters, so it now drives type size, padding, how hard the
 * screen behind dims, and how far the entrance overshoots. A sport pack
 * gets a louder celebration purely by saying tone: 'big'.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

import { colors, radius, spacing, shadow } from '../theme/tokens.js';

const TONE_COLORS = {
  big: { bg: '#F5B700', fg: '#241900' },
  good: { bg: colors.navy, fg: '#FFFFFF' },
  bad: { bg: colors.out, fg: '#FFFFFF' },
};

/**
 * How emphatic each tone gets. `scrim` is how far the screen behind dims —
 * enough that the banner owns the screen, not so far that a parent loses
 * sight of the scoreboard mid-celebration.
 */
const TONE_WEIGHT = {
  big: { fontSize: 38, scrim: 0.52, padV: spacing.xl, overshoot: 1.14, pulses: 2 },
  good: { fontSize: 30, scrim: 0.32, padV: spacing.lg, overshoot: 1.07, pulses: 0 },
  bad: { fontSize: 30, scrim: 0.32, padV: spacing.lg, overshoot: 1.07, pulses: 0 },
};

/** How long the banner holds at rest, before the exit burst starts. */
const DWELL_MS = 1300;
const EXIT_MS = 260;
/** Entrance has to settle before the heartbeat starts, or they read as one muddy wobble. */
const PULSE_DELAY_MS = 380;

/**
 * @param moment     { text, tone } or null — a new object (even with identical
 *                   text) is what triggers the animation to replay
 * @param teamColor  { fill, onFill } from resolveTeamColor, optional. Only
 *                   'good' takes it: 'big' stays stadium gold because a home
 *                   run should look like a home run on every team in the
 *                   league, and 'bad' stays red because a team's own color
 *                   announcing its own bad news reads wrong.
 */
export default function MomentBanner({ moment, teamColor }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  // Composed with `scale` rather than replacing it, so the celebratory
  // heartbeat can run during the dwell without fighting the exit burst
  // for ownership of the same value.
  const pulse = useRef(new Animated.Value(1)).current;
  const exitTimer = useRef(null);
  const pulseTimer = useRef(null);
  const loop = useRef(null);

  const base = TONE_COLORS[moment?.tone] || TONE_COLORS.good;
  const tone = moment?.tone === 'good' && teamColor?.fill
    ? { bg: teamColor.fill, fg: teamColor.onFill }
    : base;
  const weight = TONE_WEIGHT[moment?.tone] || TONE_WEIGHT.good;

  useEffect(() => {
    if (!moment) return undefined;
    clearTimeout(exitTimer.current);
    clearTimeout(pulseTimer.current);
    loop.current?.stop();

    opacity.setValue(0);
    scale.setValue(0.5);
    tilt.setValue(0);
    scrim.setValue(0);
    pulse.setValue(1);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 120, useNativeDriver: true,
      }),
      Animated.timing(scrim, {
        toValue: weight.scrim, duration: 180, useNativeDriver: true,
      }),
      // Punches past full size, then springs back to it. The old entrance
      // eased from 0.85 to 1 — too small a distance to read as anything.
      Animated.sequence([
        Animated.timing(scale, {
          toValue: weight.overshoot, duration: 170,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1, friction: 4.5, tension: 150, useNativeDriver: true,
        }),
      ]),
      // Lands off-axis and rocks upright. Easing.back carries the value
      // past 1, which the interpolation turns into a tick past level.
      Animated.timing(tilt, {
        toValue: 1, duration: 340,
        easing: Easing.out(Easing.back(2)), useNativeDriver: true,
      }),
    ]).start();

    if (weight.pulses > 0) {
      loop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.05, duration: 200,
            easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1, duration: 240,
            easing: Easing.in(Easing.quad), useNativeDriver: true,
          }),
        ]),
        { iterations: weight.pulses },
      );
      pulseTimer.current = setTimeout(() => loop.current?.start(), PULSE_DELAY_MS);
    }

    exitTimer.current = setTimeout(() => {
      loop.current?.stop();
      // Bursts outward on the way out instead of dissolving in place — an
      // exit that only fades reads as the banner failing, not finishing.
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0, duration: EXIT_MS, useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.25, duration: EXIT_MS,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(scrim, {
          toValue: 0, duration: EXIT_MS, useNativeDriver: true,
        }),
      ]).start();
    }, DWELL_MS);

    return () => {
      clearTimeout(exitTimer.current);
      clearTimeout(pulseTimer.current);
      loop.current?.stop();
    };
    // moment is a fresh object each time one fires, even for repeated text
    // ("STRIKEOUT!" twice in an inning) — that's what makes the effect
    // re-run and replay the animation instead of only firing once.
  }, [moment, opacity, scale, tilt, scrim, pulse, weight]);

  if (!moment) return null;

  const rotate = tilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['-6deg', '0deg'],
    // Easing.back overshoots past 1, and letting that through is the point:
    // it rocks a couple of degrees past level before settling.
    extrapolate: 'extend',
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.scrim, { opacity: scrim }]} />
      <Animated.View style={[
        styles.card,
        {
          backgroundColor: tone.bg,
          paddingVertical: weight.padV,
          opacity,
          transform: [{ scale }, { scale: pulse }, { rotate }],
        },
      ]}>
        <Text
          style={[styles.text, { color: tone.fg, fontSize: weight.fontSize }]}
          numberOfLines={2}
        >
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
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  card: {
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg, ...shadow.card,
    maxWidth: '90%',
  },
  text: {
    fontFamily: 'Archivo', fontWeight: '900',
    letterSpacing: 0.5, textAlign: 'center',
  },
});
