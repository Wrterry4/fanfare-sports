/**
 * Centered.jsx — One thing in the middle of an otherwise empty screen.
 *
 * Five screens each had their own copy, and every one of them painted
 * `colors.chalk`. That's the brand's page background, not the team's — so a
 * loading spinner, "No game scheduled" or "Add a game first" turned the body
 * of a themed screen white, while the header above it stayed the team's
 * colour. It read as an unstyled screen rather than an empty one.
 *
 * The surface comes from the active team here, so an empty state is as much
 * the team's screen as a full one.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import ScreenRoot from './ScreenRoot.jsx';
import { useTeamSurface } from '../theme/useSportTheme.js';
import { spacing } from '../theme/tokens.js';

/**
 * @param inset  true when this IS the screen (loading, no team) and needs the
 *               status-bar inset; false when it sits inside a screen that has
 *               already applied it, where painting a background again would
 *               only cover the one underneath.
 */
export default function Centered({ children, inset = true }) {
  const surface = useTeamSurface();
  if (!inset) return <View style={styles.centered}>{children}</View>;
  return (
    <ScreenRoot style={[styles.centered, { backgroundColor: surface }]}>
      {children}
    </ScreenRoot>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },
});
