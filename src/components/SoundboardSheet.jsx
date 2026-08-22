/**
 * SoundboardSheet.jsx — Stereotypical stadium sounds, between plays.
 *
 * A grid of one-tap sounds: six built-in effects, synthesized rather than
 * sampled (see stadiumSounds.web.js for why), plus four empty slots a coach
 * can fill with their own recording using the same picker pattern
 * WalkUpSheet already uses for walk-up songs.
 *
 * Sport-agnostic on purpose. A crowd doesn't know which game it's watching —
 * this button lives on the shared Game Day header, not inside either sport
 * pack.
 *
 * Tapping a sound plays it immediately and leaves the sheet open, since the
 * whole point is firing several in a row between plays without reopening a
 * modal each time.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, Platform, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fullCatalog, isBuiltIn, soundStorageKey } from '../shared/soundboardCatalog.js';
import { playSound, soundboardSupported } from '../services/stadiumSounds';
import { saveClip, deleteClip, probeAudio } from '../services/audioStore';
import { notify } from '../utils/confirm.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';

const NAMES_KEY = 'soundboardCustomNames';
const FILLED_KEY = 'soundboardCustomFilled';

export default function SoundboardSheet({ visible, onClose, sport }) {
  const [names, setNames] = useState({});
  const [filled, setFilled] = useState({});
  const [playingId, setPlayingId] = useState(null);
  const [busySlot, setBusySlot] = useState(null);
  const [renaming, setRenaming] = useState(null);

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(NAMES_KEY).then((raw) => {
      if (raw) setNames(JSON.parse(raw));
    }).catch(() => {});
    AsyncStorage.getItem(FILLED_KEY).then((raw) => {
      if (raw) setFilled(JSON.parse(raw));
    }).catch(() => {});
  }, [visible]);

  const play = useCallback(async (id) => {
    setPlayingId(id);
    const started = await playSound(id);
    if (!started && !isBuiltIn(id)) {
      notify('Nothing recorded', 'Tap and hold this tile to add a sound.');
    }
    // Just a brief highlight, not a playback tracker — several of these fire
    // in the same few seconds, and trying to track exact end times for each
    // synthesized sound would be more state than the feature is worth.
    setTimeout(() => setPlayingId((cur) => (cur === id ? null : cur)), 350);
  }, []);

  const pickFile = useCallback((slotId) => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '';
    // Off-screen rather than display:none — see the matching note in
    // WalkUpSheet.jsx. An input that's never attached to the document can
    // silently fail to open the picker at all in some WebKit builds,
    // including inside an installed iOS PWA — this was why nothing happened
    // when tapping an empty tile.
    input.style.position = 'fixed';
    input.style.top = '-1000px';
    document.body.appendChild(input);
    const cleanup = () => input.remove();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { cleanup(); return; }
      setBusySlot(slotId);
      try {
        // Gated on whether the file PLAYS, not on whether a duration could
        // be measured — plenty of real recordings (VBR MP3s especially)
        // load and play fine without ever resolving a clean duration.
        const { playable } = await probeAudio(file);
        if (!playable) {
          notify("Can't play that file",
            `${file.name} isn't a format this browser can decode. MP3, M4A, WAV, and AAC all work.`);
          setBusySlot(null);
          cleanup();
          return;
        }
        await saveClip(soundStorageKey(slotId), file);
        const next = { ...filled, [slotId]: true };
        setFilled(next);
        AsyncStorage.setItem(FILLED_KEY, JSON.stringify(next)).catch(() => {});
      } catch (e) {
        notify('Could not save', e.message);
      }
      setBusySlot(null);
      cleanup();
    };
    input.click();
  }, [filled]);

  const removeSlot = useCallback(async (slotId) => {
    await deleteClip(soundStorageKey(slotId)).catch(() => {});
    const nextFilled = { ...filled };
    delete nextFilled[slotId];
    setFilled(nextFilled);
    AsyncStorage.setItem(FILLED_KEY, JSON.stringify(nextFilled)).catch(() => {});
  }, [filled]);

  const rename = useCallback((slotId, label) => {
    const next = { ...names, [slotId]: label.trim() || undefined };
    setNames(next);
    AsyncStorage.setItem(NAMES_KEY, JSON.stringify(next)).catch(() => {});
  }, [names]);

  if (!visible) return null;

  // Which sounds show up is the sport's call — basketball wants a buzzer
  // and a whistle, baseball doesn't, and each suggests its own custom slots
  // (crack of the bat vs. a real buzzer). See soundboardCatalog.js.
  const catalog = fullCatalog(names, sport);
  const supported = soundboardSupported();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          {sport?.displayName ? `${sport.displayName} Soundboard` : 'Soundboard'}
        </Text>
        <Text style={styles.sub}>
          Tap to play. Long-press an empty tile to add your own sound.
        </Text>

        {!supported && (
          <Text style={styles.unsupported}>
            Sound isn't available in this browser.
          </Text>
        )}

        <View style={styles.grid}>
          {catalog.map((s) => {
            const isCustom = !isBuiltIn(s.id);
            const hasClip = !isCustom || !!filled[s.id];
            const busy = busySlot === s.id;
            return (
              <Pressable
                key={s.id}
                disabled={!supported || busy}
                onPress={() => (hasClip ? play(s.id) : pickFile(s.id))}
                onLongPress={() => (isCustom ? setRenaming(s.id) : null)}
                delayLongPress={400}
                style={[
                  styles.tile,
                  playingId === s.id && styles.tileActive,
                  isCustom && !hasClip && styles.tileEmpty,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.tileEmoji}>
                      {hasClip ? s.emoji : '＋'}
                    </Text>
                    <Text style={[styles.tileLabel, s.suggested && styles.tileLabelSuggested]}
                          numberOfLines={1}>
                      {s.label}
                    </Text>
                    {isCustom && hasClip && (
                      <Pressable
                        onPress={() => removeSlot(s.id)}
                        hitSlop={8} style={styles.tileRemove}
                        accessibilityRole="button" accessibilityLabel={`Remove ${s.label}`}
                      >
                        <Text style={styles.tileRemoveText}>×</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {renaming && (
          <View style={styles.renameRow}>
            <Text style={styles.renameLabel}>Name this sound</Text>
            <View style={styles.renameInputRow}>
              <RenameInput
                initial={names[renaming] || ''}
                onSave={(label) => { rename(renaming, label); setRenaming(null); }}
                onCancel={() => setRenaming(null)}
              />
            </View>
          </View>
        )}

        <Pressable onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>DONE</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Its own tiny component so the text-input's local state doesn't force the
    whole sheet — with its playback and picker state — to re-render on every
    keystroke. */
