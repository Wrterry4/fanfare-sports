/**
 * AccountSheet.jsx — The hamburger menu.
 *
 * Account-level, not team-level: who you are, and which team you're looking
 * at. Team *settings* stay on the Settings tab, because those belong to the
 * team rather than to you.
 *
 * Invitations sit ABOVE everything else, including your own details. They're
 * the only thing in here waiting on an answer — a name and a phone number will
 * still be there tomorrow, and a parent who can't see their kid's new team
 * won't wait until tomorrow to go looking for it.
 *
 * Slides from the left, which is where the button is.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';

import { db, doc, getDoc, setDoc, updateDoc, deleteDoc } from '../services/firebase';
import { useAuth } from '../hooks/AuthProvider.jsx';
import { useActiveTeam } from '../hooks/ActiveTeam.jsx';
import { useMyTeamPlayers } from '../hooks/useMyTeamPlayers.js';
import { useTeamInvites } from '../hooks/useTeamInvites.js';
import { respondToTeamInvite } from '../services/teamInvites.js';
import { inviteWording } from '../shared/teamInvites.js';
import { groupTeamsByPlayer, groupingIsUseful, duplicateGroups }
  from '../shared/teamGrouping.js';
import NewTeamSheet from './NewTeamSheet.jsx';
import { signOut } from '../services/authService.js';
import { confirm, notify } from '../utils/confirm.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';
import { inputStyle } from '../theme/inputs.js';

export default function AccountSheet({ visible, onClose }) {
  const { user } = useAuth();
  const { team, teams, select } = useActiveTeam();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [answering, setAnswering] = useState(null);
  const { invites } = useTeamInvites();
  // Role comes from the same member document as the linked players, so the
  // unlinked group can be labelled honestly.
  const { byTeam, roleByTeam } = useMyTeamPlayers(teams);

  const grouped = useMemo(
    () => groupTeamsByPlayer(teams, byTeam, roleByTeam),
    [teams, byTeam, roleByTeam]);
  const showHeadings = groupingIsUseful(grouped);
  // Two headings with the same name are two player records for one child —
  // worth explaining once, under the list, rather than in every heading.
  const duplicates = useMemo(() => duplicateGroups(grouped), [grouped]);

  useEffect(() => {
    if (!visible || !user?.uid) return;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        const d = snap.data() || {};
        setDisplayName(d.displayName || user.displayName || '');
        setPhone(d.phone || '');
        setDirty(false);
      })
      .catch(() => {});
  }, [visible, user?.uid]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        phone: phone.trim() || null,
      }, { merge: true });
      setDirty(false);
      notify('Saved');
    } catch (e) { notify('Could not save', e.message); }
    setBusy(false);
  }, [user?.uid, displayName, phone]);

  const renameTeam = useCallback(async (t) => {
    if (!newName.trim()) return;
    try {
      await updateDoc(doc(db, 'teams', t.id), { name: newName.trim() });
      setRenaming(null);
    } catch (e) { notify('Could not rename', e.message); }
  }, [newName]);

  /**
   * Leaving removes your membership. Deleting is only offered to whoever
   * created the team, and only removes the team document — players keep their
   * own records and their career history, which is the entire reason they live
   * at the root rather than inside a team.
   */
  const leaveTeam = useCallback(async (t) => {
    const owner = t.createdBy === user?.uid;
    const ok = await confirm({
      title: owner ? `Delete ${t.name}?` : `Leave ${t.name}?`,
      message: owner
        ? "The team and its schedule go away. Players keep their own records and stats."
        : "You'll stop seeing this team's games and messages.",
      confirmLabel: owner ? 'Delete' : 'Leave',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'teams', t.id, 'members', user.uid));
      if (owner) await deleteDoc(doc(db, 'teams', t.id)).catch(() => {});
      // The team list is driven by users/{uid}.teamIds, which a Cloud Function
      // keeps in step with membership — no client write needed here.
    } catch (e) { notify('Could not update', e.message); }
  }, [user?.uid]);

  /**
   * Accepting switches you straight to the team. Landing back on the menu
   * having "joined" with nothing visibly different is the moment a parent
   * decides the app didn't work.
   */
  const answerInvite = useCallback(async (invite, accept) => {
    setAnswering(invite.id);
    try {
      await respondToTeamInvite(invite.id, accept);
      if (accept) {
        // isNew: the id won't be in the teams list until users/{uid}.teamIds
        // comes back, and ActiveTeam would otherwise bounce the selection.
        select(invite.teamId, { isNew: true });
        onClose();
      }
    } catch (e) { notify('Could not respond', e.message); }
    setAnswering(null);
  }, [select, onClose]);

  const doSignOut = useCallback(async () => {
    const ok = await confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true });
    if (ok) { onClose(); signOut(); }
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.row}>
        <View style={styles.panel}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <View style={styles.head}>
                <Text style={styles.headTitle}>Account</Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>

              {invites.length > 0 && (
                <View style={styles.inviteBlock}>
                  <Text style={[styles.sectionLabel, styles.inviteLabel]}>
                    TEAM INVITES · {invites.length}
                  </Text>
                  {invites.map((inv) => {
                    const words = inviteWording(inv);
                    return (
                      <View key={inv.id} style={styles.inviteRow}>
                        <Text style={styles.inviteTeam}>{words.rowTitle}</Text>
                        <Text style={styles.inviteSub}>{words.rowSub}</Text>
                        {inv.invitedByName ? (
                          <Text style={styles.inviteSub}>Invited by {inv.invitedByName}</Text>
                        ) : null}
                        {answering === inv.id ? (
                          <ActivityIndicator color={colors.primary} style={styles.inviteBusy} />
                        ) : (
                          <View style={styles.inviteBtns}>
                            <Pressable onPress={() => answerInvite(inv, false)}
                              style={[styles.tinyGhost, styles.flex]}>
                              <Text style={styles.tinyGhostText}>NO THANKS</Text>
                            </Pressable>
                            <Pressable onPress={() => answerInvite(inv, true)}
                              style={[styles.tiny, styles.flex]}>
                              <Text style={styles.tinyText}>JOIN TEAM</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={styles.sectionLabel}>YOUR DETAILS</Text>
              <Text style={styles.label}>Name</Text>
              <TextInput value={displayName}
                onChangeText={(v) => { setDisplayName(v); setDirty(true); }}
                style={inputStyle} autoCapitalize="words"
                placeholder="Wallace Terry" placeholderTextColor="#A0A8B8" />

              <Text style={[styles.label, { marginTop: spacing.md }]}>Phone</Text>
              <TextInput value={phone}
                onChangeText={(v) => { setPhone(v); setDirty(true); }}
                style={inputStyle} keyboardType="phone-pad"
                placeholder="Optional" placeholderTextColor="#A0A8B8" />

              <Text style={[styles.label, { marginTop: spacing.md }]}>Email</Text>
              <View style={[inputStyle, styles.readonly]}>
                <Text style={styles.readonlyText} numberOfLines={1}>{user?.email}</Text>
              </View>
              <Text style={styles.hint}>
                Changing your email means signing in again, so it's handled
                separately.
              </Text>

              {dirty && (
                <Pressable onPress={save} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color="#FFF" />
                        : <Text style={styles.ctaText}>SAVE</Text>}
                </Pressable>
              )}

              <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>
                {teams.length > 1 ? 'YOUR TEAMS' : 'YOUR TEAM'}
              </Text>
              {grouped.map((group) => (
                <View key={group.key}>
                  {/* Headings only earn their place with something to
                      separate — one child on one team doesn't need a label
                      above it saying so. */}
                  {showHeadings && (
                    <View style={styles.groupHead}>
                      <Text style={styles.groupLabel}>{group.label}</Text>
                      {group.sublabel && (
                        <Text style={styles.groupSub}>{group.sublabel}</Text>
                      )}
                    </View>
                  )}
                  {group.teams.map((t) => {
                const kids = byTeam[t.id] || [];
                const isRenaming = renaming === t.id;
                return (
                  <View key={t.id}
                    style={[styles.teamRow, t.id === team?.id && styles.teamRowOn]}>
                    {isRenaming ? (
                      <View style={styles.flex}>
                        <TextInput value={newName} onChangeText={setNewName}
                          style={inputStyle} autoFocus autoCapitalize="words" />
                        <View style={styles.renameBtns}>
                          <Pressable onPress={() => setRenaming(null)} style={styles.tinyGhost}>
                            <Text style={styles.tinyGhostText}>CANCEL</Text>
                          </Pressable>
                          <Pressable onPress={() => renameTeam(t)} style={styles.tiny}>
                            <Text style={styles.tinyText}>SAVE</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <>
                        <Pressable style={styles.flex}
                          onPress={() => { select(t.id); onClose(); }}>
                          {/* Whose kid is on this team — the fastest way to tell
                              two teams apart when you're tracking more than one. */}
                          {/* Under a child's heading the name is already
                              above; only show it when there's no heading. */}
                          {kids.length > 0 && !showHeadings && (
                            <Text style={styles.kidLine} numberOfLines={1}>
                              {kids.map((k) => k.firstName).join(' & ')}
                            </Text>
                          )}
                          <Text style={[styles.teamName, t.id === team?.id && styles.teamNameOn]}>
                            {t.name}
                          </Text>
                          <Text style={styles.teamMeta}>
                            {t.season}{t.division ? ` · ${t.division}` : ''}
                          </Text>
                        </Pressable>
                        <View style={styles.teamActions}>
                          {t.createdBy === user?.uid && (
                            <Pressable hitSlop={8}
                              onPress={() => { setRenaming(t.id); setNewName(t.name); }}>
                              <Text style={styles.teamAction}>RENAME</Text>
                            </Pressable>
                          )}
                          <Pressable hitSlop={8} onPress={() => leaveTeam(t)}>
                            <Text style={[styles.teamAction, { color: colors.out }]}>
                              {t.createdBy === user?.uid ? 'DELETE' : 'LEAVE'}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
                  })}
                </View>
              ))}
              {teams.length === 0 && (
                <Text style={styles.hint}>You're not on a team yet.</Text>
              )}

              {duplicates.length > 0 && (
                <Text style={styles.hint}>
                  The same name appears more than once above. Those are separate
                  player records, not one child on two teams — usually a player
                  entered twice. Open that team's Roster and remove the extra
                  one; the record you keep holds the stats and the parent links.
                </Text>
              )}

              {/* Creating a team lived only in the first-run wizard, which is
                  unreachable once you have one. A spring team and a fall team
                  is the ordinary case, not an edge case. */}
              <Pressable onPress={() => setCreating(true)} style={styles.newTeam}>
                <Text style={styles.newTeamText}>+ NEW TEAM</Text>
              </Pressable>

              <Pressable onPress={doSignOut} style={[styles.cta, styles.ctaGhost]}>
                <Text style={[styles.ctaText, { color: colors.out }]}>SIGN OUT</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>

        <Pressable style={styles.backdrop} onPress={onClose} />
      </View>

      <NewTeamSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(teamId) => {
          setCreating(false);
          // isNew tells ActiveTeam this id won't be in the teams list yet, so
          // it holds the selection instead of bouncing back to the old team.
          select(teamId, { isNew: true });
          onClose();
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  panel: {
    width: '86%', maxWidth: 380, backgroundColor: colors.chalk,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16,
    shadowOffset: { width: 2, height: 0 }, elevation: 16,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  scroll: { padding: spacing.lg, paddingTop: 54, paddingBottom: 40 },
  head: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  headTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 21, color: colors.navy },
  close: { fontSize: 20, color: colors.pencil, paddingHorizontal: 4 },
  sectionLabel: { ...text.label, color: colors.pencil, marginBottom: spacing.md },
  inviteBlock: { marginBottom: spacing.xl },
  inviteLabel: { color: colors.primary, marginBottom: spacing.sm },
  inviteRow: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  inviteTeam: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy },
  inviteSub: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2, lineHeight: 16 },
  inviteBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  inviteBusy: { marginTop: spacing.md, alignSelf: 'flex-start' },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  readonly: { justifyContent: 'center', backgroundColor: '#F1F3F7' },
  readonlyText: { ...text.body, fontSize: 15, color: colors.pencil },
  hint: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 6, lineHeight: 16 },
  cta: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
  },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  groupHead: { marginTop: spacing.sm, marginBottom: 6 },
  groupLabel: { ...text.label, fontSize: 9, color: colors.primary },
  groupSub: { ...text.body, fontSize: 10.5, color: colors.pencil, marginTop: 2 },
  newTeam: {
    height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  newTeamText: { ...text.buttonSecondary, fontSize: 11, color: colors.pencil, letterSpacing: 0.7 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  teamRowOn: { borderColor: colors.primary, backgroundColor: '#F5F8FF' },
  teamName: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  kidLine: { ...text.label, fontSize: 8.5, color: colors.primary, marginBottom: 3 },
  teamActions: { alignItems: 'flex-end', gap: 6 },
  teamAction: { ...text.label, fontSize: 8.5, color: colors.pencil },
  renameBtns: { flexDirection: 'row', gap: 6, marginTop: 6, justifyContent: 'flex-end' },
  tiny: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.navy, alignItems: 'center' },
  tinyText: { ...text.buttonSecondary, fontSize: 9.5, color: '#FFF' },
  tinyGhost: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  tinyGhostText: { ...text.buttonSecondary, fontSize: 9.5, color: colors.pencil },
  teamNameOn: { color: colors.primary },
  teamMeta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  check: { fontSize: 16, color: colors.primary, fontWeight: '700' },
});
