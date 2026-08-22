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
import { StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';

import { FanfareLockup } from './FanfareLogo.jsx';
import { colors } from '../theme/tokens.js';

/** Long enough to register as intentional, short enough not to be a toll. */
export const MIN_VISIBLE_MS = 1100;
/** After this, something is wrong and the app underneath should be visible. */
export const MAX_VISIBLE_MS = 6000;
const FADE_MS = 320;

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

  /**
   * The lockup is horizontal, so its width — not the screen's height — is what
   * can overflow. "FANFARE SPORTS" beside an 84px mark needs roughly 375pt at
   * full size, which is exactly a small phone's entire width. Scaling against
   * the measured width means a 320pt device shrinks the whole lockup
   * proportionally instead of clipping the wordmark or wrapping it.
   */
  const { width } = useWindowDimensions();
  // 400 is the lockup's measured natural width at scale 1: an 84pt mark, a
  // 14pt gap, and "FANFARE SPORTS" set at 30pt. Measured against a render
  // rather than guessed — the first estimate was 340 and clipped the wordmark
  // on a 375pt phone.
  const scale = Math.min(1.15, Math.max(0.7, (width - 40) / 400));

  // No pointerEvents="none": while this is up it should swallow input. A tap
  // landing on an invisible button underneath is worse than one that does
  // nothing, and it unmounts the moment the fade completes.
  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
        <FanfareLockup scale={scale} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
    padding: 20,
    zIndex: 9999,
  },
});
