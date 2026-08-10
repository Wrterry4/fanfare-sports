/**
 * Scoreboard.jsx — The sticky strip.
 *
 * Stays pinned at the top of the scroll container. It's the thing a parent
 * glances at between pitches, and it should never require scrolling to find.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, text, spacing } from '../theme/tokens.js';

function Pips({ label, filled, total, danger }) {
  return (
    <View style={styles.pipSet}>
      <Text style={styles.pipLabel}>{label}</Text>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            i < filled && (danger ? styles.pipOut : styles.pipOn),
          ]}
        />
      ))}
    </View>
  );
}

function TeamRow({ name, score, batting }) {
  return (
    <View style={styles.teamRow}>
      <View style={styles.nameWrap}>
        {batting && <View style={styles.arrow} />}
        <Text style={[styles.teamName, batting && styles.teamNameActive]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

function Scoreboard({ state, awayName, homeName }) {
  const battingSide = state.isTop ? 'away' : 'home';
  const half = state.isTop ? 'TOP' : 'BOT';
  const label = state.status === 'final'
    ? (state.endReason === 'mercy' ? 'FINAL · MERCY' : 'FINAL')
    : `${half} ${state.inning}`;

  return (
    <View style={styles.board}>
      <View style={styles.teams}>
        <TeamRow name={awayName} score={state.score.away} batting={battingSide === 'away'} />
        <TeamRow name={homeName} score={state.score.home} batting={battingSide === 'home'} />
      </View>

      <View style={styles.situation}>
        <Text style={styles.inning}>{label}</Text>
        <View style={styles.pips}>
          {/* Three ball pips and two strike pips: the fourth ball and third
              strike resolve the at-bat, so they're never displayed. */}
          <Pips label="B" filled={state.balls} total={3} />
          <Pips label="S" filled={state.strikes} total={2} />
          <Pips label="O" filled={state.outs} total={2} danger />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingTop: 11,
    paddingBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.navy,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 20,
  },
  teams: { flex: 1, gap: 3 },
  teamRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  nameWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  arrow: {
    width: 0, height: 0, marginRight: 7,
    borderLeftWidth: 5, borderLeftColor: colors.clay,
    borderTopWidth: 4, borderTopColor: 'transparent',
    borderBottomWidth: 4, borderBottomColor: 'transparent',
  },
  teamName: { ...text.teamName, color: '#A8B0C6', flexShrink: 1 },
  teamNameActive: { color: colors.white },
  score: { ...text.scoreboardNumber, color: colors.white, marginLeft: 14 },

  situation: { alignItems: 'flex-end', gap: 5, marginLeft: 10 },
  inning: { ...text.inning, color: colors.white },
  pips: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  pipSet: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  pipLabel: { ...text.label, fontSize: 9, color: '#7E88A3', marginRight: 2 },
  pip: {
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#5A6486',
  },
  pipOn: { backgroundColor: colors.white, borderColor: colors.white },
  pipOut: { backgroundColor: colors.out, borderColor: colors.out },
});

export default memo(Scoreboard);
