/**
 * ImportPlayersSheet.jsx — "I coach most of these kids already."
 *
 * Two steps, because they answer two different questions: WHICH team, then
 * WHICH of its players. Collapsing them into one long list of every player on
 * every team you coach reads fine with two teams and not at all with five.
 *
 * The team step is skipped when there's exactly one other team to import from,
 * which is the common case — a coach with a spring team starting a fall one.
 *
 * All the selection rules live in shared/rosterImport.js; this file is the
 * screen around them — including the two things worth saying out loud on the
 * screen itself: an imported player is the SAME player (career and parent
 * links intact), and their number does not come with them.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';

import { db, collection, getDocs } from '../services/firebase';
import { importPlayers } from '../services/bootstrap.js';
import { notify } from '../utils/confirm.js';
import {
  importSourceTeams, buildImportRows, defaultSelection, importSelection, importSummary,
} from '../shared/rosterImport.js';
import { useActiveTeam } from '../hooks/ActiveTeam.jsx';
import { useMyTeamPlayers } from '../hooks/useMyTeamPlayers.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export default function ImportPlayersSheet({ visible, team, roster, onClose, onImported }) {
  const { teams } = useActiveTeam();
  // Role per team comes from the member document, and only staff teams may be
  // copied from — see the header of rosterImport.js.
  const { roleByTeam } = useMyTeamPlayers(teams);

  const sources = useMemo(
    () => importSourceTeams(teams, roleByTeam, team?.id),
    [teams, roleByTeam, team?.id]);

  const [sourceId, setSourceId] = useState(null);
  const [rows, setRows] = useState(null);          // null = still loading
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  // One team to choose from is not a choice worth making someone make.
  useEffect(() => {
    if (!visible) { setSourceId(null); setRows(null); setSelected([]); return; }
    if (sources.length === 1) setSourceId(sources[0].id);
  }, [visible, sources.length]);

  // The source roster is read once, on selection. It isn't live data to us —
  // we're taking a copy of it at this moment by definition.
  useEffect(() => {
    if (!visible || !sourceId) { setRows(null); return undefined; }
    let cancelled = false;
    setRows(null);

    getDocs(collection(db, 'teams', sourceId, 'roster'))
      .then((snap) => {
        if (cancelled) return;
        const source = snap.docs.map((d) => ({ playerId: d.id, ...d.data() }));
        const next = buildImportRows(source, roster || []);
        setRows(next);
        setSelected(defaultSelection(next));
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        notify('Could not load that roster', e.message);
      });

    return () => { cancelled = true; };
  }, [visible, sourceId]);

  const toggle = useCallback((playerId) => {
    setSelected((s) => s.includes(playerId)
      ? s.filter((id) => id !== playerId)
      : [...s, playerId]);
  }, []);

  // "All" means everyone importable — players already on this roster can't be
  // selected, so counting them would leave the button permanently half-on.
  const selectable = useMemo(
    () => (rows || []).filter((r) => !r.alreadyOnRoster), [rows]);
  const allOn = !!selectable.length && selected.length === selectable.length;
  const toggleAll = useCallback(() => {
    setSelected(allOn ? [] : selectable.map((r) => r.playerId));
  }, [allOn, selectable]);

  const runImport = useCallback(async () => {
    const players = importSelection(rows, selected);
    if (!players.length) { notify('Pick at least one player.'); return; }
    setBusy(true);
    try {
      const { added, failures = [] } = await importPlayers({
        fromTeamId: sourceId, toTeamId: team.id, players,
      });
      notify(
        failures.length ? 'Imported with problems' : 'Players imported',
        importSummary({ added: added.length, failed: failures.length }),
      );
      onImported?.(added);
      onClose?.();
    } catch (e) { notify('Could not import', e.message); }
    setBusy(false);
  }, [rows, selected, sourceId, team?.id, onImported, onClose]);

  if (!visible) return null;

  const source = sources.find((t) => t.id === sourceId) || null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          {source ? `Import from ${source.name}` : 'Import from another team'}
        </Text>
        <Text style={styles.sub}>
          {source
            ? "Everyone's checked. Uncheck anyone who isn't on this team. They keep "
              + 'their stats and parent links; give them numbers on the roster.'
            : 'Pick the team to import players from. You choose who comes over next.'}
        </Text>

        {/* ---- step 1: which team ------------------------------------- */}
        {!source && (
          <ScrollView style={styles.list}>
            {sources.length === 0 && (
              <Text style={styles.empty}>
                You don't coach another team yet. Once you do, last season's
                roster can be copied over from here.
              </Text>
            )}
            {sources.map((t) => (
              <Pressable key={t.id} onPress={() => setSourceId(t.id)} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.meta}>{t.season || 'No season set'}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ---- step 2: which players ----------------------------------- */}
        {source && rows === null && (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        )}

        {source && rows?.length === 0 && (
          <Text style={styles.empty}>That team has no players to import.</Text>
        )}

        {source && !!rows?.length && (
          <>
            <View style={styles.listHead}>
              <Text style={styles.count}>
                {selected.length} of {selectable.length} selected
              </Text>
              <Pressable onPress={toggleAll} hitSlop={6}>
                <Text style={styles.link}>{allOn ? 'Clear all' : 'Select all'}</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.list}>
              {rows.map((r) => {
                const on = selected.includes(r.playerId);
                return (
                  <Pressable
                    key={r.playerId}
                    onPress={() => !r.alreadyOnRoster && toggle(r.playerId)}
                    disabled={r.alreadyOnRoster}
                    style={[styles.row, on && styles.rowOn, r.alreadyOnRoster && styles.rowOff]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${r.firstName} ${r.lastName}`.trim()}
                  >
                    <View style={[styles.box, on && styles.boxOn]}>
                      {on && <Text style={styles.tick}>✓</Text>}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.name}>
                        {r.firstName} {r.lastName}
                      </Text>
                      {/* The old number identifies the row and nothing more —
                          it is not what gets imported. */}
                      <Text style={styles.meta}>
                        {r.alreadyOnRoster
                          ? 'Already on this roster'
                          : [r.formerJersey != null ? `Wore #${r.formerJersey}` : null,
                             r.primaryPosition || null]
                              .filter(Boolean).join(' · ') || 'No position'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.note}>
              Imported players keep their stats, career history and parent
              links. Jersey numbers start blank — set them on the roster.
            </Text>
          </>
        )}

        <View style={styles.actions}>
          {/* Back only exists when there was a choice to go back to. */}
          {source && sources.length > 1 && (
            <Pressable onPress={() => setSourceId(null)} style={[styles.cta, styles.ctaGhost]}>
              <Text style={[styles.ctaText, { color: colors.pencil }]}>BACK</Text>
            </Pressable>
          )}
          {!source && (
            <Pressable onPress={onClose} style={[styles.cta, styles.flex, styles.ctaGhost]}>
              <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
            </Pressable>
          )}
          {source && (
            <Pressable onPress={runImport} disabled={busy || !selected.length}
              style={[styles.cta, styles.flex, !selected.length && styles.ctaOff]}>
              {busy
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.ctaText}>
                    IMPORT {selected.length || ''}
                  </Text>}
            </Pressable>
          )}
        </View>
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
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 17, color: colors.navy },
  sub: { ...text.body, fontSize: 12.5, color: colors.pencil, marginTop: 4, marginBottom: spacing.md, lineHeight: 17 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  count: { ...text.bodyStrong, fontSize: 12.5, color: colors.navy },
  link: { ...text.bodyStrong, fontSize: 12.5, color: colors.primary },
  list: { flexGrow: 0 },
  flex: { flex: 1 },
  loading: { paddingVertical: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  rowOn: { borderColor: colors.primary },
  rowOff: { opacity: 0.5 },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#FFF', fontSize: 13, fontWeight: '900', lineHeight: 15 },
  name: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  meta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  chev: { fontSize: 20, color: colors.pencil, paddingHorizontal: 4 },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30, lineHeight: 19 },
  note: { ...text.body, fontSize: 11.5, color: colors.pencil, lineHeight: 16, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cta: { height: 48, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaOff: { opacity: 0.5 },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
