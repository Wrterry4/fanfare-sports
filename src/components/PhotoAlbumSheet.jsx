/**
 * PhotoAlbumSheet.jsx — Everything the team has posted, in one place.
 *
 * Not a second upload flow. A photo gets into the album by being posted in
 * chat, and this is the same collection read a different way — which is why
 * there is no "add" button here and why deleting from either place removes it
 * from both.
 *
 * A three-column grid because that's the shape a camera roll has, and the one
 * people already know how to scan. Tapping opens the photo full-width, which
 * is as far as this goes: a pinch-zoom viewer is a dependency, and the browser
 * gives you one for free on the full-size image.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, Pressable, Modal, StyleSheet, ScrollView,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';

import { subscribePhotos, deletePhoto } from '../services/photoService.js';
import { groupPhotosByDay, photoCountLabel, canDeletePhoto } from '../shared/photos.js';
import { confirm, notify } from '../utils/confirm.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

const COLUMNS = 3;
const GAP = 3;

export default function PhotoAlbumSheet({ visible, teamId, user, isStaff, onClose }) {
  const [photos, setPhotos] = useState(null);   // null = still loading
  const [open, setOpen] = useState(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!visible || !teamId) return undefined;
    return subscribePhotos(teamId, setPhotos);
  }, [visible, teamId]);

  // Reset on close so reopening lands on the grid, not on whatever was open.
  useEffect(() => { if (!visible) setOpen(null); }, [visible]);

  const groups = useMemo(() => groupPhotosByDay(photos || []), [photos]);

  // The sheet is inset by spacing.lg on each side; tiles fill what's left.
  const tile = Math.floor((Math.min(width, 720) - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const remove = async (photo) => {
    const ok = await confirm({
      title: 'Delete this photo?',
      message: 'It comes out of the album and out of the chat message it was posted in.',
      confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    try {
      await deletePhoto({ teamId, photoId: photo.id });
      setOpen(null);
    } catch (e) { notify('Could not delete', e.message); }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {open ? (
          <>
            <Pressable onPress={() => setOpen(null)} style={styles.backRow}>
              <Text style={styles.backChev}>‹</Text>
              <Text style={styles.backText}>All photos</Text>
            </Pressable>
            <ScrollView contentContainerStyle={styles.viewer}>
              <Image source={{ uri: open.url }}
                style={[styles.full, aspect(open)]} resizeMode="contain" />
              <Text style={styles.caption}>
                {open.uploadedByName || 'Someone'}
              </Text>
              {canDeletePhoto(open, user?.uid, isStaff) && (
                <Pressable onPress={() => remove(open)} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>DELETE PHOTO</Text>
                </Pressable>
              )}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.title}>Team photos</Text>
            <Text style={styles.sub}>
              {photos === null ? 'Loading…' : photoCountLabel(photos.length)}
              {photos?.length ? ' · posted in team chat' : ''}
            </Text>

            {photos === null && (
              <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
            )}

            {photos?.length === 0 && (
              <Text style={styles.empty}>
                Nothing here yet. Photos posted in Team chat land in this album
                automatically.
              </Text>
            )}

            <ScrollView style={styles.grid}>
              {groups.map((group) => (
                <View key={group.key}>
                  <Text style={styles.dayLabel}>{group.label}</Text>
                  <View style={styles.tiles}>
                    {group.photos.map((p) => (
                      <Pressable key={p.id} onPress={() => setOpen(p)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`Photo from ${p.uploadedByName || 'a teammate'}`}>
                        <Image source={{ uri: p.url }}
                          style={{ width: tile, height: tile, borderRadius: radius.sm,
                                   backgroundColor: colors.line }} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Pressable onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>DONE</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Keep the shape the photo actually is; fall back to 4:3 when unknown. */
const aspect = (p) => ({
  aspectRatio: p?.width && p?.height ? p.width / p.height : 4 / 3,
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, maxHeight: '88%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sub: { ...text.body, fontSize: 12.5, color: colors.pencil, marginTop: 4, marginBottom: spacing.md },
  loading: { paddingVertical: 30 },
  grid: { flexGrow: 0 },
  dayLabel: { ...text.label, color: colors.pencil, marginTop: spacing.sm, marginBottom: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30, lineHeight: 19 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  backChev: { fontSize: 22, color: colors.primary, lineHeight: 24 },
  backText: { ...text.bodyStrong, fontSize: 13.5, color: colors.primary },
  viewer: { alignItems: 'center', paddingBottom: spacing.md },
  full: { width: '100%', borderRadius: radius.md, backgroundColor: colors.line },
  caption: { ...text.body, fontSize: 12.5, color: colors.pencil, marginTop: spacing.sm },
  deleteBtn: { marginTop: spacing.md, paddingHorizontal: 16, paddingVertical: 10 },
  deleteText: { ...text.buttonSecondary, fontSize: 11, color: colors.out, letterSpacing: 0.6 },
  done: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  doneText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
