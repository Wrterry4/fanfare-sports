/**
 * TeamColorPicker.jsx — Pick the team's color from jersey colors that work.
 *
 * A row of swatches rather than a color wheel. The reasoning is in
 * shared/teamColors.js: a wheel is one tap from safety yellow, and it asks a
 * parent standing at a field to make a design decision on a phone. Every
 * swatch here is a color a youth jersey actually comes in, and every one is
 * proven readable by teamColors.test.js.
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
 * @param value     the selected colorId, or null for "not chosen"
 * @param onChange  (colorId) => void
 * @param label     optional heading; pass null to render just the swatches
 */
export default function TeamColorPicker({ value, onChange, label = 'TEAM COLOR' }) {
  const selected = TEAM_COLORS.find((c) => c.id === value) || DEFAULT_TEAM_COLOR;

  return (
    <View>
      {label ? (
        <View style={styles.head}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.selected}>{selected.label}</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
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
  // The ring is drawn in the surface color so it reads as a gap between the
  // swatch and its outline on any background.
  swatchOn: { borderColor: colors.navy },
  swatchPressed: { opacity: 0.7 },
  check: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 18 },
});
