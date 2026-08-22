/**
 * AttendanceSheet.jsx — Who's coming, in one list.
 *
 * Two pieces:
 *
 *   AttendanceBar    the in / maybe / out summary, shown on the event's main
 *                    bar so a coach reads it without expanding anything.
 *   AttendanceSheet  the full roster with each child's answer, opened by
 *                    tapping any part of that summary.
 *
 * One list, not three. Tapping "in", "maybe" and "out" separately to assemble a
 * picture of the team is the thing a coach does on Friday night with a phone in
 * one hand — so all four groups are on screen at once, and the fourth group is
 * the point: NO ANSWER is who still needs a text.
 *
 * Staff can set an answer for any child from here. The security rule already
 * allows it (`|| isStaff(teamId)` on the rsvp write); there was simply never a
 * control, which meant attendance stayed empty until every parent was linked
 * to their child and answered on their own.
 */

import React, { useMemo } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView,
} from 'react-native';

import { RSVP, RSVP_SHORT } from '../shared/eventTypes.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

/** Summary line. Always renders — "nobody has answered" is information too. */
export function AttendanceBar({ counts, onPress, compact }) {
  const { yes = 0, maybe = 0, no = 0, staff } = counts || {};
  const staffYes = staff?.yes || 0;
  const answered = yes + maybe + no + staffYes;

  const body = (
    <View style={[styles.bar, compact && styles.barCompact]}>
      {answered === 0 ? (
        <Text style={styles.barEmpty}>No answers yet</Text>
      ) : (
        <>
          <Pill tone="yes" n={yes} label={`player${yes === 1 ? '' : 's'} in`} />
          {maybe > 0 && <Pill tone="maybe" n={maybe} label="maybe" />}
          {no > 0 && <Pill tone="no" n={no} label="out" />}
          {/* Counted apart from the children, because "nine kids" is the
              number that decides whether there's a game. */}
          {staffYes > 0 && (
            <Text style={styles.staffNote}>
              +{staffYes} staff
            </Text>
          )}
        </>
      )}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="See who has responded"
      hitSlop={6}
      style={({ pressed }) => [pressed && styles.barPressed]}
    >
      {body}
    </Pressable>
  );
}

function Pill({ tone, n, label }) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={[styles.pillNum, styles[`pillText_${tone}`]]}>{n}</Text>
      <Text style={[styles.pillLabel, styles[`pillText_${tone}`]]}>{label}</Text>
    </View>
  );
}

const GROUP_ORDER = [
  [RSVP.YES, 'IN', 'yes'],
  [RSVP.MAYBE, 'MAYBE', 'maybe'],
  [RSVP.NO, 'OUT', 'no'],
  ['none', 'NO ANSWER', 'none'],
];

