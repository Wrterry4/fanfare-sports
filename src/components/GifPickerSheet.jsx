/**
 * GifPickerSheet.jsx — Search Giphy, send one.
 *
 * Trending on open, because an empty grid teaches nobody what to type. Search
 * is debounced at 350ms — a request per keystroke is four wasted round trips
 * on the word "nice" and a grid that flickers through three wrong answers on
 * the way to the right one.
 *
 * The grid shows Giphy's downsized previews rather than the full files: thirty
 * full-size GIFs animating at once is what makes a picker stutter on a phone.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Image, Pressable, Modal, StyleSheet, ScrollView,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';

import { searchGifs } from '../services/giphyService.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

const COLUMNS = 2;
const GAP = 6;
const DEBOUNCE_MS = 350;

export default function GifPickerSheet({ visible, onClose, onPick }) {
  const [term, setTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(null);
  const { width } = useWindowDimensions();
  const controller = useRef(null);

  useEffect(() => {
    if (!visible) { setTerm(''); setGifs([]); setError(null); return undefined; }

    const timer = setTimeout(() => {
      // Abort the in-flight request before starting another: without this a
      // slow response for "n" can land after the one for "nice" and repaint
      // the grid with the wrong results.
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;

      setLoading(true);
      setError(null);
      searchGifs(term, { signal: ctrl.signal })
        .then((results) => { if (!ctrl.signal.aborted) { setGifs(results); setLoading(false); } })
        .catch((e) => {
          if (ctrl.signal.aborted) return;      // superseded, not failed
          setError(e.message);
          setLoading(false);
        });
    }, term ? DEBOUNCE_MS : 0);

    return () => clearTimeout(timer);
  }, [visible, term]);

  useEffect(() => () => controller.current?.abort(), []);

  const pick = useCallback(async (gif) => {
    setSending(gif.id);
    try {
      await onPick(gif);
      onClose?.();
    } catch {
      setSending(null);
    }
  }, [onPick, onClose]);

  if (!visible) return null;

  const tile = Math.floor((Math.min(width, 720) - spacing.lg * 2 - GAP) / COLUMNS);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Add a GIF</Text>

        <TextInput value={term} onChangeText={setTerm} style={inputStyle}
          placeholder="Search Giphy" placeholderTextColor="#A0A8B8"
          autoCapitalize="none" autoCorrect={false} autoFocus />

        {loading && <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && gifs.length === 0 && (
          <Text style={styles.empty}>Nothing for that. Try a different word.</Text>
        )}

        <ScrollView style={styles.grid} keyboardShouldPersistTaps="handled">
          <View style={styles.tiles}>
            {gifs.map((gif) => (
              <Pressable key={gif.id} onPress={() => pick(gif)} disabled={!!sending}
                accessibilityRole="imagebutton"
                accessibilityLabel={gif.title || 'GIF'}>
                <Image source={{ uri: gif.previewUrl }}
                  style={{
                    width: tile,
                    height: tile * (gif.height && gif.width ? gif.height / gif.width : 0.75),
                    borderRadius: radius.sm, backgroundColor: colors.line,
                    opacity: sending && sending !== gif.id ? 0.4 : 1,
                  }} />
              </Pressable>
            ))}
          </View>
          {/* Giphy's terms require attribution wherever their results show. */}
          {gifs.length > 0 && <Text style={styles.attribution}>Powered by GIPHY</Text>}
        </ScrollView>

        <Pressable onPress={onClose} style={[styles.cta, styles.ctaGhost]}>
          <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
        </Pressable>
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
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy, marginBottom: spacing.sm },
  loading: { paddingVertical: 24 },
  error: { ...text.bodyStrong, fontSize: 12.5, color: colors.out, paddingVertical: spacing.md },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 24 },
  grid: { flexGrow: 0, marginTop: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'space-between' },
  attribution: { ...text.label, fontSize: 9, color: colors.pencil, textAlign: 'center', paddingVertical: spacing.md },
  cta: { height: 48, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
