/**
 * LinkParentSheet.jsx — A coach assigns a player to a parent.
 *
 * The claim flow works the other way round: a parent asks, a coach approves.
 * That's the right default for people who join on their own. But a coach
 * sitting with a roster and a list of families wants to do it directly, and
 * without this there was no path at all from the coach's side.
 *
 * Same two kinds of link as a claim, and the same rule: a parent link confers
 * guardianship, a family link does not.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';

import {
  subscribeMembers, unlinkPlayerFromMember, assignGuardian, ROLE_LABELS,
} from '../services/membership.js';
import { confirm, notify } from '../utils/confirm.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export default function LinkParentSheet({ visible, teamId, player, onClose }) {
  const [members, setMembers] = useState([]);
  const [busyUid, setBusyUid] = useState(null);

  useEffect(() => {
    if (!visible || !teamId) return undefined;
    return subscribeMembers(teamId, setMembers);
  }, [visible, teamId]);

  const linkedTo = useCallback(
    (m) => (m.linkedPlayerIds || []).includes(player?.playerId),
    [player?.playerId]
  );

  const link = useCallback(async (m, asGuardian) => {
    setBusyUid(m.uid);
    try {
      await assignGuardian({
        teamId, playerId: player.playerId, memberUid: m.uid, asGuardian,
      });
      notify('Linked', `${m.displayName || 'They'} can now follow ${player.firstName}.`);
    } catch (e) { notify('Could not link', e.message); }
    setBusyUid(null);
  }, [teamId, player]);

  const unlink = useCallback(async (m) => {
    const ok = await confirm({
      title: `Unlink ${m.displayName || 'this person'}?`,
      message: `They'll stop seeing ${player.firstName}'s stats and alerts.`,
      confirmLabel: 'Unlink', destructive: true,
    });
    if (!ok) return;
    setBusyUid(m.uid);
    try { await unlinkPlayerFromMember(teamId, m.uid, player.playerId); }
    catch (e) { notify('Could not unlink', e.message); }
    setBusyUid(null);
  }, [teamId, player]);

  if (!visible || !player) return null;

  // Coaches and scorekeepers already see the whole roster; linking them to a
  // specific child would mean nothing.
  const candidates = members.filter((m) => ['parent', 'fan'].includes(m.role));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          Who follows #{player.jerseyNumber ?? '–'} {player.firstName}?
        </Text>
        <Text style={styles.sub}>
          Linked people see this player's stats and get their game alerts.
        </Text>

        <ScrollView style={styles.list}>
          {candidates.length === 0 && (
            <Text style={styles.empty}>
              Nobody has joined this team yet. Share the join code from Settings
              and they'll show up here.
            </Text>
          )}

          {candidates.map((m) => {
            const isLinked = linkedTo(m);
            return (
              <View key={m.uid} style={[styles.row, isLinked && styles.rowOn]}>
                <View style={styles.flex}>
                  <Text style={styles.name}>{m.displayName || 'Team member'}</Text>
                  <Text style={styles.role}>
                    {ROLE_LABELS[m.role] || m.role}
                    {isLinked ? ' · linked' : ''}
                  </Text>
                </View>

                {busyUid === m.uid ? (
                  <ActivityIndicator color={colors.primary} />
                ) : isLinked ? (
                  <Pressable onPress={() => unlink(m)} style={[styles.btn, styles.btnGhost]}>
                    <Text style={[styles.btnText, { color: colors.out }]}>UNLINK</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => link(m, m.role === 'parent')} style={styles.btn}>
                    <Text style={styles.btnText}>
                      {m.role === 'parent' ? 'LINK AS PARENT' : 'LINK'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>

        <Pressable onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>DONE</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, paddingBottom: 34, maxHeight: '80%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sub: { ...text.body, fontSize: 12.5, color: colors.pencil, marginTop: 4, marginBottom: spacing.md, lineHeight: 17 },
  list: { flexGrow: 0 },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  rowOn: { borderColor: colors.grass, backgroundColor: '#F4FAF5' },
  name: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  role: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  btn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: colors.navy },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  btnText: { ...text.buttonSecondary, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30, lineHeight: 19 },
  done: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  doneText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
