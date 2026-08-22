/**
 * InAppNotice.jsx — Foreground notifications, shown in the app.
 *
 * ── The distinction this exists to make ─────────────────────────────────────
 *
 * A push notification interrupts. It's for someone whose phone is in a pocket
 * — a grandparent five hundred miles away who wants to know Jack is up. An
 * in-app notice informs without interrupting: the person is already looking at
 * the app, so an OS banner over the top of the thing they're watching is
 * noise, not news.
 *
 * FCM already knows which is which — onBackgroundMessage versus onMessage —
 * and now that the server sends data-only to web, the two can render
 * differently. The service worker shows the OS banner; this shows a card that
 * slides in, sits for a few seconds, and can be tapped to navigate.
 *
 * Deliberately not a queue of many. Two notices stacked on a phone in a gym is
 * already too much; a newer one replaces the older, which matches how a person
 * reads them anyway.
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';

import { subscribeForegroundPush } from '../services/foregroundPush';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

const NoticeContext = createContext(null);

/** Long enough to read a short sentence, short enough not to sit in the way. */
const DWELL_MS = 4500;

export function InAppNoticeProvider({ children, onNavigate }) {
  const [notice, setNotice] = useState(null);
  const slide = useRef(new Animated.Value(-120)).current;
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    Animated.timing(slide, {
      toValue: -120, duration: 180, useNativeDriver: true,
    }).start(() => setNotice(null));
  }, [slide]);

  const show = useCallback((next) => {
    clearTimeout(timer.current);
    setNotice(next);
    Animated.timing(slide, {
      toValue: 0, duration: 220, useNativeDriver: true,
    }).start();
    timer.current = setTimeout(dismiss, DWELL_MS);
  }, [slide, dismiss]);

  useEffect(() => {
    const unsub = subscribeForegroundPush(show);
    return () => { clearTimeout(timer.current); unsub(); };
  }, [show]);

  return (
    <NoticeContext.Provider value={{ show, dismiss }}>
      {children}
      {notice && (
        <Animated.View
          style={[styles.wrap, { transform: [{ translateY: slide }] }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => {
              dismiss();
              if (notice.data?.link) onNavigate?.(notice.data);
            }}
            accessibilityRole="button"
            style={styles.card}
          >
            <View style={styles.dot} />
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={1}>{notice.title}</Text>
              {!!notice.body && (
                <Text style={styles.body} numberOfLines={2}>{notice.body}</Text>
              )}
            </View>
            <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss">
              <Text style={styles.close}>×</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      )}
    </NoticeContext.Provider>
  );
}

/**
 * Also usable directly, so in-app events that never involve the server — a
 * saved lineup, a finished sync — can use the same surface rather than
 * inventing a second one.
 */
export function useInAppNotice() {
  return useContext(NoticeContext) ?? { show: () => {}, dismiss: () => {} };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: spacing.md, zIndex: 999,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, ...shadow.card,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  flex: { flex: 1 },
  title: { ...text.bodyStrong, fontSize: 13.5, color: colors.navy },
  body: { ...text.body, fontSize: 12, color: colors.pencil, marginTop: 2, lineHeight: 16 },
  close: { fontSize: 20, color: colors.pencil, paddingHorizontal: 4 },
});
