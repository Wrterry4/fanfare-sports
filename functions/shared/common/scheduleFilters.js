/**
 * scheduleFilters.js — Upcoming, past, and calendar grouping.
 *
 * Pure and Firestore-agnostic on purpose: it accepts anything with a `.date`
 * (a Firestore Timestamp, a JS Date, or a date string) and a `.status`, and
 * does its own conversion. That's what makes it testable without a fake
 * Timestamp object, and reusable if a calendar view ever shows up somewhere
 * else.
 */

/** Firestore Timestamp, JS Date, or a date string — whatever shows up. */
export const toDate = (d) => d?.toDate?.() ?? (d ? new Date(d) : null);

/**
 * 'YYYY-MM-DD' in LOCAL time.
 *
 * Not toISOString().slice(0,10) — that's UTC, and a 9pm game on the US west
 * coast would land on tomorrow's date on the calendar grid. Every date
 * comparison in this file goes through this one function so they can't drift
 * apart from each other.
 */
export const dateKey = (d) => {
  const date = d instanceof Date ? d : toDate(d);
  if (!date || isNaN(date)) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Upcoming vs past, plus the sort order that makes each useful.
 *
 * Upcoming sorts soonest-first — the next thing on the calendar belongs at
 * the top. Past sorts most-recent-first — "how did we do Saturday" is a more
 * common question than "how did we do in March."
 *
 * A live game counts as upcoming regardless of its scheduled time, so a game
 * that started five minutes late doesn't flip to "past" while it's still
 * being played. Everything else is a straight time comparison: once the
 * scheduled moment has gone by, it's past — including a game nobody remembered
 * to start, which is exactly the one a coach most needs to notice.
 */
export function splitUpcomingPast(events, now = new Date()) {
  const upcoming = [];
  const past = [];

  for (const e of events || []) {
    const d = toDate(e?.date);
    const isPast = e?.status !== 'live' && d && d < now;
    (isPast ? past : upcoming).push(e);
  }

  const time = (e) => toDate(e?.date)?.getTime() ?? 0;
  upcoming.sort((a, b) => time(a) - time(b));
  past.sort((a, b) => time(b) - time(a));

  return { upcoming, past };
}

/**
 * Every event, keyed by the local day it falls on.
 *
 * Used for the calendar's dots (which days have something) and for the list
 * shown under a tapped date. One pass produces both.
 */
export function groupEventsByDate(events) {
  const byDate = {};
  for (const e of events || []) {
    const key = dateKey(e?.date);
    if (!key) continue;
    (byDate[key] ||= []).push(e);
  }
  return byDate;
}
