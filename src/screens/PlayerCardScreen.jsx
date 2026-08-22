/**
 * PlayerCardScreen.jsx — One player's numbers.
 *
 * Readable by everyone on the team. That's a product decision, not an
 * oversight: the scorebook is shared, so the card is too. What stays private
 * is the player RECORD — birth year, guardians, media consent — which lives on
 * /players and is never read here. This screen is built entirely from the team
 * roster entry (name, jersey, position) and the stat subcollections.
 *
 * ── What leads ──────────────────────────────────────────────────────────────
 *
 * Today first, then this season, then career.
 *
 * At 6U a season average is mostly noise — .400 off twelve at-bats swings a
 * hundred points on one ground ball. "2-for-3 on Saturday" is the thing a
 * grandparent five hundred miles away actually wants, and it's true the moment
 * the game ends. Career sits last: it's the long arc, not today's news.
 *
 * Pitching only appears when the player has thrown. A card full of empty
 * pitching rows for a six-year-old outfielder is noise.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';

import {
  subscribeSeasonStats, subscribeCareerStats,
  fetchPitchingAppearances, restStatus,
} from '../services/statsService.js';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { sportForTeam } from '../sports/registry.js';

/**
 * @param player   roster entry: playerId, firstName, lastName, jerseyNumber
 * @param team     active team — supplies teamId and season for the season key
 * @param liveLine optional batting line for a game in progress, which finalize
 *                 hasn't folded into the season document yet
 */
export default function PlayerCardScreen({ visible, player, team, liveLine, onClose }) {
  const [season, setSeason] = useState(null);
  const [career, setCareer] = useState(null);
  const [appearances, setAppearances] = useState([]);
  const [loading, setLoading] = useState(true);

  const playerId = player?.playerId;

  useEffect(() => {
    if (!visible || !playerId) return undefined;
    setLoading(true);
    const unsubs = [
      subscribeSeasonStats(playerId, team?.id, team?.season, (d) => {
        setSeason(d); setLoading(false);
      }),
      subscribeCareerStats(playerId, setCareer),
    ];
    fetchPitchingAppearances(playerId).then(setAppearances);
    return () => unsubs.forEach((u) => u && u());
  }, [visible, playerId, team?.id, team?.season]);

  const rest = useMemo(() => restStatus(appearances), [appearances]);

  const sport = sportForTeam(team);
  const sections = useMemo(
    () => sport.describeStatCard?.({ season, career }) ?? [],
    [sport, season, career]);
  const todayLine = useMemo(
    () => sport.describeTodayLine?.(liveLine) ?? null,
    [sport, liveLine]);

  if (!visible || !player) return null;


  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.head}>
          <View style={styles.jersey}>
            <Text style={styles.jerseyText}>{player.jerseyNumber ?? '-'}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {player.firstName} {player.lastName}
            </Text>
            <Text style={styles.meta}>
              {[player.primaryPosition, team?.name, team?.season]
                .filter(Boolean).join(' \u00b7 ')}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyPad}>
          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {/* Today, when a game is in progress. Comes from the live event log
              rather than the season document, which only updates on finalize. */}
          {todayLine && (
            <Section label="TODAY">
              <View style={styles.bigRow}>
                {todayLine.map((b) => (
                  <Big key={b.label} value={b.value} label={b.label} />
                ))}
              </View>
            </Section>
          )}

          {rest?.resting && (
            <View style={styles.restBanner}>
              <Text style={styles.restTitle}>
                Resting - eligible in {rest.daysLeft} day{rest.daysLeft === 1 ? '' : 's'}
              </Text>
              <Text style={styles.restSub}>
                Threw {rest.pitches} pitches on {rest.lastThrown.toLocaleDateString(
                  undefined, { month: 'short', day: 'numeric' })}
                {rest.exceededLimit ? ' \u00b7 over the outing limit' : ''}
              </Text>
            </View>
          )}

          {!loading && sections.length === 0 && (
            <Text style={styles.empty}>
              No stats yet. Numbers appear here once a game is finished.
            </Text>
          )}

          {/* Whatever the sport says belongs here. Baseball sends batting,
              pitching, fielding and career; basketball sends scoring and
              career. This screen no longer knows the difference. */}
          {sections.map((sec) => (
            <Section key={sec.key} label={sec.label}>
              {sec.headline?.length > 0 && (
                <View style={styles.bigRow}>
                  {sec.headline.map((b) => (
                    <Big key={b.label} value={b.value} label={b.label} />
                  ))}
                </View>
              )}
              {sec.grid?.length > 0 && <StatGrid rows={sec.grid} />}
              {sec.note && <Text style={styles.sectionNote}>{sec.note}</Text>}
            </Section>
          ))}

        </ScrollView>

        <Pressable onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>DONE</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Big({ value, label }) {
  return (
    <View style={styles.big}>
      <Text style={styles.bigValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

/** Three across. Zeroes are shown rather than hidden - 0 RBI is a fact. */
function StatGrid({ rows }) {
  const shown = rows.filter(([, v]) => v !== undefined && v !== null);
  return (
    <View style={styles.grid}>
      {shown.map(([label, value]) => (
        <View key={label} style={styles.cell}>
          <Text style={styles.cellValue}>{value ?? 0}</Text>
          <Text style={styles.cellLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// Number formatting lives in each sport's presenter now — baseball drops the
// leading zero on an average, basketball wants percentages. Neither belongs
// in a screen that renders both.

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.chalk, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 34,
    maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  flex: { flex: 1 },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  jersey: {
    width: 46, height: 46, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  jerseyText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 19, color: '#FFF' },
  name: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 19, color: colors.navy },
  meta: { ...text.body, fontSize: 12, color: colors.pencil, marginTop: 2 },

  body: { flexGrow: 0 },
  bodyPad: { paddingBottom: spacing.md },
  loading: { paddingVertical: 30, alignItems: 'center' },
  empty: {
    ...text.body, color: colors.pencil, textAlign: 'center',
    paddingVertical: 34, lineHeight: 19,
  },

  section: { marginBottom: spacing.lg },
  sectionNote: {
    ...text.body, fontSize: 11, color: colors.pencil,
    marginTop: 6, lineHeight: 15, fontStyle: 'italic',
  },
  sectionLabel: { ...text.label, fontSize: 9, color: colors.pencil, marginBottom: spacing.sm },
  subLabel: { ...text.label, fontSize: 8.5, color: colors.pencil, marginTop: spacing.md, marginBottom: 6 },

  bigRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  big: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center',
    ...shadow.card,
  },
  bigValue: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 20, color: colors.navy },
  bigLabel: { ...text.label, fontSize: 8, color: colors.pencil, marginTop: 3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    flexBasis: '31.5%', flexGrow: 1,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center',
  },
  cellValue: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 14.5, color: colors.navy },
  cellLabel: { ...text.label, fontSize: 7.5, color: colors.pencil, marginTop: 2 },

  restBanner: {
    backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#E8D9AE',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  restTitle: { ...text.bodyStrong, fontSize: 13, color: colors.navy },
  restSub: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 3, lineHeight: 16 },

  outing: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 8,
    marginBottom: 5,
  },
  outingDate: { ...text.label, fontSize: 9, color: colors.pencil, width: 52 },
  outingMain: { ...text.bodyStrong, fontSize: 13, color: colors.navy, flex: 1 },
  outingRest: { ...text.label, fontSize: 8.5, color: colors.pencil },
  outingOver: { color: colors.out },

  done: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  doneText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
});
