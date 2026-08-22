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
  CONTROL_GROUPS, getVisibleControls, weArePitching, showsPitchTally,
} from '../scoringModes.js';
import { colors, radius, spacing, text, tap, shadow } from '../../../theme/tokens.js';

/**
 * Full words rather than scorekeeper shorthand. "GO" and "FO" are obvious to
 * someone who has kept a book for years and opaque to the parent handed the
 * phone in the third inning — and that parent is who this has to work for.
 *
 * Three across instead of five, so the words fit at a readable size and the
 * targets get bigger.
 */
const LABELS = {
  [EV.BALL]: 'Ball',
  [EV.STRIKE_SWINGING]: 'Strike',
  [EV.FOUL]: 'Foul',
  [EV.SINGLE]: 'Single',
  [EV.DOUBLE]: 'Double',
  [EV.TRIPLE]: 'Triple',
  [EV.HOME_RUN]: 'Home Run',
  [EV.WALK]: 'Walk',
  [EV.GROUND_OUT]: 'Ground Out',
  [EV.FLY_OUT]: 'Fly Out',
  [EV.STRIKEOUT]: 'Strikeout',
  [EV.FIELDERS_CHOICE]: "Fielder's Choice",
  [EV.REACHED_ON_ERROR]: 'Error',
};

function Key({ label, onPress, variant, disabled, compact }) {
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
        compact && (variant === 'pitch' || variant === 'strike')
          ? styles.keyPrimaryCompact : null,
        compact && (variant === 'hit' || variant === 'out')
          ? styles.keySecondaryCompact : null,
        pressed && styles.keyPressed,
        disabled && styles.keyDisabled,
      ]}
    >
      <Text numberOfLines={2} style={[
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

function ActionPads({ state, mode, homeOrAway, rules, onEvent, onMore, onUndo, disabled, compact }) {
  const pitching = weArePitching(state.isTop, homeOrAway);
  const groups = getVisibleControls(mode, pitching);
  const showPitch = !!groups[CONTROL_GROUPS.PITCH];
  const showTally = showsPitchTally(mode, pitching);
  // Defaulted rather than indexed directly — see the matching note in
  // present.js. This component receives `state` straight from GameDayScreen
  // with no presenter layer in between, so it was never covered by the
  // guards added there; it's the same class of bug in a different file.
  const pitchers = state.pitchers || {};
  const pitchCounts = state.pitchCounts || {};
  const pitcherId = pitchers[state.isTop ? 'home' : 'away'];
  const pitchCount = pitchCounts[pitcherId] ?? 0;
  const overLimit = !!rules?.maxPitchesPerOuting && pitchCount >= rules.maxPitchesPerOuting;

  return (
    <View style={[styles.pads, compact && styles.padsCompact]}>
      {showPitch && (
        <>
          <PadLabel>
            {pitching ? 'Pitch · counts toward the limit' : 'Pitch'}
          </PadLabel>
          <View style={styles.grid}>
            {groups[CONTROL_GROUPS.PITCH].map((ev) => (
              <Key
                key={ev}
                label={LABELS[ev]}
                variant={ev === EV.STRIKE_SWINGING ? 'strike' : 'pitch'}
                disabled={disabled}
                compact={compact}
                onPress={() => onEvent(ev)}
              />
            ))}
          </View>
        </>
      )}

      {showTally && (
        <>
          <PadLabel>
            Pitch count · {pitchCount}
            {rules?.maxPitchesPerOuting ? ` of ${rules.maxPitchesPerOuting}` : ''}
          </PadLabel>
          <Pressable
            onPress={() => { tapMedium(); onEvent(EV.PITCH_TALLY); }}
            disabled={disabled}
            style={({ pressed }) => [styles.tally,
                                     compact && styles.keyPrimaryCompact,
                                     pressed && styles.keyPressed,
                                     overLimit && styles.tallyOver]}
            accessibilityRole="button"
            accessibilityLabel="Count one pitch"
          >
            <Text style={styles.tallyText}>+1 PITCH</Text>
            <Text style={styles.tallySub}>
              {overLimit ? 'OVER THE LIMIT' : 'keeps rest days accurate'}
            </Text>
          </Pressable>
        </>
      )}

      <PadLabel>On base</PadLabel>
      <View style={styles.grid}>
        {groups[CONTROL_GROUPS.ON_BASE].map((ev) => (
          <Key key={ev} label={LABELS[ev]} variant="hit" compact={compact}
               disabled={disabled} onPress={() => onEvent(ev)} />
        ))}
      </View>

      <PadLabel>Out</PadLabel>
      <View style={styles.grid}>
        {groups[CONTROL_GROUPS.OUT].map((ev) => (
          <Key key={ev} label={LABELS[ev]} variant="out" compact={compact}
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
  // Trims roughly 40pt off the stack without dropping a control or taking any
  // key below Android's 48pt minimum target.
  padsCompact: { paddingBottom: spacing.sm, gap: 5 },
  padLabel: { ...text.label, color: colors.pencil, paddingLeft: 3, marginBottom: -2 },
  // Three per row, wrapping. basis 31% leaves room for two gaps.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  key: {
    flexBasis: '31.5%',
    flexGrow: 1,
    // One outline for every control on this screen. A single button with a
    // heavier border read as "selected"; uniform weight reads as a keypad.
    borderWidth: 2, borderColor: colors.navy,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  keyPitch:  { height: tap.primary },
  keyStrike: { height: tap.primary },
  keyHit:    { height: tap.secondary, backgroundColor: '#FFFDF8' },
  keyOut:    { height: tap.secondary },
  // "Fielder's Choice" needs two lines at this width.
  keyPressed: { transform: [{ scale: 0.965 }], backgroundColor: '#F0EDE6' },
  keyDisabled: { opacity: 0.4 },
  keyPrimaryCompact: { height: 50 },
  keySecondaryCompact: { height: 42 },

  keyText: {
    ...text.buttonSecondary, color: colors.navy,
    fontSize: 13, textAlign: 'center', paddingHorizontal: 4,
  },
  keyTextLarge: { ...text.buttonPrimary, color: colors.navy, fontSize: 15 },

  utility: { flexDirection: 'row', gap: spacing.sm, marginTop: 1 },
  util: {
    flex: 1, height: tap.utility, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.navy,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  utilUndo: { borderColor: colors.out },
  utilText: { ...text.buttonSecondary, fontSize: 12, letterSpacing: 0.7, color: colors.pencil },

  tally: {
    height: tap.primary, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  tallyOver: { borderColor: colors.out, backgroundColor: '#FDECEC' },
  tallyText: { ...text.buttonPrimary, color: colors.navy },
  tallySub: { ...text.label, fontSize: 8, color: colors.pencil, marginTop: 2 },
});

export default memo(ActionPads);
