/**
 * PollComposerSheet.jsx — Asking the team a question.
 *
 * Two options are on screen from the start, because an empty list doesn't
 * teach anyone that a poll needs options — and the two most common polls
 * ("can you make it?", "which day?") are both answered by filling in two
 * boxes and pressing post.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';

import { notify } from '../utils/confirm.js';
import { MAX_OPTIONS, MAX_QUESTION } from '../shared/polls.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

/** The two polls coaches actually send, one tap away from being written. */
const TEMPLATES = [
  ['Availability', 'Who can make it?', ['I can be there', "Can't make it", 'Not sure yet']],
  ['Pick a day', 'Which day works?', ['Saturday', 'Sunday']],
];

export default function PollComposerSheet({ visible, onClose, onPost }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setQuestion(''); setOptions(['', '']); setMulti(false);
  }, []);

  const setOption = useCallback((i, value) => {
    setOptions((o) => o.map((v, k) => (k === i ? value : v)));
  }, []);

  const addOption = useCallback(() => {
    setOptions((o) => (o.length >= MAX_OPTIONS ? o : [...o, '']));
  }, []);

  const removeOption = useCallback((i) => {
    setOptions((o) => (o.length <= 2 ? o : o.filter((_, k) => k !== i)));
  }, []);

  const applyTemplate = useCallback(([, q, opts]) => {
    setQuestion(q);
    // Padded to two so the form never renders fewer boxes than a poll needs.
    setOptions(opts.length >= 2 ? [...opts] : [...opts, '']);
  }, []);

  const post = useCallback(async () => {
    setBusy(true);
    try {
      await onPost({ question, options, multi });
      reset();
      onClose?.();
    } catch (e) {
      notify('Could not post', e.message);
    }
    setBusy(false);
  }, [question, options, multi, onPost, onClose, reset]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>New poll</Text>
          <Text style={styles.sub}>
            Posted to the team chat. Everyone sees the answers, which is the
            point — a coach needs to know who, not just how many.
          </Text>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.templates}>
              {TEMPLATES.map((t) => (
                <Pressable key={t[0]} onPress={() => applyTemplate(t)} style={styles.template}>
                  <Text style={styles.templateText}>{t[0]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Question</Text>
            <TextInput value={question} onChangeText={setQuestion} style={inputStyle}
              placeholder="Who can make Saturday?" placeholderTextColor="#A0A8B8"
              maxLength={MAX_QUESTION} autoFocus />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Options</Text>
            {options.map((o, i) => (
              <View key={i} style={styles.optionRow}>
                <TextInput value={o} onChangeText={(v) => setOption(i, v)}
                  style={[inputStyle, styles.flex]}
                  placeholder={`Option ${i + 1}`} placeholderTextColor="#A0A8B8" />
                {options.length > 2 && (
                  <Pressable onPress={() => removeOption(i)} hitSlop={8} style={styles.remove}
                    accessibilityRole="button" accessibilityLabel={`Remove option ${i + 1}`}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {options.length < MAX_OPTIONS && (
              <Pressable onPress={addOption} style={styles.addOption}>
                <Text style={styles.addOptionText}>+ ADD OPTION</Text>
              </Pressable>
            )}

            <Pressable onPress={() => setMulti((m) => !m)} style={styles.toggle}>
              <View style={[styles.box, multi && styles.boxOn]}>
                {multi && <Text style={styles.tick}>✓</Text>}
              </View>
              <View style={styles.flex}>
                <Text style={styles.toggleTitle}>Let people pick more than one</Text>
                <Text style={styles.toggleSub}>
                  For "which nights work" — everyone can tick every night they can do.
                </Text>
              </View>
            </Pressable>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.cta, styles.ctaGhost]}>
              <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
            </Pressable>
            <Pressable onPress={post} disabled={busy} style={[styles.cta, styles.flex]}>
              {busy ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.ctaText}>POST POLL</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, maxHeight: '88%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sub: { ...text.body, fontSize: 12.5, color: colors.pencil, marginTop: 4, marginBottom: spacing.md, lineHeight: 17 },
  body: { flexGrow: 0 },
  flex: { flex: 1 },
  templates: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  template: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card,
  },
  templateText: { ...text.bodyStrong, fontSize: 12, color: colors.primary },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  remove: { padding: 6 },
  removeText: { fontSize: 15, color: colors.pencil },
  addOption: { paddingVertical: 8 },
  addOptionText: { ...text.buttonSecondary, fontSize: 11, color: colors.primary, letterSpacing: 0.6 },
  toggle: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    marginTop: spacing.md, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.md, padding: spacing.md,
  },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#FFF', fontSize: 13, fontWeight: '900', lineHeight: 15 },
  toggleTitle: { ...text.bodyStrong, fontSize: 13.5, color: colors.navy },
  toggleSub: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cta: { height: 48, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
