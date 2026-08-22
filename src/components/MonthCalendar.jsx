/**
 * MonthCalendar.jsx — A month grid with dots on days that have something.
 *
 * Deliberately generic: it knows nothing about games, teams, or Firestore.
 * It takes a month to display, a set of date keys that should carry a dot,
 * and reports which date was tapped. ScheduleScreen supplies the schedule
 * data; this only draws the grid.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { dateKey } from '../shared/scheduleFilters.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const sameDay = (a, b) => !!a && !!b
  && a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

/**
 * @param month        any Date within the month to display
 * @param onMonthChange(nextMonth)
 * @param selectedDate Date or null
 * @param onSelectDate(date)
 * @param eventDates   Set<string> of 'YYYY-MM-DD' keys that should show a dot
 * @param today        for tests; defaults to now
 */
export default function MonthCalendar({
  month, onMonthChange, selectedDate, onSelectDate, eventDates, today = new Date(),
}) {
  const cells = useMemo(() => buildGrid(month), [month]);
  const hasEvent = (d) => eventDates?.has(dateKey(d));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => onMonthChange(addMonths(month, -1))}
          hitSlop={10} accessibilityLabel="Previous month" style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>

        <Text style={styles.monthLabel}>
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </Text>

        <Pressable onPress={() => onMonthChange(addMonths(month, 1))}
          hitSlop={10} accessibilityLabel="Next month" style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      {!sameDay(startOfMonth(month), startOfMonth(today)) && (
        <Pressable onPress={() => onMonthChange(startOfMonth(today))} style={styles.todayBtn}>
          <Text style={styles.todayBtnText}>TODAY</Text>
        </Pressable>
      )}

      <View style={styles.weekdays}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />;
          const dot = hasEvent(date);
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, selectedDate);
          return (
            <Pressable
              key={i}
              onPress={() => onSelectDate(date)}
              disabled={!dot}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={`${MONTH_NAMES[date.getMonth()]} ${date.getDate()}${dot ? ', has an event' : ''}`}
            >
              <View style={[
                styles.dayCircle,
                isSelected && styles.dayCircleSelected,
                isToday && !isSelected && styles.dayCircleToday,
              ]}>
                <Text style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                  !dot && styles.dayTextDim,
                ]}>
                  {date.getDate()}
                </Text>
              </View>
              {dot && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 6 rows × 7 columns. Nulls pad the days outside the month. */
function buildGrid(month) {
  const first = startOfMonth(month);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells = Array(startWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  // A fixed 6-row grid keeps every month the same height, so the list below
  // the calendar doesn't jump up and down as you page through months.
  while (cells.length < 42) cells.push(null);
  return cells;
}

const CELL = `${100 / 7}%`;

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 22, color: colors.navy, fontWeight: '600' },
  monthLabel: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 16, color: colors.navy },
  todayBtn: { alignSelf: 'center', marginBottom: 6 },
  todayBtnText: { ...text.label, fontSize: 9, color: colors.primary },

  weekdays: { flexDirection: 'row' },
  weekday: {
    width: CELL, textAlign: 'center', ...text.label, fontSize: 9, color: colors.pencil,
    marginBottom: 2,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayCircleSelected: { backgroundColor: colors.navy },
  dayText: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 13, color: colors.navy },
  dayTextDim: { color: colors.pencil, fontWeight: '500' },
  dayTextSelected: { color: '#FFF' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary, marginTop: 2 },
  dotSelected: { backgroundColor: colors.navy },
});
