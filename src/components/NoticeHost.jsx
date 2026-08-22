/**
 * NoticeHost.jsx — notify() with a face.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * notify() was window.alert on web. That works, but it's the browser's dialog:
 * it can't be centered, sized, themed, or made to look like the app, and on a
 * phone it renders as a system sheet with the origin printed above it. "Saved"
 * appearing in a box that says fanfare-sports.web.app is not a confirmation,
 * it's an interruption.
 *
 * ── Why a module-level subscriber instead of a hook ─────────────────────────
 *
 * notify() is imported as a plain function by a dozen screens and called from
 * inside async handlers, where a hook can't reach. Rather than convert every
 * call site to a context consumer, this registers itself once and confirm.js
 * routes through it — so every existing `notify('Saved', ...)` gets the new
 * dialog with no change at the call site, and anything calling it before the
 * host mounts still falls back to Alert rather than silently dropping.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';

import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

/** Set by the mounted host. confirm.js reads it through setNoticeHandler. */
let handler = null;
export const setNoticeHandler = (fn) => { handler = fn; };
export const getNoticeHandler = () => handler;

export default function NoticeHost() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setNoticeHandler((title, message) => setNotice({ title, message }));
    return () => setNoticeHandler(null);
  }, []);

  const close = useCallback(() => setNotice(null), []);

  return (
    <Modal visible={!!notice} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        {/* The card swallows its own taps so a mis-tap inside the dialog
            doesn't dismiss the thing being read. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{notice?.title}</Text>
          {notice?.message ? (
            <Text style={styles.message}>{notice.message}</Text>
          ) : null}
          <Pressable onPress={close} style={styles.ok} accessibilityRole="button">
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
    width: '100%', maxWidth: 360, ...shadow.card,
  },
  title: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 20,
    color: colors.navy, textAlign: 'center',
  },
  // Body stays at the app's normal reading size — only the title grew.
  message: {
    ...text.body, color: colors.pencil, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 19,
  },
  ok: {
    marginTop: spacing.lg, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  okText: { ...text.buttonPrimary, color: '#FFFFFF' },
});
