/** PlayerCardScreen.jsx — not yet built. Placeholder so the navigator resolves. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, text } from '../theme/tokens.js';

export default function PlayerCardScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.t}>PlayerCardScreen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chalk },
  t: { ...text.bodyStrong, color: colors.pencil },
});
