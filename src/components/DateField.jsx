/**
 * DateField.jsx — NATIVE fallback.
 *
 * The web build uses real <input type="date"> pickers. On native this would be
 * @react-native-community/datetimepicker; until that's wired up, plain text
 * entry in the same ISO format keeps the shared screens working.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, text } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

export function DateField({ label, value, onChange }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput value={value || ''} onChangeText={onChange} style={inputStyle}
        placeholder="2027-04-12" placeholderTextColor="#A0A8B8" />
    </View>
  );
}

export function TimeField({ label, value, onChange }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput value={value || ''} onChangeText={onChange} style={inputStyle}
        placeholder="17:30" placeholderTextColor="#A0A8B8" />
    </View>
  );
}

export function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 12, mm = 0;
  if (timeStr) { const [h, min] = timeStr.split(':').map(Number); hh = h; mm = min; }
  return new Date(y, (m || 1) - 1, d || 1, hh, mm);
}

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
