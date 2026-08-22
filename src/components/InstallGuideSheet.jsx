/**
 * InstallGuideSheet.jsx — How to add Fanfare to a Home Screen.
 *
 * A fuller version of the three-line nudge in InstallPrompt.jsx. That card is
 * meant to be glanced at and dismissed; this is meant to be followed —
 * numbered steps, an illustration of the actual Share icon so "tap Share"
 * isn't an abstraction, and the iPhone/iPad distinction, since the icon sits
 * in a different toolbar on each and that's the single most common point
 * where someone gets stuck.
 *
 * Reachable two ways: proactively from Settings (isFan especially, since
 * notifications are the entire reason a grandparent installs this), and
 * reactively from NotificationSettings when "Turn on notifications" is tapped
 * before the site is installed — replacing what used to be a single-line
 * browser alert with actual instructions.
 */

import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView, Platform } from 'react-native';
import Svg, { Rect, Path, Line } from 'react-native-svg';

import { colors, radius, spacing, text } from '../theme/tokens.js';

const isIPad = () => Platform.OS === 'web'
  && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

const isIOS = () => Platform.OS === 'web'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || isIPad());

/**
 * Safari's own Share icon isn't a stock emoji or Unicode glyph — it's a
 * square with an arrow escaping the top — so it's drawn here rather than
 * approximated with something that doesn't match what's actually on screen.
 */
function ShareIcon({ size = 26, color = colors.navy }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 L12 15" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M7.5 7.5 L12 3 L16.5 7.5" stroke={color} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x={4} y={11} width={16} height={11} rx={2.2} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

/** The "＋" tile look of the Add to Home Screen entry in the share sheet. */
function AddIcon({ size = 24, color = colors.navy }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={2} width={20} height={20} rx={5} stroke={color} strokeWidth={2} fill="none" />
      <Line x1={12} y1={7} x2={12} y2={17} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={7} y1={12} x2={17} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const STEPS_IOS = (ipad) => [
  {
    icon: <ShareIcon />,
    title: 'Open Fanfare in Safari, then tap Share',
    body: ipad
      ? "It's the square-with-an-arrow icon near the top right of Safari's window."
      : "It's the square-with-an-arrow icon in the toolbar at the bottom of the screen.",
  },
  {
    icon: <AddIcon />,
    title: 'Scroll down and tap "Add to Home Screen"',
    body: "It's in the second group of options, below the row of apps to share with. If you don't see it, you may be in Chrome or another browser — open this page in Safari first.",
  },
  {
    icon: null,
    title: 'Tap "Add" in the top right',
    body: 'Fanfare\'s icon appears on your Home Screen, same as any other app.',
  },
  {
    icon: null,
    title: 'Open Fanfare from the Home Screen, not from Safari',
    body: "This is the step that matters. Alerts only work from the installed icon — a bookmark or a Safari tab can't receive them, even after this.",
  },
];

const STEPS_ANDROID = [
  {
    icon: null,
    title: 'Open Fanfare in Chrome',
    body: 'Tap the ⋮ menu in the top right.',
  },
  {
    icon: null,
    title: 'Tap "Install app" or "Add to Home screen"',
    body: 'Chrome sometimes offers this as a banner at the bottom instead — tap Install there if you see it.',
  },
  {
    icon: null,
    title: 'Open Fanfare from your Home Screen',
    body: 'It behaves like any other installed app from here on.',
  },
];

export default function InstallGuideSheet({ visible, onClose }) {
  if (!visible) return null;

  const ios = isIOS();
  const steps = ios ? STEPS_IOS(isIPad()) : STEPS_ANDROID;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Add Fanfare to your Home Screen</Text>
        <Text style={styles.sub}>
          Two things depend on this: alerts only reach the installed app —
          Safari in a browser tab can't receive them — and your scoring stays
          safe if you lose signal at the field, instead of being cleared
          between games the way a browser tab can be.
        </Text>

        <ScrollView style={styles.list}>
          {steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <View style={styles.stepTitleRow}>
                  {s.icon && <View style={styles.stepIcon}>{s.icon}</View>}
                  <Text style={styles.stepTitle}>{s.title}</Text>
                </View>
                <Text style={styles.stepText}>{s.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <Pressable onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>GOT IT</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 6, marginBottom: spacing.md, lineHeight: 18,
  },
  list: { flexGrow: 0 },
  step: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 12, color: '#FFF' },
  stepBody: { flex: 1 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  stepIcon: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  stepTitle: { ...text.bodyStrong, fontSize: 14, color: colors.navy, flex: 1 },
  stepText: { ...text.body, fontSize: 12, color: colors.pencil, lineHeight: 17 },
  done: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  doneText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
