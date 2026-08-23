/**
 * SignupRow.jsx — Snacks, drinks, whoever's setting up the field.
 *
 * This is the Sign Up Genius job, and it lives on the game rather than in chat
 * for one reason: a rota has to be findable in week six. A message scrolls
 * away; the game it belongs to is still right there on the schedule.
 *
 * Claiming is one tap, and so is giving it back — the second one matters more
 * than it looks. A sheet where the only way out of a mistake is texting the
 * coach is a sheet people are afraid to tap.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import {
  subscribeSlots, createSignup, claimSlot, releaseSlot, removeSlot,
} from '../services/signupService.js';
import { groupSlots, slotState, canRelease, SIGNUP_PRESETS, SLOT_STATE }
  from '../shared/signups.js';
import { confirm, notify } from '../utils/confirm.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export default function SignupRow({ teamId, eventId, user, isStaff }) {
  const [slots, setSlots] = useState([]);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => subscribeSlots({ teamId, eventId }, setSlots), [teamId, eventId]);

  const groups = groupSlots(slots);

  const add = useCallback(async ([label, count]) => {
    setAdding(false);
    try {
      await createSignup({ teamId, eventId, label, count });
    } catch (e) { notify('Could not add', e.message); }
  }, [teamId, eventId]);

  const toggle = useCallback(async (slot) => {
    const state = slotState(slot, user?.uid);
    setBusyId(slot.id);
    try {
      if (state === SLOT_STATE.OPEN) {
        await claimSlot({ teamId, eventId, slotId: slot.id, user });
      } else if (canRelease(slot, user?.uid, isStaff)) {
        await releaseSlot({ teamId, eventId, slotId: slot.id });
      }
    } catch (e) { notify('Could not update', e.message); }
    setBusyId(null);
  }, [teamId, eventId, user, isStaff]);

  const remove = useCallback(async (group) => {
    const ok = await confirm({
      title: `Remove ${group.label}?`,
      message: 'Anyone who signed up will be unassigned.',
      confirmLabel: 'Remove', destructive: true,
    });
    if (!ok) return;
    try {
      for (const slot of group.slots) {
        await removeSlot({ teamId, eventId, slotId: slot.id });
      }
    } catch (e) { notify('Could not remove', e.message); }
  }, [teamId, eventId]);

  // Nothing to sign up for, and nobody who could create one: render nothing
  // rather than an empty heading.
  if (!groups.length && !isStaff) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Sign-ups</Text>
        {isStaff && (
          <Pressable onPress={() => setAdding((a) => !a)} hitSlop={8}>
            <Text style={styles.action}>{adding ? 'CANCEL' : '+ ADD'}</Text>
          </Pressable>
        )}
      </View>

      {adding && (
        <View style={styles.presets}>
          {SIGNUP_PRESETS.map((preset) => (
            <Pressable key={preset[0]} onPress={() => add(preset)} style={styles.preset}>
              <Text style={styles.presetText}>
                {preset[0]}{preset[1] > 1 ? ` ×${preset[1]}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {groups.length === 0 && !adding && (
        <Text style={styles.empty}>
          Nothing to bring yet. Tap ADD for snacks, drinks or field setup.
        </Text>
      )}

      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <View style={styles.groupHead}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Text style={styles.groupSummary}>{group.summary}</Text>
            {isStaff && (
              <Pressable onPress={() => remove(group)} hitSlop={8}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            )}
          </View>

          {group.slots.map((slot) => {
            const state = slotState(slot, user?.uid);
            const mine = state === SLOT_STATE.MINE;
            const taken = state === SLOT_STATE.TAKEN;
            const actionable = state === SLOT_STATE.OPEN || canRelease(slot, user?.uid, isStaff);
            return (
              <Pressable
                key={slot.id}
                onPress={() => actionable && toggle(slot)}
                disabled={!actionable || busyId === slot.id}
                style={[styles.slot, mine && styles.slotMine, taken && styles.slotTaken]}
                accessibilityRole="button"
                accessibilityLabel={taken
                  ? `${slot.label} taken by ${slot.claimedName || 'someone'}`
                  : mine ? `${slot.label}, you signed up — tap to give it back`
                         : `Sign up for ${slot.label}`}
              >
                <Text style={[styles.slotName, mine && styles.slotNameMine]} numberOfLines={1}>
                  {slot.claimedBy
                    ? (mine ? 'You' : slot.claimedName || 'Signed up')
                    : `Open${slot.of ? ` · ${slot.position} of ${slot.of}` : ''}`}
                </Text>
                {busyId === slot.id
                  ? <ActivityIndicator color={colors.primary} />
                  : (
                    <Text style={styles.slotAction}>
                      {state === SLOT_STATE.OPEN ? "I'LL BRING IT"
                       : mine ? 'GIVE BACK'
                       : isStaff ? 'CLEAR' : ''}
                    </Text>
                  )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...text.label, color: colors.pencil },
  action: { ...text.buttonSecondary, fontSize: 10, color: colors.primary, letterSpacing: 0.6 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  preset: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card,
  },
  presetText: { ...text.bodyStrong, fontSize: 12, color: colors.primary },
  empty: { ...text.body, fontSize: 12, color: colors.pencil, lineHeight: 17 },
  group: { marginBottom: spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  groupLabel: { ...text.bodyStrong, fontSize: 13, color: colors.navy, flex: 1 },
  groupSummary: { ...text.body, fontSize: 11.5, color: colors.pencil },
  removeText: { fontSize: 13, color: colors.pencil, paddingHorizontal: 2 },
  slot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 9,
    marginBottom: 5, backgroundColor: '#FDFDFC',
  },
  slotMine: { borderColor: colors.grass, backgroundColor: '#F4FAF5' },
  slotTaken: { opacity: 0.75 },
  slotName: { ...text.body, fontSize: 13, color: colors.navy, flex: 1 },
  slotNameMine: { fontWeight: '700' },
  slotAction: { ...text.buttonSecondary, fontSize: 9.5, color: colors.primary, letterSpacing: 0.6 },
});
