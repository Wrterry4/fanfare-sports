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
import { useTeamInvites } from '../hooks/useTeamInvites.js';

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
  /**
   * Read here rather than passed down from five screens.
   *
   * An invite is account-level and the menu is on every tab, so threading a
   * count through each screen would be five places to forget. One listener on
   * one small collection, mounted wherever the button it marks is.
   */
  const { count: menuBadge } = useTeamInvites();

  /**
   * The bar itself takes the team's color.
   *
   * This started as a 3pt stripe under a permanently-navy bar, on the
   * reasoning that user-chosen color behind white text was never measured.
   * That reasoning was sound and the conclusion was too timid: every color in
   * the palette ships an `onFill` that IS measured against it, and the tests
   * prove all 22 clear AA. So the bar can be the team's color as long as
   * everything on it uses onFill rather than a hardcoded white.
   *
   * Which is the difference between an app with a colored accent and an app
   * that belongs to the team.
   */
  const bg = teamColor.fill;
  const fg = teamColor.onFill;
  // Secondary text and the pressed-state wash have to sit on the team color
  // too, so they're derived from the foreground rather than fixed greys.
  const dim = fg === '#FFFFFF' ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.66)';

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <View style={styles.bar}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.back, { color: fg }]}>‹</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onMenu} style={styles.iconBtn} hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={menuBadge > 0
              ? `Account menu, ${menuBadge} invite${menuBadge === 1 ? '' : 's'} waiting`
              : 'Account menu'}>
            <Hamburger color={fg} />
            {/* An invitation is the one thing in the menu that expires and is
                addressed to you. Without a mark on the button, the only way to
                find it is to already know it's there. */}
            {menuBadge > 0 && <View style={[styles.badge, { borderColor: bg }]} />}
          </Pressable>
        )}

        {centerTitle ? (
          // Absolutely positioned so a long name centres on the BAR, not on
          // the space left between the buttons.
          <View style={styles.centerWrap} pointerEvents="none">
            <Text style={[styles.centerText, { color: fg }]} numberOfLines={1}>{centerTitle}</Text>
          </View>
        ) : (
          <View style={styles.titles}>
            <Text style={[styles.name, { color: fg }]} numberOfLines={1}>
              {team?.name ?? 'Fanfare Sports'}
            </Text>
            {/* Season only. The division is a league setting, not an
                identity — it belongs in Settings, not on every screen. */}
            {team?.season ? (
              <Text style={[styles.season, { color: dim }]} numberOfLines={1}>{team.season}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.rightSlot}>{right ?? null}</View>
      </View>

      {/* Now that the bar carries the primary, the band below is where the
          SECOND color goes — the trim line on a jersey. A team that picked one
          color gets no band at all rather than a stripe of the same color
          repeating itself under a bar that already is that color. */}
      {teamColor.secondary?.fill !== teamColor.fill && (
        <View style={[styles.stripe, { backgroundColor: teamColor.secondary.fill }]} />
      )}

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
  stripe: { height: 4, width: '100%' },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  // Borderless would vanish on a gold or white team colour; the ring is the
  // bar's own colour, so the dot reads on all 22 of them.
  badge: {
    position: 'absolute', top: 5, right: 4, width: 10, height: 10,
    borderRadius: 5, backgroundColor: colors.out, borderWidth: 1.5,
  },
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