function RenameInput({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TextInput
        value={value} onChangeText={setValue} autoFocus
        style={styles.renameInput} placeholder="Charge!" placeholderTextColor="#A0A8B8"
        maxLength={16} onSubmitEditing={() => onSave(value)} returnKeyType="done"
      />
      <Pressable onPress={() => onSave(value)} style={styles.renameSave}>
        <Text style={styles.renameSaveText}>SAVE</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.renameCancel}>
        <Text style={styles.renameCancelText}>CANCEL</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sub: {
    ...text.body, fontSize: 12, color: colors.pencil,
    marginTop: 4, marginBottom: spacing.md, lineHeight: 16,
  },
  unsupported: { ...text.body, color: colors.out, marginBottom: spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31%', aspectRatio: 1, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    ...shadow.card,
  },
  tileActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  tileEmoji: { fontSize: 24 },
  tileLabel: { ...text.label, fontSize: 8.5, color: colors.pencil, maxWidth: '90%' },
  tileLabelSuggested: { fontStyle: 'italic', opacity: 0.75 },
  tileRemove: {
    position: 'absolute', top: 3, right: 5,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  tileRemoveText: { fontSize: 15, color: colors.pencil },

  renameRow: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  renameLabel: { ...text.label, fontSize: 9, color: colors.pencil, marginBottom: 6 },
  renameInputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  renameInput: {
    flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.card, paddingHorizontal: spacing.md, color: colors.navy,
  },
  renameSave: {
    height: 40, paddingHorizontal: 14, borderRadius: radius.md,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  renameSaveText: { ...text.buttonSecondary, fontSize: 10.5, color: '#FFF' },
  renameCancel: { height: 40, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  renameCancelText: { ...text.buttonSecondary, fontSize: 10.5, color: colors.pencil },

  done: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
  },
  doneText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