export default function AttendanceSheet({
  visible, eventLabel, attendance, isStaff, busyId, onSet, onClose,
}) {
  const { groups, staff } = attendance || { groups: {}, staff: [] };

  const total = useMemo(
    () => GROUP_ORDER.reduce((n, [key]) => n + (groups[key]?.length || 0), 0),
    [groups]
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Who's coming</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {eventLabel ? `${eventLabel} · ` : ''}
          {total} on the roster
          {isStaff ? ' · tap a name to answer for them' : ''}
        </Text>

        <ScrollView style={styles.list}>
          {total === 0 && (
            <Text style={styles.empty}>
              No players on the roster yet. Add them from the Roster tab.
            </Text>
          )}

          {GROUP_ORDER.map(([key, heading, tone]) => {
            const people = groups[key] || [];
            if (!people.length) return null;
            return (
              <View key={key} style={styles.group}>
                <Text style={[styles.groupHead, styles[`head_${tone}`]]}>
                  {heading} · {people.length}
                </Text>
                {people.map((p) => (
                  <PersonLine
                    key={p.playerId}
                    person={p}
                    tone={tone}
                    isStaff={isStaff}
                    busy={busyId === p.playerId}
                    onSet={onSet}
                  />
                ))}
              </View>
            );
          })}

          {staff.length > 0 && (
            <View style={styles.group}>
              <Text style={[styles.groupHead, styles.head_staff]}>
                TEAM STAFF · {staff.length}
              </Text>
              {staff.map((s) => (
                <View key={s.uid} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                  </View>
                  <Text style={styles.answered}>
                    {RSVP_SHORT[s.status] || '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <Pressable onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>DONE</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function PersonLine({ person, tone, isStaff, busy, onSet }) {
  return (
    <View style={[styles.row, styles[`row_${tone}`], busy && styles.rowBusy]}>
      <View style={[styles.jersey, styles[`jersey_${tone}`]]}>
        <Text style={styles.jerseyText}>{person.jerseyNumber ?? '–'}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
      </View>

      {isStaff ? (
        <View style={styles.setters}>
          {[RSVP.YES, RSVP.MAYBE, RSVP.NO].map((value) => (
            <Pressable
              key={value}
              disabled={busy}
              onPress={() => onSet(person, value)}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${person.name} ${RSVP_SHORT[value]}`}
              style={[
                styles.setter,
                person.status === value && styles[`setterOn_${value}`],
              ]}
            >
              <Text style={[
                styles.setterText,
                person.status === value && styles.setterTextOn,
              ]}>
                {RSVP_SHORT[value]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.answered}>
          {person.status ? RSVP_SHORT[person.status] : 'No answer'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  barCompact: { marginTop: 5 },
  barPressed: { opacity: 0.6 },
  barEmpty: { ...text.body, fontSize: 11, color: colors.pencil },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm,
    borderWidth: 1,
  },
  pill_yes: { backgroundColor: '#E4F0E7', borderColor: colors.grass },
  pill_maybe: { backgroundColor: '#FBF1D8', borderColor: colors.gold },
  pill_no: { backgroundColor: '#F3E5E5', borderColor: colors.out },
  pillNum: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 11 },
  pillLabel: { ...text.body, fontSize: 10.5 },
  pillText_yes: { color: '#1F5130' },
  pillText_maybe: { color: '#7A5B10' },
  pillText_no: { color: '#7A2222' },
  staffNote: { ...text.body, fontSize: 10.5, color: colors.pencil },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sub: {
    ...text.body, fontSize: 12.5, color: colors.pencil,
    marginTop: 4, marginBottom: spacing.md, lineHeight: 17,
  },
  list: { flexGrow: 0 },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30 },
  flex: { flex: 1 },

  group: { marginBottom: spacing.md },
  groupHead: { ...text.label, fontSize: 9, marginBottom: 6 },
  head_yes: { color: colors.grass },
  head_maybe: { color: colors.gold },
  head_no: { color: colors.out },
  head_none: { color: colors.pencil },
  head_staff: { color: colors.pencil },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 9,
    marginBottom: 6,
  },
  row_yes: { borderColor: colors.grass },
  row_maybe: { borderColor: colors.gold },
  row_no: { borderColor: colors.out },
  row_none: { borderStyle: 'dashed' },
  rowBusy: { opacity: 0.5 },

  jersey: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pencil,
  },
  jersey_yes: { backgroundColor: colors.grass },
  jersey_maybe: { backgroundColor: colors.gold },
  jersey_no: { backgroundColor: colors.out },
  jersey_none: { backgroundColor: colors.line },
  jerseyText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 12, color: '#FFF' },

  name: { ...text.bodyStrong, fontSize: 13.5, color: colors.navy },
  answered: { ...text.label, fontSize: 9, color: colors.pencil },

  setters: { flexDirection: 'row', gap: 4 },
  setter: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
    minWidth: 40, alignItems: 'center',
  },
  setterOn_yes: { backgroundColor: '#E4F0E7', borderColor: colors.grass },
  setterOn_maybe: { backgroundColor: '#FBF1D8', borderColor: colors.gold },
  setterOn_no: { backgroundColor: '#F3E5E5', borderColor: colors.out },
  setterText: { ...text.label, fontSize: 8.5, color: colors.pencil },
  setterTextOn: { color: colors.navy },

  done: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  doneText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
