/**
 * WinCelebration.jsx — The end of the game, which used to pass in silence.
 *
 * A game reaching final is the emotional peak of the whole app and produced
 * no reaction at all. This is the one moment big enough to earn the full
 * screen.
 *
 * ── What it will and won't do ───────────────────────────────────────────────
 *
 * Confetti falls for a win. A loss gets the same card with no confetti, a
 * calmer scrim, and a plain "FINAL" — see gameOutcome.js for why that is not
 * an oversight. Nobody is congratulated for losing and nobody is consoled in
 * a way that reads as pity; it simply states the score.
 *
 * ── Confetti without a dependency ───────────────────────────────────────────
 *
 * A handful of Views, each with a precomputed x, delay, drift, and spin,
 * animated on the native driver. A physics library would render this more
 * beautifully and cost a package, a bundle increase, and one more thing that
 * can break a scoreboard people are relying on. Pieces are laid out once per
 * mount and never recomputed, so the fall is deterministic for a given game.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

import { colors, radius, spacing, shadow } from '../theme/tokens.js';
import { outcomeHeadline } from '../shared/gameOutcome.js';
import { shareCard } from '../services/shareCard';

const PIECES = 42;
const FALL_MS = 2600;

/** Deterministic per mount, so the same game doesn't reshuffle on re-render. */
function makePieces(width, palette) {
  return Array.from({ length: PIECES }, (_, i) => ({
    key: i,
    x: Math.random() * width,
    size: 7 + Math.random() * 7,
    color: palette[i % palette.length],
    delay: Math.random() * 900,
    drift: (Math.random() - 0.5) * 90,
    spin: Math.random() > 0.5 ? 1 : -1,
    duration: FALL_MS * (0.7 + Math.random() * 0.5),
  }));
}

