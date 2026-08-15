/**
 * WalkUpSheet.jsx — Pick a song and choose where it starts.
 *
 * Deliberately not a waveform scrubber. A coach setting fifteen of these needs
 * "start at 48 seconds, play 15" and a preview button — anything richer is a
 * toy that costs time at a kitchen table the night before a game.
 *
 * Start point rather than full trim: the file is stored whole, and start/
 * duration are just numbers. That means changing the drop-in point later
 * doesn't require re-picking the file.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';

import {
  saveClip, deleteClip, getClip, probeDuration, playClip, stopClip, audioSupported,
} from '../services/audioStore';
import { notify } from '../utils/confirm.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

const DURATIONS = [10, 15, 20, 30];

export default function WalkUpSheet({ visible, player, config, onSave, onClose }) {
  const [duration, setDuration] = useState(config?.durationSeconds ?? 15);
  const [start, setStart] = useState(config?.startSeconds ?? 0);
  const [fileName, setFileName] = useState(config?.fileName ?? null);
  const [songLength, setSongLength] = useState(0);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!visible || !player) return;
    setDuration(config?.durationSeconds ?? 15);
    setStart(config?.startSeconds ?? 0);
    setFileName(config?.fileName ?? null);
    getClip(player.playerId).then((blob) => {
      if (blob) probeDuration(blob).then(setSongLength);
    }).catch(() => {});
  }, [visible, player?.playerId]);

  const pickFile = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    // Explicit extensions alongside the wildcard: iOS Files applies its own
    // filter to audio/* and hides .m4a, which is what iOS records and what
    // Apple Music exports. Listing them by name gets them back.
    // No accept filter at all.
    //
    // iOS Files applies its own interpretation of audio/* and greys out .m4a —
    // the format iOS itself records and Apple Music exports — and an explicit
    // extension list didn't reliably fix it either. Accepting everything and
    // validating after the pick is the only approach that lets people choose
    // the files they actually have.
    input.accept = '';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        // Validate by asking the browser whether it can actually decode it,
        // rather than by trusting the extension or MIME type.
        const len = await probeDuration(file);
        if (!len) {
          notify(
            "Can't play that file",
            `${file.name} isn't a format this browser can decode. MP3, M4A, WAV, and AAC all work.`
          );
          setBusy(false);
          return;
        }
        await saveClip(player.playerId, file);
        setSongLength(len);
        setFileName(file.name);
        // Most walk-up songs have their hook well past the intro.
        setStart(Math.min(Math.floor(len * 0.25), Math.max(0, len - duration)));
      } catch (e) {
        console.warn('audio save failed', e);
      }
      setBusy(false);
    };
    input.click();
  }, [player?.playerId, duration]);

  const preview = useCallback(async () => {
    if (previewing) { stopClip(); setPreviewing(false); return; }
    setPreviewing(true);
    const ok = await playClip(player.playerId, { startSeconds: start, durationSeconds: duration });
    if (!ok) setPreviewing(false);
    else setTimeout(() => setPreviewing(false), duration * 1000);
  }, [player?.playerId, start, duration, previewing]);

  const save = useCallback(() => {
    stopClip();
    onSave({ startSeconds: start, durationSeconds: duration, fileName, hasAudio: !!fileName });
    onClose();
  }, [start, duration, fileName, onSave, onClose]);

  const clear = useCallback(async () => {
    stopClip();
    await deleteClip(player.playerId).catch(() => {});
    onSave(null);
    onClose();
  }, [player?.playerId, onSave, onClose]);

  if (!visible || !player) return null;

  const maxStart = Math.max(0, Math.floor(songLength - duration));
  const nudge = (delta) => setStart((s) => Math.max(0, Math.min(maxStart, s + delta)));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={() => { stopClip(); onClose(); }} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          Walk-up song · #{player.jerseyNumber ?? '–'} {player.firstName}
        </Text>

        {!audioSupported() ? (
          <Text style={styles.warn}>
            Audio isn't available in this build. Open the app in a browser or on
            your home screen.
          </Text>
        ) : (
          <>
            <Pressable onPress={pickFile} style={styles.pick} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.navy} /> : (
                <>
                  <Text style={styles.pickText}>
                    {fileName ? 'CHANGE SONG' : 'CHOOSE A SONG'}
                  </Text>
                  {fileName ? <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text> : null}
                </>
              )}
            </Pressable>

            {fileName && (
              <>
                <Text style={styles.label}>Play for</Text>
                <View style={styles.chips}>
                  {DURATIONS.map((d) => (
                    <Pressable key={d} onPress={() => setDuration(d)}
                      style={[styles.chip, duration === d && styles.chipOn]}>
                      <Text style={[styles.chipText, duration === d && styles.chipTextOn]}>
                        {d}s
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Start at</Text>
                <View style={styles.startRow}>
                  <Pressable onPress={() => nudge(-5)} style={styles.nudge}>
                    <Text style={styles.nudgeText}>−5s</Text>
                  </Pressable>
                  <Pressable onPress={() => nudge(-1)} style={styles.nudge}>
                    <Text style={styles.nudgeText}>−1s</Text>
                  </Pressable>
                  <Text style={styles.startValue}>{fmt(start)}</Text>
                  <Pressable onPress={() => nudge(1)} style={styles.nudge}>
                    <Text style={styles.nudgeText}>+1s</Text>
                  </Pressable>
                  <Pressable onPress={() => nudge(5)} style={styles.nudge}>
                    <Text style={styles.nudgeText}>+5s</Text>
                  </Pressable>
                </View>
                {songLength > 0 && (
                  <Text style={styles.hint}>
                    Song is {fmt(songLength)} long. Plays {fmt(start)} to {fmt(Math.min(songLength, start + duration))},
                    fading out at the end.
                  </Text>
                )}

                <Pressable onPress={preview} style={styles.preview}>
                  <Text style={styles.previewText}>
                    {previewing ? '■  STOP' : '▶  PREVIEW'}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}

        <View style={styles.actions}>
          {fileName && (
            <Pressable onPress={clear} style={[styles.action, styles.actionGhost]}>
              <Text style={[styles.actionText, { color: colors.out }]}>REMOVE</Text>
            </Pressable>
          )}
          <Pressable onPress={save} style={[styles.action, { flex: 1 }]}>
            <Text style={styles.actionText}>DONE</Text>
          </Pressable>
        </View>

        <Text style={styles.fine}>
          Songs are stored on this device. Whoever keeps the book at the game
          needs them set up here — that's the phone connected to the speaker.
        </Text>
      </View>
    </Modal>
  );
}

const fmt = (s) => {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy, marginBottom: spacing.md },
  warn: { ...text.body, color: colors.pencil, paddingVertical: spacing.md, lineHeight: 19 },
  pick: {
    borderWidth: 2, borderColor: colors.navy, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: 18, alignItems: 'center',
    backgroundColor: colors.card, marginBottom: spacing.md,
  },
  pickText: { ...text.buttonSecondary, fontSize: 12, color: colors.navy, letterSpacing: 0.8 },
  fileName: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 5, paddingHorizontal: spacing.md },
  label: { ...text.label, color: colors.pencil, marginBottom: 6, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 7, marginBottom: spacing.md },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 13, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  nudge: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  nudgeText: { ...text.buttonSecondary, fontSize: 11, color: colors.navy },
  startValue: { flex: 1, textAlign: 'center', fontFamily: 'Archivo', fontWeight: '900', fontSize: 20, color: colors.navy },
  hint: { ...text.body, fontSize: 11.5, color: colors.pencil, lineHeight: 16, marginBottom: spacing.md },
  preview: {
    height: 46, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, backgroundColor: colors.card,
  },
  previewText: { ...text.buttonSecondary, fontSize: 13, color: colors.primary, letterSpacing: 0.8 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  action: { height: 48, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  actionGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  actionText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  fine: { ...text.body, fontSize: 10.5, color: colors.pencil, textAlign: 'center', marginTop: spacing.md, lineHeight: 15 },
});
