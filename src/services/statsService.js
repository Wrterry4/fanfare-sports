/**
 * statsService.js — Reading a player's stats.
 *
 * Three sources, deliberately separate documents:
 *
 *   seasons/{teamId}_{season}   this team, this season
 *   career/totals               every season merged, across every team
 *   pitchingAppearances/{id}    one row per outing, for rest days
 *
 * All three are gated by canSeeStats() rather than canSeePlayer(), so any
 * member of a team the player is rostered on can read them — while the
 * /players document itself (birth year, guardians, media consent) stays
 * restricted. Nothing here reads that document, which is what makes the wider
 * access safe.
 */

import {
  db, doc, collection, getDoc, getDocs, onSnapshot, query, where,
} from './firebase';
import { call } from './callable.js';

export const seasonKeyFor = (teamId, season) => `${teamId}_${season}`;

/** This team's season line. Live, so a finalized game updates the card. */
export function subscribeSeasonStats(playerId, teamId, season, cb) {
  if (!playerId || !teamId || !season) { cb(null); return () => {}; }
  return onSnapshot(
    doc(db, 'players', playerId, 'seasons', seasonKeyFor(teamId, season)),
    (snap) => cb(snap.exists() ? snap.data() : null),
    // Absent is normal — a player who hasn't finished a game yet has no
    // season document. Denied lands here too and is handled the same way, so
    // the card shows "no stats yet" rather than an error a parent can't act
    // on.
    () => cb(null)
  );
}

/** Career totals across every team the player has ever been on. */
export function subscribeCareerStats(playerId, cb) {
  if (!playerId) { cb(null); return () => {}; }
  return onSnapshot(
    doc(db, 'players', playerId, 'career', 'totals'),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => cb(null)
  );
}

/**
 * Every season row, so the card can show a history rather than one line.
 *
 * An unconstrained list is allowed here because the rule is evaluated per
 * document against canSeeStats(playerId) — the player id is in the path, not
 * in a field, so every document in this collection resolves the same way.
 */
export async function fetchAllSeasons(playerId) {
  if (!playerId) return [];
  try {
    const snap = await getDocs(collection(db, 'players', playerId, 'seasons'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

/**
 * Recent outings, newest first. Rest days are computed at finalize and stored,
 * so this doesn't recompute — a coach and a parent must see the same number.
 */
export async function fetchPitchingAppearances(playerId, limitTo = 10) {
  if (!playerId) return [];
  try {
    const snap = await getDocs(
      collection(db, 'players', playerId, 'pitchingAppearances'));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => toDate(b.date) - toDate(a.date))
      .slice(0, limitTo);
  } catch { return []; }
}

const toDate = (v) => v?.toDate?.() ?? (v ? new Date(v) : new Date(0));

/**
 * Whether this player is currently resting.
 *
 * Derived from the most recent appearance rather than summed, because rest
 * days don't stack — the latest outing sets the date they're eligible again.
 */
export function restStatus(appearances) {
  if (!appearances?.length) return null;
  const latest = appearances[0];
  const eligible = toDate(latest.eligibleAgain);
  const now = new Date();
  const msLeft = eligible - now;
  const daysLeft = Math.ceil(msLeft / 86400000);
  return {
    pitches: latest.pitches,
    lastThrown: toDate(latest.date),
    eligibleAgain: eligible,
    resting: msLeft > 0,
    daysLeft: daysLeft > 0 ? daysLeft : 0,
    exceededLimit: !!latest.exceededLimit,
  };
}

/** Must match STATS_ACCESS_VERSION in functions/index.js. */
export const STATS_ACCESS_VERSION = 2;

export const backfillStatsAccess = (teamId) =>
  call('backfillStatsAccess', { teamId });

/**
 * Repairs a team's access lists and member names, once, without being asked.
 *
 * Stats sync automatically — two triggers keep the lists current on every
 * player and membership write. What they can't do is fire for data that
 * already exists and isn't changing, so anything created before those triggers
 * worked keeps a null list and nothing ever repairs it.
 *
 * Asking a coach to press a button for that was wrong: they have no way to
 * know whether their team is affected. This runs on its own when a staff
 * member opens the team, and the version stamp on the team document means it
 * happens exactly once.
 *
 * Failures are swallowed on purpose. This is a repair, not a feature — a coach
 * opening the roster should never see an error about a maintenance task.
 */
export async function ensureStatsAccess(team, isStaff) {
  if (!isStaff || !team?.id) return false;
  if (team.statsAccessVersion >= STATS_ACCESS_VERSION) return false;
  try {
    await backfillStatsAccess(team.id);
    return true;
  } catch {
    return false;
  }
}
