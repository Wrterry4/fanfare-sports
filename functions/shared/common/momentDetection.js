/**
 * momentDetection.js — Which new event, if any, deserves a banner.
 *
 * Split from GameDayScreen so the decision is testable without mounting a
 * screen. Takes `describeMoment` as a parameter rather than importing a
 * sport pack directly — this file doesn't need to know baseball or
 * basketball exist, only that some function can look at an event and say
 * whether it's a moment.
 *
 * ── Why a "last seen" watermark ──────────────────────────────────────────
 *
 * Opening a game already in progress must NOT replay every home run that's
 * already happened — that would mean scrolling through history, or someone
 * refreshing the page, seeing a burst of banners for things that happened
 * an hour ago. The watermark is `null` on first load specifically so the
 * caller can tell "just synced" apart from "nothing new happened": the first
 * call only records where the log currently ends, and produces no moment at
 * all, regardless of what's already in it.
 */

/**
 * @param events        the current event log (voided entries are ignored)
 * @param lastSeenSeq   the highest seq already accounted for, or null on
 *                      first load
 * @param describeMoment(event, state, extras) → {text, tone} | null
 * @param state         passed through to describeMoment unchanged
 * @param extras        passed through to describeMoment unchanged
 * @returns { moment, seq } — `seq` is what the caller should remember as
 *          lastSeenSeq going forward; `moment` is null unless something new
 *          and notable arrived
 */
export function findNewMoment(events, lastSeenSeq, describeMoment, state, extras) {
  const live = (events || []).filter((e) => e && !e.voided);
  const maxSeq = live.reduce((m, e) => Math.max(m, e.seq || 0), 0);

  // First load: adopt the current end of the log as the baseline, but never
  // celebrate anything already in it.
  if (lastSeenSeq == null) return { moment: null, seq: maxSeq };

  const arrived = live
    .filter((e) => (e.seq || 0) > lastSeenSeq)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));

  if (arrived.length === 0) return { moment: null, seq: lastSeenSeq };

  // If several notable events landed between renders — a rapid correction
  // and replay, say — the most recent one is what the banner should reflect;
  // showing three banners in a row for events that already happened would
  // read as broken, not exciting.
  let moment = null;
  for (const event of arrived) {
    const described = describeMoment?.(event, state, extras);
    if (described) moment = described;
  }

  return { moment, seq: Math.max(lastSeenSeq, maxSeq) };
}