function Confetti({ palette, height, width }) {
  const t = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(() => makePieces(width, palette), [width, palette]);

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1, duration: FALL_MS + 900,
      easing: Easing.linear, useNativeDriver: true,
    }).start();
  }, [t]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => {
        // Each piece maps the shared 0→1 clock onto its own window, which is
        // what staggers them without one timer per piece.
        const start = p.delay / (FALL_MS + 900);
        const end = Math.min(1, start + p.duration / (FALL_MS + 900));
        const range = [0, start, end, 1];

        const translateY = t.interpolate({
          inputRange: range,
          outputRange: [-40, -40, height + 40, height + 40],
        });
        const translateX = t.interpolate({
          inputRange: range,
          outputRange: [0, 0, p.drift, p.drift],
        });
        const rotate = t.interpolate({
          inputRange: range,
          outputRange: ['0deg', '0deg', `${p.spin * 540}deg`, `${p.spin * 540}deg`],
        });
        // Fades in the last stretch so pieces don't pile up at the bottom edge.
        const opacity = t.interpolate({
          inputRange: [0, start, Math.min(1, end - 0.05), end, 1],
          outputRange: [0, 1, 1, 0, 0],
        });

        return (
          <Animated.View
            key={p.key}
            style={{
              position: 'absolute', left: p.x, top: 0,
              width: p.size, height: p.size * 0.6,
              backgroundColor: p.color, borderRadius: 1,
              opacity, transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * @param outcome    from describeOutcome(); null or non-final renders nothing
 * @param teamName   shown above the score
 * @param teamColor  { fill, onFill } — the card takes the team's color on a win
 * @param onDismiss  tapping anywhere closes it
 */
export default function WinCelebration({ outcome, teamName, opponent, teamColor, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const { width, height } = Dimensions.get('window');
  const [shareState, setShareState] = useState('idle');

  const won = outcome?.result === 'win';

  /**
   * The result names what happened rather than assuming it worked. A browser
   * that can't share a file downloads it; one that can't do that copies the
   * text — and telling someone "Shared!" when the card is sitting in their
   * Downloads folder is how they conclude the button is broken.
   */
  const doShare = async () => {
    setShareState('working');
    const result = await shareCard({ outcome, teamName, opponent, teamColor });
    setShareState(result);
    setTimeout(() => setShareState('idle'), 2600);
  };

  const shareLabel = {
    idle: 'SHARE FINAL SCORE',
    working: 'PREPARING…',
    shared: 'SHARED ✓',
    downloaded: 'SAVED TO DOWNLOADS ✓',
    copied: 'COPIED ✓',
    failed: 'COULD NOT SHARE',
  }[shareState];

  useEffect(() => {
    if (!outcome?.final) return;
    opacity.setValue(0);
    scale.setValue(0.8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [outcome, opacity, scale]);

  // Confetti in the team's color plus the brand gold. A single-color burst
  // reads as a glitch; two colors and their tints read as celebration.
  //
  // Memoized because Confetti lays its pieces out from this array: a fresh
  // array each render would reshuffle every piece mid-fall. Declared above the
  // early return — every hook in this component has to run on every render.
  const palette = useMemo(() => (won
    ? [teamColor?.fill || colors.primary, '#F5B700', '#FFFFFF', teamColor?.fill || colors.primary]
    : []), [won, teamColor?.fill]);

  if (!outcome?.final) return null;

  const cardBg = won ? (teamColor?.fill || colors.primary) : colors.card;
  const cardFg = won ? (teamColor?.onFill || '#FFFFFF') : colors.navy;

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      {/* Deeper for a win — a loss gets a lighter touch, not a spotlight. */}
      <View style={[styles.scrim, { opacity: won ? 0.62 : 0.4 }]} />

      {won ? <Confetti palette={palette} height={height} width={width} /> : null}

      <Pressable style={styles.press} onPress={onDismiss} accessibilityRole="button"
        accessibilityLabel="Dismiss final score">
        <Animated.View style={[
          styles.card,
          { backgroundColor: cardBg, transform: [{ scale }] },
        ]}>
          <Text style={[styles.headline, { color: cardFg }]} numberOfLines={2}>
            {outcomeHeadline(outcome)}
          </Text>
          {teamName ? (
            <Text style={[styles.team, { color: cardFg }]} numberOfLines={1}>{teamName}</Text>
          ) : null}
          <Text style={[styles.score, { color: cardFg }]}>
            {outcome.us} — {outcome.them}
          </Text>

          {/* Stops the tap from reaching the dismiss layer underneath —
              sharing and closing are different intentions. */}
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); doShare(); }}
            style={[styles.shareBtn, { borderColor: cardFg }]}
            accessibilityRole="button" accessibilityLabel="Share the final score"
          >
            <Text style={[styles.shareText, { color: cardFg }]}>
              {shareLabel}
            </Text>
          </Pressable>

          <Text style={[styles.tap, { color: cardFg }]}>TAP OUTSIDE TO CLOSE</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, zIndex: 998 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xl,
    borderRadius: radius.lg, ...shadow.card,
    alignItems: 'center', minWidth: '68%', maxWidth: '88%',
  },
  headline: {
    fontFamily: 'Archivo', fontWeight: '900', fontSize: 34,
    letterSpacing: 0.5, textAlign: 'center',
  },
  team: {
    fontFamily: 'Archivo', fontWeight: '700', fontSize: 13,
    letterSpacing: 0.9, textTransform: 'uppercase',
    marginTop: 6, opacity: 0.85, textAlign: 'center',
  },
  score: {
    fontFamily: 'Archivo', fontWeight: '900', fontSize: 46,
    fontVariant: ['tabular-nums'], marginTop: spacing.sm,
  },
  shareBtn: {
    marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: 11,
    borderRadius: radius.md, borderWidth: 2,
  },
  shareText: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 12.5, letterSpacing: 0.9,
  },
  tap: {
    fontFamily: 'PublicSans', fontWeight: '700', fontSize: 9,
    letterSpacing: 1.3, marginTop: spacing.md, opacity: 0.6,
  },
});
