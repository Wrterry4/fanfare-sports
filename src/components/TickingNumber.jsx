/**
 * TickingNumber.jsx — A total that climbs instead of snapping.
 *
 * A run scoring changed a 3 into a 4 with no transition, which is the same
 * visual event as a re-render. Counting up draws the eye to the thing that
 * just happened, which is the entire job of a scoreboard.
 *
 * ── Why a decrease does not animate ─────────────────────────────────────────
 *
 * Scores go down in this app — an undo, a correction to a miscounted run.
 * Animating that direction would dress up a mistake being fixed as an event
 * worth watching, and worse, a scorekeeper correcting an error in front of
 * the other team's parents does not want it announced. Down is instant and
 * silent; only up gets the treatment.
 *
 * ── Why a listener instead of interpolation ─────────────────────────────────
 *
 * Animated can drive styles on the native driver, but it cannot write into a
 * Text node's children. The value is driven normally and a listener rounds it
 * into state — which is why the count itself can't use the native driver,
 * while the pop that accompanies it can.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, Easing } from 'react-native';

const COUNT_MS = 420;

/**
 * @param value  the number to show; non-numeric renders as-is, untouched
 * @param style  passed through to the Text
 */
export default function TickingNumber({ value, style, ...rest }) {
  const numeric = Number(value);
  const isNumber = value !== null && value !== '' && Number.isFinite(numeric);

  const [shown, setShown] = useState(isNumber ? numeric : 0);
  const anim = useRef(new Animated.Value(isNumber ? numeric : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const prev = useRef(isNumber ? numeric : 0);

  useEffect(() => {
    if (!isNumber) return undefined;

    const from = prev.current;
    prev.current = numeric;

    if (numeric <= from) {
      // Down, or unchanged: no ceremony. See the header.
      anim.setValue(numeric);
      setShown(numeric);
      return undefined;
    }

    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.parallel([
      Animated.timing(anim, {
        toValue: numeric, duration: COUNT_MS,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(pop, {
          toValue: 1.35, duration: 140,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
    ]).start();

    return () => anim.removeListener(id);
  }, [numeric, isNumber, anim, pop]);

  if (!isNumber) return <Text style={style} {...rest}>{value}</Text>;

  return (
    <Animated.Text style={[style, { transform: [{ scale: pop }] }]} {...rest}>
      {shown}
    </Animated.Text>
  );
}
