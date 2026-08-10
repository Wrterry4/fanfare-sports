/**
 * ActionPads.jsx — The buttons that get tapped 200–400 times a game.
 *
 * Two things drive the layout:
 *
 *   Pitch buttons are the largest and sit LOWEST, because they're the most
 *   frequent and the bottom of the screen is where a thumb rests. STRIKE is
 *   inverted so it's findable without reading.
 *
 *   In casual mode the pitch row disappears while our team is batting, and
 *   returns while our pitcher is working — rest-day limits depend on an
 *   accurate count and nothing else can reconstruct it.
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { tapLight, tapMedium } from '../../../services/haptics';
import { EV } from '../events.js';
import {
  CONTROL_GROUPS, getVisibleControls, weArePitching,
} from '../scoringModes.js';
import { colors, radius, spacing, text, tap, shadow } from '../../../theme/tokens.js';

const LABELS = {
  [EV.BALL]: 'BALL',
  [EV.STRIKE_SWINGING]: 'STRIKE',
  [EV.FOUL]: 'FOUL',
  [EV.SINGLE]: '1B',
  [EV.DOUBLE]: '2B',
  [EV.TRIPLE]: '3B',
  [EV.HOME_RUN]: 'HR',
  [EV.WALK]: 'BB',
  [EV.GROUND_OUT]: 'GO',
  [EV.FLY_OUT]: 'FO',
  [EV.STRIKEOUT]: 'K',
  [EV.FIELDERS_CHOICE]: 'FC',
  [EV.REACHED_ON_ERROR]: 'E',
};

function Key({ label, onPress, variant, disabled }) {
  const handle = useCallback(() => {
    // Confirmation you can feel, so the scorekeeper doesn't look down to check
    // the tap registered. No-ops on iOS Safari, which has never shipped the
    // Vibration API — there the visual press state carries it alone.
    (variant === 'pitch' ? tapMedium : tapLight)();
    onPress();
  }, [onPress, variant]);

  return (
    <Pressable
      onPress={handle}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.key,
        variant === 'pitch' && styles.keyPitch,
        variant === 'strike' && styles.keyStrike,
        variant === 'hit' && styles.keyHit,
        variant === 'out' && styles.keyOut,
        pressed && styles.keyPressed,
        disabled && styles.keyDisabled,
      ]}
    >
      <Text style={[
        styles.keyText,
        (variant === 'pitch' || variant === 'strike') && styles.keyTextLarge,
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PadLabel({ children }) {
  return <Text style={styles.padLabel}>{children}</Text>;
}

function ActionPads({ state, mode, homeOrAway, onEvent, onMore, onUndo, disabled }) {
  const pitching = weArePitching(state.isTop, homeOrAway);
  const groups = getVisibleControls(mode, pitching);
  const showPitch = !!groups[CONTROL_GROUPS.PITCH];

  return (
    <View style={styles.pads}>
      {showPitch && (
        <>
          <PadLabel>
            {pitching ? 'Pitch · counts toward the limit' : 'Pitch'}
          </PadLabel>
          <View style={styles.row3}>
            {groups[CONTROL_GROUPS.PITCH].map((ev) => (
              <Key
                key={ev}
                label={LABELS[ev]}
                variant={ev === EV.STRIKE_SWINGING ? 'strike' : 'pitch'}
                disabled={disabled}
                onPress={() => onEvent(ev)}
              />
            ))}
          </View>
        </>
      )}

      <PadLabel>On base</PadLabel>
      <View style={styles.row5}>
        {groups[CONTROL_GROUPS.ON_BASE].map((ev) => (
          <Key key={ev} label={LABELS[ev]} variant="hit"
               disabled={disabled} onPress={() => onEvent(ev)} />
        ))}
      </View>

      <PadLabel>Out</PadLabel>
      <View style={styles.row5}>
        {groups[CONTROL_GROUPS.OUT].map((ev) => (
          <Key key={ev} label={LABELS[ev]} variant="out"
               disabled={disabled} onPress={() => onEvent(ev)} />
        ))}
      </View>

      <View style={styles.utility}>
        <Pressable onPress={onUndo} disabled={disabled}
                   style={({ pressed }) => [styles.util, styles.utilUndo, pressed && styles.keyPressed]}
                   accessibilityRole="button" accessibilityLabel="Undo last entry">
          <Text style={[styles.utilText, { color: colors.out }]}>↶ UNDO</Text>
        </Pressable>
        <Pressable onPress={onMore} disabled={disabled}
                   style={({ pressed }) => [styles.util, pressed && styles.keyPressed]}
                   accessibilityRole="button" accessibilityLabel="More actions">
          <Text style={styles.utilText}>MORE ···</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pads: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  padLabel: { ...text.label, color: colors.pencil, paddingLeft: 3, marginBottom: -2 },
  row3: { flexDirection: 'row', gap: spacing.sm },
  row5: { flexDirection: 'row', gap: 6 },

  key: {
    flex: 1,
    borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  keyPitch:  { height: tap.primary },
  // Previously filled navy, which read as permanently selected. Weight and a
  // heavier border distinguish it without looking active.
  keyStrike: { height: tap.primary, borderColor: colors.navy, borderWidth: 2 },
  keyHit:    { height: tap.secondary, backgroundColor: '#FFFDF8', borderColor: '#CFC2AC' },
  keyOut:    { height: tap.secondary },
  keyPressed: { transform: [{ scale: 0.965 }], backgroundColor: '#F0EDE6' },
  keyDisabled: { opacity: 0.4 },

  keyText: { ...text.buttonSecondary, color: colors.navy },
  keyTextLarge: { ...text.buttonPrimary, color: colors.navy },

  utility: { flexDirection: 'row', gap: spacing.sm, marginTop: 1 },
  util: {
    flex: 1, height: tap.utility, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  utilUndo: { borderColor: '#D3C4C4' },
  utilText: { ...text.buttonSecondary, fontSize: 12, letterSpacing: 0.7, color: colors.pencil },
});

export default memo(ActionPads);
