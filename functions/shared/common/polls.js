/**
 * polls.js — A question with buttons, posted into team chat.
 *
 * ── Why a message and not its own screen ───────────────────────────────────
 *
 * "Who can make a Saturday scrimmage?" is a thing a coach says to the team.
 * Saying it in the place the team already talks means no new tab to check, no
 * notification anyone has to opt into, and no explaining where polls live.
 * A poll is a message with buttons, and it sits in the thread where it was
 * asked.
 *
 * The cost is that a poll scrolls away like any other message. That's the
 * right trade for an availability question, which is answered in a day and
 * then irrelevant. It is the WRONG trade for a snack rota, which is why that
 * one lives on the schedule instead — see shared/signups.js.
 *
 * ── Votes are documents, not an array on the poll ──────────────────────────
 *
 * One document per voter, id = their uid. Two parents answering at the same
 * moment can't clobber each other, changing your mind is a write to your own
 * document, and the rule "you may only write your own vote" is expressible in
 * one line. An array field would need a transaction for every vote and a rule
 * that can't actually be written.
 */

export const MAX_OPTIONS = 8;
export const MAX_QUESTION = 200;
export const MAX_OPTION_LABEL = 60;

/**
 * Build the poll payload for a message document.
 *
 * Option ids are positional (`opt-1`) rather than derived from the label:
 * a coach fixing a typo in "Saturaday" must not orphan the votes already
 * cast for it.
 */
export function newPoll({ question, options, multi = false, closesAt = null }) {
  const q = (question || '').trim().slice(0, MAX_QUESTION);
  if (!q) throw new Error('Give the poll a question.');

  const cleaned = (options || [])
    .map((o) => (o ?? '').toString().trim().slice(0, MAX_OPTION_LABEL))
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);

  if (cleaned.length < 2) throw new Error('A poll needs at least two options.');

  return {
    question: q,
    options: cleaned.map((label, i) => ({ id: `opt-${i + 1}`, label })),
    multi: !!multi,
    closesAt: closesAt || null,
    closed: false,
  };
}

/** Closed by the coach, or past its own deadline. */
export function isClosed(poll, now = Date.now()) {
  if (!poll) return false;
  if (poll.closed) return true;
  const at = toMillis(poll.closesAt);
  return at ? at <= now : false;
}

const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime() || 0;
  if (typeof v.toMillis === 'function') return v.toMillis() || 0;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
};

/** What this person has picked so far. Never null — an empty array is "none". */
export const myChoices = (votes, uid) =>
  (votes || []).find((v) => v.id === uid)?.optionIds || [];

/**
 * Tapping an option.
 *
 * Single-choice replaces; tapping your own answer again clears it, because
 * "I clicked the wrong one and there's no way back" is the complaint every
 * poll without this gets.
 */
export function toggleChoice(current, optionId, multi) {
  const has = (current || []).includes(optionId);
  if (!multi) return has ? [] : [optionId];
  return has ? current.filter((id) => id !== optionId) : [...(current || []), optionId];
}

/**
 * Results, ready to render.
 *
 * Percentages are of VOTERS, not of votes: in a multi-choice poll the columns
 * deliberately sum past 100, because "6 of 10 people can do Saturday" is the
 * question a coach is asking, and normalising it against total picks would
 * answer a different one.
 */
export function tally(poll, votes) {
  const options = poll?.options || [];
  const cast = (votes || []).filter((v) => (v.optionIds || []).length > 0);
  const voters = cast.length;

  const counts = new Map(options.map((o) => [o.id, 0]));
  const names = new Map(options.map((o) => [o.id, []]));

  for (const v of cast) {
    for (const id of v.optionIds || []) {
      if (!counts.has(id)) continue;      // an option deleted after a vote
      counts.set(id, counts.get(id) + 1);
      if (v.name) names.get(id).push(v.name);
    }
  }

  const rows = options.map((o) => {
    const count = counts.get(o.id) || 0;
    return {
      ...o,
      count,
      pct: voters ? Math.round((count / voters) * 100) : 0,
      // Who picked what is not a secret on a team, and it's the part a coach
      // needs: a count of five doesn't say which five to expect on Saturday.
      names: names.get(o.id) || [],
    };
  });

  const most = Math.max(0, ...rows.map((r) => r.count));
  return {
    rows: rows.map((r) => ({ ...r, leading: voters > 0 && r.count === most && r.count > 0 })),
    voters,
  };
}

/** "8 votes" / "1 vote" / "No votes yet". */
export const voteLabel = (voters) =>
  voters === 0 ? 'No votes yet' : `${voters} vote${voters === 1 ? '' : 's'}`;

/** The option with the most votes, or null on a tie or an empty poll. */
export function winner(poll, votes) {
  const { rows, voters } = tally(poll, votes);
  if (!voters) return null;
  const leaders = rows.filter((r) => r.leading);
  return leaders.length === 1 ? leaders[0] : null;
}
