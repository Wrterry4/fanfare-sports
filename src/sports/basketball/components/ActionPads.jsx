/**
 * ActionPads.jsx — Basketball scoring controls.
 *
 * ── The player cards ARE the picker now ─────────────────────────────────────
 *
 * This used to render its own strip of small number chips to pick who an
 * action applies to — a second, smaller copy of the same five players
 * GameDayScreen already shows as big cards above it. Now the big cards do
 * that job directly: tapping one arms it (turns the sport's accent color),
 * and every action here fires against whichever player is armed.
 * `selectedPlayerId`/`onSelectPlayer` are lifted into GameDayScreen so the
 * cards and this panel share one source of truth instead of two.
 *
 * Selection still clears itself after a made shot — possession changes, and
 * the next event almost certainly belongs to someone else.
 *
 * ── Color language ──────────────────────────────────────────────────────────
 *
 * Orange is claimed by "this is live, this is ours, this is happening right
 * now" — the armed player card, the scoring keys, the pressed state on
 * anything you tap. Opponent scoring is deliberately NOT orange, because it
 * would read as if it were part of that same "our action" language; it gets
 * a cool steel-blue instead, which also just reads correctly as "the other
 * team." Fouls stay red — a warning color has to stay a warning color
 * regardless of what else is orange on the screen.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { EV } from '../events.js';
import { getVisibleControls, CONTROL_GROUPS, SCORING_MODES } from '../scoringModes.js';
import { colors, radius, spacing, text, tap } from '../../../theme/tokens.js';
import { basketballTheme as t } from '../theme.js';

const LABELS = {
  [EV.MADE_1]: '+1',
  [EV.MADE_2]: '+2',
  [EV.MADE_3]: '+3',
  [EV.MISS_1]: 'MISS FT',
  [EV.MISS_2]: 'MISS',
  [EV.MISS_3]: 'MISS 3',
  [EV.REBOUND_DEF]: 'REB',
  [EV.REBOUND_OFF]: 'OFF REB',
  [EV.ASSIST]: 'AST',
  [EV.STEAL]: 'STL',
  [EV.BLOCK]: 'BLK',
  [EV.TURNOVER]: 'TO',
  [EV.FOUL_PERSONAL]: 'FOUL',
  [EV.FOUL_DRAWN]: 'DREW FOUL',
};

// A short glyph beside each box-stat label — not required to read the
// button, just enough personality that this doesn't look like a form.
const ICONS = {
  [EV.REBOUND_DEF]: '⬇',
  [EV.REBOUND_OFF]: '⬆',
  [EV.ASSIST]: '🤝',
  [EV.STEAL]: '✋',
  [EV.BLOCK]: '🛡',
  [EV.TURNOVER]: '↩',
};

function Key({ label, icon, onPress, variant, disabled, compact }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.key,
        variant === 'score' && styles.keyScore,
        variant === 'miss' && styles.keyMiss,
        variant === 'box' && styles.keyBox,
        variant === 'foul' && styles.keyFoul,
        variant === 'opponent' && styles.keyOpponent,
        variant === 'utility' && styles.keyUtility,
        compact && (variant === 'score' ? styles.keyPrimaryCompact : styles.keySecondaryCompact),
        // Every key flashes the sport's own accent on press, not a generic
        // grey — the "unique to basketball" feel is as much in the touch
        // feedback as it is in the resting colors.
        pressed && styles.keyPressed,
        pressed && (variant === 'score' || variant === 'box' || variant === 'foul')
          && styles.keyPressedAccent,
        disabled && styles.keyDisabled,
      ]}
    >
      <Text style={[
        styles.keyText,
        variant === 'score' && styles.keyTextScore,
        variant === 'opponent' && styles.keyTextOpponent,
      ]}>
        {icon ? `${icon} ${label}` : label}
      </Text>
    </Pressable>
  );
}

function ActionPads({
  state, mode, rules, participants, selectedPlayerId, onSelectPlayer,
  onEvent, onMore, onUndo, disabled, compact,
}) {
  const controls = getVisibleControls(mode, rules);
  const armed = !!selectedPlayerId && !disabled;
  const selected = participants?.find((p) => p.playerId === selectedPlayerId);

  const fire = useCallback((ev) => {
    if (!selectedPlayerId) return;
    onEvent(ev, { playerId: selectedPlayerId });
    // Possession changes on a make; leaving the selection armed is how the
    // next rebound would land on the wrong child.
    if (ev === EV.MADE_1 || ev === EV.MADE_2 || ev === EV.MADE_3) onSelectPlayer?.(null);
  }, [selectedPlayerId, onEvent, onSelectPlayer]);

  return (
    <View style={[styles.pads, compact && styles.padsCompact]}>
      {/* Context bar replaces both the old "who" chip row and the plain
          prompt text — it's the one place that always says who taps apply
          to, using the same orange the armed card above uses. */}
      <View style={[styles.context, armed && styles.contextArmed]}>
        {armed ? (
          <>
            <View style={styles.contextDot} />
            <Text style={styles.contextTextArmed} numberOfLines={1}>
              Scoring for #{selected?.person?.jerseyNumber ?? '–'}{' '}
              {selected?.person?.lastName || selected?.person?.firstName || 'Player'}
            </Text>
          </>
        ) : (
          <Text style={styles.contextText}>Tap a player above to begin.</Text>
        )}
      </View>

      <View style={styles.row}>
        {controls[CONTROL_GROUPS.SCORE].map((ev) => (
          <Key key={ev} label={LABELS[ev]} compact={compact}
               variant={String(ev).startsWith('MADE') ? 'score' : 'miss'}
               disabled={!armed} onPress={() => fire(ev)} />
        ))}
      </View>

      {controls[CONTROL_GROUPS.BOX].length > 0 && (
        <View style={styles.row}>
          {controls[CONTROL_GROUPS.BOX].map((ev) => (
            <Key key={ev} label={LABELS[ev]} icon={ICONS[ev]} variant="box" compact={compact}
                 disabled={!armed} onPress={() => fire(ev)} />
          ))}
        </View>
      )}

      {/* Fouls are here in BOTH modes. Five ends a child's game and team
          fouls decide the bonus — that's eligibility, not colour. */}
      <View style={styles.row}>
        {controls[CONTROL_GROUPS.FOUL].map((ev) => (
          <Key key={ev} label={LABELS[ev]} variant="foul" compact={compact}
               disabled={!armed} onPress={() => fire(ev)} />
        ))}
      </View>

      {/* Opponent scoring needs no player selected — it isn't credited to
          anyone on our roster — and it's deliberately NOT orange, so it never
          reads as part of "our" live action. */}
      <View style={styles.row}>
        <Key label="OPP +1" variant="opponent" compact={compact} disabled={disabled}
             onPress={() => onEvent(EV.OPPONENT_SCORE, { points: 1 })} />
        <Key label="OPP +2" variant="opponent" compact={compact} disabled={disabled}
             onPress={() => onEvent(EV.OPPONENT_SCORE, { points: 2 })} />
        <Key label="OPP +3" variant="opponent" compact={compact} disabled={disabled}
             onPress={() => onEvent(EV.OPPONENT_SCORE, { points: 3 })} />
      </View>

      {/* Slim utility row, same height baseball uses for Undo/More. */}
      <View style={styles.row}>
        <Key label="↶ UNDO" variant="utility" disabled={disabled} onPress={onUndo} />
        <Key label="MORE ···" variant="utility" disabled={disabled} onPress={onMore} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pads: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  padsCompact: { paddingBottom: spacing.sm, gap: 5 },

  context: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 34, borderRadius: radius.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  contextArmed: { backgroundColor: t.accent, borderColor: t.accent },
  contextDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  contextText: { ...text.body, fontSize: 12, color: colors.pencil },
  contextTextArmed: { ...text.bodyStrong, fontSize: 12.5, color: '#FFF' },

  row: { flexDirection: 'row', gap: 6 },
  key: {
    flex: 1, height: tap.secondary, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
  },
  // Orange, not navy — the score keys are the most-tapped surface on this
  // screen, so they carry the sport's own color rather than the brand's.
  keyScore: { height: tap.primary, backgroundColor: t.accent, borderColor: t.accent },
  keyMiss: { backgroundColor: colors.card },
  keyBox: { backgroundColor: colors.card },
  keyFoul: { borderColor: colors.out },
  // Cool steel-blue, deliberately not orange — see the file header.
  keyOpponent: { backgroundColor: '#EAF1F6', borderColor: '#3E6E8E', borderWidth: 1.5 },
  keyTextOpponent: { color: '#2C5A76', fontWeight: '800' },
  keyUtility: { height: tap.utility, backgroundColor: colors.card },
  keyPrimaryCompact: { height: 50 },
  keySecondaryCompact: { height: 42 },
  keyPressed: { transform: [{ scale: 0.97 }] },
  // The orange press-flash — applied on top of whatever the key's resting
  // style is, so even a plain grey box-stat button confirms the tap in the
  // sport's own color rather than a generic darkening.
  keyPressedAccent: { borderColor: t.accent, backgroundColor: t.accentSoft },
  keyDisabled: { opacity: 0.4 },
  keyText: { ...text.buttonSecondary, fontSize: 11, color: colors.navy },
  keyTextScore: { color: '#FFF', fontSize: 15 },
});

export default ActionPads;
