/**
 * TeamColorPicker.jsx — Pick a team color from colors that work.
 *
 * A row of swatches rather than a color wheel. The reasoning is in
 * shared/teamColors.js: a wheel is one tap from safety yellow, and it asks a
 * parent standing at a field to make a design decision on a phone. Every
 * swatch here is a color a youth jersey actually comes in, and every one is
 * proven readable by teamColors.test.js.
 *
 * Nothing here knows or cares which sport the team plays. A basketball team
 * gets the same picker, the same tint, and the same celebration colors as a
 * baseball one — team identity is a property of the team, not the game.
 *
 * Selection is shown with a check drawn in the swatch's OWN text color, which
 * is the color guaranteed to be legible on it — a white check would vanish on
 * gold and silver.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { TEAM_COLORS, DEFAULT_TEAM_COLOR } from '../shared/teamColors.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

/**
 * @param value      the selected colorId, or null for "not chosen"
 * @param onChange   (colorId | null) => void
 * @param label      optional heading; pass null to render just the swatches
 * @param noneLabel  what the clear option is called. "Default" for a primary
 *                   (there IS a fallback look); "None" for a secondary (there
 *                   simply isn't a second color).
 */
export default function TeamColorPicker({
  value, onChange, label = 'TEAM COLOR', noneLabel = 'Default',
}) {
  const selected = TEAM_COLORS.find((c) => c.id === value);
  const isNone = !selected;

  return (
    <View>
      {label ? (
        <View style={styles.head}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.selected}>{selected ? selected.label : noneLabel}</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {/*
          An explicit way back to no color.

          Tapping the selected swatch already cleared it, but nothing on screen
          said so — an undiscoverable gesture is the same as no gesture. This
          shows what "no color chosen" actually looks like rather than
          describing it: the brand blue the app falls back to.
        */}
        <Pressable
          onPress={() => onChange?.(null)}
          style={({ pressed }) => [
            styles.swatch,
            styles.none,
            isNone && styles.swatchOn,
            pressed && styles.swatchPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: isNone }}
          accessibilityLabel={`${noneLabel} — no team color`}
        >
          <View style={[styles.noneDot, { backgroundColor: DEFAULT_TEAM_COLOR.fill }]} />
          {isNone ? <Text style={styles.noneCheck}>✓</Text> : null}
        </Pressable>

        {TEAM_COLORS.map((c) => {
          const on = c.id === value;
          return (
            <Pressable
              key={c.id}
              onPress={() => onChange?.(on ? null : c.id)}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: c.fill },
                on && styles.swatchOn,
                pressed && styles.swatchPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${c.label} team color`}
            >
              {on ? <Text style={[styles.check, { color: c.onFill }]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 7,
  },
  label: { ...text.label, color: colors.pencil },
  selected: { ...text.bodyStrong, fontSize: 12, color: colors.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  // Reads as an empty slot rather than a color: the app's own surface, with a
  // dashed edge and a dot of the fallback blue inside it.
  none: {
    backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed',
  },
  noneDot: { width: 14, height: 14, borderRadius: 7, opacity: 0.55 },
  noneCheck: {
    position: 'absolute',
    fontFamily: 'Archivo', fontWeight: '900', fontSize: 18, color: colors.navy,
  },
  swatchOn: { borderColor: colors.navy, borderStyle: 'solid' },
  swatchPressed: { opacity: 0.7 },
  check: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 18 },
});
