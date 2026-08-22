/**
 * AppHeader.jsx — The same bar on every tab.
 *
 * Fixed height regardless of what it contains, so switching tabs doesn't shift
 * the content underneath. Team name and season always sit in the same place;
 * the tab's own name is already in the bottom bar, so it isn't repeated here.
 *
 * The right slot takes one action (ADD, DONE). Screen-level sub-tabs go in the
 * separate row below, which keeps the main bar's height constant.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing, text } from '../theme/tokens.js';
import { resolveTeamColor } from '../shared/teamColors.js';

export const HEADER_HEIGHT = 58;

function Hamburger({ color = '#FFF' }) {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={2}
            strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * Sub-tabs used to live inside this bar, which made the header taller on the
 * screens that had them. They're a separate component now, rendered in the
 * page body — so the navy bar is exactly HEADER_HEIGHT on every tab.
 */
function AppHeader({ team, onMenu, right, onBack, centerTitle }) {
  const teamColor = resolveTeamColor(team);

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.back}>‹</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onMenu} style={styles.iconBtn} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Account menu">
            <Hamburger />
          </Pressable>
        )}

        {centerTitle ? (
          // Absolutely positioned so a long name centres on the BAR, not on
          // the space left between the buttons.
          <View style={styles.centerWrap} pointerEvents="none">
            <Text style={styles.centerText} numberOfLines={1}>{centerTitle}</Text>
          </View>
        ) : (
          <View style={styles.titles}>
            <Text style={styles.name} numberOfLines={1}>
              {team?.name ?? 'Fanfare Sports'}
            </Text>
            {/* Season only. The division is a league setting, not an
                identity — it belongs in Settings, not on every screen. */}
            {team?.season ? (
              <Text style={styles.season} numberOfLines={1}>{team.season}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.rightSlot}>{right ?? null}</View>
      </View>

      {/*
        The team's color, as a stripe under the bar on every screen.

        A stripe rather than repainting the bar itself: the navy bar is the
        one thing that's constant across sports and screens, and a maroon or
        gold header would put user-chosen color behind white text that was
        never measured against it. A 3pt band carries the identity, is
        visible at a glance from the stands, and can't make anything
        unreadable because nothing sits on it.
      */}
      <View style={[styles.stripe, { backgroundColor: teamColor.fill }]} />

    </View>
  );
}

/** Page-level segmented control. Sits below the header, on the page. */
export function SegmentedTabs({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map(([key, label]) => (
        <Pressable key={key} onPress={() => onChange(key)}
          style={[styles.segmentItem, value === key && styles.segmentItemOn]}>
          <Text style={[styles.segmentText, value === key && styles.segmentTextOn]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Consistent right-hand action. */
export function HeaderButton({ label, onPress, active }) {
  return (
    <Pressable onPress={onPress} style={[styles.action, active && styles.actionOn]}>
      <Text style={[styles.actionText, active && styles.actionTextOn]}>{label}</Text>
    </Pressable>
  );
}



const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.navy },
  stripe: { height: 3, width: '100%' },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 30, color: '#FFF', marginTop: -4 },
  titles: { flex: 1, justifyContent: 'center' },
  name: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 18, color: '#FFF' },
  season: { ...text.body, fontSize: 12, color: '#A8B0C6', marginTop: 1 },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  centerText: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 16, color: '#FFF',
    maxWidth: '60%',
  },
  rightSlot: { minWidth: 34, alignItems: 'flex-end' },
  action: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionOn: { backgroundColor: colors.gold },
  actionText: { ...text.buttonSecondary, fontSize: 11, color: '#FFF', letterSpacing: 0.8 },
  actionTextOn: { color: colors.navy },
  segment: {
    flexDirection: 'row', gap: 4, padding: 4, margin: spacing.md, marginBottom: 0,
    backgroundColor: '#E9EDF3', borderRadius: radius.md,
  },
  segmentItem: {
    flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center',
  },
  segmentItemOn: { backgroundColor: colors.card },
  segmentText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  segmentTextOn: { color: colors.navy },
});

export default memo(AppHeader);
