/**
 * PollBubble.jsx — A poll, in the thread where it was asked.
 *
 * ── Results are always visible ─────────────────────────────────────────────
 *
 * Most polls hide the tally until you vote, to stop the first answers
 * anchoring the rest. That's a good rule for a public poll and the wrong one
 * for a team: the question is usually "can we field nine on Saturday", and a
 * parent deciding whether to move something around needs to see how many are
 * already in. Hiding it would make people vote to find out, which is worse
 * data than the anchoring it prevents.
 *
 * The bar is drawn behind the label rather than beside it, so a row is one
 * tap target at any width — a separate bar and a separate button is two things
 * to miss with a thumb.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { subscribeVotes, castVote, closePoll, reopenPoll } from '../services/pollService.js';
import { tally, myChoices, toggleChoice, isClosed, voteLabel } from '../shared/polls.js';
import { notify } from '../utils/confirm.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export default function PollBubble({ message, teamId, channel, user, canManage }) {
  const poll = message.poll;
  const [votes, setVotes] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeVotes(
    { teamId, channel, messageId: message.id }, setVotes,
  ), [teamId, channel, message.id]);

  const closed = isClosed(poll);
  const mine = useMemo(() => myChoices(votes, user?.uid), [votes, user?.uid]);
  const { rows, voters } = useMemo(() => tally(poll, votes), [poll, votes]);

  const vote = async (optionId) => {
    if (closed || busy) return;
    setBusy(true);
    try {
      await castVote({
        teamId, channel, messageId: message.id, user,
        optionIds: toggleChoice(mine, optionId, poll.multi),
      });
    } catch (e) { notify('Could not vote', e.message); }
    setBusy(false);
  };

  const toggleClosed = async () => {
    try {
      const args = { teamId, channel, messageId: message.id };
      await (closed ? reopenPoll(args) : closePoll(args));
    } catch (e) { notify('Could not update', e.message); }
  };

  if (!poll) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>
        POLL{poll.multi ? ' · PICK ANY' : ''}{closed ? ' · CLOSED' : ''}
      </Text>
      <Text style={styles.question}>{poll.question}</Text>

      {rows.map((row) => {
        const picked = mine.includes(row.id);
        return (
          <Pressable
            key={row.id}
            onPress={() => vote(row.id)}
            disabled={closed}
            style={[styles.row, picked && styles.rowMine, closed && styles.rowClosed]}
            accessibilityRole="button"
            accessibilityState={{ selected: picked, disabled: closed }}
            accessibilityLabel={`${row.label}, ${row.count} of ${voters}`}
          >
            {/* The fill is the result; the row is the button. */}
            <View style={[styles.fill, { width: `${row.pct}%` },
                          picked && styles.fillMine]} />
            <View style={styles.rowInner}>
              <Text style={[styles.optionLabel, picked && styles.optionLabelMine]}
                    numberOfLines={2}>
                {picked ? '✓ ' : ''}{row.label}
              </Text>
              <Text style={[styles.count, row.leading && styles.countLeading]}>
                {row.count}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {/* Who, not just how many — the part a coach is actually reading for. */}
      {voters > 0 && (
        <View style={styles.names}>
          {rows.filter((r) => r.names.length).map((r) => (
            <Text key={r.id} style={styles.nameLine} numberOfLines={2}>
              <Text style={styles.nameLabel}>{r.label}: </Text>
              {r.names.join(', ')}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.meta}>{voteLabel(voters)}</Text>
        {canManage && (
          <Pressable onPress={toggleClosed} hitSlop={8}>
            <Text style={styles.action}>{closed ? 'REOPEN' : 'CLOSE POLL'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, maxWidth: '92%',
    alignSelf: 'flex-start', marginBottom: spacing.sm,
  },
  kicker: { ...text.label, fontSize: 9.5, color: colors.primary, marginBottom: 4 },
  question: {
    fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy,
    marginBottom: spacing.sm, lineHeight: 20,
  },
  row: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    marginBottom: 6, overflow: 'hidden', backgroundColor: '#FDFDFC',
  },
  rowMine: { borderColor: colors.primary },
  rowClosed: { opacity: 0.85 },
  fill: {
    ...StyleSheet.absoluteFillObject, right: undefined,
    backgroundColor: '#EEF2FF',
  },
  fillMine: { backgroundColor: '#DCE6FF' },
  rowInner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: 11, paddingVertical: 10,
  },
  optionLabel: { ...text.body, fontSize: 13.5, color: colors.navy, flex: 1 },
  optionLabelMine: { fontWeight: '700' },
  count: { ...text.bodyStrong, fontSize: 13, color: colors.pencil, minWidth: 18, textAlign: 'right' },
  countLeading: { color: colors.navy },
  names: { marginTop: 2, marginBottom: 4 },
  nameLine: { ...text.body, fontSize: 11.5, color: colors.pencil, lineHeight: 16 },
  nameLabel: { fontWeight: '700', color: colors.navy },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 4, gap: spacing.sm,
  },
  meta: { ...text.body, fontSize: 11.5, color: colors.pencil },
  action: { ...text.buttonSecondary, fontSize: 10, color: colors.primary, letterSpacing: 0.6 },
});
