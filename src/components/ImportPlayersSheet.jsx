/**
 * ImportPlayersSheet.jsx — "I coach most of these kids already."
 *
 * Two steps, because they answer two different questions: WHICH team, then
 * WHICH of its players. Collapsing them into one long list of every player on
 * every team you coach reads fine with two teams and not at all with five.
 *
 * Picks accumulate across teams, so a coach merging a spring and a summer
 * roster does it in one pass. The team step is skipped when there's only one
 * other team to import from, which is the common case.
 *
 * Two things are worth saying on the screen itself, because both contradict
 * what "import" sounds like: an imported player is the SAME player — career
 * and parent links intact — and their number does not come with them. All the
 * rules live in shared/rosterImport.js; this file is the screen around them.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';

import { db, collection, getDocs } from '../services/firebase';
import { importPlayers } from '../services/bootstrap.js';
import { notify } from '../utils/confirm.js';
import {
  importSourceTeams, buildImportRows, defaultSelection, importsBySource,
  importSummary, rowState, rowIsLocked, ROW_STATE,
} from '../shared/rosterImport.js';
import { useActiveTeam } from '../hooks/ActiveTeam.jsx';
import { useMyTeamPlayers } from '../hooks/useMyTeamPlayers.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export default function ImportPlayersSheet({ visible, team, roster, onClose, onImported }) {
  const { teams } = useActiveTeam();
  // Role per team comes from the member document, and only teams you're staff
  // on may be imported from — see the header of rosterImport.js.
  const { roleByTeam } = useMyTeamPlayers(teams);

  const sources = useMemo(
    () => importSourceTeams(teams, roleByTeam, team?.id),
    [teams, roleByTeam, team?.id]);

  const [sourceId, setSourceId] = useState(null);
  // { [sourceTeamId]: rows }, kept so switching back to a team you've already
  // looked at doesn't re-read it or lose what you ticked there.
  const [rowsBySource, setRowsBySource] = useState({});
  // { [playerId]: sourceTeamId } — every pick, across every team.
  const [picked, setPicked] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = sourceId ? rowsBySource[sourceId] : null;
  const source = sources.find((t) => t.id === sourceId) || null;
  const pickedCount = Object.keys(picked).length;

  // One team to choose from is not a choice worth making someone make.
  useEffect(() => {
    if (sources.length === 1 && !sourceId) setSourceId(sources[0].id);
  }, [sources.length, sourceId]);

  // A source roster is read once and kept. It isn't live data to us — we're
  // taking a copy of it at this moment by definition.
  useEffect(() => {
    if (!sourceId || rowsBySource[sourceId]) return undefined;
    let cancelled = false;
    setLoading(true);

    getDocs(collection(db, 'teams', sourceId, 'roster'))
      .then((snap) => {
        if (cancelled) return;
        const from = snap.docs.map((d) => ({ playerId: d.id, ...d.data() }));
        const next = buildImportRows(from, roster || []);
        setRowsBySource((m) => ({ ...m, [sourceId]: next }));
        // Everyone not already accounted for starts ticked.
        setPicked((p) => {
          const out = { ...p };
          for (const id of defaultSelection(next)) if (!out[id]) out[id] = sourceId;
          return out;
        });
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setRowsBySource((m) => ({ ...m, [sourceId]: [] }));
        setLoading(false);
        notify('Could not load that roster', e.message);
      });

    return () => { cancelled = true; };
  }, [sourceId]);

  const toggle = useCallback((playerId) => {
    setPicked((p) => {
      const out = { ...p };
      if (out[playerId]) delete out[playerId];
      else out[playerId] = sourceId;
      return out;
    });
  }, [sourceId]);

  // "All" means everyone this team can still contribute — players already on
  // the destination, or already picked from another team, aren't choices.
  const selectable = useMemo(
    () => (rows || []).filter((r) => !rowIsLocked(rowState(r, picked, sourceId))),
    [rows, picked, sourceId]);
  const fromThisTeam = useMemo(
    () => selectable.filter((r) => picked[r.playerId]).length, [selectable, picked]);
  const allOn = !!selectable.length && fromThisTeam === selectable.length;

  const toggleAll = useCallback(() => {
    setPicked((p) => {
      const out = { ...p };
      for (const r of selectable) {
        if (allOn) delete out[r.playerId];
        else out[r.playerId] = sourceId;
      }
      return out;
    });
  }, [allOn, selectable, sourceId]);

  const runImport = useCallback(async () => {
    const batches = importsBySource(picked, rowsBySource);
    if (!batches.length) { notify('Pick at least one player.'); return; }
    setBusy(true);

    // One call per source team: the function checks staff on the team it's
    // reading from, so the batches can't be merged.
    let added = 0, failed = 0, invited = 0;
    try {
      for (const batch of batches) {
        const res = await importPlayers({
          fromTeamId: batch.fromTeamId, toTeamId: team.id, players: batch.players,
        });
        added += (res.added || []).length;
        failed += (res.failures || []).length;
        invited += res.invited || 0;
      }
      notify(
        failed ? 'Imported with problems' : 'Players imported',
        importSummary({ added, failed, invited }),
      );
      onImported?.(added);
      onClose?.();
    } catch (e) { notify('Could not import', e.message); }
    setBusy(false);
  }, [picked, rowsBySource, team?.id, onImported, onClose]);

  if (!visible) return null;

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
            ? "Everyone's checked. Uncheck anyone who isn't on this team — they "
              + 'keep their stats and their parents, and their families are '
              + 'invited to join.'
            : 'Pick a team to import players from. You can come back and pick '
              + 'from another before importing.'}
        </Text>

        {/* ---- step 1: which team ------------------------------------- */}
        {!source && (
          <ScrollView style={styles.list}>
            {sources.length === 0 && (
              <Text style={styles.empty}>
                You don't coach another team yet. Once you do, last season's
                roster can be brought over from here.
              </Text>
            )}
            {sources.map((t) => {
              const fromHere = Object.values(picked).filter((id) => id === t.id).length;
              return (
                <Pressable key={t.id} onPress={() => setSourceId(t.id)} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{t.name}</Text>
                    <Text style={styles.meta}>
                      {t.season || 'No season set'}
                      {fromHere ? ` · ${fromHere} picked` : ''}
                    </Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ---- step 2: which players ----------------------------------- */}
        {source && loading && (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        )}

        {source && !loading && rows?.length === 0 && (
          <Text style={styles.empty}>That team has no players to import.</Text>
        )}

        {source && !loading && !!rows?.length && (
          <>
            <View style={styles.listHead}>
              <Text style={styles.count}>
                {fromThisTeam} of {selectable.length} selected
              </Text>
              {selectable.length > 0 && (
                <Pressable onPress={toggleAll} hitSlop={6}>
                  <Text style={styles.link}>{allOn ? 'Clear all' : 'Select all'}</Text>
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.list}>
              {rows.map((r) => {
                const state = rowState(r, picked, sourceId);
                const locked = rowIsLocked(state);
                const on = state === ROW_STATE.ON;
                return (
                  <Pressable
                    key={r.playerId}
                    onPress={() => !locked && toggle(r.playerId)}
                    disabled={locked}
                    style={[styles.row, on && styles.rowOn, locked && styles.rowOff]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: locked }}
                    accessibilityLabel={`${r.firstName} ${r.lastName}`.trim()}
                  >
                    <View style={[styles.box, on && styles.boxOn]}>
                      {on && <Text style={styles.tick}>✓</Text>}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{r.firstName} {r.lastName}</Text>
                      {/* Last season's number identifies the row and nothing
                          more — it is not what gets imported. */}
                      <Text style={styles.meta}>
                        {state === ROW_STATE.ALREADY_HERE ? 'Already on this roster'
                         : state === ROW_STATE.PICKED_ELSEWHERE ? 'Already picked from another team'
                         : [r.leftSourceTeam ? `Left ${source.name}` : null,
                            r.formerJersey != null ? `Wore #${r.formerJersey}` : null,
                            r.primaryPosition || null].filter(Boolean).join(' · ')
                           || 'No position'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.note}>
              Imported players keep their stats, career history and parent
              links. Numbers start blank — set them on the roster.
            </Text>
          </>
        )}

        <View style={styles.actions}>
          {/* Back only exists when there's another team to go back to. */}
          {source && sources.length > 1 && (
            <Pressable onPress={() => setSourceId(null)} style={[styles.cta, styles.ctaGhost]}>
              <Text style={[styles.ctaText, { color: colors.pencil }]}>ANOTHER TEAM</Text>
            </Pressable>
          )}
          {!source && (
            <Pressable onPress={onClose} style={[styles.cta, styles.flex, styles.ctaGhost]}>
              <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
            </Pressable>
          )}
          <Pressable onPress={runImport} disabled={busy || !pickedCount}
            style={[styles.cta, styles.flex, !pickedCount && styles.ctaOff]}>
            {busy
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.ctaText}>IMPORT {pickedCount || ''}</Text>}
          </Pressable>
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
  rowOff: { opacity: 0.45 },
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
