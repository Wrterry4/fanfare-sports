/**
 * RsvpRow.jsx — Attending / Maybe / Can't make it.
 *
 * One row per child you're linked to, so a parent with two on the roster
 * answers for each. Staff answer for themselves.
 *
 * The count a coach sees is of PLAYERS, not people — "9 in" means nine kids,
 * which is the number that decides whether there's a game.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { setRsvp } from '../services/eventService.js';
import { useMyRole } from '../hooks/useMyRole.js';
import { useAuth } from '../hooks/AuthProvider.jsx';
import { useRsvps } from '../hooks/useRsvps.js';
import AttendanceSheet, { AttendanceBar } from './AttendanceSheet.jsx';
import { RSVP_OPTIONS } from '../shared/eventTypes.js';
import { notify } from '../utils/confirm.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export default function RsvpRow({ teamId, eventId, roster }) {
  const { user } = useAuth();
  const { isFan, isStaff, linkedPlayerIds } = useMyRole();
  const [busy, setBusy] = useState(null);
  const [sheet, setSheet] = useState(false);

  const { counts, attendance, byId } =
    useRsvps(teamId, eventId, roster, { enabled: !isFan });

  const answer = useCallback(async (playerId, status, name) => {
    const key = playerId || 'self';
    setBusy(key);
    try {
      await setRsvp({ teamId, eventId, playerId, status, name });
    } catch (e) { notify('Could not save', e.message); }
    setBusy(null);
  }, [teamId, eventId]);

  // Family members follow a child; they aren't part of the headcount.
  if (isFan) return null;

  const mine = (roster || []).filter((p) => linkedPlayerIds.includes(p.playerId));
  const rows = mine.length
    ? mine.map((p) => ({
        key: p.playerId,
        label: `${p.firstName} ${p.lastName}`.trim(),
        playerId: p.playerId,
      }))
    // A coach or scorekeeper with no child on the roster answers for themselves.
    : [{ key: 'self', label: 'You', playerId: null }];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>WHO'S COMING</Text>
        <AttendanceBar counts={counts} onPress={() => setSheet(true)} />
      </View>

      {rows.map((row) => {
        const current = byId[row.playerId || `u_${user?.uid}`]?.status;
        return (
          <View key={row.key} style={styles.person}>
            <Text style={styles.name} numberOfLines={1}>{row.label}</Text>
            <View style={styles.options}>
              {RSVP_OPTIONS.map(([value, labelText]) => (
                <Pressable
                  key={value}
                  disabled={busy === row.key}
                  onPress={() => answer(row.playerId, value, row.label)}
                  style={[
                    styles.option,
                    current === value && styles[`on_${value}`],
                  ]}
                >
                  <Text style={[styles.optionText, current === value && styles.optionTextOn]}>
                    {labelText}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      <Pressable onPress={() => setSheet(true)} style={styles.seeAll}>
        <Text style={styles.seeAllText}>SEE EVERYONE ›</Text>
      </Pressable>

      <AttendanceSheet
        visible={sheet}
        attendance={attendance}
        isStaff={isStaff}
        busyId={busy}
        onSet={(person, status) => answer(person.playerId, status, person.name)}
        onClose={() => setSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1, borderTopColor: colors.line,
    paddingTop: spacing.md, marginTop: spacing.md,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  label: { ...text.label, color: colors.pencil },
  counts: { ...text.body, fontSize: 11.5, color: colors.pencil },
  person: { marginBottom: spacing.sm },
  name: { ...text.bodyStrong, fontSize: 13, color: colors.navy, marginBottom: 5 },
  options: { flexDirection: 'row', gap: 6 },
  option: {
    flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
  },
  on_yes: { backgroundColor: '#E4F0E7', borderColor: colors.grass },
  on_maybe: { backgroundColor: '#FBF1D8', borderColor: colors.gold },
  on_no: { backgroundColor: '#F3E5E5', borderColor: colors.out },
  optionText: { ...text.bodyStrong, fontSize: 11.5, color: colors.pencil },
  optionTextOn: { color: colors.navy },
  seeAll: {
    marginTop: 2, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.line, alignItems: 'center',
  },
  seeAllText: { ...text.label, fontSize: 9, color: colors.pencil },
});
