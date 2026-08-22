/**
 * SplashScreen.jsx — The first second of the app.
 *
 * ── What it's actually for ──────────────────────────────────────────────────
 *
 * Startup has a gap: auth resolves, then the team list, then the active team
 * preference from storage. Until all three land the navigator can't know which
 * screen is right — and the screen it fell back to during that window was
 * "Create your team", so every launch briefly told an existing coach they had
 * no team. That's alarming, not merely unpolished.
 *
 * So this isn't decoration over a fast app; it's the honest answer to "we
 * don't know yet". It holds until the app genuinely knows what to show.
 *
 * ── Why a minimum AND a maximum ─────────────────────────────────────────────
 *
 * A minimum, because a splash that flickers for 80ms on a warm cache is worse
 * than none — it reads as a glitch. A maximum, because if a load ever hangs,
 * a permanent logo is the least useful thing a person could be looking at: it
 * hides the error screen that would have told them what went wrong.
 *
 * The mark is drawn rather than loaded from public/icons so it stays crisp at
 * any size and needs no asset resolution that differs between web and native.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors, spacing } from '../theme/tokens.js';

/** Long enough to register as intentional, short enough not to be a toll. */
export const MIN_VISIBLE_MS = 1100;
/** After this, something is wrong and the app underneath should be visible. */
export const MAX_VISIBLE_MS = 6000;
const FADE_MS = 320;

/** The Fanfare F: white stem, gold top arm, blue middle arm. */
export function FanfareMark({ size = 96 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 192 192">
      {/* Stem first, arms over it — the arms are the colored part of the
          letter and must not be interrupted by the stem's rounded cap. */}
      <Rect x="66" y="38" width="28" height="118" rx="14" fill="#FFFFFF" />
      <Rect x="66" y="38" width="78" height="28" rx="14" fill="#F59E0B" />
      <Rect x="66" y="80" width="62" height="28" rx="14" fill="#2563EB" />
    </Svg>
  );
}

/**
 * @param onHidden  called once the fade finishes, so the parent can unmount it
 * @param ready     the app knows what to render; the splash may start leaving
 */
export default function SplashScreen({ ready, onHidden }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const [minDone, setMinDone] = useState(false);
  const [capped, setCapped] = useState(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 420,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    const minTimer = setTimeout(() => setMinDone(true), MIN_VISIBLE_MS);
    const maxTimer = setTimeout(() => setCapped(true), MAX_VISIBLE_MS);
    return () => { clearTimeout(minTimer); clearTimeout(maxTimer); };
  }, [enter]);

  useEffect(() => {
    if (!(minDone && ready) && !capped) return undefined;
    const anim = Animated.timing(opacity, {
      toValue: 0, duration: FADE_MS, useNativeDriver: true,
    });
    anim.start(({ finished }) => { if (finished) onHidden?.(); });
    return () => anim.stop();
  }, [minDone, ready, capped, opacity, onHidden]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  // No pointerEvents="none": while this is up it should swallow input. A tap
  // landing on an invisible button underneath is worse than one that does
  // nothing, and it unmounts the moment the fade completes.
  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
        <View style={styles.markRow}>
          <FanfareMark size={104} />
        </View>
        <Text style={styles.name}>FANFARE</Text>
        <Text style={styles.sport}>SPORTS</Text>
        <Text style={styles.slogan}>Never miss a play.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  markRow: { alignItems: 'center', marginBottom: spacing.lg },
  name: {
    fontFamily: 'Archivo', fontWeight: '900', fontSize: 38,
    letterSpacing: 2, color: '#FFFFFF', textAlign: 'center',
  },
  // Set apart rather than run together: the mark is an F, and "FANFARE"
  // carrying the weight lets "SPORTS" sit under it as a qualifier.
  sport: {
    fontFamily: 'Archivo', fontWeight: '700', fontSize: 15,
    letterSpacing: 6.5, color: colors.gold, textAlign: 'center',
    marginTop: 2,
  },
  slogan: {
    fontFamily: 'PublicSans', fontWeight: '400', fontSize: 13,
    color: '#94A3B8', textAlign: 'center', marginTop: spacing.lg,
  },
});
