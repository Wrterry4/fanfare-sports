/**
 * DateField.web.jsx — Native date and time pickers.
 *
 * react-native-web renders to the DOM, so a real <input type="date"> works —
 * and it's better than anything I'd build: iOS shows its wheel picker, Android
 * its calendar, both localized, both keyboard-accessible on desktop.
 *
 * Styled to match the RN TextInputs beside it so the form doesn't look like
 * two different toolkits stitched together.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, text } from '../theme/tokens.js';

const domStyle = {
  boxSizing: 'border-box',
  width: '100%',
  height: 46,
  padding: '0 12px',
  fontSize: 16,               // below 16 and mobile Safari zooms on focus
  fontFamily: 'PublicSans, -apple-system, sans-serif',
  color: colors.navy,
  backgroundColor: '#FDFDFC',
  border: `1px solid ${colors.line}`,
  borderRadius: radius.md,
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
};

export function DateField({ label, value, onChange }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={domStyle}
      />
    </View>
  );
}

export function TimeField({ label, value, onChange }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={domStyle}
      />
    </View>
  );
}

/** ISO date + 24h time -> Date. Both optional. */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 12, mm = 0;
  if (timeStr) {
    const [h, min] = timeStr.split(':').map(Number);
    hh = h; mm = min;
  }
  return new Date(y, (m || 1) - 1, d || 1, hh, mm);
}

/** Date -> the two strings the inputs want. */
export function splitDateTime(date) {
  if (!date || isNaN(date)) return { dateStr: '', timeStr: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    dateStr: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    timeStr: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
});
